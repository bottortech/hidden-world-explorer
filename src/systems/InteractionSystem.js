import * as THREE from 'three';

// Reusable interaction registry: proximity, look-at, and click events.
//
// Register an entry with `add({ object, onClick, onLook, onProximity, proximityRadius })`.
//
//   onClick(entry)
//     Fired when the player clicks while looking at `object` within maxLookDist.
//
//   onLook(entry, hit)
//     Fired every frame while `object` is the center-screen raycast target.
//
//   onProximity({ entry, distance, inside, justEntered, justLeft })
//     Fired every frame for any registered object regardless of look state.
//     `inside` is true when the player is within `proximityRadius` of the object.
//     `justEntered` / `justLeft` fire on the single frame the boundary is crossed.
//
// To extend: add new event types (e.g. onHover/onLeaveHover) by tracking
// per-entry state in update() and calling the new callbacks accordingly.
export class InteractionSystem {
  constructor(camera, domElement) {
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.center = new THREE.Vector2(0, 0);

    // Max distance the look-ray will hit. Beyond this, objects can't be clicked.
    this.maxLookDist = 20;

    this.entries = [];
    this.currentLookTarget = null;

    this.crosshair = document.getElementById('crosshair');
    this.lookPrompt = document.getElementById('lookPrompt');

    domElement.addEventListener('click', () => this._handleClick());
  }

  add(entry) {
    const full = { _wasInside: false, ...entry };
    this.entries.push(full);
    return full;
  }

  remove(object) {
    this.entries = this.entries.filter((e) => e.object !== object);
  }

  // Internal: list of meshes used for raycasting.
  _hitTargets() {
    return this.entries
      .filter((e) => (e.onClick || e.onLook) && e.object)
      .map((e) => e.object);
  }

  _handleClick() {
    if (!this.currentLookTarget) return;
    const entry = this.entries.find((e) => e.object === this.currentLookTarget);
    if (entry?.onClick) entry.onClick(entry);
  }

  update(/* dt */) {
    // Raycast from screen center to find what the player is looking at.
    this.raycaster.setFromCamera(this.center, this.camera);
    const hits = this.raycaster.intersectObjects(this._hitTargets(), false);
    const hit = hits.find((h) => h.distance <= this.maxLookDist);
    this.currentLookTarget = hit ? hit.object : null;

    // Drive the on-screen prompt + crosshair "hot" state.
    const entry = hit ? this.entries.find((e) => e.object === hit.object) : null;
    const isClickable = !!entry?.onClick;
    this.crosshair?.classList.toggle('has-target', isClickable);
    this.lookPrompt?.classList.toggle('visible', isClickable);

    if (hit) entry?.onLook?.(entry, hit);

    // Proximity pass.
    const playerPos = this.camera.position;
    for (const e of this.entries) {
      if (!e.onProximity || !e.object) continue;
      const dist = e.object.position.distanceTo(playerPos);
      const inside = dist <= (e.proximityRadius ?? 5);
      e.onProximity({
        entry: e,
        distance: dist,
        inside,
        justEntered: inside && !e._wasInside,
        justLeft: !inside && e._wasInside,
      });
      e._wasInside = inside;
    }
  }
}

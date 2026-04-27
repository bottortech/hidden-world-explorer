import * as THREE from 'three';
import { COLORS } from '../utils/colors.js';

// A *visible* trigger zone, marked by a faint ring on the ground. Walking into
// it shifts atmosphere temporarily; walking out restores whatever atmosphere
// was active before entry (so it composes with the pillar's permanent shift).
//
// To extend: chain multiple zones with different shifts, persist a
// "discovered" flag, layer in a sound cue, or spawn entities on entry.
export class PortalZone {
  constructor(scene, movement, world) {
    this.movement = movement;
    this.world = world;

    this.center = new THREE.Vector3(-22, 0, 18);
    this.radius = 7;
    this.inside = false;
    this.savedTarget = null;

    // Faint ring marker so the zone is discoverable from a distance.
    // `fog: false` prevents the ring from being swallowed by fog at range.
    const ringGeo = new THREE.RingGeometry(this.radius - 0.15, this.radius, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: COLORS.portalRing,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.copy(this.center);
    this.ring.position.y = 0.02;
    scene.add(this.ring);

    // Inner disc adds a barely-there glow to suggest depth.
    const discGeo = new THREE.CircleGeometry(this.radius * 0.95, 48);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x6c4d80,
      transparent: true,
      opacity: 0.05,
      fog: false,
    });
    this.disc = new THREE.Mesh(discGeo, discMat);
    this.disc.rotation.x = -Math.PI / 2;
    this.disc.position.copy(this.center);
    this.disc.position.y = 0.015;
    scene.add(this.disc);
  }

  update(/* dt */) {
    // 2D distance check (XZ plane). Cheaper than vector3.distanceTo and
    // ignores player Y so jumping/crouching wouldn't bypass the trigger.
    const p = this.movement.getPosition();
    const dx = p.x - this.center.x;
    const dz = p.z - this.center.z;
    const inside = Math.hypot(dx, dz) < this.radius;

    if (inside !== this.inside) {
      this.inside = inside;
      if (inside) {
        // Snapshot whatever the world is currently targeting so we restore
        // back to *that* on exit, not a hardcoded baseline.
        this.savedTarget = this.world.snapshotTarget();
        this.world.setAtmosphere({
          fogColor: COLORS.portalFog,
          fogDensity: 0.075,
          directionalColor: 0xc89dd6,
        });
      } else if (this.savedTarget) {
        this.world.setAtmosphere(this.savedTarget);
        this.savedTarget = null;
      }
    }

    // Slow pulse so the ring reads as "alive" without being loud.
    const t = performance.now() * 0.001;
    this.ring.material.opacity = 0.14 + Math.sin(t * 1.4) * 0.06;
  }
}

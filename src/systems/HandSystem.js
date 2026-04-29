import * as THREE from 'three';

// First-person right hand attached to the camera. Stays at the bottom-right
// of the player's view, idle by default. Other systems trigger short
// scripted poses:
//
//   hand.tap()        — quick punch-forward (used on every interactive click)
//   hand.holdKey(mesh) → Promise — runs the full key-pickup sequence:
//                        reach forward, key snaps into palm, brief hold,
//                        hand + key fade out, fade back in idle.
//
// Implementation is a simple per-state lerp driven by update(dt). All
// transforms are in camera-local space; HandSystem.update is called by
// Game inside the render loop.

const IDLE_POS = new THREE.Vector3(0.22, -0.28, -0.42);
const REACH_POS = new THREE.Vector3(0.10, -0.18, -0.55);
const IDLE_ROT = new THREE.Euler(-0.4, -0.5, 0.2);
const REACH_ROT = new THREE.Euler(-0.7, -0.2, 0.0);

export class HandSystem {
  constructor(camera) {
    this.camera = camera;
    this.group = buildHandMesh();
    this.group.position.copy(IDLE_POS);
    this.group.rotation.copy(IDLE_ROT);
    this.group.renderOrder = 999; // draw on top of room geometry
    this._setMaterialOpacity(this.group, 1);
    camera.add(this.group);

    // Where to mount a held key — slightly above the palm.
    this.keyAnchor = new THREE.Group();
    this.keyAnchor.position.set(0.0, 0.04, 0.0);
    this.group.add(this.keyAnchor);

    this.state = 'idle';      // 'idle' | 'tapping' | 'holding' | 'fading' | 'hidden' | 'returning'
    this.t = 0;               // seconds elapsed in current state
    this._currentResolve = null;
    this._heldMesh = null;
    this._opacity = 1;
  }

  // Quick reach-and-back used as feedback on every interactable click.
  tap() {
    if (this.state !== 'idle') return;
    this.state = 'tapping';
    this.t = 0;
  }

  // Full pickup choreography. Returns a Promise that resolves once the
  // hand has faded out (caller can chain a room transition off it).
  holdKey(keyMesh) {
    return new Promise((resolve) => {
      this._currentResolve = resolve;
      this._heldMesh = keyMesh;

      // Detach from world, reparent to the hand anchor at the origin.
      keyMesh.parent?.remove(keyMesh);
      keyMesh.position.set(0, 0, 0);
      keyMesh.rotation.set(0, 0, 0);
      keyMesh.scale.setScalar(1);
      this.keyAnchor.add(keyMesh);

      this.state = 'reaching';
      this.t = 0;
    });
  }

  update(dt) {
    this.t += dt;
    switch (this.state) {
      case 'idle':
        this._lerpPose(IDLE_POS, IDLE_ROT, 1, Math.min(1, dt * 6));
        break;
      case 'tapping': {
        // 0..0.18s out, 0.18..0.36s back.
        const halfway = 0.18;
        const u = this.t < halfway ? this.t / halfway : 1 - (this.t - halfway) / halfway;
        const pos = new THREE.Vector3().lerpVectors(IDLE_POS, REACH_POS, easeOut(u));
        const rot = lerpEuler(IDLE_ROT, REACH_ROT, easeOut(u));
        this._setPose(pos, rot, 1);
        if (this.t >= halfway * 2) {
          this.state = 'idle';
          this.t = 0;
        }
        break;
      }
      case 'reaching': {
        // Reach forward over 0.30s.
        const u = clamp01(this.t / 0.30);
        const pos = new THREE.Vector3().lerpVectors(IDLE_POS, REACH_POS, easeOut(u));
        const rot = lerpEuler(IDLE_ROT, REACH_ROT, easeOut(u));
        this._setPose(pos, rot, 1);
        if (u >= 1) { this.state = 'holding'; this.t = 0; }
        break;
      }
      case 'holding': {
        // Brief hold (0.55s) with a tiny vertical bob.
        const bob = Math.sin(this.t * 6) * 0.005;
        const pos = REACH_POS.clone();
        pos.y += bob;
        this._setPose(pos, REACH_ROT, 1);
        if (this.t >= 0.55) { this.state = 'fading'; this.t = 0; }
        break;
      }
      case 'fading': {
        // Fade hand + key over 0.40s.
        const u = clamp01(this.t / 0.40);
        const opacity = 1 - u;
        this._setPose(REACH_POS, REACH_ROT, opacity);
        if (u >= 1) {
          this.state = 'hidden';
          this.t = 0;
          // Drop the held key from the hand (the room will get rid of the
          // mesh entirely; we just stop rendering it on the hand).
          if (this._heldMesh) {
            this.keyAnchor.remove(this._heldMesh);
            this._heldMesh = null;
          }
          // Resolve the pickup Promise — caller (e.g. Game) takes over now.
          this._currentResolve?.();
          this._currentResolve = null;
        }
        break;
      }
      case 'hidden':
        // Stay invisible until restoreIdle() is called.
        this._setPose(IDLE_POS, IDLE_ROT, 0);
        break;
      case 'returning': {
        // Fade back in over 0.4s.
        const u = clamp01(this.t / 0.4);
        this._setPose(IDLE_POS, IDLE_ROT, u);
        if (u >= 1) { this.state = 'idle'; this.t = 0; }
        break;
      }
    }
  }

  // After a room transition, fade the hand back in.
  restoreIdle() {
    if (this.state === 'idle' || this.state === 'returning') return;
    this.state = 'returning';
    this.t = 0;
  }

  _setPose(pos, rot, opacity) {
    this.group.position.copy(pos);
    this.group.rotation.copy(rot);
    if (opacity !== this._opacity) {
      this._setMaterialOpacity(this.group, opacity);
      this._opacity = opacity;
    }
  }

  _lerpPose(targetPos, targetRot, opacity, k) {
    this.group.position.lerp(targetPos, k);
    this.group.rotation.x += (targetRot.x - this.group.rotation.x) * k;
    this.group.rotation.y += (targetRot.y - this.group.rotation.y) * k;
    this.group.rotation.z += (targetRot.z - this.group.rotation.z) * k;
    if (opacity !== this._opacity) {
      this._setMaterialOpacity(this.group, opacity);
      this._opacity = opacity;
    }
  }

  _setMaterialOpacity(root, opacity) {
    root.traverse((node) => {
      if (!node.material) return;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      for (const m of mats) {
        m.transparent = true;
        m.opacity = opacity;
      }
    });
  }
}

// --- Mesh construction ------------------------------------------------------

function buildHandMesh() {
  const skin = new THREE.MeshStandardMaterial({
    color: 0xc09078, roughness: 0.8, flatShading: true,
  });
  const sleeve = new THREE.MeshStandardMaterial({
    color: 0x3a2418, roughness: 1, flatShading: true,
  });

  const group = new THREE.Group();
  group.name = 'firstPersonHand';

  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.022, 0.115), skin);
  group.add(palm);

  // Four fingers in a row along +Z (forward of palm) — slightly curled.
  const fingerLen = 0.06;
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.022, fingerLen), skin,
    );
    const dx = (i - 1.5) * 0.022;
    finger.position.set(dx, -0.005, 0.058 + fingerLen / 2 - 0.01);
    finger.rotation.x = -0.18;
    group.add(finger);
  }

  // Thumb, off the side of the palm.
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.05), skin);
  thumb.position.set(-0.052, 0.0, 0.018);
  thumb.rotation.y = 0.6;
  thumb.rotation.x = -0.1;
  group.add(thumb);

  // Wrist / sleeve cuff
  const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.045, 0.045), sleeve);
  cuff.position.set(0, -0.005, -0.07);
  group.add(cuff);

  return group;
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function easeOut(u) { return 1 - Math.pow(1 - u, 2); }
function lerpEuler(a, b, t) {
  return new THREE.Euler(
    a.x + (b.x - a.x) * t,
    a.y + (b.y - a.y) * t,
    a.z + (b.z - a.z) * t,
  );
}

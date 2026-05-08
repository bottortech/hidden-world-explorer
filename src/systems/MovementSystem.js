import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { clamp } from '../utils/math.js';

// Tunable feel parameters. Tweak these to taste.
const PLAYER_HEIGHT = 1.7;     // camera Y when on the ground (meters)
const PLAYER_RADIUS = 0.4;     // collision circle radius
const WALK_SPEED = 6.0;        // peak velocity (units / second)
const ACCEL = 28;              // ramp toward target velocity
const DAMPING = 7;             // slowdown when no input (per second)

// Camera bob. Phase advances by stride distance, so bob frequency naturally
// matches walking pace and stops cleanly when the player stops.
const BOB_FREQ = 1.6;          // cycles per meter walked
const BOB_AMP_Y = 0.045;       // vertical bob amplitude (m)
const BOB_AMP_SIDE = 0.022;    // sideways sway amplitude (m)

// First-person controller. Uses PointerLockControls for mouse look and
// implements its own velocity/acceleration so movement feels smooth.
//
// Position is tracked separately from the rendered camera position so the
// camera bob is a pure visual offset and does not feed back into movement.
//
// Collision: features can register axis-aligned bounding boxes via
// `addColliders([...])`. After each frame's movement, the player position is
// pushed out of any AABB it overlaps — gives correct wall sliding for free.
export class MovementSystem {
  constructor(camera, domElement) {
    this.camera = camera;
    // Initialize enabled before any listener can reference it. Game.js sets
    // this to false during startup transitions / name prompt and re-enables
    // once the player should be in control.
    this.enabled = true;
    // Use the canvas itself as the pointer-lock target — Safari is picky
    // and silently rejects requestPointerLock() when the element doesn't
    // match the click target.
    this.controls = new PointerLockControls(camera, domElement);

    // Logical player position (feet projected to head height). Camera position
    // = basePos + bob offset, recomputed each frame.
    this.basePos = new THREE.Vector3(camera.position.x, PLAYER_HEIGHT, camera.position.z);
    this.velocity = new THREE.Vector3();
    this.stride = 0; // accumulated horizontal distance — drives bob phase

    // AABB list for collision. Each entry: { minX, maxX, minZ, maxZ }.
    this.colliders = [];

    // Analog input from on-screen joystick (mobile). Range [-1, 1] each.
    // Combined with keyboard input in update().
    this.virtualInput = { forward: 0, right: 0 };

    this.hint = document.getElementById('hint');
    this.crosshair = document.getElementById('crosshair');

    // Listen on document.body so clicks anywhere on the page bubble up and
    // engage pointer lock (overlays use pointer-events:none and let clicks
    // pass through to the canvas, which bubbles up here).
    document.body.addEventListener('click', () => {
      if (!this.enabled) return;
      this.controls.lock();
    });

    // Enter / Space also engage pointer lock — keyboard counts as a user
    // gesture, and this saves the user from having to mouse-click first.
    window.addEventListener('keydown', (e) => {
      if (!this.enabled || this.controls.isLocked) return;
      // Don't hijack Enter/Space when a form input has focus (e.g. name
      // prompt, combo lock).
      const t = document.activeElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.controls.lock();
      }
    });

    this.controls.addEventListener('lock', () => {
      this.hint?.classList.add('hidden');
      this.crosshair?.classList.add('active');
    });
    this.controls.addEventListener('unlock', () => {
      this.hint?.classList.remove('hidden');
      this.crosshair?.classList.remove('active');
    });

    // Keyboard input. Using a Set keeps multi-key combinations clean.
    this.keys = new Set();
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  // Disable controls during focused interactions (inspect view, menus). When
  // disabling we also release pointer lock so the cursor reappears for UI;
  // keys are cleared so a held W doesn't auto-walk on re-enable.
  setEnabled(value) {
    if (this.enabled === value) return;
    this.enabled = value;
    this.keys.clear();
    this.velocity.set(0, 0, 0);
    this.virtualInput.forward = 0;
    this.virtualInput.right = 0;
    if (!value && this.controls.isLocked) this.controls.unlock();
  }

  // On-screen joystick / external analog input. Both axes in [-1, 1].
  setVirtualInput(forward, right) {
    this.virtualInput.forward = forward;
    this.virtualInput.right = right;
  }

  // Other systems/features query player position via this to stay decoupled.
  getPosition() {
    return this.camera.position;
  }

  isLocked() {
    return this.controls.isLocked;
  }

  // Register colliders. Each AABB is a plain object so features can build them
  // without importing THREE types. The list is not cleared between calls.
  addColliders(list) {
    this.colliders.push(...list);
  }

  // Circle-vs-AABB push-out for every registered collider. Called once per
  // sub-step from update(). The "inside the AABB" branch is the safety net:
  // if a frame ever slips through (e.g. tab refocus blew dt to the 0.1 cap),
  // we eject the player back along their motion instead of letting d2 ≈ 0
  // skip resolution and leave them ghosting through walls.
  _resolveCollisions() {
    const r2 = PLAYER_RADIUS * PLAYER_RADIUS;
    for (let i = 0; i < this.colliders.length; i++) {
      const a = this.colliders[i];
      const cx = clamp(this.basePos.x, a.minX, a.maxX);
      const cz = clamp(this.basePos.z, a.minZ, a.maxZ);
      const dx = this.basePos.x - cx;
      const dz = this.basePos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 > 1e-6) {
        if (d2 < r2) {
          const d = Math.sqrt(d2);
          const push = (PLAYER_RADIUS - d) / d;
          this.basePos.x += dx * push;
          this.basePos.z += dz * push;
        }
        continue;
      }
      // Center is inside (or right on the boundary of) the AABB. Push out
      // along the dominant velocity axis so we undo the offending step.
      const vx = this.velocity.x;
      const vz = this.velocity.z;
      const useX = Math.abs(vx) >= Math.abs(vz);
      if (useX && vx !== 0) {
        if (vx > 0) this.basePos.x = a.minX - PLAYER_RADIUS;
        else        this.basePos.x = a.maxX + PLAYER_RADIUS;
      } else if (vz !== 0) {
        if (vz > 0) this.basePos.z = a.minZ - PLAYER_RADIUS;
        else        this.basePos.z = a.maxZ + PLAYER_RADIUS;
      } else {
        // Velocity is zero (got pushed inside by something else). Pick
        // the nearest face.
        const dL = this.basePos.x - a.minX;
        const dR = a.maxX - this.basePos.x;
        const dN = this.basePos.z - a.minZ;
        const dS = a.maxZ - this.basePos.z;
        const m = Math.min(dL, dR, dN, dS);
        if      (m === dL) this.basePos.x = a.minX - PLAYER_RADIUS;
        else if (m === dR) this.basePos.x = a.maxX + PLAYER_RADIUS;
        else if (m === dN) this.basePos.z = a.minZ - PLAYER_RADIUS;
        else                this.basePos.z = a.maxZ + PLAYER_RADIUS;
      }
    }
  }

  update(dt) {
    if (!this.enabled) return;
    // 1. Read input into a local 2D vector (forward / right).
    let f = 0;
    let r = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) f += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) f -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) r += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) r -= 1;

    // Mix in joystick input. Analog values are preserved by clamping
    // (rather than normalizing) the combined vector below.
    f += this.virtualInput.forward;
    r += this.virtualInput.right;

    // Clamp to length 1 so diagonals aren't sqrt(2) faster, while still
    // allowing partial deflection from the joystick to mean partial speed.
    const len = Math.hypot(f, r);
    if (len > 1) {
      f /= len;
      r /= len;
    }

    // 2. Build target velocity in world space using the camera's yaw only
    //    (so looking up/down doesn't change horizontal movement).
    const target = new THREE.Vector3(r, 0, -f).multiplyScalar(WALK_SPEED);
    target.applyEuler(new THREE.Euler(0, this.camera.rotation.y, 0));

    // 3. Move current velocity toward target. This gives a brief ramp-up so
    //    movement feels weighty rather than instantaneous.
    this.velocity.x = approach(this.velocity.x, target.x, ACCEL * dt);
    this.velocity.z = approach(this.velocity.z, target.z, ACCEL * dt);

    // 4. Light damping when no input avoids slidey-feeling stops.
    if (len === 0) {
      const decay = Math.min(1, DAMPING * dt);
      this.velocity.x -= this.velocity.x * decay;
      this.velocity.z -= this.velocity.z * decay;
    }

    // 5. Advance logical position with sub-stepping. Walls are 0.2m thick
    //    and a single 0.1s frame at WALK_SPEED can move 0.6m, enough to
    //    skip clean past a thin AABB. Cap each sub-step to a fraction of
    //    the player radius so the closest-point check below always sees
    //    the player approaching the AABB rather than sitting inside it.
    const stepX = this.velocity.x * dt;
    const stepZ = this.velocity.z * dt;
    const stepLen = Math.hypot(stepX, stepZ);
    const MAX_SUB_STEP = PLAYER_RADIUS * 0.25;
    const subSteps = Math.max(1, Math.ceil(stepLen / MAX_SUB_STEP));
    const subDx = stepX / subSteps;
    const subDz = stepZ / subSteps;
    for (let s = 0; s < subSteps; s++) {
      this.basePos.x += subDx;
      this.basePos.z += subDz;
      this._resolveCollisions();
    }

    // 7. Camera bob. Phase advances by distance so cadence matches gait;
    //    amplitude scales with current speed so bob fades in/out smoothly.
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const speedFrac = clamp(speed / WALK_SPEED, 0, 1);
    this.stride += speed * dt;

    const phase = this.stride * BOB_FREQ * Math.PI * 2;
    const bobY = Math.sin(phase) * BOB_AMP_Y * speedFrac;
    const sway = Math.cos(phase * 0.5) * BOB_AMP_SIDE * speedFrac;

    // Sway is perpendicular to the camera's yaw direction (screen-right).
    const yaw = this.camera.rotation.y;
    const sx = Math.cos(yaw) * sway;
    const sz = -Math.sin(yaw) * sway;

    this.camera.position.set(
      this.basePos.x + sx,
      PLAYER_HEIGHT + bobY,
      this.basePos.z + sz,
    );
  }
}

// Move `current` toward `target` by at most `step`. No overshoot.
function approach(current, target, step) {
  const d = target - current;
  if (Math.abs(d) <= step) return target;
  return current + Math.sign(d) * step;
}

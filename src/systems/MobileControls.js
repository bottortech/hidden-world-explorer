import * as THREE from 'three';

// On-screen controls for touch devices: a virtual joystick (movement),
// a journal button, and drag-anywhere-else camera look. Initialized only
// when the primary pointer is coarse so desktops never see it.
//
// Wiring:
//   - Joystick writes to `movement.setVirtualInput(forward, right)`.
//   - Journal button calls `journal.toggle()`.
//   - Camera look mutates camera.quaternion directly using the same
//     YXZ Euler convention PointerLockControls uses, so the two stay
//     compatible on hybrid devices.
//
// Tap vs drag: a drag past TAP_THRESHOLD pixels suppresses the synthetic
// click event (via preventDefault on touchmove) so spinning the camera
// doesn't accidentally fire interactions on whatever is under the finger
// when it lifts.

const STYLE_ID = 'mobile-controls-style';
const JOY_RADIUS = 50;     // px — visual + max thumb deflection
const TAP_THRESHOLD = 10;  // px — drag distance that disqualifies a tap
const LOOK_SENS = 0.0035;  // radians per pixel (tuned to feel close to desktop)

const CSS = `
body.touch-controls #hint { display: none !important; }
body.touch-controls canvas { touch-action: none; }

#mobile-joystick {
  position: fixed;
  bottom: 28px;
  left: 28px;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgba(20, 14, 32, 0.45);
  border: 2px solid rgba(184, 157, 214, 0.45);
  z-index: 40;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
#mobile-joystick .thumb {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 56px;
  height: 56px;
  margin: -28px 0 0 -28px;
  border-radius: 50%;
  background: rgba(184, 157, 214, 0.6);
  border: 2px solid rgba(232, 216, 255, 0.75);
  pointer-events: none;
  transition: transform 60ms linear;
}

#mobile-journal-btn {
  position: fixed;
  top: 16px;
  right: 16px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(20, 14, 32, 0.75);
  border: 2px solid rgba(184, 157, 214, 0.55);
  color: #e8d8ff;
  font-size: 26px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 55;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
  padding: 0;
}
#mobile-journal-btn:active { background: rgba(40, 28, 60, 0.9); }
`;

export class MobileControls {
  constructor({ movement, journal, camera, canvas }) {
    if (!isTouchPrimary()) return;

    this.movement = movement;
    this.journal = journal;
    this.camera = camera;
    this.canvas = canvas;

    this._joystickId = null;
    this._lookId = null;
    this._lookLastX = 0;
    this._lookLastY = 0;
    this._lookStartX = 0;
    this._lookStartY = 0;
    this._lookDragged = false;
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');

    document.body.classList.add('touch-controls');

    this._injectStyle();
    this._createJoystick();
    this._createJournalButton();
    this._setupTouchLook();
  }

  _injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  _createJoystick() {
    const base = document.createElement('div');
    base.id = 'mobile-joystick';
    base.innerHTML = '<div class="thumb"></div>';
    document.body.appendChild(base);
    this.joystickEl = base;
    this.joystickThumb = base.querySelector('.thumb');

    base.addEventListener('touchstart', (e) => {
      if (this._joystickId !== null) return;
      const t = e.changedTouches[0];
      this._joystickId = t.identifier;
      const rect = base.getBoundingClientRect();
      this._jcx = rect.left + rect.width / 2;
      this._jcy = rect.top + rect.height / 2;
      this._updateJoystick(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });

    base.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this._joystickId) continue;
        this._updateJoystick(t.clientX, t.clientY);
        e.preventDefault();
      }
    }, { passive: false });

    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._joystickId) {
          this._joystickId = null;
          this._resetJoystick();
        }
      }
    };
    base.addEventListener('touchend', end);
    base.addEventListener('touchcancel', end);
  }

  _updateJoystick(clientX, clientY) {
    const dx = clientX - this._jcx;
    const dy = clientY - this._jcy;
    const dist = Math.hypot(dx, dy);
    const r = JOY_RADIUS;
    const clamped = Math.min(dist, r);
    const angle = Math.atan2(dy, dx);
    const tx = Math.cos(angle) * clamped;
    const ty = Math.sin(angle) * clamped;
    this.joystickThumb.style.transform = `translate(${tx}px, ${ty}px)`;
    // Up on screen (-y) means walk forward; right on screen (+x) means strafe right.
    this.movement.setVirtualInput(-ty / r, tx / r);
  }

  _resetJoystick() {
    this.joystickThumb.style.transform = 'translate(0, 0)';
    this.movement.setVirtualInput(0, 0);
  }

  _createJournalButton() {
    const btn = document.createElement('button');
    btn.id = 'mobile-journal-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle journal');
    btn.textContent = '\u{1F4D6}';
    document.body.appendChild(btn);
    // Use touchend rather than click so the body-click handler in
    // MovementSystem (which tries pointer-lock) doesn't also see this tap.
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.journal.toggle();
    }, { passive: false });
    btn.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    // Click fallback for pointer / keyboard activation.
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.journal.toggle();
    });
  }

  _setupTouchLook() {
    const PI_2 = Math.PI / 2;

    this.canvas.addEventListener('touchstart', (e) => {
      if (!this.movement.enabled) return;
      if (this._lookId !== null) return;
      const t = e.changedTouches[0];
      if (this._isInJoystickArea(t.clientX, t.clientY)) return;
      this._lookId = t.identifier;
      this._lookLastX = t.clientX;
      this._lookLastY = t.clientY;
      this._lookStartX = t.clientX;
      this._lookStartY = t.clientY;
      this._lookDragged = false;
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (this._lookId === null) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== this._lookId) continue;
        const dx = t.clientX - this._lookLastX;
        const dy = t.clientY - this._lookLastY;
        this._lookLastX = t.clientX;
        this._lookLastY = t.clientY;

        this._euler.setFromQuaternion(this.camera.quaternion);
        this._euler.y -= dx * LOOK_SENS;
        this._euler.x -= dy * LOOK_SENS;
        this._euler.x = Math.max(-PI_2 + 0.01, Math.min(PI_2 - 0.01, this._euler.x));
        this.camera.quaternion.setFromEuler(this._euler);

        // Once cumulative drag passes the tap threshold, suppress the
        // synthetic click that would otherwise fire on touchend and
        // misfire interactions while the player was just turning.
        if (!this._lookDragged) {
          const total = Math.hypot(t.clientX - this._lookStartX, t.clientY - this._lookStartY);
          if (total > TAP_THRESHOLD) this._lookDragged = true;
        }
        if (this._lookDragged) e.preventDefault();
      }
    }, { passive: false });

    const endLook = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._lookId) this._lookId = null;
      }
    };
    this.canvas.addEventListener('touchend', endLook);
    this.canvas.addEventListener('touchcancel', endLook);
  }

  _isInJoystickArea(x, y) {
    if (!this.joystickEl) return false;
    const rect = this.joystickEl.getBoundingClientRect();
    const pad = 24;
    return x >= rect.left - pad && x <= rect.right + pad
        && y >= rect.top - pad && y <= rect.bottom + pad;
  }
}

function isTouchPrimary() {
  if (typeof window === 'undefined') return false;
  // Any touch-capable device gets the on-screen controls. On hybrid
  // laptops these coexist with mouse/keyboard — the joystick just sits
  // in the corner unused. Covers real phones/tablets, iPadOS (which
  // reports maxTouchPoints), and Chrome DevTools mobile emulation.
  if ('ontouchstart' in window) return true;
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true;
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
  return false;
}

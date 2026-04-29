// Fade-to-black room transition. The overlay starts opaque on page load so
// the player never sees a half-built scene; Game's bootstrap fades it out
// once the name prompt is dismissed.
//
//   advance({ position, yaw })   — fade to black, teleport, fade in.
//   exitBlack()                  — release the initial black hold.
//   enterBlack()                 — manually fade to black (rarely needed).
//   showEndCard(node)            — fade to black, mount end-card content,
//                                  hold there. Used after the final room.

const ROOT_ID = 'room-fade';
const STYLE_ID = 'room-fade-style';
const FADE_MS = 820;

const CSS = `
#${ROOT_ID} {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #08040d;
  color: #e8d8ff;
  font-family: 'Georgia', 'Times New Roman', serif;
  text-align: center;
  z-index: 95;
  opacity: 1;
  pointer-events: auto;
  transition: opacity ${FADE_MS}ms ease;
}
#${ROOT_ID}.faded {
  opacity: 0;
  pointer-events: none;
}
#${ROOT_ID} .end-pretitle {
  color: #b89dd6;
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  margin-bottom: 14px;
}
#${ROOT_ID} .end-title {
  font-size: 26px;
  letter-spacing: 0.06em;
  font-weight: normal;
  color: #f0e3ff;
  margin: 0 0 28px 0;
}
#${ROOT_ID} .end-actions button {
  background: rgba(184, 157, 214, 0.18);
  border: 1px solid rgba(184, 157, 214, 0.55);
  color: #f0e3ff;
  font-family: inherit;
  font-size: 13px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  padding: 9px 24px;
  cursor: pointer;
  border-radius: 2px;
  margin: 0 6px;
}
#${ROOT_ID} .end-actions button:hover { background: rgba(184, 157, 214, 0.32); }
`;

export class RoomTransition {
  constructor(movement, camera) {
    this.movement = movement;
    this.camera = camera;
    this._injectStyle();
    this._createRoot();
  }

  enterBlack() {
    this.root.classList.remove('faded');
    return wait(FADE_MS);
  }

  exitBlack() {
    this.root.classList.add('faded');
    return wait(FADE_MS);
  }

  async advance({ position, yaw }) {
    this.movement.setEnabled(false);
    this.root.replaceChildren(); // strip any prior end card
    await this.enterBlack();

    this.camera.position.set(position[0], position[1], position[2]);
    this.camera.rotation.set(0, yaw, 0, 'YXZ');
    this.movement.basePos.set(position[0], position[1], position[2]);
    this.movement.velocity.set(0, 0, 0);

    await wait(280);
    await this.exitBlack();
    this.movement.setEnabled(true);
  }

  // Mount an "end card" (DOM tree) and hold the fade in. Used for the
  // post-final-room screen ("To be continued…") with action buttons.
  showEndCard(node) {
    this.movement.setEnabled(false);
    this.root.replaceChildren(node);
    this.root.classList.remove('faded');
  }

  _injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  _createRoot() {
    this.root = document.createElement('div');
    this.root.id = ROOT_ID;
    document.body.appendChild(this.root);
  }
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

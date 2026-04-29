// Focused inspect overlay: a fullscreen modal layer that disables movement
// and gives a feature its own DOM area to render whatever it needs (note,
// rune carving, or rune dial puzzle). One inspect at a time.
//
// Usage:
//   inspect.enter({
//     render: () => HTMLElement,   // mounted into the focus area
//     onClose: () => {},           // called when ESC / click-outside / X
//     dismissible: true,           // default true
//   })
//
// The overlay swallows pointer events so MovementSystem's click-to-lock
// listener (on body) doesn't fire while inspecting.

const ROOT_ID = 'inspect-root';
const STYLE_ID = 'inspect-style';

const CSS = `
#${ROOT_ID} {
  position: fixed;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(8, 4, 16, 0.65);
  backdrop-filter: blur(6px);
  z-index: 80;
  font-family: 'Georgia', 'Times New Roman', serif;
  color: #e8d8ff;
  opacity: 0;
  transition: opacity 180ms ease;
}
#${ROOT_ID}.open { display: flex; opacity: 1; }

#${ROOT_ID} .frame {
  position: relative;
  min-width: 320px;
  max-width: min(640px, 92vw);
  max-height: 86vh;
  overflow: auto;
  background: rgba(20, 14, 32, 0.94);
  border: 1px solid rgba(184, 157, 214, 0.4);
  box-shadow: 0 16px 64px rgba(0, 0, 0, 0.7);
  padding: 28px 32px;
  border-radius: 4px;
}
#${ROOT_ID} .close {
  position: absolute;
  top: 8px;
  right: 12px;
  background: transparent;
  border: none;
  color: #b89dd6;
  font-size: 22px;
  cursor: pointer;
  font-family: inherit;
  line-height: 1;
  padding: 4px 8px;
}
#${ROOT_ID} .close:hover { color: #f0e3ff; }

#${ROOT_ID} .esc-hint {
  position: fixed;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  color: #8e7ba8;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
`;

export class InspectSystem {
  constructor(movement) {
    this.movement = movement;
    this.active = null; // { onClose, dismissible }

    this._injectStyle();
    this._createRoot();

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.active?.dismissible) {
        e.stopPropagation();
        this.exit();
      }
    });
  }

  isActive() { return !!this.active; }

  enter({ render, onClose, dismissible = true }) {
    if (this.active) this.exit();

    const node = render();
    this.frame.replaceChildren(this.closeBtn, node);
    this.closeBtn.style.display = dismissible ? '' : 'none';

    this.active = { onClose, dismissible };
    this.movement.setEnabled(false);
    this.root.classList.add('open');
  }

  exit() {
    if (!this.active) return;
    const { onClose } = this.active;
    this.active = null;
    this.root.classList.remove('open');
    this.frame.replaceChildren(this.closeBtn);
    this.movement.setEnabled(true);
    onClose?.();
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

    this.frame = document.createElement('div');
    this.frame.className = 'frame';

    this.closeBtn = document.createElement('button');
    this.closeBtn.className = 'close';
    this.closeBtn.textContent = '×';
    this.closeBtn.setAttribute('aria-label', 'Close');
    this.closeBtn.addEventListener('click', () => this.exit());

    const escHint = document.createElement('div');
    escHint.className = 'esc-hint';
    escHint.textContent = 'Press ESC to leave';

    this.frame.appendChild(this.closeBtn);
    this.root.appendChild(this.frame);
    this.root.appendChild(escHint);

    // Click on the dimmed backdrop (but not on the frame) closes.
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root && this.active?.dismissible) this.exit();
    });

    document.body.appendChild(this.root);
  }
}

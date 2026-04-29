// Tiny persistent HUD: shows the player's key count out of the total
// required (5). Updates whenever SaveSystem changes — subscribes once and
// re-renders the count.

const ROOT_ID = 'key-hud';
const STYLE_ID = 'key-hud-style';

const CSS = `
#${ROOT_ID} {
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 12;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 10px;
  background: rgba(20, 14, 32, 0.72);
  border: 1px solid rgba(184, 157, 214, 0.32);
  border-radius: 999px;
  color: #f0e3ff;
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 13px;
  letter-spacing: 0.08em;
  pointer-events: none;
  backdrop-filter: blur(6px);
}
#${ROOT_ID} .glyph {
  font-size: 18px;
  filter: drop-shadow(0 0 6px rgba(252, 220, 130, 0.7));
}
#${ROOT_ID} .count strong {
  color: #ffd966;
  font-weight: bold;
  margin-right: 1px;
}
#${ROOT_ID}.bump { animation: keyhud-bump 480ms ease; }
@keyframes keyhud-bump {
  0% { transform: scale(1); }
  35% { transform: scale(1.18); box-shadow: 0 0 18px rgba(252, 220, 130, 0.55); }
  100% { transform: scale(1); box-shadow: 0 0 0 rgba(0, 0, 0, 0); }
}
`;

export class KeyHud {
  constructor(save) {
    this.save = save;
    this._lastCount = save.getKeyCount();
    this._injectStyle();
    this._createRoot();
    save.subscribe(() => this._render());
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
    this._render();
  }

  _render() {
    const have = this.save.getKeyCount();
    const total = this.save.getKeyTotal();
    this.root.innerHTML = `
      <span class="glyph">🗝</span>
      <span class="count"><strong>${have}</strong> / ${total}</span>
    `;
    if (have > this._lastCount) {
      this.root.classList.remove('bump');
      // Force reflow so the animation can replay.
      // eslint-disable-next-line no-unused-expressions
      this.root.offsetWidth;
      this.root.classList.add('bump');
    }
    this._lastCount = have;
  }
}

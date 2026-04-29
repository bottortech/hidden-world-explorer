// One-time blocking modal that asks the player for a name before the game
// starts. Skippable — empty input is stored as null and shown as 'UNKNOWN'
// in-game until a future diegetic naming moment overwrites it.
//
// Promise-based so Game can `await prompt.run()` and only then enable
// movement / pointer lock.

const STYLE_ID = 'name-prompt-style';
const ROOT_ID = 'name-prompt';

const CSS = `
#${ROOT_ID} {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 4, 16, 0.78);
  backdrop-filter: blur(6px);
  z-index: 90;
  font-family: 'Georgia', 'Times New Roman', serif;
  color: #e8d8ff;
  opacity: 0;
  transition: opacity 220ms ease;
}
#${ROOT_ID}.open { opacity: 1; }
#${ROOT_ID} .frame {
  background: rgba(20, 14, 32, 0.94);
  border: 1px solid rgba(184, 157, 214, 0.4);
  box-shadow: 0 16px 64px rgba(0, 0, 0, 0.7);
  padding: 36px 40px;
  border-radius: 4px;
  text-align: center;
  min-width: 320px;
  max-width: 92vw;
}
#${ROOT_ID} .pretitle {
  color: #b89dd6;
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  margin-bottom: 18px;
}
#${ROOT_ID} h2 {
  margin: 0 0 22px 0;
  font-size: 22px;
  font-weight: normal;
  color: #f0e3ff;
  letter-spacing: 0.04em;
}
#${ROOT_ID} input {
  display: block;
  width: 100%;
  padding: 12px 14px;
  font-family: inherit;
  font-size: 18px;
  background: rgba(40, 28, 60, 0.7);
  border: 1px solid rgba(184, 157, 214, 0.35);
  color: #fff5dd;
  text-align: center;
  letter-spacing: 0.08em;
  outline: none;
  border-radius: 2px;
  box-sizing: border-box;
  margin-bottom: 18px;
}
#${ROOT_ID} input:focus {
  border-color: rgba(184, 157, 214, 0.85);
  box-shadow: 0 0 12px rgba(184, 157, 214, 0.4);
}
#${ROOT_ID} button {
  background: rgba(184, 157, 214, 0.18);
  border: 1px solid rgba(184, 157, 214, 0.55);
  color: #f0e3ff;
  font-family: inherit;
  font-size: 14px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  padding: 10px 32px;
  cursor: pointer;
  border-radius: 2px;
}
#${ROOT_ID} button:hover { background: rgba(184, 157, 214, 0.32); }
#${ROOT_ID} .skip {
  display: block;
  margin: 14px auto 0;
  background: transparent;
  border: none;
  color: #8e7ba8;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
  padding: 4px 8px;
}
#${ROOT_ID} .skip:hover { color: #d6bef0; }
`;

export class NamePrompt {
  constructor(save) {
    this.save = save;
    this._injectStyle();
  }

  // Returns a Promise that resolves once the player submits or skips. If
  // a name already exists in save state, resolves synchronously without
  // ever showing the modal.
  run() {
    if (this.save.hasPlayerName()) return Promise.resolve();

    return new Promise((resolve) => {
      const root = document.createElement('div');
      root.id = ROOT_ID;
      root.innerHTML = `
        <div class="frame">
          <div class="pretitle">Before we begin</div>
          <h2>What name should we put on the door?</h2>
          <input type="text" maxlength="24" autocomplete="off" autocorrect="off" spellcheck="false" />
          <button class="begin">Begin</button>
          <button class="skip">Skip — leave it unknown</button>
        </div>
      `;
      document.body.appendChild(root);

      const input = root.querySelector('input');
      const beginBtn = root.querySelector('.begin');
      const skipBtn = root.querySelector('.skip');

      // Defer the open class so the CSS transition runs.
      requestAnimationFrame(() => root.classList.add('open'));
      setTimeout(() => input.focus(), 60);

      const finish = (name) => {
        this.save.setPlayerName(name);
        root.classList.remove('open');
        setTimeout(() => root.remove(), 240);
        resolve();
      };

      beginBtn.addEventListener('click', () => finish(input.value));
      skipBtn.addEventListener('click', () => finish(''));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish(input.value);
      });
    });
  }

  _injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }
}

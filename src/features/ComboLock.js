// Letter / digit combination lock used as a door seal. Player clicks the
// lock target, an inspect view opens with N input boxes (one per character
// of the solution). They type, hit Confirm, and either the door yields or
// the form shakes (no penalty).
//
//   new ComboLock(interaction, inspect, save, {
//     id: 'cabin',                       // also the room id
//     object: lockMesh,                  // 3D click target
//     solution: 'ASH',                   // case-insensitive; length defines slot count
//     onSolved: () => cabin.openDoor(),
//     gate: () => playerInside(),
//   })
//
// Already-completed rooms skip the puzzle and call onSolved synchronously
// on first click, so re-entering a cleared room can't lock the player out.
export class ComboLock {
  constructor(interaction, inspect, save, config) {
    this.interaction = interaction;
    this.inspect = inspect;
    this.save = save;
    this.config = config;
    this.solution = config.solution.toUpperCase();

    interaction.add({
      object: config.object,
      onClick: () => {
        if (config.gate && !config.gate()) return;
        if (save.isRoomComplete(config.id)) {
          config.onSolved?.({ alreadySolved: true });
          return;
        }
        this._open();
      },
    });
  }

  _open() {
    this.inspect.enter({ render: () => this._render() });
  }

  _render() {
    ensureStyle();
    const root = document.createElement('div');
    root.className = 'combo-view';

    const slotCount = this.solution.length;
    const inputsHtml = new Array(slotCount).fill(0).map((_, i) => `
      <input class="slot" data-i="${i}" maxlength="1" autocomplete="off"
             autocorrect="off" autocapitalize="characters" spellcheck="false" />
    `).join('');

    root.innerHTML = `
      <h2>The door is sealed</h2>
      <div class="hint">A ${slotCount}-letter word, in order.</div>
      <div class="boxes">${inputsHtml}</div>
      <div class="feedback"></div>
      <button class="confirm">Confirm</button>
    `;

    const slots = [...root.querySelectorAll('.slot')];
    const feedback = root.querySelector('.feedback');
    const confirmBtn = root.querySelector('.confirm');

    slots.forEach((slot, i) => {
      slot.addEventListener('input', () => {
        slot.value = slot.value.toUpperCase().slice(0, 1);
        if (slot.value && i < slots.length - 1) slots[i + 1].focus();
      });
      slot.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && slot.value === '' && i > 0) {
          e.preventDefault();
          slots[i - 1].focus();
          slots[i - 1].value = '';
        } else if (e.key === 'ArrowLeft' && i > 0) {
          e.preventDefault();
          slots[i - 1].focus();
        } else if (e.key === 'ArrowRight' && i < slots.length - 1) {
          e.preventDefault();
          slots[i + 1].focus();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          confirmBtn.click();
        }
      });
    });

    confirmBtn.addEventListener('click', () => {
      const guess = slots.map((s) => s.value).join('').toUpperCase();
      if (guess === this.solution) {
        root.classList.add('correct');
        feedback.textContent = 'The lock yields.';
        setTimeout(() => {
          this.save.markRoomComplete(this.config.id);
          this.inspect.exit();
          this.config.onSolved?.({ alreadySolved: false });
        }, 700);
      } else {
        root.classList.remove('wrong');
        // Force reflow so the animation can replay on repeated wrong guesses.
        // eslint-disable-next-line no-unused-expressions
        root.offsetWidth;
        root.classList.add('wrong');
        feedback.textContent = 'Nothing happens.';
        setTimeout(() => { feedback.textContent = ''; }, 1400);
      }
    });

    // Defer focus so the inspect overlay has finished mounting.
    setTimeout(() => slots[0]?.focus(), 0);
    return root;
  }

  update() {}
}

const STYLE_ID = 'combo-style';
const CSS = `
.combo-view h2 {
  margin: 0 0 6px 0;
  font-size: 22px;
  letter-spacing: 0.05em;
  color: #f0e3ff;
  font-weight: normal;
  text-align: center;
}
.combo-view .hint {
  color: #b89dd6;
  font-size: 12px;
  text-align: center;
  margin-bottom: 22px;
  letter-spacing: 0.06em;
}
.combo-view .boxes {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 18px;
}
.combo-view .slot {
  width: 64px;
  height: 84px;
  background: rgba(40, 28, 60, 0.7);
  border: 1px solid rgba(184, 157, 214, 0.4);
  color: #fff5dd;
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 52px;
  font-weight: bold;
  text-align: center;
  text-transform: uppercase;
  border-radius: 4px;
  outline: none;
  caret-color: rgba(252, 220, 160, 0.9);
  text-shadow: 0 0 12px rgba(252, 220, 160, 0.5);
}
.combo-view .slot:focus {
  border-color: rgba(184, 157, 214, 0.9);
  box-shadow: 0 0 14px rgba(184, 157, 214, 0.45);
}
.combo-view .feedback {
  text-align: center;
  font-size: 13px;
  color: #c8b8e0;
  height: 18px;
  margin-bottom: 12px;
  font-style: italic;
}
.combo-view .confirm {
  display: block;
  margin: 0 auto;
  background: rgba(184, 157, 214, 0.18);
  border: 1px solid rgba(184, 157, 214, 0.5);
  color: #f0e3ff;
  font-family: inherit;
  font-size: 14px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 10px 28px;
  cursor: pointer;
  border-radius: 2px;
}
.combo-view .confirm:hover {
  background: rgba(184, 157, 214, 0.32);
}
.combo-view.wrong { animation: combo-shake 0.42s ease; }
.combo-view.wrong .boxes {
  filter: drop-shadow(0 0 12px rgba(220, 90, 90, 0.6));
}
.combo-view.correct .boxes {
  filter: drop-shadow(0 0 16px rgba(140, 220, 160, 0.7));
  transition: filter 200ms ease;
}
@keyframes combo-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

import { RUNES, runeChar } from '../data/runes.js';

// A 3-position rune dial used as a door lock. Player clicks the door, an
// inspect view opens with three cyclable rune slots and a Confirm button.
// Wrong guess: soft visual buzz, no penalty. Right guess: success flash,
// onSolved fires, inspect closes, and the room is marked complete in save.
//
//   new RuneDial(interaction, inspect, save, {
//     id: 'cabin',                                  // also the room id
//     object: doorMesh,                             // 3D click target
//     solution: ['ansuz', 'kenaz', 'raido'],        // ordered; length defines slot count
//     onSolved: () => { /* unlock door etc */ },
//     gate: () => playerInside(),
//   })
//
// Slot positions are persisted under save.rooms[id].dialPositions, so closing
// inspect mid-puzzle doesn't reset progress. Already-completed rooms skip
// the puzzle and call onSolved synchronously on first click.
export class RuneDial {
  constructor(interaction, inspect, save, config) {
    this.interaction = interaction;
    this.inspect = inspect;
    this.save = save;
    this.config = config;

    const slotCount = config.solution.length;
    const persisted = save.getRoomState(config.id).dialPositions;
    this.positions = Array.isArray(persisted) && persisted.length === slotCount
      ? persisted.slice()
      : new Array(slotCount).fill(0);

    interaction.add({
      object: config.object,
      onClick: () => {
        if (config.gate && !config.gate()) return;
        if (save.isRoomComplete(config.id)) {
          // Already cracked. Unlock immediately so re-entering a room doesn't
          // re-lock the player out.
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
    ensureDialStyle();
    const root = document.createElement('div');
    root.className = 'dial-view';

    const slotCount = this.config.solution.length;
    const slotsHtml = new Array(slotCount).fill(0).map((_, i) => `
      <div class="slot" data-slot="${i}">
        <button class="cycle prev" aria-label="Previous">◀</button>
        <div class="symbol"></div>
        <button class="cycle next" aria-label="Next">▶</button>
      </div>
    `).join('');

    root.innerHTML = `
      <h2>The door is sealed</h2>
      <div class="hint">Set ${slotCount} runes in order, then confirm.</div>
      <div class="slots">${slotsHtml}</div>
      <div class="feedback"></div>
      <button class="confirm">Confirm</button>
    `;

    const symbolEls = [...root.querySelectorAll('.slot .symbol')];
    const refresh = () => {
      symbolEls.forEach((el, i) => {
        el.textContent = runeChar(RUNES[this.positions[i]].id);
      });
    };
    refresh();

    root.querySelectorAll('.slot').forEach((slot) => {
      const i = Number(slot.dataset.slot);
      slot.querySelector('.prev').addEventListener('click', () => {
        this.positions[i] = (this.positions[i] - 1 + RUNES.length) % RUNES.length;
        this._persist();
        refresh();
      });
      slot.querySelector('.next').addEventListener('click', () => {
        this.positions[i] = (this.positions[i] + 1) % RUNES.length;
        this._persist();
        refresh();
      });
    });

    const feedback = root.querySelector('.feedback');
    const confirmBtn = root.querySelector('.confirm');
    confirmBtn.addEventListener('click', () => {
      if (this._isSolved()) {
        root.classList.add('correct');
        feedback.textContent = 'The lock yields.';
        setTimeout(() => {
          this.save.markRoomComplete(this.config.id);
          this.inspect.exit();
          this.config.onSolved?.({ alreadySolved: false });
        }, 700);
      } else {
        root.classList.remove('wrong');
        // Force reflow so the animation can replay.
        // eslint-disable-next-line no-unused-expressions
        root.offsetWidth;
        root.classList.add('wrong');
        feedback.textContent = 'Nothing happens.';
        setTimeout(() => { feedback.textContent = ''; }, 1400);
      }
    });

    return root;
  }

  _isSolved() {
    return this.config.solution.every((id, i) => RUNES[this.positions[i]].id === id);
  }

  _persist() {
    this.save.setRoomState(this.config.id, { dialPositions: this.positions.slice() });
  }

  update() {}
}

const STYLE_ID = 'dial-style';
const CSS = `
.dial-view h2 {
  margin: 0 0 6px 0;
  font-size: 22px;
  letter-spacing: 0.05em;
  color: #f0e3ff;
  font-weight: normal;
  text-align: center;
}
.dial-view .hint {
  color: #b89dd6;
  font-size: 12px;
  text-align: center;
  margin-bottom: 22px;
  letter-spacing: 0.06em;
}
.dial-view .slots {
  display: flex;
  gap: 18px;
  justify-content: center;
  margin-bottom: 18px;
}
.dial-view .slot {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(40, 28, 60, 0.7);
  border: 1px solid rgba(184, 157, 214, 0.3);
  padding: 10px 8px;
  border-radius: 4px;
}
.dial-view .slot .symbol {
  font-size: 56px;
  width: 64px;
  text-align: center;
  color: #f0e3ff;
  text-shadow: 0 0 16px rgba(184, 157, 214, 0.8);
  line-height: 1;
}
.dial-view .cycle {
  background: transparent;
  border: 1px solid rgba(184, 157, 214, 0.4);
  color: #d6bef0;
  font-size: 14px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  font-family: inherit;
}
.dial-view .cycle:hover {
  background: rgba(184, 157, 214, 0.15);
  color: #f0e3ff;
}
.dial-view .feedback {
  text-align: center;
  font-size: 13px;
  color: #c8b8e0;
  height: 18px;
  margin-bottom: 12px;
  font-style: italic;
}
.dial-view .confirm {
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
.dial-view .confirm:hover {
  background: rgba(184, 157, 214, 0.32);
}
.dial-view.wrong { animation: dial-shake 0.42s ease; }
.dial-view.wrong .slots {
  box-shadow: 0 0 24px rgba(220, 90, 90, 0.45);
  border-radius: 6px;
}
.dial-view.correct .slots {
  box-shadow: 0 0 32px rgba(140, 220, 160, 0.6);
  border-radius: 6px;
  transition: box-shadow 200ms ease;
}
@keyframes dial-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
`;

function ensureDialStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

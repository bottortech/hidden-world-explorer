// In-game journal: a side panel listing every clue the player has found,
// toggled with J. Backed by SaveSystem (so progress persists), looks up
// per-clue metadata from a registry that features populate on construction.
//
// Two-step lifecycle for a clue:
//   1. Feature constructs → calls journal.register({ id, title, body, ... })
//      so metadata exists even before discovery.
//   2. Player interacts → caller calls journal.discover(id), which marks it
//      in SaveSystem and surfaces a "new clue" toast.
//
// Already-discovered clues from a prior session show up in the panel as soon
// as their feature registers (which happens during Game construction).

import { bodyToHtml } from '../features/Clue.js';

const PANEL_ID = 'journal-panel';
const TOAST_ID = 'journal-toast';
const STYLE_ID = 'journal-style';

const CSS = `
#${PANEL_ID} {
  position: fixed;
  top: 0;
  right: 0;
  width: 340px;
  max-width: 90vw;
  height: 100vh;
  background: rgba(20, 14, 32, 0.92);
  color: #e8d8ff;
  font-family: 'Georgia', 'Times New Roman', serif;
  border-left: 1px solid rgba(184, 157, 214, 0.35);
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.6);
  transform: translateX(100%);
  transition: transform 220ms ease;
  z-index: 50;
  overflow-y: auto;
  padding: 24px 20px;
  box-sizing: border-box;
  backdrop-filter: blur(8px);
}
#${PANEL_ID}.open { transform: translateX(0); }
#${PANEL_ID} h2 {
  margin: 0 0 8px 0;
  font-size: 22px;
  letter-spacing: 0.05em;
  color: #d6bef0;
  font-weight: normal;
}
#${PANEL_ID} .hint {
  color: #8e7ba8;
  font-size: 12px;
  margin-bottom: 18px;
  letter-spacing: 0.04em;
}
#${PANEL_ID} .empty {
  color: #6a5d80;
  font-style: italic;
  margin-top: 32px;
  text-align: center;
}
#${PANEL_ID} .clue {
  border-top: 1px solid rgba(184, 157, 214, 0.18);
  padding: 14px 0;
}
#${PANEL_ID} .clue .title {
  font-size: 15px;
  color: #f0e3ff;
  margin-bottom: 4px;
}
#${PANEL_ID} .clue .loc {
  font-size: 11px;
  color: #8e7ba8;
  margin-bottom: 6px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
#${PANEL_ID} .clue .body {
  font-size: 13px;
  line-height: 1.5;
  color: #c8b8e0;
}
#${PANEL_ID} .clue .row {
  display: flex;
  align-items: center;
  gap: 12px;
}
#${PANEL_ID} .keys-section {
  margin: 0 0 18px 0;
  padding: 12px 14px;
  background: rgba(40, 28, 60, 0.5);
  border: 1px solid rgba(184, 157, 214, 0.22);
  border-radius: 4px;
}
#${PANEL_ID} .keys-section h3 {
  margin: 0 0 8px 0;
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #b89dd6;
  font-weight: normal;
}
#${PANEL_ID} .keys-section .row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #d6c8ee;
}
#${PANEL_ID} .keys-section .row .glyph {
  font-size: 16px;
  filter: drop-shadow(0 0 6px rgba(252, 220, 130, 0.7));
}
#${PANEL_ID} .keys-section .list {
  margin-top: 6px;
  font-size: 12px;
  color: #8e7ba8;
}
#${PANEL_ID} .clue .key-letter {
  font-size: 30px;
  color: #fff5dd;
  text-shadow: 0 0 10px rgba(252, 220, 160, 0.85);
  line-height: 1;
  flex-shrink: 0;
  width: 36px;
  text-align: center;
  font-family: 'Georgia', 'Times New Roman', serif;
  font-weight: bold;
}

#${TOAST_ID} {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: rgba(20, 14, 32, 0.92);
  color: #e8d8ff;
  border: 1px solid rgba(184, 157, 214, 0.35);
  font-family: 'Georgia', 'Times New Roman', serif;
  padding: 12px 22px;
  border-radius: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 220ms ease, transform 220ms ease;
  z-index: 60;
  letter-spacing: 0.04em;
}
#${TOAST_ID}.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
#${TOAST_ID} .label {
  font-size: 10px;
  color: #b89dd6;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: 2px;
}
#${TOAST_ID} .title {
  font-size: 14px;
}
`;

export class JournalSystem {
  constructor(save, movement) {
    this.save = save;
    this.movement = movement;
    this.registry = new Map();
    this.open = false;
    this._toastTimer = null;
    this.currentRoomId = null;
    // Snapshot of movement.enabled at open-time so we restore it correctly
    // when the journal closes (don't blindly re-enable if a transition or
    // name prompt was the one that disabled movement).
    this._restoreMovement = false;

    this._injectStyle();
    this._createPanel();
    this._createToast();

    window.addEventListener('keydown', (e) => {
      if (e.key === 'j' || e.key === 'J') {
        if (this._inputFocused()) return;
        this.toggle();
      } else if (e.key === 'Escape' && this.open) {
        this.close();
      }
    });

    save.subscribe(() => this._render());
  }

  register(def) {
    this.registry.set(def.id, def);
    this._render();
  }

  // Scope the visible journal entries to a single room. Past-room clues stay
  // in the registry (and in save state) but don't render here. Set to null
  // to show no entries.
  setCurrentRoom(roomId) {
    if (this.currentRoomId === roomId) return;
    this.currentRoomId = roomId;
    this._render();
  }

  // Mark a clue discovered. Idempotent; returns true only the first time so
  // callers can chain side effects (sound, animation) on the first reveal.
  discover(id) {
    const def = this.registry.get(id);
    if (!def) {
      console.warn(`JournalSystem: discover("${id}") with no registered def`);
      return false;
    }
    const isNew = this.save.markClueDiscovered(id);
    if (isNew) this._showToast(def);
    return isNew;
  }

  toggle() { this.open ? this.close() : this.show(); }
  show() {
    if (this.open) return;
    this.open = true;
    this.panel.classList.add('open');
    // Release pointer lock + freeze the player so the cursor is available
    // for scrolling the panel.
    this._restoreMovement = !!this.movement?.enabled;
    if (this._restoreMovement) this.movement.setEnabled(false);
  }
  close() {
    if (!this.open) return;
    this.open = false;
    this.panel.classList.remove('open');
    if (this._restoreMovement) {
      this.movement.setEnabled(true);
      this._restoreMovement = false;
    }
  }

  _injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  _createPanel() {
    this.panel = document.createElement('div');
    this.panel.id = PANEL_ID;
    document.body.appendChild(this.panel);
  }

  _createToast() {
    this.toast = document.createElement('div');
    this.toast.id = TOAST_ID;
    this.toast.innerHTML = '<div class="label">New clue</div><div class="title"></div>';
    document.body.appendChild(this.toast);
  }

  _showToast(def) {
    this.toast.querySelector('.title').textContent = def.title;
    this.toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toast.classList.remove('show'), 2800);
  }

  _render() {
    const ids = this.save.state.discoveredClues;
    const known = ids
      .map((id) => this.registry.get(id))
      .filter(Boolean)
      .filter((c) => !this.currentRoomId || c.room === this.currentRoomId);
    const headerCount = `${known.length} found`;

    const keysHtml = this._keysSectionHtml();
    if (known.length === 0) {
      this.panel.innerHTML = `
        <h2>Journal</h2>
        <div class="hint">Press J to close · ${headerCount}</div>
        ${keysHtml}
        <div class="empty">Nothing discovered yet.<br/>Look around.</div>
      `;
      return;
    }

    const items = known.map((c) => {
      const inner = `
        <div class="title">${escapeHtml(c.title)}</div>
        ${c.location ? `<div class="loc">${escapeHtml(c.location)}</div>` : ''}
        <div class="body">${bodyToHtml(c.body)}</div>
      `;
      const body = c.keyLetter
        ? `<div class="row"><div class="key-letter">${escapeHtml(c.keyLetter)}</div><div>${inner}</div></div>`
        : inner;
      return `<div class="clue">${body}</div>`;
    }).join('');

    this.panel.innerHTML = `
      <h2>Journal</h2>
      <div class="hint">Press J to close · ${headerCount}</div>
      ${keysHtml}
      ${items}
    `;
  }

  _keysSectionHtml() {
    const have = this.save.getKeyCount();
    const total = this.save.getKeyTotal();
    const collected = this.save.state.collectedKeys;
    const list = collected.length
      ? `<div class="list">From: ${collected.map((id) => titleCase(id)).join(', ')}</div>`
      : '';
    return `
      <div class="keys-section">
        <h3>Keys</h3>
        <div class="row">
          <span class="glyph">🗝</span>
          <span><strong>${have}</strong> of ${total} found</span>
        </div>
        ${list}
      </div>
    `;
  }

  _inputFocused() {
    const t = document.activeElement;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function titleCase(id) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

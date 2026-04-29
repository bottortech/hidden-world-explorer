// Single source of truth for cross-session player progress: completed rooms,
// discovered clues, and per-room partial state (e.g. dial positions). Backed
// by localStorage under one key. Listeners subscribe to be notified of any
// mutation so dependent systems (journal, hub gating) can react without
// holding direct references.
//
// Schema is versioned; bump VERSION and add a migration when fields change.
//
// Dev resets:
//   • URL `?reset=1`           — wipes save on page load (any environment)
//   • Shift+R                  — wipes save on demand (dev builds only)

const STORAGE_KEY = 'hidden-world-explorer.save';
const VERSION = 1;

const EMPTY_STATE = () => ({
  version: VERSION,
  completedRooms: [],
  discoveredClues: [],
  rooms: {}, // per-room partial state, keyed by roomId
});

export class SaveSystem {
  constructor() {
    this.listeners = new Set();
    this.state = this._loadOrInit();

    if (import.meta.env.DEV) {
      window.addEventListener('keydown', (e) => {
        if (e.shiftKey && (e.key === 'R' || e.key === 'r')) {
          this.reset();
          window.location.reload();
        }
      });
    }
  }

  _loadOrInit() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === '1') {
      localStorage.removeItem(STORAGE_KEY);
      return EMPTY_STATE();
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return EMPTY_STATE();
      const parsed = JSON.parse(raw);
      if (parsed.version !== VERSION) return EMPTY_STATE();
      return { ...EMPTY_STATE(), ...parsed };
    } catch {
      return EMPTY_STATE();
    }
  }

  _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Quota or private-mode failure — keep running, just skip persistence.
    }
    for (const fn of this.listeners) fn(this.state);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  isRoomComplete(roomId) {
    return this.state.completedRooms.includes(roomId);
  }

  markRoomComplete(roomId) {
    if (this.isRoomComplete(roomId)) return;
    this.state.completedRooms = [...this.state.completedRooms, roomId];
    this._persist();
  }

  isClueDiscovered(clueId) {
    return this.state.discoveredClues.includes(clueId);
  }

  markClueDiscovered(clueId) {
    if (this.isClueDiscovered(clueId)) return false;
    this.state.discoveredClues = [...this.state.discoveredClues, clueId];
    this._persist();
    return true;
  }

  getRoomState(roomId) {
    return this.state.rooms[roomId] ?? {};
  }

  setRoomState(roomId, partial) {
    this.state.rooms = {
      ...this.state.rooms,
      [roomId]: { ...(this.state.rooms[roomId] ?? {}), ...partial },
    };
    this._persist();
  }

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.state = EMPTY_STATE();
    this._persist();
  }
}

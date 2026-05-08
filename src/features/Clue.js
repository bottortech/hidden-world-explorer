// A discoverable clue placed in the world. Two flavors share one class:
//   • Lore prop   — body is just narrative text. No emphasized letters.
//   • Clue prop   — body contains one letter wrapped in asterisks (e.g.
//                   "…dear *H*enry, in haste…"). The render emphasizes it
//                   visually so the player notices it inside the prose.
//
// On click, the first-person hand runs a pickup choreography (reach →
// pause holding the prop) and only then opens the inspect view. When the
// player closes the view, the prop is restored and the hand returns to
// idle. Wall-mounted props that shouldn't physically come off the wall
// (photo, plaque, hung coat) take `pickupable: false` — the hand still
// reaches but the mesh stays in place.
//
//   new Clue(interaction, journal, inspect, hand, {
//     id: 'cabin-chair-letter',
//     title: 'Folded letter under the chair',
//     body: '…and so I write to you, dear *H*enry, in haste…',
//     location: 'Cabin · chair',
//     object: foldedLetterMesh,
//     pickupable: true,                // default true
//     gate: () => playerInside(),      // optional — block click when false
//   })
//
// `hand` may be omitted; when null, the inspect view opens immediately
// without a pickup gesture.

const EMPHASIS_RE = /\*([^*\n])\*/;

export class Clue {
  constructor(interaction, journal, inspect, hand, config) {
    this.config = config;
    this.journal = journal;
    this.inspect = inspect;
    this.hand = hand;

    journal.register({
      id: config.id,
      title: config.title,
      body: config.body,
      location: config.location,
      room: config.room,
      keyLetter: extractKeyLetter(config.body),
    });

    interaction.add({
      object: config.object,
      onClick: () => {
        if (config.gate && !config.gate()) return;
        this._open();
      },
    });
  }

  async _open() {
    const { id, title, body, location, object, pickupable = true } = this.config;
    if (this.hand) {
      await this.hand.beginItemHold(object, { reparent: pickupable });
    }
    this.inspect.enter({
      render: () => renderClueView({ title, body, location }),
      onClose: () => this.hand?.endItemHold(),
    });
    this.journal.discover(id);
  }

  update() {}
}

// Pull the first emphasized letter out of a body string for journal display.
// Returns null if the body has no `*X*` marker.
export function extractKeyLetter(body) {
  if (!body) return null;
  const m = body.match(EMPHASIS_RE);
  return m ? m[1].toUpperCase() : null;
}

// Convert a body string into HTML: escapes HTML, then replaces all `*X*`
// markers with a glowing span.
export function bodyToHtml(body) {
  if (!body) return '';
  let html = escapeHtml(body);
  html = html.replace(/\*([^*\n])\*/g, '<span class="glyph-em">$1</span>');
  // Preserve double newlines as paragraph breaks; single newlines as <br>.
  html = html.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
  return `<p>${html}</p>`;
}

const STYLE_ID = 'clue-style';
const CSS = `
.clue-view h2 {
  margin: 0 0 8px 0;
  font-size: 22px;
  letter-spacing: 0.05em;
  color: #f0e3ff;
  font-weight: normal;
}
.clue-view .loc {
  color: #b89dd6;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  margin-bottom: 18px;
}
.clue-view .body {
  font-size: 15px;
  line-height: 1.7;
  color: #d6c8ee;
}
.clue-view .body p { margin: 0 0 14px 0; }
.clue-view .body p:last-child { margin-bottom: 0; }
.glyph-em {
  display: inline-block;
  font-family: 'Georgia', 'Times New Roman', serif;
  font-weight: bold;
  font-size: 2.6em;
  line-height: 0.9;
  color: #ffd966;
  text-shadow:
    0 0 6px rgba(255, 217, 102, 1),
    0 0 18px rgba(255, 180, 80, 0.85),
    0 0 36px rgba(255, 140, 60, 0.55);
  background: rgba(255, 200, 80, 0.10);
  border-bottom: 2px solid rgba(255, 210, 110, 0.7);
  padding: 0 0.12em 0.04em;
  margin: 0 0.04em;
  border-radius: 3px;
  vertical-align: -0.18em;
  letter-spacing: 0.02em;
  animation: glyph-pulse 2.2s ease-in-out infinite;
}
@keyframes glyph-pulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.18); }
}
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

// Inject at import time so .glyph-em is available wherever bodyToHtml is
// rendered (e.g. the journal panel) without requiring a clue inspect first.
ensureStyle();

function renderClueView({ title, body, location }) {
  const root = document.createElement('div');
  root.className = 'clue-view';
  root.innerHTML = `
    <h2>${escapeHtml(title)}</h2>
    ${location ? `<div class="loc">${escapeHtml(location)}</div>` : ''}
    <div class="body">${bodyToHtml(body)}</div>
  `;
  return root;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

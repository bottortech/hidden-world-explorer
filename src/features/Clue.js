import * as THREE from 'three';

// A discoverable clue placed in the world. Two variants:
//   • Note clue   — a small folded paper / inscription. Inspect reveals text.
//   • Glyph clue  — a glowing carved letter. Inspect reveals the character
//                   itself (which the player will need for the door lock).
//
// On first inspect, the clue is logged to the journal. Subsequent inspects
// just re-open the same view (idempotent).
//
// `object` is the THREE.Object3D used for the in-world visual *and* the click
// target. The caller is responsible for placing it in the scene tree.
//
//   new Clue(interaction, journal, inspect, {
//     id: 'beam-glyph',
//     title: 'Letter carved into the beam',
//     body: 'A faint letter is etched into the underside of a beam.',
//     location: 'Cabin · roof beam',
//     glyph: 'A',                     // optional — turns this into a glyph clue
//     object: glowingGlyphMesh,
//     gate: () => playerInside(),     // optional — block click when false
//   })
export class Clue {
  constructor(interaction, journal, inspect, config) {
    this.config = config;
    this.journal = journal;
    this.inspect = inspect;

    journal.register({
      id: config.id,
      title: config.title,
      body: config.body,
      location: config.location,
      glyph: config.glyph,
    });

    interaction.add({
      object: config.object,
      onClick: () => {
        if (config.gate && !config.gate()) return;
        this._open();
      },
    });
  }

  _open() {
    const { id, title, body, location, glyph } = this.config;
    this.inspect.enter({
      render: () => renderClueView({ title, body, location, glyph }),
      onClose: () => {},
    });
    // Mark on open. Discover() is idempotent so reopening costs nothing.
    this.journal.discover(id);
  }

  // No per-frame logic by default. Subclass / wrapper features can drive
  // ambient glow on `config.object` via their own update().
  update() {}
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
.clue-view .glyph {
  font-size: 132px;
  text-align: center;
  color: #fff5dd;
  text-shadow: 0 0 24px rgba(252, 220, 160, 0.85);
  margin: 8px 0 18px;
  line-height: 1;
  font-family: 'Georgia', 'Times New Roman', serif;
  letter-spacing: 0.04em;
}
.clue-view .body {
  font-size: 15px;
  line-height: 1.6;
  color: #d6c8ee;
  white-space: pre-wrap;
}
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

function renderClueView({ title, body, location, glyph }) {
  ensureStyle();
  const root = document.createElement('div');
  root.className = 'clue-view';
  const glyphHtml = glyph ? `<div class="glyph">${escapeHtml(glyph)}</div>` : '';
  root.innerHTML = `
    <h2>${escapeHtml(title)}</h2>
    ${location ? `<div class="loc">${escapeHtml(location)}</div>` : ''}
    ${glyphHtml}
    <div class="body">${escapeHtml(body ?? '')}</div>
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

// Helper: build a small in-world carved-glyph mesh (a glowing letter on a
// plane). Used by CabinInterior and other rooms when the character is the
// clue itself.
export function makeGlyphCarvingMesh(char, { color = 0xfde7b3, size = 0.5 } = {}) {
  const tex = makeGlyphTexture(char);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    color,
    transparent: true,
    opacity: 0.95,
    fog: false,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
}

function makeGlyphTexture(char) {
  const px = 256;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  g.clearRect(0, 0, px, px);
  g.fillStyle = '#ffffff';
  g.font = 'bold 200px Georgia, "Times New Roman", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(char, px / 2, px / 2 + 12);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Tiny synth helpers using the Web Audio API. We don't ship audio files —
// these are short tonal blips composed at runtime so the bundle stays light.
//
// AudioContext requires a user gesture to start; all of these helpers are
// only invoked from click / keydown handlers, so resume() succeeds.

let ctx = null;

function getCtx() {
  if (!ctx) {
    const Klass = window.AudioContext || window.webkitAudioContext;
    if (!Klass) return null;
    ctx = new Klass();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Bright two-note chime, used for picking up a key.
export function playKeyChime() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(1320, now + 0.18);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.5);
}

// Short metallic click, used for lock confirmation.
export function playClick() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.06);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.10, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

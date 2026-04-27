// Linear progression chain shown as cinematic subtitle text in the HUD.
// Features call `advanceTo(stepIndex)` to move forward; the chain only
// advances (never goes backward), so triggers can fire idempotently.
//
// Each update fades the text in immediately, then fades it out after ~4s.
// Re-entering a state (or earlier-numbered state) is a no-op.
export class ObjectiveSystem {
  constructor() {
    // Index → text. Adding a new step is just appending to this array.
    this.steps = [
      'Find the hidden signal.',     // 0 — initial
      'The signal is reacting.',     // 1 — proximity to cube
      'Find the pillar.',            // 2 — cube clicked
      'A path has opened.',          // 3 — pillar activated
      'Search the cabin.',           // 4 — entered cabin interior
      'Something is watching.',      // 5 — entered mystery zone
    ];
    this.current = -1; // so advanceTo(0) on construction triggers the show

    this.el = document.getElementById('objective');
    this.fadeTimer = 0;
    this.holdSeconds = 4.0;

    this.advanceTo(0);
  }

  // Move to step `index` if it's strictly ahead of the current one.
  advanceTo(index) {
    if (index <= this.current) return;
    if (index < 0 || index >= this.steps.length) return;
    this.current = index;
    this._show(this.steps[index]);
  }

  step() {
    return this.current;
  }

  _show(text) {
    if (!this.el) return;
    this.el.textContent = text;
    this.el.classList.add('visible');
    this.fadeTimer = this.holdSeconds;
  }

  update(dt) {
    if (this.fadeTimer <= 0) return;
    this.fadeTimer -= dt;
    if (this.fadeTimer <= 0) {
      this.el?.classList.remove('visible');
    }
  }
}

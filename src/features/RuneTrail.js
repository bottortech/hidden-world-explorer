import * as THREE from 'three';
import { COLORS } from '../utils/colors.js';

// A line of glowing ground runes leading from the cabin to the mystery zone.
// Hidden until `reveal()` is called (by the cabin artifact); then runes
// fade in sequentially from the cabin end outward, each with its own subtle
// pulse so the line reads as alive.
//
// To extend: lengthen the trail, branch it, or have runes brighten as the
// player passes near them.
export class RuneTrail {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'runeTrail';
    this.revealed = false;
    this.revealedAt = 0;

    // Path from cabin (22, -22) to mystery zone (28, 22). Slight x curve
    // so it doesn't read as a perfectly straight line.
    const points = [
      [22.5, -16],
      [23.0, -10],
      [23.5, -4],
      [24.5, 2],
      [25.5, 8],
      [26.5, 13],
      [27.5, 17],
      [28.0, 21],
    ];

    this.runes = [];
    for (let i = 0; i < points.length; i++) {
      const [x, z] = points[i];
      // Each rune gets its own material clone so per-rune pulse phase reads
      // as varied rather than synchronized.
      const mat = new THREE.MeshBasicMaterial({
        color: COLORS.rune,
        transparent: true,
        opacity: 0,
        fog: false, // glow stays visible at distance
        side: THREE.DoubleSide,
      });
      const geo = new THREE.CircleGeometry(0.4, 20);
      const rune = new THREE.Mesh(geo, mat);
      rune.rotation.x = -Math.PI / 2;
      rune.position.set(x, 0.04, z);
      rune.visible = false; // skip rendering until revealed
      this.group.add(rune);
      this.runes.push(rune);
    }

    scene.add(this.group);
  }

  // Trigger the staggered fade-in. Calling this multiple times is a no-op
  // after the first — keeps the moment a one-shot reveal.
  reveal() {
    if (this.revealed) return;
    this.revealed = true;
    this.revealedAt = performance.now();
    for (const r of this.runes) r.visible = true;
  }

  update(dt) {
    if (!this.revealed) return;
    const elapsed = (performance.now() - this.revealedAt) / 1000;
    const t = performance.now() * 0.001;

    for (let i = 0; i < this.runes.length; i++) {
      const rune = this.runes[i];
      const delay = i * 0.35;            // staggered fade-in down the line
      const local = elapsed - delay;
      let target = 0;
      if (local > 0) {
        const ramp = Math.min(local, 1);
        // Per-rune phase offset keeps the pulse from feeling synchronized.
        const pulse = 0.7 + Math.sin(t * 1.4 + i * 0.6) * 0.25;
        target = ramp * pulse * 0.85;
      }
      rune.material.opacity += (target - rune.material.opacity) * Math.min(1, dt * 4);
    }
  }
}

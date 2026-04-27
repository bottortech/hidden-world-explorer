import * as THREE from 'three';
import { COLORS } from '../utils/colors.js';
import { smoothstep } from '../utils/math.js';

// A glowing cube hidden in the fog. Two proximity ranges:
//   • Halo light hints from far away (illuminates surrounding ground/trees)
//   • Cube material fades in once you're close enough to see it clearly
// Glow and breathing-scale both intensify with proximity.
//
// Progression hooks:
//   • Crossing the proximity threshold advances objective step 0 → 1.
//   • Clicking the (revealed) cube one-shot activates it: emits an
//     expanding shockwave ring and advances step 1 → 2.
//
// To extend: chain reveals, add a particle aura, or trigger a sound event.
export class HiddenCube {
  constructor(scene, interaction, movement, objectives = null) {
    this.movement = movement;
    this.objectives = objectives;

    const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    this.mat = new THREE.MeshStandardMaterial({
      color: COLORS.cube,
      emissive: COLORS.cubeEmissive,
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0,
      roughness: 0.3,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.set(-12, 1.0, -14);
    this.mesh.name = 'hiddenCube';
    scene.add(this.mesh);

    // Halo: a soft point light co-located with the cube. Visible from farther
    // than the cube itself — the player notices the glow before the object.
    this.halo = new THREE.PointLight(COLORS.cubeEmissive, 0, 14, 1.6);
    this.halo.position.copy(this.mesh.position);
    this.halo.position.y += 0.2;
    scene.add(this.halo);

    // Shockwave: an expanding sphere triggered on activation. Hidden until
    // a click fires; runs once over ~1.4s, then disappears.
    this.shockMat = new THREE.MeshBasicMaterial({
      color: COLORS.cubeEmissive,
      transparent: true,
      opacity: 0,
      fog: false,
      side: THREE.BackSide, // render the inside so it reads as a "ring"
    });
    this.shockwave = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), this.shockMat);
    this.shockwave.position.copy(this.mesh.position);
    this.shockwave.visible = false;
    scene.add(this.shockwave);

    // Reveal range: cube material starts fading in at 9m, fully visible at 3m.
    this.revealStart = 9;
    this.revealEnd = 3;
    // Halo range: lights up the surroundings well before the cube is visible.
    this.haloStart = 16;
    this.haloEnd = 2;
    // Proximity threshold for the "signal is reacting" objective hint.
    this.proximityThreshold = 12;

    this.activated = false;
    this.activatedAt = 0;

    interaction.add({
      object: this.mesh,
      onClick: () => {
        if (this.activated) return;
        if (this.mat.opacity < 0.6) return; // must be close enough to see it
        this.activated = true;
        this.activatedAt = performance.now();
        this.shockwave.visible = true;
        this.objectives?.advanceTo(2);
      },
    });
  }

  update(dt) {
    const dist = this.mesh.position.distanceTo(this.movement.getPosition());

    // Step 0 → 1 when player gets close enough to "feel" the signal.
    if (dist < this.proximityThreshold) {
      this.objectives?.advanceTo(1);
    }

    // Inverse-smoothstep: 1 when close, 0 when far.
    const reveal = 1 - smoothstep(this.revealEnd, this.revealStart, dist);
    const haloProx = 1 - smoothstep(this.haloEnd, this.haloStart, dist);

    this.mat.opacity = reveal;

    // Two layered sines — the offset frequency keeps the pulse from feeling
    // mechanical. Pulse amplitude scales with proximity for the "drawing
    // near" sensation.
    const t = performance.now() * 0.001;
    const pulse =
      (Math.sin(t * 2.4) * 0.5 + 0.5) * 0.6 +
      (Math.sin(t * 5.1) * 0.5 + 0.5) * 0.25;

    // After activation, hold the cube at high glow rather than letting it
    // pulse all the way down — it should read as "claimed".
    const activatedBoost = this.activated ? 0.6 : 0;
    const targetGlow = (0.4 + pulse * 1.0) * Math.pow(reveal, 0.7) + activatedBoost;
    this.mat.emissiveIntensity += (targetGlow - this.mat.emissiveIntensity) * Math.min(1, dt * 3);

    this.halo.intensity = haloProx * (1.4 + pulse * 1.0) + activatedBoost * 1.2;

    // Subtle "breathing" scale when close.
    const breathScale = 1 + pulse * 0.06 * Math.pow(reveal, 0.7);
    this.mesh.scale.setScalar(breathScale);

    // Slow tumble so the cube reads as "alive" once visible.
    this.mesh.rotation.y += dt * 0.4;
    this.mesh.rotation.x += dt * 0.15;

    // Shockwave: expands and fades over ~1.4s, then hides.
    if (this.activated && this.shockwave.visible) {
      const elapsed = (performance.now() - this.activatedAt) / 1000;
      if (elapsed < 1.4) {
        const k = elapsed / 1.4;
        const eased = 1 - Math.pow(1 - k, 2); // ease-out
        this.shockwave.scale.setScalar(0.5 + eased * 7);
        this.shockMat.opacity = (1 - k) * 0.55;
      } else {
        this.shockwave.visible = false;
      }
    }
  }
}

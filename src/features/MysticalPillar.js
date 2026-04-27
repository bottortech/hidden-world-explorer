import * as THREE from 'three';
import { COLORS } from '../utils/colors.js';

// A tall pillar with a floating crystalline cap. Clicking either piece
// activates the pillar ONCE — a permanent "reveal" that shifts the world
// into a brighter, warmer mystical state. Subsequent clicks do nothing.
//
// On activation a brief flash (decaying emissive) sells the moment, while
// the world atmosphere transitions over a couple of seconds.
//
// To extend: stage the reveal across multiple pillars, add particle bursts,
// or persist the activated flag via localStorage.
export class MysticalPillar {
  constructor(scene, interaction, world, objectives = null) {
    this.world = world;
    this.objectives = objectives;
    this.activated = false;
    this.activatedAt = 0;

    // Pillar body
    const bodyGeo = new THREE.CylinderGeometry(0.55, 0.7, 4.8, 12);
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.pillar,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.6,
    });
    this.body = new THREE.Mesh(bodyGeo, this.bodyMat);
    this.body.position.set(10, 2.4, -6);
    this.body.name = 'mysticalPillar';
    scene.add(this.body);

    // Floating octahedron "cap" so the pillar reads as interactable at a glance.
    const capGeo = new THREE.OctahedronGeometry(0.55);
    this.capMat = new THREE.MeshStandardMaterial({
      color: 0xd9c8ee,
      emissive: 0x6c5b7b,
      emissiveIntensity: 0.2,
    });
    this.cap = new THREE.Mesh(capGeo, this.capMat);
    this.cap.position.copy(this.body.position);
    this.cap.position.y += 2.9;
    scene.add(this.cap);

    // Both pieces are clickable so aiming is forgiving.
    interaction.add({ object: this.body, onClick: () => this.activate() });
    interaction.add({ object: this.cap, onClick: () => this.activate() });
  }

  // One-shot reveal. Subsequent clicks are no-ops so the moment stays intact.
  activate() {
    if (this.activated) return;
    this.activated = true;
    this.activatedAt = performance.now();

    this.world.setAtmosphere({
      fogColor: COLORS.pillarFog,
      fogDensity: 0.038,         // thinner fog reveals more of the world
      ambientIntensity: 1.05,
      directionalIntensity: 0.85,
      directionalColor: 0xd9b8ee,
      hemisphereIntensity: 0.75,
      skyTopColor: 0x5a3a7a,
      skyBottomColor: COLORS.pillarFog,
    });

    this.objectives?.advanceTo(3);
  }

  update(dt) {
    // Cap drifts and bobs in place — gives the pillar a "humming" idle.
    this.cap.rotation.y += dt * 0.8;
    this.cap.position.y = this.body.position.y + 2.9 + Math.sin(performance.now() * 0.0015) * 0.08;

    if (this.activated) {
      // Decaying flash settles into a steady glow over ~2.5s.
      const elapsed = (performance.now() - this.activatedAt) / 1000;
      const decay = Math.exp(-elapsed * 1.4);
      this.capMat.emissiveIntensity = 1.6 + decay * 2.5;
      this.bodyMat.emissive.setHex(0x6c5b7b);
      this.bodyMat.emissiveIntensity = 0.85 + decay * 0.7;
    }
  }
}

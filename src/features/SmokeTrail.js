import * as THREE from 'three';

// Lightweight sprite-based smoke trail that loops forever from a fixed
// world position. A small pool of soft white sprites rises, drifts, and
// fades; phases are staggered so the column reads as continuous without
// having to spawn fresh particles.
//
//   const smoke = new SmokeTrail(scene, [x, y, z]);
//   // ...inside the per-frame update loop:
//   smoke.update(dt);

const SMOKE_TEXTURE = makeSmokeTexture();

function makeSmokeTexture() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(220, 220, 220, 0.85)');
  grad.addColorStop(0.5, 'rgba(220, 220, 220, 0.35)');
  grad.addColorStop(1, 'rgba(220, 220, 220, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class SmokeTrail {
  constructor(scene, origin, {
    count = 5,
    riseHeight = 0.55,
    drift = 0.04,
    life = 2.4,
    startScale = 0.04,
    endScale = 0.22,
    maxOpacity = 0.55,
  } = {}) {
    this.origin = new THREE.Vector3(origin[0], origin[1], origin[2]);
    this.life = life;
    this.riseHeight = riseHeight;
    this.drift = drift;
    this.startScale = startScale;
    this.endScale = endScale;
    this.maxOpacity = maxOpacity;

    this.particles = [];
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: SMOKE_TEXTURE,
        transparent: true,
        depthWrite: false,
        opacity: 0,
        fog: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.copy(this.origin);
      sprite.scale.setScalar(startScale);
      scene.add(sprite);
      this.particles.push({
        sprite,
        // Stagger the phase so particles continuously feed the column.
        t: (i / count) * life,
        // Per-particle drift seed for non-synced lateral motion.
        seed: Math.random() * 100,
      });
    }
  }

  update(dt) {
    for (const p of this.particles) {
      p.t += dt;
      if (p.t >= this.life) p.t -= this.life;
      const u = p.t / this.life;

      const driftX = Math.sin(p.t * 1.6 + p.seed) * this.drift;
      const driftZ = Math.cos(p.t * 1.9 + p.seed * 0.7) * this.drift;
      p.sprite.position.set(
        this.origin.x + driftX * u,
        this.origin.y + u * this.riseHeight,
        this.origin.z + driftZ * u,
      );

      p.sprite.scale.setScalar(this.startScale + (this.endScale - this.startScale) * u);

      // Opacity ramps in fast and out slow so the column looks dense at the
      // base and dissipates near the top.
      const ramp = u < 0.18 ? u / 0.18 : Math.max(0, 1 - (u - 0.18) / 0.82);
      p.sprite.material.opacity = ramp * this.maxOpacity;
    }
  }
}

import * as THREE from 'three';
import { COLORS } from '../utils/colors.js';

// Manages atmosphere: fog (color, density), named lights, and the sky gradient.
// Features call `setAtmosphere({ ... })` to request a new target; the system
// smoothly lerps current values toward those targets each frame.
//
// `snapshotTarget()` returns a serializable copy of the current target so
// temporary effects (e.g. trigger zones) can save and restore prior state
// without trampling permanent shifts (e.g. an activated pillar).
export class WorldSystem {
  constructor(scene) {
    this.scene = scene;
    this.elapsed = 0;

    const ambient = scene.getObjectByName('ambient');
    const directional = scene.getObjectByName('directional');
    const hemisphere = scene.getObjectByName('hemisphere');
    const sky = scene.getObjectByName('sky');

    this.target = {
      fogColor: new THREE.Color(COLORS.fog),
      fogDensity: scene.fog.density,
      ambientIntensity: ambient ? ambient.intensity : 0.5,
      directionalIntensity: directional ? directional.intensity : 0.55,
      directionalColor: new THREE.Color(directional ? directional.color.getHex() : 0xffffff),
      hemisphereIntensity: hemisphere ? hemisphere.intensity : 0.45,
      skyTopColor: new THREE.Color(sky ? sky.material.uniforms.topColor.value.getHex() : 0x000000),
      skyBottomColor: new THREE.Color(sky ? sky.material.uniforms.bottomColor.value.getHex() : 0x000000),
    };
  }

  // Public API. Pass any subset; colors accept any THREE.Color-compatible input.
  setAtmosphere(opts) {
    if (opts.fogColor !== undefined) this.target.fogColor.set(opts.fogColor);
    if (opts.fogDensity !== undefined) this.target.fogDensity = opts.fogDensity;
    if (opts.ambientIntensity !== undefined) this.target.ambientIntensity = opts.ambientIntensity;
    if (opts.directionalIntensity !== undefined) this.target.directionalIntensity = opts.directionalIntensity;
    if (opts.directionalColor !== undefined) this.target.directionalColor.set(opts.directionalColor);
    if (opts.hemisphereIntensity !== undefined) this.target.hemisphereIntensity = opts.hemisphereIntensity;
    if (opts.skyTopColor !== undefined) this.target.skyTopColor.set(opts.skyTopColor);
    if (opts.skyBottomColor !== undefined) this.target.skyBottomColor.set(opts.skyBottomColor);
  }

  // Snapshot the current target as plain hex/number values; pass the result
  // back to setAtmosphere() to restore the saved state with normal lerping.
  snapshotTarget() {
    return {
      fogColor: this.target.fogColor.getHex(),
      fogDensity: this.target.fogDensity,
      ambientIntensity: this.target.ambientIntensity,
      directionalIntensity: this.target.directionalIntensity,
      directionalColor: this.target.directionalColor.getHex(),
      hemisphereIntensity: this.target.hemisphereIntensity,
      skyTopColor: this.target.skyTopColor.getHex(),
      skyBottomColor: this.target.skyBottomColor.getHex(),
    };
  }

  update(dt) {
    this.elapsed += dt;
    const k = 1 - Math.exp(-dt * 1.6);

    const fog = this.scene.fog;
    fog.color.lerp(this.target.fogColor, k);
    fog.density += (this.target.fogDensity - fog.density) * k;

    if (this.scene.background?.lerp) {
      this.scene.background.lerp(this.target.fogColor, k);
    }

    // Slow sine breathing on the ambient light — adds gentle "alive" variation
    // to lighting without being noticeable as motion.
    const ambient = this.scene.getObjectByName('ambient');
    if (ambient) {
      const breathe = 1 + Math.sin(this.elapsed * 0.35) * 0.06;
      const target = this.target.ambientIntensity * breathe;
      ambient.intensity += (target - ambient.intensity) * k;
    }

    const directional = this.scene.getObjectByName('directional');
    if (directional) {
      directional.intensity += (this.target.directionalIntensity - directional.intensity) * k;
      directional.color.lerp(this.target.directionalColor, k);
    }

    const hemisphere = this.scene.getObjectByName('hemisphere');
    if (hemisphere) {
      hemisphere.intensity += (this.target.hemisphereIntensity - hemisphere.intensity) * k;
    }

    const sky = this.scene.getObjectByName('sky');
    if (sky?.material?.uniforms) {
      sky.material.uniforms.topColor.value.lerp(this.target.skyTopColor, k);
      sky.material.uniforms.bottomColor.value.lerp(this.target.skyBottomColor, k);
    }
  }
}

import * as THREE from 'three';
import { COLORS } from '../utils/colors.js';
import { rand } from '../utils/math.js';
import { isExcluded } from './Forest.js';

// Small environmental detail — rocks, bushes, and tree stumps scattered
// around the playable area to make it feel lived-in. Shares the Forest's
// exclusion zones so nothing spawns in cabin, river, or other clearings.
//
// To extend: add fallen logs, mushroom clusters, or animated ground mist.
export class SceneDecor {
  constructor(scene, {
    rockCount = 24,
    bushCount = 30,
    stumpCount = 14,
    minRadius = 6,
    maxRadius = 95,
    exclusions = [],
  } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'sceneDecor';

    // Rocks — small dodecahedrons jittered into clusters of varied scale.
    const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: COLORS.rockDecor,
      roughness: 1,
      flatShading: true,
    });
    this._scatter(rockCount, minRadius, maxRadius, exclusions, (x, z) => {
      const m = new THREE.Mesh(rockGeo, rockMat);
      m.position.set(x, rand(0.05, 0.25), z);
      m.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
      m.scale.setScalar(rand(0.5, 1.4));
      return m;
    });

    // Bushes — flat-shaded icosahedrons read as low-poly foliage clumps.
    const bushGeo = new THREE.IcosahedronGeometry(0.6, 0);
    const bushMat = new THREE.MeshStandardMaterial({
      color: COLORS.bush,
      roughness: 1,
      flatShading: true,
    });
    this._scatter(bushCount, minRadius, maxRadius, exclusions, (x, z) => {
      const m = new THREE.Mesh(bushGeo, bushMat);
      m.position.set(x, rand(0.25, 0.45), z);
      m.rotation.y = rand(0, Math.PI);
      // Squashed sphere proportions read more like a bush than a rock.
      m.scale.set(rand(0.7, 1.2), rand(0.5, 0.85), rand(0.7, 1.2));
      return m;
    });

    // Stumps — short cylinders with a slight cap geometry implied by scale.
    const stumpGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.55, 8);
    const stumpMat = new THREE.MeshStandardMaterial({
      color: COLORS.stumpBark,
      roughness: 1,
    });
    this._scatter(stumpCount, minRadius, maxRadius, exclusions, (x, z) => {
      const m = new THREE.Mesh(stumpGeo, stumpMat);
      m.position.set(x, 0.27, z);
      m.rotation.y = rand(0, Math.PI);
      m.scale.set(rand(0.7, 1.2), rand(0.7, 1.4), rand(0.7, 1.2));
      return m;
    });

    scene.add(this.group);
  }

  _scatter(count, minR, maxR, exclusions, makeMesh) {
    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * 6;
    while (placed < count && attempts < maxAttempts) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = rand(minR, maxR);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (isExcluded(x, z, exclusions)) continue;
      this.group.add(makeMesh(x, z));
      placed++;
    }
  }

  update() {}
}

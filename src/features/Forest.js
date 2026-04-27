import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { rand } from '../utils/math.js';

// Forest backed by a low-poly GLB tree model. The model is loaded once,
// inspected to find tree-like children, and each placement is a clone of
// a randomly-chosen variant. Geometry and materials are shared across
// clones (Three's clone() preserves references), so memory cost stays
// bounded — what scales linearly is draw calls, which is fine for a few
// hundred trees on modern hardware.
//
// `exclusions` is shared with SceneDecor and follows the same shape:
//   { type: 'circle', cx, cz, r }
//   { type: 'aabb', minX, maxX, minZ, maxZ }
//
// To extend: switch to InstancedMesh per (geometry, material) pair for
// thousands of trees, or load multiple GLBs and shuffle variants across
// them.
export class Forest {
  constructor(scene, options = {}) {
    this.scene = scene;

    // Defaults tuned for the current world. Override via constructor opts.
    this.opts = {
      modelUrl: '/low_poly_tree_scene_free.glb',
      count: 240,
      innerRadius: 8,
      outerRadius: 110,
      exclusions: [],
      // Mystical tint applied to all tree materials so trees match the
      // purple palette without rebuilding the model.
      tint: 0xb89dd6,
      tintStrength: 0.22,
      darken: 0.78,
      // Each variant is renormalized to roughly this height in world units
      // before per-instance scale jitter is applied.
      targetHeight: 4.5,
      scaleJitter: [0.7, 1.4],
      ...options,
    };

    this.group = new THREE.Group();
    this.group.name = 'forest';
    scene.add(this.group);

    this.ready = false;
    this._load();
  }

  _load() {
    const loader = new GLTFLoader();
    loader.load(
      this.opts.modelUrl,
      (gltf) => {
        const variants = this._extractVariants(gltf.scene);
        if (variants.length === 0) {
          console.warn('Forest: no tree variants found in model');
          return;
        }
        this._tintMaterials(variants);
        this._scatter(variants);
        this.ready = true;
      },
      undefined,
      (err) => {
        console.error('Forest: failed to load tree model', err);
      },
    );
  }

  // Walk the loaded GLTF and return a list of clone-ready Group wrappers,
  // one per tree variant. Each wrapper is normalized so:
  //   • its xz pivot is at the variant's footprint center
  //   • its base sits at y = 0
  //   • its natural height is scaled to roughly `targetHeight`
  // This way scattering only has to set position + Y-rotation + a scale
  // jitter and trees always sit cleanly on the ground.
  _extractVariants(modelScene) {
    // Take the model scene's top-level children as candidates. If the model
    // wraps everything in a single root group, descend through it once.
    let candidates = [...modelScene.children];
    if (candidates.length === 1 && candidates[0].children?.length > 1) {
      candidates = [...candidates[0].children];
    }

    const variants = [];

    for (const c of candidates) {
      const box = new THREE.Box3().setFromObject(c);
      const size = new THREE.Vector3();
      box.getSize(size);

      // Filters: skip terrain-like flat objects, oversized whole-scene
      // meshes, and anything too small to read as a tree.
      if (size.y < 0.5) continue;
      if (size.y < Math.max(size.x, size.z) * 0.18) continue;
      if (Math.max(size.x, size.z) > 30) continue;

      const inner = c.clone();
      // Rebase so xz pivot is at the footprint center, base at y = 0.
      const cx = (box.min.x + box.max.x) * 0.5;
      const cz = (box.min.z + box.max.z) * 0.5;
      inner.position.x -= cx;
      inner.position.y -= box.min.y;
      inner.position.z -= cz;

      const wrapper = new THREE.Group();
      wrapper.add(inner);
      wrapper.scale.setScalar(this.opts.targetHeight / size.y);

      variants.push(wrapper);
    }

    return variants;
  }

  // Lerp tree material colors toward the mystical tint and slightly darken,
  // so the GLB's native palette merges into the dusky purple world. Done
  // once on the variants — clones share material references and inherit it.
  _tintMaterials(variants) {
    const tint = new THREE.Color(this.opts.tint);
    const seen = new Set();
    for (const v of variants) {
      v.traverse((node) => {
        if (!node.isMesh || !node.material) return;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        for (const m of mats) {
          if (seen.has(m) || !m.color) continue;
          seen.add(m);
          m.color.lerp(tint, this.opts.tintStrength);
          m.color.multiplyScalar(this.opts.darken);
        }
      });
    }
  }

  // Scatter clones of the variants across the playable area, biasing radius
  // toward the mid-range and skipping any position inside an exclusion zone.
  _scatter(variants) {
    const { count, innerRadius, outerRadius, exclusions, scaleJitter } = this.opts;
    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * 5;

    while (placed < count && attempts < maxAttempts) {
      attempts++;

      // Bias radius distribution so trees cluster mid-range, not at the edge.
      const t = Math.pow(Math.random(), 0.65);
      const radius = innerRadius + t * (outerRadius - innerRadius);
      const angle = Math.random() * Math.PI * 2;

      // Position jitter breaks any perceived ring or grid pattern.
      const jx = (Math.random() - 0.5) * 3;
      const jz = (Math.random() - 0.5) * 3;
      const x = Math.cos(angle) * radius + jx;
      const z = Math.sin(angle) * radius + jz;

      if (isExcluded(x, z, exclusions)) continue;

      const variant = variants[Math.floor(Math.random() * variants.length)];
      const tree = variant.clone();
      tree.position.set(x, 0, z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      // multiplyScalar so per-instance jitter composes with the normalize scale.
      tree.scale.multiplyScalar(rand(scaleJitter[0], scaleJitter[1]));

      this.group.add(tree);
      placed++;
    }
  }

  update() {
    // No per-frame logic for the forest yet. Add subtle wind sway here later
    // by mutating leaf rotations based on performance.now().
  }
}

// Shared exclusion test — used by Forest and SceneDecor so they keep the
// same clearings carved out.
export function isExcluded(x, z, exclusions) {
  for (const ex of exclusions) {
    if (ex.type === 'circle') {
      const dx = x - ex.cx;
      const dz = z - ex.cz;
      if (dx * dx + dz * dz < ex.r * ex.r) return true;
    } else if (ex.type === 'aabb') {
      if (x >= ex.minX && x <= ex.maxX && z >= ex.minZ && z <= ex.maxZ) return true;
    }
  }
  return false;
}

import * as THREE from 'three';
import { COLORS } from '../utils/colors.js';
import { rand } from '../utils/math.js';

// Large rocks and jagged spires placed near the fog horizon so they read as
// silhouettes. Their sole purpose is to give the player a sense of scale and
// distance — distinct shapes you can navigate by but never quite reach.
//
// Material opacity is shared and lerped via setTargetOpacity() so external
// features (e.g. MysteryZone) can fade the silhouettes in/out.
export class DistantShapes {
  constructor(scene, { count = 9, minRadius = 60, maxRadius = 95 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'distantShapes';

    // Shared material so a single opacity assignment fades every silhouette.
    this.material = new THREE.MeshStandardMaterial({
      color: COLORS.distantSilhouette,
      roughness: 1,
      flatShading: true,
      transparent: true,
      opacity: 1,
    });

    this.targetOpacity = 1;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = rand(minRadius, maxRadius);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const isSpire = Math.random() < 0.4;
      const geo = isSpire
        ? new THREE.ConeGeometry(rand(3, 5), rand(10, 18), 5)
        : new THREE.DodecahedronGeometry(rand(4, 7), 0);

      const mesh = new THREE.Mesh(geo, this.material);
      mesh.position.set(x, isSpire ? rand(4, 8) : rand(1, 3), z);
      mesh.rotation.y = Math.random() * Math.PI;
      mesh.rotation.z = (Math.random() - 0.5) * 0.18;
      mesh.scale.setScalar(rand(0.9, 1.4));
      this.group.add(mesh);
    }

    scene.add(this.group);
  }

  setTargetOpacity(v) {
    this.targetOpacity = v;
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 1.4);
    this.material.opacity += (this.targetOpacity - this.material.opacity) * k;
    // Hide the group entirely once nearly transparent — saves overdraw.
    this.group.visible = this.material.opacity > 0.02;
  }
}

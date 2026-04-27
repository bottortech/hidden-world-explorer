import * as THREE from 'three';
import { COLORS } from '../utils/colors.js';

// Faint flagstones leading from the player's spawn area toward the cabin —
// always visible, but subtle enough that the cube (the first objective)
// remains the more obvious draw. Stones pass near the pillar so the
// progression cube → pillar → cabin reads naturally.
//
// To extend: animate a slow shimmer along the path, or thicken the stones
// once the player reaches a certain step.
export class PathToCabin {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'pathToCabin';

    // Hand-placed stones — gentle curve from near the bridge approach to the
    // cabin doorway at (22, 0, -19). Slight offsets break the perfect line.
    const stones = [
      { x: 4,  z: 3,   r: 0.55 },
      { x: 6,  z: 0,   r: 0.50 },
      { x: 8,  z: -3,  r: 0.55 },
      { x: 12, z: -8,  r: 0.50 },
      { x: 15, z: -11, r: 0.55 },
      { x: 17, z: -14, r: 0.50 },
      { x: 19, z: -17, r: 0.55 },
      { x: 21, z: -19, r: 0.55 },
    ];

    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.stone,
      roughness: 1,
      flatShading: true,
    });

    for (const s of stones) {
      // Use a low cylinder so stones have a touch of edge thickness rather
      // than reading as flat decals. Slight random rotation/scale jitter.
      const geo = new THREE.CylinderGeometry(s.r, s.r * 0.95, 0.08, 10);
      const stone = new THREE.Mesh(geo, mat);
      stone.position.set(
        s.x + (Math.random() - 0.5) * 0.3,
        0.04,
        s.z + (Math.random() - 0.5) * 0.3,
      );
      stone.rotation.y = Math.random() * Math.PI;
      stone.scale.set(
        1 + (Math.random() - 0.5) * 0.15,
        1,
        0.85 + (Math.random() - 0.5) * 0.2,
      );
      this.group.add(stone);
    }

    scene.add(this.group);
  }

  update() {}
}

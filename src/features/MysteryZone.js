import * as THREE from 'three';
import { COLORS } from '../utils/colors.js';

// An *invisible* trigger zone — there's no marker, no visual cue. Stumbling
// into it is the surprise. While inside, the world thickens: dense fog, dim
// lighting, and the distant silhouettes fade out so the player feels enclosed.
// Exiting smoothly restores whatever atmosphere was active before entry.
//
// Composes cleanly with the pillar's permanent shift via WorldSystem's
// snapshot/restore pattern.
//
// To extend: chain multiple zones with different shifts, persist a
// "discovered" flag, or spawn entities on entry.
export class MysteryZone {
  constructor(scene, movement, world, distantShapes = null, objectives = null) {
    this.movement = movement;
    this.world = world;
    this.distantShapes = distantShapes;
    this.objectives = objectives;

    this.center = new THREE.Vector3(28, 0, 22);
    this.radius = 8;
    this.inside = false;
    this.savedTarget = null;
  }

  update(/* dt */) {
    // 2D distance check (XZ plane), same pattern as PortalZone.
    const p = this.movement.getPosition();
    const dx = p.x - this.center.x;
    const dz = p.z - this.center.z;
    const inside = Math.hypot(dx, dz) < this.radius;

    if (inside === this.inside) return;
    this.inside = inside;

    if (inside) {
      this.savedTarget = this.world.snapshotTarget();
      this.world.setAtmosphere({
        fogColor: COLORS.mysteryFog,
        fogDensity: 0.11,
        ambientIntensity: 0.28,
        directionalIntensity: 0.22,
        directionalColor: 0x6a4d8a,
        hemisphereIntensity: 0.18,
        skyTopColor: 0x140a22,
        skyBottomColor: COLORS.mysteryFog,
      });
      this.distantShapes?.setTargetOpacity(0);
      this.objectives?.advanceTo(5);
    } else {
      if (this.savedTarget) {
        this.world.setAtmosphere(this.savedTarget);
        this.savedTarget = null;
      }
      this.distantShapes?.setTargetOpacity(1);
    }
  }
}

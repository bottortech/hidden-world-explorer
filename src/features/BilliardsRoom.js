import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { Clue } from './Clue.js';
import { ComboLock } from './ComboLock.js';
import { Key } from './Key.js';

// Room 3: a pre-built billiards-room GLB dropped at a far world offset.
// Linear flow takes the player here after they solve the Attic. Geometry
// comes from the asset; we add a perimeter of wall colliders so the player
// can't walk out, plus a scoresheet clue, a combo lock, and a key. The
// room offset lifts the model's floor (which sits at +0.36 in model
// coords) onto world Y = 0 so the existing PLAYER_HEIGHT constant stays
// correct.
//
// Solution: "CUE" — read top-to-bottom from the scoresheet (Winner C,
// Runner-up U, Third E).

const SOLUTION = 'CUE';
const MODEL_BBOX_MIN = new THREE.Vector3(-12.98, 0.36, -11.51);
const MODEL_BBOX_MAX = new THREE.Vector3(9.49, 15.35, 16.85);

// Module-scoped loader. MeshoptDecoder is required because the asset is
// compressed with EXT_meshopt_compression (the optimize pass produced it).
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

export class BilliardsRoom {
  constructor({
    scene, movement, interaction, journal, inspect, save, hand, onSolved,
    origin = [400, 0, 200],
  }) {
    this.scene = scene;
    this.movement = movement;

    // Lift the model so its floor (+0.36 in model coords) lands on world Y=0.
    const offset = new THREE.Vector3(
      origin[0],
      origin[1] - MODEL_BBOX_MIN.y,
      origin[2],
    );
    this.offset = offset;

    // Compute world-space bounds + interior AABB for gating.
    const worldMin = MODEL_BBOX_MIN.clone().add(offset);
    const worldMax = MODEL_BBOX_MAX.clone().add(offset);
    this.worldMin = worldMin;
    this.worldMax = worldMax;
    this.interiorAABB = {
      minX: worldMin.x + 0.5, maxX: worldMax.x - 0.5,
      minZ: worldMin.z + 0.5, maxZ: worldMax.z - 0.5,
    };

    // Container so we can position / orient the whole asset cleanly.
    this.group = new THREE.Group();
    this.group.name = 'billiardsRoom';
    this.group.position.copy(offset);
    scene.add(this.group);

    gltfLoader.load(
      `${import.meta.env.BASE_URL}the_billiards_room.glb`,
      (gltf) => this.group.add(gltf.scene),
      undefined,
      (err) => console.warn('BilliardsRoom: GLB failed to load', err),
    );

    // Perimeter colliders along the model's bbox edges (in world coords).
    const t = 0.2;
    movement.addColliders([
      // North wall (-Z)
      { minX: worldMin.x, maxX: worldMax.x, minZ: worldMin.z, maxZ: worldMin.z + t },
      // South wall (+Z)
      { minX: worldMin.x, maxX: worldMax.x, minZ: worldMax.z - t, maxZ: worldMax.z },
      // West wall (-X)
      { minX: worldMin.x, maxX: worldMin.x + t, minZ: worldMin.z, maxZ: worldMax.z },
      // East wall (+X)
      { minX: worldMax.x - t, maxX: worldMax.x, minZ: worldMin.z, maxZ: worldMax.z },
    ]);

    const inside = () => this.isPlayerInside();

    // --- Clue: pinned scoresheet on the south wall --------------------------
    const scoresheet = makeScoresheetMesh();
    scoresheet.position.set(offset.x + 2.0, 1.65, worldMax.z - 0.06);
    scoresheet.rotation.y = Math.PI; // face north into the room
    scene.add(scoresheet);
    new Clue(interaction, journal, inspect, hand, {
      id: 'billiards-scoresheet',
      title: 'A pinned scoresheet',
      body:
        'A handwritten tournament sheet pinned to the wall:\n\n' +
        '  Winner — *C* B. Smith\n' +
        '  Runner-up — *U* J. Tan\n' +
        '  Third — *E* M. White\n\n' +
        '  Date: 22 / 04 / 56',
      room: 'billiards',
      location: 'Billiards · south wall',
      object: scoresheet,
      gate: inside,
      pickupable: false,
    });

    // --- Lock on the south wall ---------------------------------------------
    const lockMount = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfde7b3, transparent: true, opacity: 0.85,
        fog: false, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    lockMount.position.set(offset.x, 1.4, worldMax.z - 0.06);
    lockMount.rotation.y = Math.PI;
    scene.add(lockMount);
    this.lockMount = lockMount;

    // --- Key spawned on solve -----------------------------------------------
    this.key = new Key({
      scene,
      interaction,
      hand,
      save,
      roomId: 'billiards',
      position: [offset.x, 1.05, worldMax.z - 0.5],
      onCollected: () => onSolved?.(),
    });

    new ComboLock(interaction, inspect, save, {
      id: 'billiards',
      object: lockMount,
      solution: SOLUTION,
      gate: inside,
      onSolved: () => this.key.activate(),
    });

    if (save.isRoomComplete('billiards') && !save.hasKey('billiards')) {
      this.key.activate();
    }
  }

  isPlayerInside(p = this.movement.getPosition()) {
    const a = this.interiorAABB;
    return p.x >= a.minX && p.x <= a.maxX && p.z >= a.minZ && p.z <= a.maxZ;
  }

  update(dt) {
    const t = performance.now() * 0.001;
    if (this.lockMount) {
      this.lockMount.material.opacity = 0.7 + Math.sin(t * 1.1) * 0.18;
    }
    this.key?.update?.(dt);
  }
}

// Cream paper rectangle, slightly emissive so it reads against the room's
// baked-in lighting. The actual scoresheet content lives in the inspect
// view, not on this surface — the mesh is just a clickable target.
function makeScoresheetMesh() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xefe4c8, emissive: 0x8a6a3a, emissiveIntensity: 0.45, roughness: 1,
  });
  return new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.012), mat);
}

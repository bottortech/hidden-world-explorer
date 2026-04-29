import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { COLORS } from '../utils/colors.js';

// Module-scoped loader so multiple props can share parsing infrastructure.
const gltfLoader = new GLTFLoader();

// Load a GLB and return a Group whose contents are scaled so the model's
// vertical span equals `targetHeight`, then translated so the bottom rests
// on y=0 and the X/Z bounds are centered on the origin. Useful when the
// authored asset uses arbitrary scene-graph transforms or non-meter units.
function loadAndNormalize(url, { targetHeight }) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        const bbox = new THREE.Box3().setFromObject(root);
        const size = bbox.getSize(new THREE.Vector3());
        const scale = size.y > 0 ? targetHeight / size.y : 1;
        root.scale.setScalar(scale);

        const sBbox = new THREE.Box3().setFromObject(root);
        const center = sBbox.getCenter(new THREE.Vector3());
        root.position.x -= center.x;
        root.position.z -= center.z;
        root.position.y -= sBbox.min.y;

        const wrapper = new THREE.Group();
        wrapper.add(root);
        resolve(wrapper);
      },
      undefined,
      (err) => reject(err),
    );
  });
}

// Single-room weathered cabin sitting in a clearing in the NE forest. This
// feature owns *only* the structure: walls, floor, roof, doorway, door, a
// fireplace recess, a desk, and a chair. Puzzle content (clues, dial) lives
// in CabinInterior so the geometry can be tweaked without touching the
// puzzle wiring (and vice versa).
//
// Door state machine:
//   'closed'  — initial (player spawns sealed inside). Collider blocks doorway.
//   'opening' — fired by openDoor() (called from CabinInterior on dial solve).
//   'open'    — doorway clear. Initial state when startOpen is true (room
//               already cleared in a prior session).
// Transitions are animated by lerp in update().
//
// Public API used by CabinInterior:
//   isPlayerInside(pos), getDoorAnchor(), openDoor()
// Plus mounting points exposed as fields for placing puzzle props:
//   deskTop, beamPos, hearthPos, chairTop, chairUnderside, doorInteriorAnchor
export class Cabin {
  constructor(scene, movement, { startOpen = false } = {}) {
    this.movement = movement;

    this.cx = 22;
    this.cz = -22;
    this.w = 6;
    this.d = 6;
    this.h = 3;
    this.wallT = 0.2;
    this.doorW = 1.6;
    this.doorH = 2.4;

    this.group = new THREE.Group();
    this.group.name = 'cabin';

    const woodMat = new THREE.MeshStandardMaterial({
      color: COLORS.wood, roughness: 1, flatShading: true,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: COLORS.woodAccent, roughness: 1,
    });
    const darkWoodMat = new THREE.MeshStandardMaterial({
      color: 0x2a1f1a, roughness: 1, flatShading: true,
    });

    // --- Floor & roof ---------------------------------------------------------
    const floor = new THREE.Mesh(new THREE.BoxGeometry(this.w, 0.1, this.d), floorMat);
    floor.position.set(this.cx, 0.05, this.cz);
    this.group.add(floor);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(this.w + 0.5, 0.18, this.d + 0.5), woodMat,
    );
    roof.position.set(this.cx, this.h + 0.09, this.cz);
    roof.rotation.z = 0.025;
    roof.rotation.x = -0.012;
    this.group.add(roof);

    // --- Walls ----------------------------------------------------------------
    const halfW = this.w / 2;
    const halfD = this.d / 2;
    const halfDoor = this.doorW / 2;
    const sideLen = halfW - halfDoor;

    this._addWall(woodMat, this.cx, this.cz - halfD, this.w, this.wallT);          // north
    this._addWall(woodMat, this.cx + halfW, this.cz, this.wallT, this.d);          // east
    this._addWall(woodMat, this.cx - halfW, this.cz, this.wallT, this.d);          // west
    this._addWall(woodMat, this.cx - halfDoor - sideLen / 2, this.cz + halfD, sideLen, this.wallT);
    this._addWall(woodMat, this.cx + halfDoor + sideLen / 2, this.cz + halfD, sideLen, this.wallT);

    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(this.doorW + 0.05, 0.6 + (this.h - this.doorH), this.wallT),
      woodMat,
    );
    lintel.position.set(this.cx, this.doorH + (this.h - this.doorH) / 2, this.cz + halfD);
    this.group.add(lintel);

    // --- Door (hinge group) ---------------------------------------------------
    // Hinge is at the west edge of the doorway. Door mesh extends east from
    // the hinge so rotating the group around Y swings it open/closed cleanly.
    this.doorHinge = new THREE.Group();
    this.doorHinge.position.set(
      this.cx - halfDoor, this.doorH / 2, this.cz + halfD,
    );
    this.group.add(this.doorHinge);

    const doorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.doorW, this.doorH, 0.08),
      darkWoodMat,
    );
    doorMesh.position.set(this.doorW / 2, 0, 0);
    this.doorHinge.add(doorMesh);
    this.doorMesh = doorMesh;

    // Iron-strap accents — three thin horizontal bars across the door.
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x18120e, roughness: 0.8 });
    for (const y of [-0.7, 0, 0.7]) {
      const strap = new THREE.Mesh(
        new THREE.BoxGeometry(this.doorW, 0.06, 0.085), strapMat,
      );
      strap.position.set(this.doorW / 2, y, 0);
      this.doorHinge.add(strap);
    }

    // Door state. Rotation 0 = closed, +π/2 = open outward.
    // Player starts inside a sealed room (door closed) unless the room has
    // already been cleared in a prior session, in which case the door is
    // already open and the dial isn't needed.
    this.doorState = startOpen ? 'open' : 'closed';
    this.doorRotTarget = startOpen ? Math.PI / 2 : 0;
    this.doorHinge.rotation.y = this.doorRotTarget;

    // Doorway-blocking collider. Mutated in place: real AABB when closed,
    // pushed off-grid when open (no allocations per frame).
    this.doorCollider = { minX: 1e6, maxX: 1e6 + 1, minZ: 1e6, maxZ: 1e6 + 1 };
    movement.addColliders([this.doorCollider]);
    if (!startOpen) this._setDoorColliderClosed(true);

    // --- Wall colliders -------------------------------------------------------
    movement.addColliders(this._wallColliders());

    // --- Interior light -------------------------------------------------------
    // Two warm lights at low decay so the whole sealed room is readable, plus
    // a violet fill to keep the corners from crushing to black.
    this.interiorLight = new THREE.PointLight(COLORS.warmLight, 4.5, 12, 1.0);
    this.interiorLight.position.set(this.cx, this.h - 0.5, this.cz);
    this.group.add(this.interiorLight);

    const secondary = new THREE.PointLight(COLORS.warmLight, 2.2, 9, 1.0);
    secondary.position.set(this.cx, this.h - 0.5, this.cz + 1.5);
    this.group.add(secondary);

    const fill = new THREE.PointLight(0x6a4a78, 1.2, 11, 1.4);
    fill.position.set(this.cx, 1.0, this.cz);
    this.group.add(fill);

    // --- Desk (north interior) ------------------------------------------------
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 1.0), floorMat);
    const deskZ = this.cz - halfD + 0.7;
    desk.position.set(this.cx, 0.4, deskZ);
    desk.rotation.y = 0.04;
    this.group.add(desk);
    this.deskTop = new THREE.Vector3(this.cx, 0.81, deskZ);

    // --- Desk candle ----------------------------------------------------------
    // Right side of the desk. Acts as a local fill light and reads as
    // human-presence; the flame sits a bit above the wax so the point light
    // illuminates the desk surface and the carved beam-letter overhead.
    const candleX = this.cx + 0.6;
    const candleZ = deskZ + 0.15;
    const wax = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.045, 0.18, 12),
      new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.85 }),
    );
    wax.position.set(candleX, 0.81 + 0.09, candleZ);
    this.group.add(wax);
    const flame = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.04, 0),
      new THREE.MeshBasicMaterial({ color: 0xffe0a0, fog: false }),
    );
    flame.scale.set(1, 1.6, 1);
    flame.position.set(candleX, 0.81 + 0.22, candleZ);
    this.group.add(flame);
    this.candleFlame = flame;
    this.candleLight = new THREE.PointLight(0xffc878, 1.6, 4.5, 1.4);
    this.candleLight.position.copy(flame.position);
    this.group.add(this.candleLight);

    // --- Chair (next to desk) -------------------------------------------------
    const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.7), floorMat);
    const chairX = this.cx + 1.1;
    const chairZ = deskZ + 0.9;
    chairSeat.position.set(chairX, 0.46, chairZ);
    chairSeat.rotation.y = -0.2;
    this.group.add(chairSeat);
    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.08), floorMat);
    chairBack.position.set(chairX, 0.85, chairZ + 0.31);
    chairBack.rotation.y = -0.2;
    this.group.add(chairBack);
    for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.06), floorMat);
      leg.position.set(chairX + dx, 0.23, chairZ + dz);
      this.group.add(leg);
    }
    // Place where the rune is carved on the underside of the seat. Slight
    // offset below the seat bottom (0.42) avoids z-fighting with the seat.
    this.chairUnderside = new THREE.Vector3(chairX, 0.40, chairZ);

    // --- Fireplace (west interior wall) ---------------------------------------
    // A black recess in the west wall with a faint ember glow at its base.
    const hearthW = 1.6;
    const hearthH = 1.4;
    const hearthD = 0.5;
    const hearthX = this.cx - halfW + this.wallT + hearthD / 2 + 0.001;
    const hearthZ = this.cz - 0.6;
    const hearth = new THREE.Mesh(
      new THREE.BoxGeometry(hearthD, hearthH, hearthW),
      new THREE.MeshStandardMaterial({ color: 0x05030a, roughness: 1 }),
    );
    hearth.position.set(hearthX, hearthH / 2, hearthZ);
    this.group.add(hearth);

    const mantle = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.12, hearthW + 0.4), darkWoodMat,
    );
    mantle.position.set(hearthX + 0.05, hearthH + 0.1, hearthZ);
    this.group.add(mantle);

    const ember = new THREE.PointLight(0xa8552a, 1.1, 3.2, 1.8);
    ember.position.set(hearthX + 0.1, 0.25, hearthZ);
    this.group.add(ember);
    this.ember = ember;
    // Anchor for the soot rune. Place just in front of the hearth's east
    // (cabin-facing) face so it's visible from inside without z-fighting.
    this.hearthPos = new THREE.Vector3(hearthX + hearthD / 2 + 0.01, 0.55, hearthZ);

    // --- Couch (GLB, center of room, facing the hearth) ----------------------
    // Async load — placeholder Group reserves the world transform so collider
    // and coffeeTableTop anchors stay valid even before the model arrives.
    const couchPlaceholder = new THREE.Group();
    couchPlaceholder.position.set(this.cx - 0.2, 0, this.cz);
    couchPlaceholder.rotation.y = Math.PI / 2;
    this.group.add(couchPlaceholder);
    loadAndNormalize(
      `${import.meta.env.BASE_URL}old_reliable_couch.glb`,
      { targetHeight: 0.78 },
    ).then((mesh) => couchPlaceholder.add(mesh))
      .catch((err) => console.warn('Cabin: couch GLB failed to load', err));
    // Couch collider — independent of the model arriving, sized to the
    // expected scaled bbox (1.7m long × 0.85m deep). Group is rotated 90°,
    // so length runs along world Z.
    movement.addColliders([{
      minX: this.cx - 0.6, maxX: this.cx + 0.25,
      minZ: this.cz - 0.85, maxZ: this.cz + 0.85,
    }]);

    // --- Coffee table (GLB, between couch and hearth) ------------------------
    const tableTopY = 0.42;
    const tableX = this.cx - 1.5;
    const tablePlaceholder = new THREE.Group();
    tablePlaceholder.position.set(tableX, 0, this.cz);
    this.group.add(tablePlaceholder);
    loadAndNormalize(
      `${import.meta.env.BASE_URL}wooden_table.glb`,
      { targetHeight: tableTopY },
    ).then((mesh) => tablePlaceholder.add(mesh))
      .catch((err) => console.warn('Cabin: table GLB failed to load', err));
    movement.addColliders([{
      minX: tableX - 0.55, maxX: tableX + 0.55,
      minZ: this.cz - 0.30, maxZ: this.cz + 0.30,
    }]);
    this.coffeeTableTop = new THREE.Vector3(tableX, tableTopY + 0.02, this.cz);

    // --- Beam (above interior, decorative) ------------------------------------
    // Single cross-beam running E-W under the roof; its underside is where
    // the beam-rune clue is carved.
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(this.w - 0.4, 0.18, 0.2), darkWoodMat,
    );
    beam.position.set(this.cx, this.h - 0.4, this.cz);
    this.group.add(beam);
    this.beamPos = new THREE.Vector3(this.cx, this.h - 0.55, this.cz);

    // Anchor for the dial: just inside the door, above eye-level isn't great
    // for clicking. Mount it at chest height on the door itself.
    this.doorInteriorAnchor = new THREE.Vector3(
      this.cx, 1.2, this.cz + halfD - 0.06,
    );

    this.interiorAABB = {
      minX: this.cx - halfW + 0.5,
      maxX: this.cx + halfW - 0.5,
      minZ: this.cz - halfD + 0.5,
      maxZ: this.cz + halfD - 0.5,
    };

    scene.add(this.group);
  }

  _addWall(mat, cx, cz, sx, sz) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, this.h, sz), mat);
    mesh.position.set(cx, this.h / 2, cz);
    mesh.rotation.z = (Math.random() - 0.5) * 0.012;
    this.group.add(mesh);
  }

  _wallColliders() {
    const halfW = this.w / 2;
    const halfD = this.d / 2;
    const halfDoor = this.doorW / 2;
    const t = this.wallT / 2;
    return [
      { minX: this.cx - halfW, maxX: this.cx + halfW, minZ: this.cz - halfD - t, maxZ: this.cz - halfD + t },
      { minX: this.cx + halfW - t, maxX: this.cx + halfW + t, minZ: this.cz - halfD, maxZ: this.cz + halfD },
      { minX: this.cx - halfW - t, maxX: this.cx - halfW + t, minZ: this.cz - halfD, maxZ: this.cz + halfD },
      { minX: this.cx - halfW, maxX: this.cx - halfDoor, minZ: this.cz + halfD - t, maxZ: this.cz + halfD + t },
      { minX: this.cx + halfDoor, maxX: this.cx + halfW, minZ: this.cz + halfD - t, maxZ: this.cz + halfD + t },
    ];
  }

  isPlayerInside(p = this.movement.getPosition()) {
    const a = this.interiorAABB;
    return p.x >= a.minX && p.x <= a.maxX && p.z >= a.minZ && p.z <= a.maxZ;
  }

  openDoor() {
    if (this.doorState === 'opening' || this.doorState === 'open') return;
    this.doorState = 'opening';
    this.doorRotTarget = Math.PI / 2;
  }

  _setDoorColliderClosed(closed) {
    if (closed) {
      const halfDoor = this.doorW / 2;
      const t = this.wallT / 2 + 0.05;
      this.doorCollider.minX = this.cx - halfDoor;
      this.doorCollider.maxX = this.cx + halfDoor;
      this.doorCollider.minZ = this.cz + this.d / 2 - t;
      this.doorCollider.maxZ = this.cz + this.d / 2 + t;
    } else {
      this.doorCollider.minX = 1e6;
      this.doorCollider.maxX = 1e6 + 1;
      this.doorCollider.minZ = 1e6;
      this.doorCollider.maxZ = 1e6 + 1;
    }
  }

  update(dt) {
    // Animate door rotation toward target.
    if (this.doorState === 'closing' || this.doorState === 'opening') {
      const cur = this.doorHinge.rotation.y;
      const k = 1 - Math.exp(-dt * 4); // exponential ease toward target
      const next = cur + (this.doorRotTarget - cur) * k;
      this.doorHinge.rotation.y = next;

      if (Math.abs(next - this.doorRotTarget) < 0.01) {
        this.doorHinge.rotation.y = this.doorRotTarget;
        if (this.doorState === 'closing') {
          this.doorState = 'closed';
          this._setDoorColliderClosed(true);
        } else {
          this.doorState = 'open';
          this._setDoorColliderClosed(false);
        }
      }
    }

    // Ember + candle flicker. Each driven by two unrelated frequencies so
    // the flicker reads organic rather than periodic.
    const t = performance.now() * 0.001;
    this.ember.intensity = 1.0 + Math.sin(t * 3.7) * 0.16 + Math.sin(t * 7.3) * 0.1;
    if (this.candleLight) {
      const f = 1.5 + Math.sin(t * 9.1) * 0.18 + Math.sin(t * 4.3) * 0.12;
      this.candleLight.intensity = f;
      // Tiny flame stretch so the silhouette reads as alive.
      this.candleFlame.scale.y = 1.55 + Math.sin(t * 11.0) * 0.18;
    }
  }
}

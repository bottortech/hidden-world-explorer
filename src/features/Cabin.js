import * as THREE from 'three';
import { COLORS } from '../utils/colors.js';
import { smoothstep } from '../utils/math.js';

// Abandoned, weathered cabin sitting in a clearing in the NE forest. Single
// 6×6 room, open south doorway. Two clickable interiors:
//   • Crystal shard on a desk — clicking lifts it to chest height where it
//     hovers, and reveals the rune trail toward the mystery zone.
//   • Wall-mounted glowing rune sigil — clicking flares its glow briefly
//     (atmospheric only; no progression effect).
//
// Walls are exposed as AABB colliders via `getColliders()` so MovementSystem
// can stop the player at solid surfaces. The doorway gap is left clear so
// the player can walk in.
//
// To extend: add weathered planks (slight gaps between wall pieces), a
// flickering candle, fallen objects, or a second room.
export class Cabin {
  constructor(scene, interaction, movement, objectives, runeTrail) {
    this.movement = movement;
    this.objectives = objectives;
    this.runeTrail = runeTrail;

    // Cabin footprint centered on (22, -22). Single open doorway in the
    // south wall (player approaches from the south along the path).
    this.cx = 22;
    this.cz = -22;
    this.w = 6;          // outer width along X
    this.d = 6;          // outer depth along Z
    this.h = 3;          // wall height
    this.wallT = 0.2;    // wall thickness
    this.doorW = 1.6;    // doorway opening width

    this.group = new THREE.Group();
    this.group.name = 'cabin';

    const woodMat = new THREE.MeshStandardMaterial({
      color: COLORS.wood,
      roughness: 1,
      flatShading: true,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: COLORS.woodAccent,
      roughness: 1,
    });

    // --- Floor & roof ---------------------------------------------------------
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(this.w, 0.1, this.d),
      floorMat,
    );
    floor.position.set(this.cx, 0.05, this.cz);
    this.group.add(floor);

    // Slightly oversized roof slab with a small weathered tilt — reads as
    // "abandoned" without needing a real gable.
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(this.w + 0.5, 0.18, this.d + 0.5),
      woodMat,
    );
    roof.position.set(this.cx, this.h + 0.09, this.cz);
    roof.rotation.z = 0.025;
    roof.rotation.x = -0.012;
    this.group.add(roof);

    // --- Walls ----------------------------------------------------------------
    // Wall positions are computed from the footprint so changing w/d/cx/cz
    // automatically rebuilds correctly. Light random tilt per wall reads
    // as weathered.
    const halfW = this.w / 2;
    const halfD = this.d / 2;
    const halfDoor = this.doorW / 2;
    const sideLen = halfW - halfDoor;

    // North wall (z = cz - halfD): full width
    this._addWall(woodMat, this.cx, this.cz - halfD, this.w, this.wallT);
    // East wall (x = cx + halfW): full depth
    this._addWall(woodMat, this.cx + halfW, this.cz, this.wallT, this.d);
    // West wall
    this._addWall(woodMat, this.cx - halfW, this.cz, this.wallT, this.d);
    // South wall: split into two segments around the doorway
    this._addWall(
      woodMat,
      this.cx - halfDoor - sideLen / 2,
      this.cz + halfD,
      sideLen,
      this.wallT,
    );
    this._addWall(
      woodMat,
      this.cx + halfDoor + sideLen / 2,
      this.cz + halfD,
      sideLen,
      this.wallT,
    );
    // South wall lintel above doorway (decorative — not a collider, so
    // player can pass under freely).
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(this.doorW + 0.05, 0.6, this.wallT),
      woodMat,
    );
    lintel.position.set(this.cx, this.h - 0.3, this.cz + halfD);
    this.group.add(lintel);

    // --- Interior light -------------------------------------------------------
    // Faint warm glow from the ceiling — inviting but mysterious. Falls off
    // before bleeding much through the doorway.
    this.interiorLight = new THREE.PointLight(COLORS.warmLight, 1.6, 7.5, 1.6);
    this.interiorLight.position.set(this.cx, this.h - 0.5, this.cz);
    this.group.add(this.interiorLight);

    // --- Desk (north interior) ------------------------------------------------
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.8, 1.0),
      floorMat,
    );
    const deskZ = this.cz - halfD + 0.7; // pushed against north wall
    desk.position.set(this.cx, 0.4, deskZ);
    desk.rotation.y = 0.04;
    this.group.add(desk);

    // --- Crystal shard (artifact) --------------------------------------------
    // Click → lifts to chest height, hovers, rotates, reveals rune trail.
    this.shardStartPos = new THREE.Vector3(this.cx, 0.95, deskZ);
    this.shardHoverPos = new THREE.Vector3(this.cx + 0.1, 1.45, deskZ + 0.7);

    const shardMat = new THREE.MeshStandardMaterial({
      color: 0xe8d8ff,
      emissive: COLORS.cubeEmissive,
      emissiveIntensity: 1.0,
      roughness: 0.25,
      transparent: true,
      opacity: 0.92,
    });
    this.shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), shardMat);
    this.shard.position.copy(this.shardStartPos);
    this.shard.scale.set(0.85, 1.4, 0.85); // elongated like a crystal
    this.group.add(this.shard);

    // Soft point light on the shard so it casts on the desk + walls.
    this.shardLight = new THREE.PointLight(COLORS.cubeEmissive, 0.7, 4, 1.5);
    this.shardLight.position.copy(this.shardStartPos);
    this.group.add(this.shardLight);

    this.shardActivated = false;
    this.shardActivatedAt = 0;

    interaction.add({
      object: this.shard,
      onClick: () => {
        // Walls aren't in the raycast list, so without this gate a player
        // standing outside could click the shard through a wall.
        if (!this._playerInside()) return;
        this._activateShard();
      },
    });

    // --- Wall rune sigil (note) ----------------------------------------------
    // Mounted on the east interior wall, faces west into the room.
    const runeTex = makeRuneTexture();
    const runeMat = new THREE.MeshBasicMaterial({
      map: runeTex,
      color: COLORS.rune,
      transparent: true,
      opacity: 0.85,
      fog: false,
      side: THREE.DoubleSide,
    });
    this.runeSigil = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), runeMat);
    this.runeSigil.position.set(this.cx + halfW - 0.12, 1.7, this.cz);
    this.runeSigil.rotation.y = -Math.PI / 2;
    this.group.add(this.runeSigil);

    this.runeFlashAt = 0;

    interaction.add({
      object: this.runeSigil,
      onClick: () => {
        if (!this._playerInside()) return;
        this.runeFlashAt = performance.now();
      },
    });

    // --- Entry detection ------------------------------------------------------
    // Fires once when player crosses into the interior AABB (slightly inset
    // from the walls so the trigger only fires after they're really inside).
    this.entered = false;
    this.interiorAABB = {
      minX: this.cx - halfW + 0.5,
      maxX: this.cx + halfW - 0.5,
      minZ: this.cz - halfD + 0.5,
      maxZ: this.cz + halfD - 0.5,
    };

    scene.add(this.group);
  }

  // Internal helper — adds a wall mesh AND records its AABB for collision.
  _addWall(mat, cx, cz, sx, sz) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, this.h, sz), mat);
    mesh.position.set(cx, this.h / 2, cz);
    // Subtle weathering — each wall leans a hair off-true.
    mesh.rotation.z = (Math.random() - 0.5) * 0.012;
    this.group.add(mesh);
  }

  // Returns AABBs for the player-blocking walls. Lintel is omitted so the
  // player can walk under the doorway.
  getColliders() {
    const halfW = this.w / 2;
    const halfD = this.d / 2;
    const halfDoor = this.doorW / 2;
    const sideLen = halfW - halfDoor;
    const t = this.wallT / 2;

    return [
      // North
      {
        minX: this.cx - halfW, maxX: this.cx + halfW,
        minZ: this.cz - halfD - t, maxZ: this.cz - halfD + t,
      },
      // East
      {
        minX: this.cx + halfW - t, maxX: this.cx + halfW + t,
        minZ: this.cz - halfD, maxZ: this.cz + halfD,
      },
      // West
      {
        minX: this.cx - halfW - t, maxX: this.cx - halfW + t,
        minZ: this.cz - halfD, maxZ: this.cz + halfD,
      },
      // South — left segment
      {
        minX: this.cx - halfW, maxX: this.cx - halfDoor,
        minZ: this.cz + halfD - t, maxZ: this.cz + halfD + t,
      },
      // South — right segment
      {
        minX: this.cx + halfDoor, maxX: this.cx + halfW,
        minZ: this.cz + halfD - t, maxZ: this.cz + halfD + t,
      },
    ];
  }

  _activateShard() {
    if (this.shardActivated) return;
    this.shardActivated = true;
    this.shardActivatedAt = performance.now();
    this.runeTrail?.reveal();
  }

  // Player center inside the interior AABB. Used to gate clicks on interior
  // objects so they can't be triggered through walls from outside.
  _playerInside() {
    const p = this.movement.getPosition();
    const a = this.interiorAABB;
    return p.x >= a.minX && p.x <= a.maxX && p.z >= a.minZ && p.z <= a.maxZ;
  }

  update(dt) {
    const now = performance.now();
    const t = now * 0.001;

    // Cabin entry detection — fires once. Gated to step ≥ 3 so wandering
    // into the cabin before the pillar is activated doesn't out-of-order
    // the chain.
    if (!this.entered && this.objectives && this.objectives.step() >= 3) {
      const p = this.movement.getPosition();
      const a = this.interiorAABB;
      if (p.x >= a.minX && p.x <= a.maxX && p.z >= a.minZ && p.z <= a.maxZ) {
        this.entered = true;
        this.objectives.advanceTo(4);
      }
    }

    // Shard idle: gentle bob + slow rotate so it reads as "alive".
    this.shard.rotation.y += dt * 0.6;
    if (!this.shardActivated) {
      this.shard.position.y = this.shardStartPos.y + Math.sin(t * 1.2) * 0.015;
    } else {
      // Activation: lerp from desk to chest-height hover, ease-out.
      const elapsed = (now - this.shardActivatedAt) / 1000;
      const lift = smoothstep(0, 1.5, elapsed);
      const bob = lift * Math.sin(t * 1.6) * 0.06;
      this.shard.position.lerpVectors(this.shardStartPos, this.shardHoverPos, lift);
      this.shard.position.y += bob;
      // Brief brightness flare on activation that decays into a steady glow.
      const flare = Math.exp(-elapsed * 1.2);
      this.shard.material.emissiveIntensity = 1.0 + flare * 1.8;
      this.shardLight.intensity = 0.7 + flare * 1.6;
    }
    // Shard light always tracks the shard so the glow follows it as it lifts.
    this.shardLight.position.copy(this.shard.position);

    // Wall rune: subtle ambient pulse, plus a brighter flare-and-decay
    // when clicked.
    const basePulse = 0.75 + Math.sin(t * 1.0) * 0.12;
    let flash = 0;
    if (this.runeFlashAt) {
      const since = (now - this.runeFlashAt) / 1000;
      flash = Math.max(0, Math.exp(-since * 2.2)) * 0.6;
      if (since > 2.5) this.runeFlashAt = 0;
    }
    this.runeSigil.material.opacity = Math.min(1, basePulse + flash);
  }
}

// Procedural rune texture — drawn once via canvas, used as the sigil's
// alpha-bearing color map. A circle, an inner triangle, and a center mark
// read as "occult symbol" without committing to anything specific.
function makeRuneTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';

  const c = size / 2;

  // Outer circle
  ctx.beginPath();
  ctx.arc(c, c, c - 24, 0, Math.PI * 2);
  ctx.stroke();

  // Inner triangle (apex up)
  const tr = c - 56;
  ctx.beginPath();
  ctx.moveTo(c, c - tr);
  ctx.lineTo(c + tr * 0.866, c + tr * 0.5);
  ctx.lineTo(c - tr * 0.866, c + tr * 0.5);
  ctx.closePath();
  ctx.stroke();

  // Inner center dot
  ctx.beginPath();
  ctx.arc(c, c, 10, 0, Math.PI * 2);
  ctx.fill();

  // Three short tick marks pointing inward, evenly placed on the circle
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
    const x1 = c + Math.cos(angle) * (c - 24);
    const y1 = c + Math.sin(angle) * (c - 24);
    const x2 = c + Math.cos(angle) * (c - 50);
    const y2 = c + Math.sin(angle) * (c - 50);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

import * as THREE from 'three';
import { Clue } from './Clue.js';
import { ComboLock } from './ComboLock.js';

// Room 2 (Attic) shell. Sealed-room geometry placed far from the cabin in
// world coordinates so the two rooms can coexist in the same scene without
// the player ever walking between them — transitions teleport instead.
//
// This pass scaffolds the room: walls/floor/roof, a single sloped beam, a
// dim warm bulb, a door with a combo lock, and one placeholder crate prop
// to verify the clue/inspect pipeline. Real attic content (boxes, photo
// albums, toys, hidden compartments) lands in a follow-up.
//
// Placeholder solution: "OUT" — the crate's flavor text emphasizes one
// letter so a player can immediately validate the lock works.
export class Attic {
  constructor({
    scene, movement, interaction, journal, inspect, save, onSolved,
    origin = [200, 0, 0],
  }) {
    this.movement = movement;
    this.cx = origin[0];
    this.cy = origin[1];
    this.cz = origin[2];
    this.w = 8;
    this.d = 6;
    this.h = 2.5;
    this.wallT = 0.2;
    this.doorW = 1.4;
    this.doorH = 2.1;

    this.group = new THREE.Group();
    this.group.name = 'attic';

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x4a3324, roughness: 1, flatShading: true,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x3a2a1c, roughness: 1,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x251910, roughness: 1, flatShading: true,
    });

    // Floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(this.w, 0.1, this.d), floorMat);
    floor.position.set(this.cx, this.cy + 0.05, this.cz);
    this.group.add(floor);

    // Roof
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(this.w + 0.4, 0.18, this.d + 0.4), woodMat,
    );
    roof.position.set(this.cx, this.cy + this.h + 0.09, this.cz);
    this.group.add(roof);

    // Walls (door cut into south wall)
    const halfW = this.w / 2;
    const halfD = this.d / 2;
    const halfDoor = this.doorW / 2;
    const sideLen = halfW - halfDoor;
    this._addWall(woodMat, this.cx, this.cz - halfD, this.w, this.wallT);
    this._addWall(woodMat, this.cx + halfW, this.cz, this.wallT, this.d);
    this._addWall(woodMat, this.cx - halfW, this.cz, this.wallT, this.d);
    this._addWall(woodMat, this.cx - halfDoor - sideLen / 2, this.cz + halfD, sideLen, this.wallT);
    this._addWall(woodMat, this.cx + halfDoor + sideLen / 2, this.cz + halfD, sideLen, this.wallT);
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(this.doorW + 0.05, 0.4, this.wallT), woodMat,
    );
    lintel.position.set(
      this.cx, this.cy + this.doorH + 0.2, this.cz + halfD,
    );
    this.group.add(lintel);

    // Cross-rafters for attic feel
    for (const offset of [-1.6, 0, 1.6]) {
      const rafter = new THREE.Mesh(
        new THREE.BoxGeometry(this.w - 0.4, 0.16, 0.18), darkMat,
      );
      rafter.position.set(this.cx, this.cy + this.h - 0.4, this.cz + offset);
      this.group.add(rafter);
    }

    // Door
    this.doorHinge = new THREE.Group();
    this.doorHinge.position.set(
      this.cx - halfDoor, this.cy + this.doorH / 2, this.cz + halfD,
    );
    this.group.add(this.doorHinge);
    const doorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.doorW, this.doorH, 0.08), darkMat,
    );
    doorMesh.position.set(this.doorW / 2, 0, 0);
    this.doorHinge.add(doorMesh);

    this.doorState = 'closed';
    this.doorRotTarget = 0;
    this.doorHinge.rotation.y = 0;

    this.doorCollider = { minX: 1e6, maxX: 1e6 + 1, minZ: 1e6, maxZ: 1e6 + 1 };
    movement.addColliders([this.doorCollider]);
    this._setDoorColliderClosed(true);

    // Wall colliders
    movement.addColliders(this._wallColliders());

    // Warm bulb hanging from a rafter — main light source.
    const bulbLight = new THREE.PointLight(0xffd095, 2.6, 9, 1.3);
    bulbLight.position.set(this.cx, this.cy + this.h - 0.55, this.cz);
    this.group.add(bulbLight);
    this.bulbLight = bulbLight;
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe3a0, fog: false }),
    );
    bulb.position.copy(bulbLight.position);
    this.group.add(bulb);

    // Subtle violet fill so far corners don't crush.
    const fill = new THREE.PointLight(0x6a4a78, 0.5, 9, 1.4);
    fill.position.set(this.cx, this.cy + 1.0, this.cz);
    this.group.add(fill);

    // --- Placeholder prop: dusty crate ---------------------------------------
    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x4a3220, emissive: 0x9a6a3a, emissiveIntensity: 0.4, roughness: 1,
    });
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), crateMat);
    crate.position.set(this.cx + 1.2, this.cy + 0.25, this.cz - 0.6);
    this.group.add(crate);
    this.crateMat = crateMat;

    const inside = () => this.isPlayerInside();

    new Clue(interaction, journal, inspect, {
      id: 'attic-crate',
      title: 'A dusty wooden crate',
      body:
        'Stencilled on the side, half-rubbed off:\n\n  HOLD WI*T*H CARE — DO NOT OPEN\n\n' +
        'Heavy. Whatever\'s inside shifts when you nudge it.',
      location: 'Attic · floor',
      object: crate,
      gate: inside,
    });

    // --- Door lock -----------------------------------------------------------
    const lockMount = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfde7b3, transparent: true, opacity: 0.85,
        fog: false, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    lockMount.position.set(this.cx, this.cy + 1.2, this.cz + halfD - 0.06);
    lockMount.rotation.y = Math.PI;
    this.group.add(lockMount);
    this.lockMount = lockMount;

    new ComboLock(interaction, inspect, save, {
      id: 'attic',
      object: lockMount,
      solution: 'OUT',
      gate: inside,
      onSolved: () => onSolved?.(),
    });

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
    mesh.position.set(cx, this.cy + this.h / 2, cz);
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

  isPlayerInside(p = this.movement.getPosition()) {
    const a = this.interiorAABB;
    return p.x >= a.minX && p.x <= a.maxX && p.z >= a.minZ && p.z <= a.maxZ;
  }

  openDoor() {
    if (this.doorState === 'opening' || this.doorState === 'open') return;
    this.doorState = 'opening';
    this.doorRotTarget = Math.PI / 2;
  }

  update(dt) {
    if (this.doorState === 'closing' || this.doorState === 'opening') {
      const cur = this.doorHinge.rotation.y;
      const k = 1 - Math.exp(-dt * 4);
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

    // Bulb sway / flicker
    const t = performance.now() * 0.001;
    if (this.bulbLight) {
      this.bulbLight.intensity = 2.5 + Math.sin(t * 2.3) * 0.18;
    }
  }
}

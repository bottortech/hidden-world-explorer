import * as THREE from 'three';
import { Clue } from './Clue.js';
import { ComboLock } from './ComboLock.js';
import { Key } from './Key.js';

// Room 2: dusty attic. Sealed-room geometry placed far from the cabin in
// world coordinates so both rooms can coexist; transitions teleport the
// player between them.
//
// Solution: "MAP"
//   Music box     → M    ("Property of *M*ariel")
//   Folded map    → A    ("*A*shwood County")
//   Postcard      → P    ("Dear *P*apa")
//
// Plus an order hint ("First the music. Then the road. Then the message.")
// and three lore props: wooden train, hat box, stack of newspapers.
export class Attic {
  constructor({
    scene, movement, interaction, journal, inspect, save, hand, onSolved,
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

    movement.addColliders(this._wallColliders());

    // --- Lighting -------------------------------------------------------------
    // Two warm bulbs hanging from rafters cover the long axis; a violet fill
    // and a candle on the workbench keep corners legible.
    const bulb1 = new THREE.PointLight(0xffd095, 4.0, 12, 1.1);
    bulb1.position.set(this.cx - 1.8, this.cy + this.h - 0.55, this.cz);
    this.group.add(bulb1);
    const bulb2 = new THREE.PointLight(0xffd095, 4.0, 12, 1.1);
    bulb2.position.set(this.cx + 1.8, this.cy + this.h - 0.55, this.cz);
    this.group.add(bulb2);
    this.bulbLights = [bulb1, bulb2];
    for (const b of this.bulbLights) {
      const bulbMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xffe3a0, fog: false }),
      );
      bulbMesh.position.copy(b.position);
      this.group.add(bulbMesh);
    }

    // Violet fill so corners aren't crushed
    const fill = new THREE.PointLight(0x6a4a78, 0.9, 12, 1.4);
    fill.position.set(this.cx, this.cy + 1.0, this.cz);
    this.group.add(fill);

    // Window-light fake: a soft blue rectangle of light from "outside" through
    // the small window we'll add on the north wall.
    const windowGlow = new THREE.PointLight(0x8aa6c8, 1.2, 6, 1.3);
    windowGlow.position.set(this.cx, this.cy + 1.6, this.cz - halfD + 0.4);
    this.group.add(windowGlow);

    // --- Window on north wall (visual only) -----------------------------------
    const windowFrame = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.7),
      new THREE.MeshBasicMaterial({ color: 0x9ab4d6, fog: false, side: THREE.DoubleSide }),
    );
    windowFrame.position.set(this.cx, this.cy + 1.7, this.cz - halfD + 0.01);
    this.group.add(windowFrame);

    // --- Workbench against the east wall --------------------------------------
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x3d2a1c, roughness: 1 });
    const benchTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.06, 2.4), benchMat,
    );
    const benchX = this.cx + halfW - 0.4;
    const benchZ = this.cz;
    benchTop.position.set(benchX, this.cy + 0.78, benchZ);
    this.group.add(benchTop);
    for (const dz of [-1.05, 1.05]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.78, 0.07), benchMat,
      );
      leg.position.set(benchX, this.cy + 0.39, benchZ + dz);
      this.group.add(leg);
    }
    const benchTop_y = this.cy + 0.81;

    // Candle on the workbench (extra local light + atmosphere)
    const wax = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.045, 0.18, 12),
      new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.85 }),
    );
    wax.position.set(benchX, benchTop_y + 0.09, benchZ - 0.9);
    this.group.add(wax);
    const flame = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.04, 0),
      new THREE.MeshBasicMaterial({ color: 0xffe0a0, fog: false }),
    );
    flame.scale.set(1, 1.6, 1);
    flame.position.set(benchX, benchTop_y + 0.22, benchZ - 0.9);
    this.group.add(flame);
    this.candleFlame = flame;
    this.candleLight = new THREE.PointLight(0xffc878, 1.8, 4.5, 1.4);
    this.candleLight.position.copy(flame.position);
    this.group.add(this.candleLight);

    const inside = () => this.isPlayerInside();
    const playerName = save.displayPlayerName();

    // --- Order hint: chalk note pinned to the workbench wall ------------------
    const noteMesh = makeNoteMesh();
    noteMesh.position.set(benchX - 0.3, benchTop_y + 0.005, benchZ - 0.4);
    noteMesh.rotation.y = -0.15;
    this.group.add(noteMesh);
    new Clue(interaction, journal, inspect, hand, {
      id: 'attic-note',
      title: 'A scrap pinned to the wall',
      body: 'Childlike letters in chalk-blue pencil:\n\n  "First the music. Then the road. Then the message."',
      room: 'attic',
      location: 'Attic · workbench',
      object: noteMesh,
      gate: inside,
    });

    // --- Clue M: music box ----------------------------------------------------
    const musicBox = makeMusicBoxMesh();
    musicBox.position.set(benchX - 0.05, benchTop_y + 0.06, benchZ + 0.0);
    musicBox.rotation.y = -0.2;
    this.group.add(musicBox);
    new Clue(interaction, journal, inspect, hand, {
      id: 'attic-music',
      title: 'A small music box',
      body: 'Mahogany, latch tarnished. A brass plate is screwed to the lid:\n\n  Property of *M*ariel\n\nYou wind the crank a half-turn. A few notes stagger out, then nothing.',
      room: 'attic',
      location: 'Attic · workbench',
      object: musicBox,
      gate: inside,
    });

    // --- Clue A: folded map ---------------------------------------------------
    const folded = makeFoldedMapMesh();
    folded.position.set(benchX - 0.05, benchTop_y + 0.018, benchZ + 0.55);
    folded.rotation.y = 0.18;
    this.group.add(folded);
    new Clue(interaction, journal, inspect, hand, {
      id: 'attic-map',
      title: 'A folded county map',
      body: 'Brittle along the creases. The cover is stamped in faded ink:\n\n  *A*shwood County — Surveyors\' Edition\n\nMost of the interior is taken up by a road grid; one route is traced over twice in red.',
      room: 'attic',
      location: 'Attic · workbench',
      object: folded,
      gate: inside,
    });

    // --- Clue P: postcard -----------------------------------------------------
    const postcard = makePostcardMesh();
    postcard.position.set(benchX - 0.05, benchTop_y + 0.018, benchZ + 1.0);
    postcard.rotation.y = 0.18;
    this.group.add(postcard);
    new Clue(interaction, journal, inspect, hand, {
      id: 'attic-postcard',
      title: 'A faded postcard',
      body:
        'A picture of a long pier on the front. The handwritten side reads:\n\n' +
        `  Sent to: ${playerName}\n\n` +
        '  "Dear *P*apa,\n   the cabin is locked up tight. We won\'t go back. — A."',
      room: 'attic',
      location: 'Attic · workbench',
      object: postcard,
      gate: inside,
    });

    // --- Lore: wooden train (floor near west wall) ----------------------------
    const train = makeTrainMesh();
    train.position.set(this.cx - 1.6, this.cy + 0.06, this.cz + 0.4);
    train.rotation.y = 0.6;
    this.group.add(train);
    new Clue(interaction, journal, inspect, hand, {
      id: 'attic-train',
      title: 'A toy locomotive',
      body: 'Painted wood, paint chipped at the corners. The smokestack rattles when you tip it. There\'s no track up here for it to run on.',
      room: 'attic',
      location: 'Attic · floor',
      object: train,
      gate: inside,
    });

    // --- Lore: hat box (floor, NW corner) ------------------------------------
    const hatbox = makeHatboxMesh();
    hatbox.position.set(this.cx - halfW + 0.6, this.cy + 0.18, this.cz - halfD + 0.5);
    this.group.add(hatbox);
    new Clue(interaction, journal, inspect, hand, {
      id: 'attic-hatbox',
      title: 'A round hat box',
      body: 'The lid is laced shut with twine. You don\'t want to disturb it. A faded shipping tag hangs off the side, the address worn smooth.',
      room: 'attic',
      location: 'Attic · NW corner',
      object: hatbox,
      gate: inside,
    });

    // --- Lore: phonograph on a small crate (NW area) -------------------------
    const phonoCrate = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.45, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 1 }),
    );
    phonoCrate.position.set(this.cx - halfW + 1.2, this.cy + 0.225, this.cz - halfD + 0.7);
    this.group.add(phonoCrate);
    const phono = makePhonographMesh();
    phono.position.set(this.cx - halfW + 1.2, this.cy + 0.46, this.cz - halfD + 0.7);
    phono.rotation.y = 0.3;
    this.group.add(phono);
    new Clue(interaction, journal, inspect, hand, {
      id: 'attic-phonograph',
      title: 'A small phonograph',
      body: 'Cabinet wood, brass horn dented at the lip. The crank is missing. A label pasted to the inside of the open lid is faded but legible:\n\n  "Property of Brand & Son — Ashwood."',
      room: 'attic',
      location: 'Attic · NW corner',
      object: phono,
      gate: inside,
    });

    // --- Atmosphere: stack of crates against the south wall (decoration) -----
    const stack = makeCrateStack();
    stack.position.set(this.cx + halfW - 1.0, this.cy, this.cz + halfD - 0.7);
    this.group.add(stack);

    // --- Atmosphere: a couple of hanging tools on the east wall (decoration) -
    const tools = makeHangingTools();
    tools.position.set(this.cx + halfW - this.wallT - 0.06, this.cy + 1.55, this.cz - 1.6);
    tools.rotation.y = -Math.PI / 2;
    this.group.add(tools);

    // --- Lore: stack of newspapers -------------------------------------------
    const newsStack = makeNewspaperStack();
    newsStack.position.set(this.cx + 0.4, this.cy + 0.05, this.cz + halfD - 0.7);
    newsStack.rotation.y = -0.18;
    this.group.add(newsStack);
    new Clue(interaction, journal, inspect, hand, {
      id: 'attic-newspapers',
      title: 'A stack of newspapers',
      body: 'All folded the same way, stacked neatly. The top one is dated decades back. A headline is half-visible: SEARCH CALLED OFF — NO TRACE FOUND.',
      room: 'attic',
      location: 'Attic · floor',
      object: newsStack,
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

    // --- Key spawned on lock solve -------------------------------------------
    this.key = new Key({
      scene,
      interaction,
      hand,
      save,
      roomId: 'attic',
      position: [this.cx, this.cy + 1.05, this.cz + halfD - 0.32],
      onCollected: () => onSolved?.(),
    });

    new ComboLock(interaction, inspect, save, {
      id: 'attic',
      object: lockMount,
      solution: 'MAP',
      gate: inside,
      onSolved: () => this.key.activate(),
    });

    if (save.isRoomComplete('attic') && !save.hasKey('attic')) {
      this.key.activate();
    }

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

    const t = performance.now() * 0.001;
    if (this.bulbLights) {
      const flicker = Math.sin(t * 2.3) * 0.18 + Math.sin(t * 5.1) * 0.08;
      this.bulbLights[0].intensity = 4.0 + flicker;
      this.bulbLights[1].intensity = 4.0 - flicker;
    }
    if (this.candleLight) {
      const f = 1.7 + Math.sin(t * 9.1) * 0.2 + Math.sin(t * 4.3) * 0.14;
      this.candleLight.intensity = f;
      this.candleFlame.scale.y = 1.55 + Math.sin(t * 11.0) * 0.2;
    }
    this.key?.update?.(dt);
  }
}

// --- Prop mesh factories ----------------------------------------------------

function makeNoteMesh() {
  const group = new THREE.Group();
  const paper = new THREE.MeshStandardMaterial({
    color: 0xd9c9b1, emissive: 0x6a4f30, emissiveIntensity: 0.7, roughness: 1,
  });
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.005, 0.16), paper);
  group.add(sheet);
  return group;
}

function makeMusicBoxMesh() {
  const wood = new THREE.MeshStandardMaterial({
    color: 0x6a3a1c, emissive: 0xa86a30, emissiveIntensity: 0.45, roughness: 0.85,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xc89a4a, roughness: 0.5, metalness: 0.4,
  });
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.18), wood);
  group.add(body);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 0.19), wood);
  lid.position.y = 0.07;
  group.add(lid);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.005, 0.06), brass);
  plate.position.y = 0.085;
  group.add(plate);
  const crank = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), brass);
  crank.rotation.z = Math.PI / 2;
  crank.position.set(0.13, 0.0, 0);
  group.add(crank);
  return group;
}

function makeFoldedMapMesh() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xbfa888, emissive: 0x8a6a3a, emissiveIntensity: 0.45, roughness: 1,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.018, 0.22), mat);
  return m;
}

function makePostcardMesh() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xeac79a, emissive: 0xc88a4a, emissiveIntensity: 0.75, roughness: 1,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.025, 0.18), mat);
  return m;
}

function makeTrainMesh() {
  const red = new THREE.MeshStandardMaterial({
    color: 0x782a1a, emissive: 0x4a1a10, emissiveIntensity: 0.4, roughness: 0.85,
  });
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.9 });
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.10, 0.10), red);
  body.position.y = 0.08;
  group.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.10), red);
  cab.position.set(-0.06, 0.18, 0);
  group.add(cab);
  const stack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.08, 12), black,
  );
  stack.position.set(0.07, 0.18, 0);
  group.add(stack);
  for (const [x, z] of [[-0.07, 0.06], [0.07, 0.06], [-0.07, -0.06], [0.07, -0.06]]) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), black,
    );
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.04, z);
    group.add(wheel);
  }
  return group;
}

function makeHatboxMesh() {
  const cream = new THREE.MeshStandardMaterial({
    color: 0xc8b894, emissive: 0x6a5a3a, emissiveIntensity: 0.4, roughness: 1,
  });
  const ribbon = new THREE.MeshStandardMaterial({ color: 0x7a3a4a, roughness: 0.9 });
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.32, 24), cream);
  group.add(body);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.04, 24), cream);
  lid.position.y = 0.18;
  group.add(lid);
  const ribbon1 = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.02, 0.04), ribbon);
  ribbon1.position.y = 0.185;
  group.add(ribbon1);
  const ribbon2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.62), ribbon);
  ribbon2.position.y = 0.185;
  group.add(ribbon2);
  return group;
}

function makePhonographMesh() {
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.9 });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xc89a4a, emissive: 0x6a4a20, emissiveIntensity: 0.4, roughness: 0.45, metalness: 0.6,
  });
  const black = new THREE.MeshStandardMaterial({ color: 0x18120c, roughness: 1 });
  const group = new THREE.Group();
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.32), wood);
  cabinet.position.y = 0;
  group.add(cabinet);
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.012, 24), black);
  platter.position.set(0, 0.086, 0);
  group.add(platter);
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.04, 0.34, 16, 1, true), brass);
  horn.rotation.z = -Math.PI / 2;
  horn.position.set(0.20, 0.18, 0);
  group.add(horn);
  return group;
}

function makeCrateStack() {
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 1 });
  const lighter = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 1 });
  const group = new THREE.Group();
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), wood);
  c1.position.set(0, 0.25, 0);
  group.add(c1);
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.45), lighter);
  c2.position.set(0.05, 0.50 + 0.225, -0.05);
  c2.rotation.y = 0.18;
  group.add(c2);
  const c3 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), wood);
  c3.position.set(-0.5, 0.20, -0.1);
  c3.rotation.y = -0.12;
  group.add(c3);
  return group;
}

function makeHangingTools() {
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 1 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.7, metalness: 0.6 });
  const group = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.9), wood);
  group.add(board);
  // Hammer
  const hammerHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.32, 8), wood);
  hammerHandle.rotation.z = Math.PI / 2;
  hammerHandle.position.set(0.04, 0.0, -0.30);
  group.add(hammerHandle);
  const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.10), iron);
  hammerHead.position.set(0.04, 0.0, -0.46);
  group.add(hammerHead);
  // Saw
  const sawBlade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, 0.40), iron);
  sawBlade.position.set(0.04, 0.10, 0.18);
  group.add(sawBlade);
  const sawHandle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.10), wood);
  sawHandle.position.set(0.04, 0.10, -0.06);
  group.add(sawHandle);
  return group;
}

function makeNewspaperStack() {
  const paper = new THREE.MeshStandardMaterial({
    color: 0xc8b894, emissive: 0x4a3a28, emissiveIntensity: 0.35, roughness: 1,
  });
  const group = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.24), paper);
    sheet.position.y = 0.01 + i * 0.022;
    sheet.rotation.y = (i - 2) * 0.04;
    group.add(sheet);
  }
  return group;
}

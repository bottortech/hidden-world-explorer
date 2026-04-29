import * as THREE from 'three';
import { Clue } from './Clue.js';
import { ComboLock } from './ComboLock.js';
import { Key } from './Key.js';

// Room 1's puzzle layout. Builds on Cabin's geometry anchors. Owns six props:
//   • 4 clue items — desk note (order hint) + three prose clues whose body
//                    text contains the letter inline (rendered with a glow).
//   • 2 lore items — leather book (carries player name) and framed photo.
//
// Solution: "ASH"
//   Torn page    → A   ( + order hint "Page. Notebook. Photo." )
//   Notebook     → S
//   Photograph   → H
//
// onSolved is fired when the lock yields. Game wires this to the room
// transition so solving Room 1 fades into Room 2.
export class CabinInterior {
  constructor({ scene, cabin, interaction, journal, inspect, save, hand, onSolved }) {
    this.cabin = cabin;
    this.glowMeshes = [];

    const inside = () => cabin.isPlayerInside();
    const playerName = save.displayPlayerName();

    // --- Clue 1: torn page on the desk (order hint) --------------------------
    const note = makeNoteMesh();
    note.position.copy(cabin.deskTop);
    note.position.x -= 0.4;
    note.position.z -= 0.1;
    note.rotation.x = -Math.PI / 2;
    note.rotation.z = 0.18;
    scene.add(note);
    new Clue(interaction, journal, inspect, {
      id: 'cabin-note',
      title: 'Torn page',
      body:
        'Hand-scratched, smudged with soot:\n\n' +
        '  "Page. Notebook. Photo."\n\n' +
        'At the bottom, in the same shaky hand, a single character pressed deep into the paper:\n\n' +
        '  *A*',
      room: 'cabin',
      location: 'Cabin · desk',
      object: note,
      gate: inside,
    });

    // --- Clue 2: nameplate on the cross-beam (letter A) ----------------------
    const plaque = makePlaqueMesh();
    plaque.position.copy(cabin.beamPos);
    plaque.position.y -= 0.02;
    plaque.rotation.x = Math.PI / 2;
    scene.add(plaque);
    this.glowMeshes.push(plaque);
    new Clue(interaction, journal, inspect, {
      id: 'cabin-beam',
      title: 'A nameplate on the beam',
      body: 'A small wooden plaque is nailed to the underside of the cross-beam. A name is burned into it, the letters uneven where the iron slipped:\n\n  B. Brand',
      room: 'cabin',
      location: 'Cabin · roof beam',
      object: plaque,
      gate: inside,
    });

    // --- Clue 3: burned envelope in the hearth (letter S) --------------------
    const envelope = makeEnvelopeMesh();
    envelope.position.copy(cabin.hearthPos);
    envelope.position.x -= 0.05;
    envelope.position.y = 0.06;
    envelope.rotation.x = -Math.PI / 2;
    envelope.rotation.z = 0.12;
    scene.add(envelope);
    this.glowMeshes.push(envelope);
    new Clue(interaction, journal, inspect, {
      id: 'cabin-hearth',
      title: 'A burned envelope in the ash',
      body: 'Most of the envelope is gone — only a curl of paper at the edge of the hearth survived. You can still read the address:\n\n  …5 Ashwood Lane.\n\nThe rest crumbles when you touch it.',
      room: 'cabin',
      location: 'Cabin · hearth',
      object: envelope,
      gate: inside,
    });

    // --- Clue 4: folded letter under the chair (letter H) --------------------
    const folded = makeFoldedLetterMesh();
    folded.position.copy(cabin.chairUnderside);
    folded.position.y = 0.06;
    folded.rotation.y = 0.32;
    scene.add(folded);
    this.glowMeshes.push(folded);
    new Clue(interaction, journal, inspect, {
      id: 'cabin-chair',
      title: 'A folded letter wedged under the seat',
      body: 'The paper is brittle. A few lines, in a careful hand:\n\n  "…and so I write to you, dear Henry, in haste, before the cabin is sealed for the season…"',
      room: 'cabin',
      location: 'Cabin · chair',
      object: folded,
      gate: inside,
    });

    // --- Lore 1: leather book on the desk ------------------------------------
    const book = makeBookMesh();
    book.position.copy(cabin.deskTop);
    book.position.x += 0.1;
    book.position.z -= 0.18;
    book.position.y += 0.03;
    book.rotation.y = -0.18;
    scene.add(book);
    new Clue(interaction, journal, inspect, {
      id: 'cabin-book',
      title: 'A worn leather notebook',
      body:
        'The cover is cracked, the spine half loose. Inside the front board, in faded ink:\n\n' +
        `  Property of ${playerName}.\n\n` +
        'Most of the pages are blank. Among the few that are written on, one entry stands out:\n\n' +
        '  "...made it back before the storm. The cabin is *S*ealed for the season."',
      room: 'cabin',
      location: 'Cabin · desk',
      object: book,
      gate: inside,
    });

    // --- Lore 2: framed photograph on the west wall --------------------------
    const photo = makePhotoMesh();
    const halfW = cabin.w / 2;
    photo.position.set(cabin.cx - halfW + cabin.wallT + 0.02, 1.55, cabin.cz + 0.7);
    photo.rotation.y = Math.PI / 2;
    scene.add(photo);
    new Clue(interaction, journal, inspect, {
      id: 'cabin-photo',
      title: 'A framed photograph',
      body: 'Two figures stand in the cabin doorway, half-blurred by the long exposure. You can\'t quite make out their faces. On the back of the frame, in pencil:\n\n  "For *H*enry — Summer, before the snow."',
      room: 'cabin',
      location: 'Cabin · west wall',
      object: photo,
      gate: inside,
    });

    // --- Lore 3 (atmosphere): coat hung beside the door ----------------------
    const coat = makeCoatMesh();
    const halfD = cabin.d / 2;
    coat.position.set(cabin.cx + halfW - 0.18, 1.45, cabin.cz + halfD - 0.6);
    coat.rotation.y = -Math.PI / 2;
    scene.add(coat);
    new Clue(interaction, journal, inspect, {
      id: 'cabin-coat',
      title: 'A heavy oil-skin coat',
      body: 'Hanging on a peg, half-stiff with cold. The collar is patched with a stitched square of plain cloth. Inside the lining, a strip of canvas reads:\n\n  "Brand & Son — riggers — Ashwood."\n\nThe pockets are empty.',
      room: 'cabin',
      location: 'Cabin · door peg',
      object: coat,
      gate: inside,
    });

    // --- Atmosphere: shelf with three jars (decoration only, not clickable) --
    const shelfGroup = makeJarShelf();
    shelfGroup.position.set(cabin.cx + halfW - this.cabin.wallT - 0.18, 1.85, cabin.cz - 0.5);
    shelfGroup.rotation.y = -Math.PI / 2;
    scene.add(shelfGroup);

    // --- Lock on the door ----------------------------------------------------
    const lockMount = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfde7b3,
        transparent: true,
        opacity: 0.85,
        fog: false,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    lockMount.position.copy(cabin.doorInteriorAnchor);
    lockMount.rotation.y = Math.PI;
    scene.add(lockMount);
    this.lockMount = lockMount;

    // --- Key spawned on lock solve -------------------------------------------
    // Floats just in front of (and below) the lock disc, on the cabin-interior
    // side, so the player can walk up and click it after solving.
    const keyAnchor = cabin.doorInteriorAnchor;
    this.key = new Key({
      scene,
      interaction,
      hand,
      save,
      roomId: 'cabin',
      position: [keyAnchor.x, keyAnchor.y - 0.18, keyAnchor.z - 0.25],
      onCollected: () => onSolved?.(),
    });

    new ComboLock(interaction, inspect, save, {
      id: 'cabin',
      object: lockMount,
      solution: 'ASH',
      gate: inside,
      onSolved: () => this.key.activate(),
    });

    // If the player previously solved the lock but didn't yet pick up the
    // key (rare — would need to refresh between solve and pickup), offer
    // the key on load so they aren't soft-locked.
    if (save.isRoomComplete('cabin') && !save.hasKey('cabin')) {
      this.key.activate();
    }
  }

  update(dt) {
    const t = performance.now() * 0.001;
    const pulse = 0.92 + Math.sin(t * 1.3) * 0.08;
    for (const m of this.glowMeshes) {
      const mat = m.userData.glowMat ?? m.material;
      if (mat.emissive) mat.emissiveIntensity = pulse * 0.7;
    }
    if (this.lockMount) {
      this.lockMount.material.opacity = 0.7 + Math.sin(t * 1.1) * 0.18;
    }
    this.key?.update?.(dt);
  }
}

// --- Prop mesh factories ----------------------------------------------------

function makeNoteMesh() {
  const group = new THREE.Group();
  const paper = new THREE.MeshStandardMaterial({
    color: 0xd9c9b1, emissive: 0x6a4f30, emissiveIntensity: 0.6, roughness: 1,
  });
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.005, 0.24), paper);
  group.add(sheet);
  const crease = new THREE.Mesh(
    new THREE.BoxGeometry(0.001, 0.006, 0.24),
    new THREE.MeshBasicMaterial({ color: 0x6b5a40 }),
  );
  crease.position.y = 0.003;
  group.add(crease);
  return group;
}

function makePlaqueMesh() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4a3422, emissive: 0xa86a30, emissiveIntensity: 0.5, roughness: 0.9,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.16), mat);
  m.userData.glowMat = mat;
  return m;
}

function makeEnvelopeMesh() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3a2418, emissive: 0xc97a3a, emissiveIntensity: 0.55, roughness: 1,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.16), mat);
  m.userData.glowMat = mat;
  return m;
}

function makeFoldedLetterMesh() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc9b994, emissive: 0xb88a4a, emissiveIntensity: 0.5, roughness: 1,
  });
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.014, 0.12), mat);
  group.add(sheet);
  group.userData.glowMat = mat;
  return group;
}

function makeBookMesh() {
  const cover = new THREE.MeshStandardMaterial({ color: 0x4a1f1a, roughness: 0.8 });
  const pages = new THREE.MeshStandardMaterial({ color: 0xd9c9a0, roughness: 1 });
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.13), cover);
  group.add(body);
  const stack = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.125), pages);
  stack.position.x = 0.005;
  group.add(stack);
  return group;
}

function makePhotoMesh() {
  const frame = new THREE.MeshStandardMaterial({ color: 0x2b1d10, roughness: 0.8 });
  const surface = new THREE.MeshStandardMaterial({
    color: 0x8a7050, emissive: 0x3a2a1a, emissiveIntensity: 0.4, roughness: 1,
  });
  const group = new THREE.Group();
  const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.44), frame);
  group.add(frameMesh);
  const surfaceMesh = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.28, 0.38), surface);
  surfaceMesh.position.x = 0.028;
  group.add(surfaceMesh);
  return group;
}

function makeCoatMesh() {
  const wool = new THREE.MeshStandardMaterial({ color: 0x2b2418, roughness: 1 });
  const peg = new THREE.MeshStandardMaterial({ color: 0x1a120a, roughness: 0.9 });
  const group = new THREE.Group();
  const pegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.10, 8), peg);
  pegMesh.rotation.z = Math.PI / 2;
  pegMesh.position.set(0, 0.45, 0);
  group.add(pegMesh);
  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.18, 0.06), wool);
  shoulders.position.set(0, 0.30, 0);
  group.add(shoulders);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.55, 0.05), wool);
  body.position.set(0, -0.05, 0);
  group.add(body);
  return group;
}

function makeJarShelf() {
  const wood = new THREE.MeshStandardMaterial({ color: 0x3d2a1c, roughness: 1 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x6a5a4a, transparent: true, opacity: 0.55, roughness: 0.4, metalness: 0.1,
  });
  const lid = new THREE.MeshStandardMaterial({ color: 0x2a1f14, roughness: 0.9 });
  const group = new THREE.Group();
  const plank = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 1.2), wood);
  group.add(plank);
  for (let i = 0; i < 3; i++) {
    const jar = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.12, 12), glass,
    );
    jar.add(body);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.046, 0.02, 12), lid,
    );
    cap.position.y = 0.07;
    jar.add(cap);
    jar.position.set(0, 0.08, (i - 1) * 0.32);
    group.add(jar);
  }
  return group;
}

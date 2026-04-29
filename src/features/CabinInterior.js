import * as THREE from 'three';
import { Clue, makeRuneCarvingMesh } from './Clue.js';
import { RuneDial } from './RuneDial.js';

// Room 1's puzzle layout. Builds on Cabin's geometry anchors. Owns the four
// clues (one note + three rune carvings) and the rune dial. On solve, calls
// cabin.openDoor() and notifies the hub via onSolved.
//
// Solution: ['ansuz', 'kenaz', 'raido']
//
// Note tells the order — "Beam, hearth, hand". Each rune is hidden where
// the order word hints (beam = look up; hearth = look at the embers; hand =
// reach under the chair, i.e. lift the seat).
export class CabinInterior {
  constructor({ scene, cabin, interaction, journal, inspect, save, onSolved }) {
    this.cabin = cabin;
    this.runeMeshes = [];

    const inside = () => cabin.isPlayerInside();

    // --- Note: torn page on the desk ------------------------------------------
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
      body: 'Hand-scratched, smudged with soot:\n\n  "Beam, hearth, hand."\n\nNothing else on the page.',
      location: 'Cabin · desk',
      object: note,
      gate: inside,
    });

    // --- Beam rune (look up) --------------------------------------------------
    const beamRune = makeRuneCarvingMesh('ansuz', { color: 0xc8b0ee, size: 0.32 });
    beamRune.position.copy(cabin.beamPos);
    beamRune.rotation.x = Math.PI / 2; // face down
    scene.add(beamRune);
    this.runeMeshes.push(beamRune);
    new Clue(interaction, journal, inspect, {
      id: 'cabin-rune-beam',
      title: 'A rune carved into the beam',
      body: 'Cut shallow into the underside of the cross-beam.',
      location: 'Cabin · roof beam',
      symbol: 'ansuz',
      object: beamRune,
      gate: inside,
    });

    // --- Hearth rune (in the soot) --------------------------------------------
    const hearthRune = makeRuneCarvingMesh('kenaz', { color: 0xe6b48a, size: 0.28 });
    hearthRune.position.copy(cabin.hearthPos);
    hearthRune.rotation.y = Math.PI / 2; // face east into cabin
    scene.add(hearthRune);
    this.runeMeshes.push(hearthRune);
    new Clue(interaction, journal, inspect, {
      id: 'cabin-rune-hearth',
      title: 'A rune scrawled in the soot',
      body: 'Drawn by a fingertip in the cold ash at the back of the hearth.',
      location: 'Cabin · hearth',
      symbol: 'kenaz',
      object: hearthRune,
      gate: inside,
    });

    // --- Chair rune (underside of the seat) -----------------------------------
    const chairRune = makeRuneCarvingMesh('raido', { color: 0xc8b0ee, size: 0.22 });
    chairRune.position.copy(cabin.chairUnderside);
    chairRune.rotation.x = Math.PI / 2;
    scene.add(chairRune);
    this.runeMeshes.push(chairRune);
    new Clue(interaction, journal, inspect, {
      id: 'cabin-rune-chair',
      title: 'A rune under the chair',
      body: 'Pressed into the wood of the seat\'s underside, as if hidden on purpose.',
      location: 'Cabin · chair',
      symbol: 'raido',
      object: chairRune,
      gate: inside,
    });

    // --- Rune dial (on the door) ----------------------------------------------
    // A small, clickable sigil mounted on the inside face of the door at
    // chest height. Click → inspect view with the 3-slot dial.
    const dialMount = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 24),
      new THREE.MeshBasicMaterial({
        color: 0xb89dd6,
        transparent: true,
        opacity: 0.85,
        fog: false,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    dialMount.position.copy(cabin.doorInteriorAnchor);
    // Inside face of the door faces -Z (north into cabin). Disc default
    // normal is +Z, so a 180° flip aligns it.
    dialMount.rotation.y = Math.PI;
    scene.add(dialMount);
    this.dialMount = dialMount;

    new RuneDial(interaction, inspect, save, {
      id: 'cabin',
      object: dialMount,
      solution: ['ansuz', 'kenaz', 'raido'],
      gate: inside,
      onSolved: () => {
        cabin.openDoor();
        onSolved?.();
      },
    });

    // If we're loading a save where the room is already solved, the door
    // should be open and the player should be able to walk in/out freely.
    // Hide dial in the open initial state (player hasn't entered yet) and
    // again after solving (door is open, dial would just float in the
    // doorway).
    dialMount.visible = false;

    if (save.isRoomComplete('cabin')) {
      cabin.openDoor();
    }
  }

  update(dt) {
    const t = performance.now() * 0.001;
    const pulse = 0.7 + Math.sin(t * 1.4) * 0.18;
    for (const m of this.runeMeshes) m.material.opacity = pulse;
    if (this.dialMount) {
      this.dialMount.visible = this.cabin.doorState !== 'open';
      this.dialMount.material.opacity = 0.7 + Math.sin(t * 1.1) * 0.15;
    }
  }
}

// A tiny folded-paper-ish mesh: a faintly luminous off-white square with a
// crease. Just enough silhouette that the player can spot it on the desk.
function makeNoteMesh() {
  const group = new THREE.Group();
  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xd9c9b1,
    emissive: 0x4a3a28,
    emissiveIntensity: 0.4,
    roughness: 1,
  });
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.005, 0.24), paperMat);
  group.add(sheet);
  // Crease line — a darker stripe across the sheet.
  const crease = new THREE.Mesh(
    new THREE.BoxGeometry(0.001, 0.006, 0.24),
    new THREE.MeshBasicMaterial({ color: 0x6b5a40 }),
  );
  crease.position.y = 0.003;
  group.add(crease);
  return group;
}

import * as THREE from 'three';
import { Clue, makeGlyphCarvingMesh } from './Clue.js';
import { ComboLock } from './ComboLock.js';

// Room 1's puzzle layout. Builds on Cabin's geometry anchors. Owns the four
// clues (one note + three carved letters) and the door lock. On solve, calls
// cabin.openDoor() and notifies the hub via onSolved.
//
// Solution: "ASH" — letters etched at three places in the room.
// Note tells the order. Each letter is hidden where the order word hints
// (beam = look up; hearth = look at the embers; hand = reach under the chair).
export class CabinInterior {
  constructor({ scene, cabin, interaction, journal, inspect, save, onSolved }) {
    this.cabin = cabin;
    this.glyphMeshes = [];

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
      body: 'Hand-scratched, smudged with soot:\n\n  "Beam. Hearth. Hand."\n\nNothing else on the page.',
      location: 'Cabin · desk',
      object: note,
      gate: inside,
    });

    // --- Beam letter (look up) ------------------------------------------------
    const beamGlyph = makeGlyphCarvingMesh('A', { size: 0.34 });
    beamGlyph.position.copy(cabin.beamPos);
    beamGlyph.rotation.x = Math.PI / 2; // face down
    scene.add(beamGlyph);
    this.glyphMeshes.push(beamGlyph);
    new Clue(interaction, journal, inspect, {
      id: 'cabin-glyph-beam',
      title: 'A letter carved into the beam',
      body: 'Cut shallow into the underside of the cross-beam.',
      location: 'Cabin · roof beam',
      glyph: 'A',
      object: beamGlyph,
      gate: inside,
    });

    // --- Hearth letter (in the soot) ------------------------------------------
    const hearthGlyph = makeGlyphCarvingMesh('S', { size: 0.30, color: 0xffd9a0 });
    hearthGlyph.position.copy(cabin.hearthPos);
    hearthGlyph.rotation.y = Math.PI / 2; // face east into cabin
    scene.add(hearthGlyph);
    this.glyphMeshes.push(hearthGlyph);
    new Clue(interaction, journal, inspect, {
      id: 'cabin-glyph-hearth',
      title: 'A letter scrawled in the soot',
      body: 'Drawn by a fingertip in the cold ash at the back of the hearth.',
      location: 'Cabin · hearth',
      glyph: 'S',
      object: hearthGlyph,
      gate: inside,
    });

    // --- Chair letter (underside of the seat) ---------------------------------
    const chairGlyph = makeGlyphCarvingMesh('H', { size: 0.24 });
    chairGlyph.position.copy(cabin.chairUnderside);
    chairGlyph.rotation.x = Math.PI / 2;
    scene.add(chairGlyph);
    this.glyphMeshes.push(chairGlyph);
    new Clue(interaction, journal, inspect, {
      id: 'cabin-glyph-chair',
      title: 'A letter under the chair',
      body: 'Pressed into the wood of the seat\'s underside, as if hidden on purpose.',
      location: 'Cabin · chair',
      glyph: 'H',
      object: chairGlyph,
      gate: inside,
    });

    // --- Lock (on the door) ---------------------------------------------------
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
    // Inside face of the door faces -Z (north into cabin). Disc default
    // normal is +Z, so a 180° flip aligns it.
    lockMount.rotation.y = Math.PI;
    scene.add(lockMount);
    this.lockMount = lockMount;

    new ComboLock(interaction, inspect, save, {
      id: 'cabin',
      object: lockMount,
      solution: 'ASH',
      gate: inside,
      onSolved: () => {
        cabin.openDoor();
        onSolved?.();
      },
    });

    // Hide lock until the player is inside (door starts closed already, so
    // this is mostly a guard for the post-completion state where the door
    // is open and the lock would just float in the doorway).
    lockMount.visible = !save.isRoomComplete('cabin');

    if (save.isRoomComplete('cabin')) {
      cabin.openDoor();
      onSolved?.({ alreadySolved: true });
    }
  }

  update(dt) {
    const t = performance.now() * 0.001;
    // Slightly more visible pulse so letters are findable in dim light.
    const pulse = 0.78 + Math.sin(t * 1.4) * 0.2;
    for (const m of this.glyphMeshes) m.material.opacity = pulse;
    if (this.lockMount) {
      this.lockMount.visible = this.cabin.doorState !== 'open';
      this.lockMount.material.opacity = 0.7 + Math.sin(t * 1.1) * 0.18;
    }
  }
}

// A tiny folded-paper-ish mesh: a faintly luminous off-white square with a
// crease. Just enough silhouette that the player can spot it on the desk.
function makeNoteMesh() {
  const group = new THREE.Group();
  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xd9c9b1,
    emissive: 0x6a4f30,
    emissiveIntensity: 0.6,
    roughness: 1,
  });
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.005, 0.24), paperMat);
  group.add(sheet);
  const crease = new THREE.Mesh(
    new THREE.BoxGeometry(0.001, 0.006, 0.24),
    new THREE.MeshBasicMaterial({ color: 0x6b5a40 }),
  );
  crease.position.y = 0.003;
  group.add(crease);
  return group;
}

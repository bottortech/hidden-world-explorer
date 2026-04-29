import * as THREE from 'three';
import { createScene } from './Scene.js';
import { createCamera } from './Camera.js';
import { createRenderer } from './Renderer.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { InteractionSystem } from '../systems/InteractionSystem.js';
import { WorldSystem } from '../systems/WorldSystem.js';
import { ObjectiveSystem } from '../systems/ObjectiveSystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { JournalSystem } from '../systems/JournalSystem.js';
import { InspectSystem } from '../systems/InspectSystem.js';
import { NamePrompt } from '../systems/NamePrompt.js';
import { RoomTransition } from '../systems/RoomTransition.js';
import { Cabin } from '../features/Cabin.js';
import { CabinInterior } from '../features/CabinInterior.js';
import { Attic } from '../features/Attic.js';

// Linear room sequence. Each room knows where to spawn the player on entry.
// To add another room, append an entry here and construct the matching
// feature inside the Game constructor.
const ROOM_SEQUENCE = [
  { id: 'cabin', spawn: { position: [22, 1.7, -23], yaw: Math.PI } },
  { id: 'attic', spawn: { position: [200, 1.7, 1.4], yaw: Math.PI } },
];

// Top-level orchestrator. Builds the scene/camera/renderer/systems, the
// linear room features, and wires room-to-room transitions on solve.
export class Game {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();

    this.renderer = createRenderer(container);
    this.scene = createScene();

    this.save = new SaveSystem();
    const startRoom = determineStartRoom(this.save);
    const initialSpawn = startRoom?.spawn ?? ROOM_SEQUENCE[0].spawn;
    this.camera = createCamera(initialSpawn);

    this.movement = new MovementSystem(this.camera, this.renderer.domElement);
    this.interaction = new InteractionSystem(this.camera, this.renderer.domElement);
    this.world = new WorldSystem(this.scene);
    this.objectives = new ObjectiveSystem();
    this.journal = new JournalSystem(this.save, this.movement);
    this.inspect = new InspectSystem(this.movement);
    this.namePrompt = new NamePrompt(this.save);
    this.transition = new RoomTransition(this.movement, this.camera);

    // Build all rooms up front. They live in disjoint world coordinates so
    // they can coexist; transitions teleport the player between them.
    const cabin = new Cabin(this.scene, this.movement);
    const cabinInterior = new CabinInterior({
      scene: this.scene,
      cabin,
      interaction: this.interaction,
      journal: this.journal,
      inspect: this.inspect,
      save: this.save,
      onSolved: () => this._onRoomSolved('cabin'),
    });

    const attic = new Attic({
      scene: this.scene,
      movement: this.movement,
      interaction: this.interaction,
      journal: this.journal,
      inspect: this.inspect,
      save: this.save,
      onSolved: () => this._onRoomSolved('attic'),
      origin: [200, 0, 0],
    });

    this.features = [cabin, cabinInterior, attic];

    window.addEventListener('resize', () => this.onResize());
    this.onResize();

    this.animate = this.animate.bind(this);
  }

  async _bootstrap() {
    // Page begins with the fade overlay shown (set in RoomTransition's
    // constructor). Disable movement so the player can't act before the
    // name prompt closes / fade finishes.
    this.movement.setEnabled(false);

    const startRoom = determineStartRoom(this.save);
    if (!startRoom) {
      // All rooms cleared in a prior session — go straight to the end card.
      this._showEndCard();
      return;
    }

    this.journal.setCurrentRoom(startRoom.id);
    await this.namePrompt.run();
    await this.transition.exitBlack();
    this.movement.setEnabled(true);
  }

  async _onRoomSolved(roomId) {
    const idx = ROOM_SEQUENCE.findIndex((r) => r.id === roomId);
    const next = ROOM_SEQUENCE[idx + 1];
    if (next) {
      // Switch journal scope before the fade so opening it during the
      // transition shows the new room (empty) rather than the old one.
      this.journal.setCurrentRoom(next.id);
      await this.transition.advance(next.spawn);
    } else {
      this._showEndCard();
    }
  }

  _showEndCard() {
    const card = document.createElement('div');
    card.innerHTML = `
      <div class="end-pretitle">A door closes</div>
      <h2 class="end-title">To be continued…</h2>
      <div class="end-actions">
        <button class="reset">Play again</button>
      </div>
    `;
    card.querySelector('.reset').addEventListener('click', () => {
      this.save.reset();
      window.location.reload();
    });
    this.transition.showEndCard(card);
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  start() {
    this._bootstrap();
    this.renderer.setAnimationLoop(this.animate);
  }

  animate() {
    // Clamp dt to 100ms so a tab refocus doesn't catapult the player.
    const dt = Math.min(this.clock.getDelta(), 0.1);

    this.movement.update(dt);
    this.interaction.update(dt);
    this.world.update(dt);
    this.objectives.update(dt);
    for (const feature of this.features) feature.update?.(dt, this);

    this.renderer.render(this.scene, this.camera);
  }
}

// Walk the room sequence and return the first uncleared room, or null if
// all rooms are complete. Drives initial spawn position.
function determineStartRoom(save) {
  for (const r of ROOM_SEQUENCE) {
    if (!save.isRoomComplete(r.id)) return r;
  }
  return null;
}

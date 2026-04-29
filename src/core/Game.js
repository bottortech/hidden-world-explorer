import * as THREE from 'three';
import { createScene } from './Scene.js';
import { createCamera } from './Camera.js';
import { createRenderer } from './Renderer.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { InteractionSystem } from '../systems/InteractionSystem.js';
import { WorldSystem } from '../systems/WorldSystem.js';
import { ObjectiveSystem } from '../systems/ObjectiveSystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { Forest } from '../features/Forest.js';
import { SceneDecor } from '../features/SceneDecor.js';
import { River } from '../features/River.js';
import { PathToCabin } from '../features/PathToCabin.js';
import { RuneTrail } from '../features/RuneTrail.js';
import { Cabin } from '../features/Cabin.js';
import { DistantShapes } from '../features/DistantShapes.js';
import { HiddenCube } from '../features/HiddenCube.js';
import { MysticalPillar } from '../features/MysticalPillar.js';
import { PortalZone } from '../features/PortalZone.js';
import { MysteryZone } from '../features/MysteryZone.js';

// Top-level orchestrator. Owns the renderer/scene/camera, wires systems, and
// holds the list of features. To add a new feature: implement a class with
// (optional) `update(dt, game)` and push it into `this.features`.
export class Game {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();

    this.renderer = createRenderer(container);
    this.scene = createScene();
    this.camera = createCamera();

    // Systems = generic, reusable behaviors (movement, raycasting, atmosphere,
    // objective HUD).
    this.movement = new MovementSystem(this.camera, this.renderer.domElement);
    this.interaction = new InteractionSystem(this.camera, this.renderer.domElement);
    this.world = new WorldSystem(this.scene);
    this.objectives = new ObjectiveSystem();
    this.save = new SaveSystem();

    // Exclusion zones — kept in one list so Forest, SceneDecor, and any
    // future scattered-prop feature carve the same clearings.
    const exclusions = [
      // Cabin clearing
      { type: 'circle', cx: 22, cz: -22, r: 12 },
      // River strip (centered on x = -7, width 4 + small buffer)
      { type: 'aabb', minX: -10, maxX: -4, minZ: -55, maxZ: 55 },
      // Bridge approach — keep it walkable on both banks
      { type: 'circle', cx: -7, cz: 4, r: 5 },
    ];

    // Features = game content built on top of systems. Some are referenced
    // by other features (RuneTrail by Cabin, DistantShapes by MysteryZone),
    // so construct those first and pass them through.
    const distantShapes = new DistantShapes(this.scene);
    const runeTrail = new RuneTrail(this.scene);
    const cabin = new Cabin(
      this.scene, this.interaction, this.movement, this.objectives, runeTrail,
    );
    this.movement.addColliders(cabin.getColliders());

    this.features = [
      new Forest(this.scene, { exclusions }),
      new SceneDecor(this.scene, { exclusions }),
      new River(this.scene),
      new PathToCabin(this.scene),
      distantShapes,
      runeTrail,
      cabin,
      new HiddenCube(this.scene, this.interaction, this.movement, this.objectives),
      new MysticalPillar(this.scene, this.interaction, this.world, this.objectives),
      new PortalZone(this.scene, this.movement, this.world),
      new MysteryZone(this.scene, this.movement, this.world, distantShapes, this.objectives),
    ];

    window.addEventListener('resize', () => this.onResize());
    this.onResize();

    this.animate = this.animate.bind(this);
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  start() {
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

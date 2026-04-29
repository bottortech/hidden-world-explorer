import * as THREE from 'three';
import { playKeyChime } from '../utils/audio.js';

// A brass key mesh that materializes on a solved combo lock. Hidden until
// activate() is called. On click: triggers the hand pickup animation,
// plays a chime, marks the key as collected in save state, and resolves
// onCollected once the hand has finished its sequence.
//
//   const key = new Key({ scene, interaction, hand, save, roomId, position, onCollected });
//   key.activate();   // call after the lock is solved
export class Key {
  constructor({ scene, interaction, hand, save, roomId, position, onCollected }) {
    this.scene = scene;
    this.interaction = interaction;
    this.hand = hand;
    this.save = save;
    this.roomId = roomId;
    this.onCollected = onCollected;
    this.collected = save.hasKey(roomId);

    this.mesh = buildKeyMesh();
    this.mesh.position.set(position[0], position[1], position[2]);
    this.mesh.visible = false;
    scene.add(this.mesh);

    interaction.add({
      object: this.mesh,
      onClick: () => this._handleClick(),
    });

    // Soft warm point light to draw attention. Disabled until activate().
    this.light = new THREE.PointLight(0xffd070, 0, 2.4, 1.4);
    this.light.position.copy(this.mesh.position);
    scene.add(this.light);

    this.activated = false;
    this.busy = false;
    this._t = 0;
  }

  activate() {
    if (this.activated || this.collected) return;
    this.activated = true;
    this.mesh.visible = true;
    this.light.intensity = 1.4;
  }

  async _handleClick() {
    if (!this.activated || this.busy || this.collected) return;
    this.busy = true;
    this.light.intensity = 0;
    playKeyChime();
    // The Hand reparents the mesh and runs the choreography; await its
    // promise so the room can transition cleanly when it resolves.
    await this.hand.holdKey(this.mesh);
    this.collected = true;
    this.save.collectKey(this.roomId);
    this.onCollected?.();
  }

  update(dt) {
    if (!this.activated || this.collected || this.busy) return;
    // Slow rotation + gentle bob so the key reads as "active reward".
    this._t += dt;
    this.mesh.rotation.y += dt * 1.4;
    const yBase = this.light.position.y;
    this.mesh.position.y = yBase + Math.sin(this._t * 2.0) * 0.04;
  }
}

function buildKeyMesh() {
  const brass = new THREE.MeshStandardMaterial({
    color: 0xd9a44a,
    emissive: 0x8a5a20,
    emissiveIntensity: 0.6,
    roughness: 0.45,
    metalness: 0.65,
  });

  const group = new THREE.Group();

  // Bow (ring head) — flat torus on its side.
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.010, 8, 18), brass);
  bow.rotation.x = Math.PI / 2;
  bow.position.set(0, 0, 0.03);
  group.add(bow);

  // Shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.10, 8), brass);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.set(0, 0, -0.02);
  group.add(shaft);

  // Two teeth
  const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.012), brass);
  tooth1.position.set(0.012, 0, -0.057);
  group.add(tooth1);
  const tooth2 = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.012, 0.012), brass);
  tooth2.position.set(0.014, 0, -0.072);
  group.add(tooth2);

  return group;
}

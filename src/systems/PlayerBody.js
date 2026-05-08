import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// First-person visible body. The model is mounted as a sibling in the scene
// (not as a child of the camera) and tracks the camera's X/Z position +
// Y-yaw each frame, so when the player looks down they see torso → legs →
// feet beneath them. Y stays anchored at floor level so the MovementSystem's
// vertical bob shows on the camera but never on the body.
//
// The asset is a static, unrigged Sketchfab mesh — no animations, no
// skeleton. Walk-cycle and grab gestures are *not* possible from this model
// alone; the procedural HandSystem keeps handling those. If a rigged version
// arrives later (e.g. via Mixamo) we can drop in an AnimationMixer here
// without changing how Game wires this up.
//
// Scaled to ~1.7 m tall so the model's head sits at camera eye-level. The
// face / eyes / teeth / arm-hair meshes are hidden so the camera doesn't
// look out through floating teeth.

const HIDE_MATERIAL_NAMES = new Set(['Face', 'Eyes', 'Gum_Teeth', 'ArmsHair']);
const TARGET_HEIGHT = 1.7; // meters

export class PlayerBody {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.name = 'playerBody';
    this.loaded = false;
    scene.add(this.group);

    const loader = new GLTFLoader();
    loader.load(
      `${import.meta.env.BASE_URL}stylized_game_character_male.glb`,
      (gltf) => this._onLoaded(gltf),
      undefined,
      (err) => console.warn('PlayerBody: GLB failed to load', err),
    );
  }

  _onLoaded(gltf) {
    const root = gltf.scene;
    // Hide the head/face/teeth so the camera doesn't see them from inside.
    root.traverse((node) => {
      if (!node.isMesh || !node.material) return;
      const matName = Array.isArray(node.material)
        ? node.material[0]?.name
        : node.material.name;
      if (matName && HIDE_MATERIAL_NAMES.has(matName)) {
        node.visible = false;
      }
    });

    // Normalize: scale so total height equals TARGET_HEIGHT, then translate
    // so feet sit on y=0 and X/Z bbox is centered on the origin.
    const bbox = new THREE.Box3().setFromObject(root);
    const size = bbox.getSize(new THREE.Vector3());
    const scale = size.y > 0 ? TARGET_HEIGHT / size.y : 1;
    root.scale.setScalar(scale);

    const sBbox = new THREE.Box3().setFromObject(root);
    const center = sBbox.getCenter(new THREE.Vector3());
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= sBbox.min.y;

    // Render under everything else so the procedural hand still appears
    // crisply on top during a grab.
    root.traverse((n) => { n.renderOrder = -1; });

    this.group.add(root);
    this.loaded = true;
  }

  update() {
    if (!this.loaded) return;
    // Track the camera's horizontal position; keep Y anchored to the floor.
    // Match yaw only — pitching the camera up/down shouldn't tilt the body.
    this.group.position.set(
      this.camera.position.x,
      0,
      this.camera.position.z,
    );
    this.group.rotation.y = this.camera.rotation.y;
  }
}

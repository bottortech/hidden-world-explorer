import * as THREE from 'three';

// Eye-level perspective camera. The far plane is short to let fog do its job.
//
// Spawn pose is configurable so Game can place the player inside the cabin
// for the escape sequence, or just outside the cabin if the room has already
// been cleared in a prior session.
export function createCamera({ position = [0, 1.7, 8], yaw = 0 } = {}) {
  const camera = new THREE.PerspectiveCamera(
    72,
    window.innerWidth / window.innerHeight,
    0.1,
    500,
  );
  camera.position.set(position[0], position[1], position[2]);
  // PointerLockControls reads the camera's existing Euler on construction,
  // so setting rotation.y here gives the player the right starting facing.
  camera.rotation.set(0, yaw, 0, 'YXZ');
  return camera;
}

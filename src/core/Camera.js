import * as THREE from 'three';

// Eye-level perspective camera. The far plane is short to let fog do its job.
export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    72,
    window.innerWidth / window.innerHeight,
    0.1,
    500,
  );
  camera.position.set(0, 1.7, 8);
  return camera;
}

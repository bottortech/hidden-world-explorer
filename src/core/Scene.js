import * as THREE from 'three';
import { COLORS } from '../utils/colors.js';

// Builds the base scene: sky gradient, fog, lights, ground.
// Lights and the sky are named so WorldSystem can mutate them by name later.
export function createScene() {
  const scene = new THREE.Scene();

  // Denser exponential fog gives the world layered depth.
  scene.fog = new THREE.FogExp2(COLORS.fog, 0.055);
  // Background matches the fog horizon for any rare gap behind the skydome.
  scene.background = new THREE.Color(COLORS.skyHorizon);

  // Gradient skydome: shader interpolates topColor → bottomColor along world Y.
  // bottomColor is kept in sync with fog by WorldSystem so the horizon dissolves.
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(COLORS.skyTop) },
      bottomColor: { value: new THREE.Color(COLORS.skyHorizon) },
      exponent: { value: 0.55 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        float t = pow(max(h, 0.0), exponent);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), skyMat);
  sky.name = 'sky';
  sky.renderOrder = -1;
  scene.add(sky);

  // Ambient — warm violet undertone so shadow sides aren't flat black.
  const ambient = new THREE.AmbientLight(0x6a5878, 0.5);
  ambient.name = 'ambient';
  scene.add(ambient);

  // Directional "moonlight" — cool lavender top-down.
  const directional = new THREE.DirectionalLight(0xb89dd6, 0.55);
  directional.position.set(20, 30, 10);
  directional.name = 'directional';
  scene.add(directional);

  // Hemisphere — purple sky / dark ground tint adds non-flat ambient variation.
  const hemisphere = new THREE.HemisphereLight(0x6c5b7b, 0x1a1424, 0.45);
  hemisphere.name = 'hemisphere';
  scene.add(hemisphere);

  // Ground plane — generous size so the player never reaches its edge.
  const groundMat = new THREE.MeshStandardMaterial({
    color: COLORS.ground,
    roughness: 1,
    metalness: 0,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.name = 'ground';
  scene.add(ground);

  return scene;
}

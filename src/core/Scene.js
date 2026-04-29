import * as THREE from 'three';
import { COLORS } from '../utils/colors.js';

// Builds the base scene for the indoor escape rooms: dark void background
// and three scene-level lights (ambient, directional, hemisphere) that
// provide the soft fill on top of each room's own point lights. No sky,
// no ground plane, no atmospheric fog — the rooms are sealed and the
// player never sees the world outside their walls.
export function createScene() {
  const scene = new THREE.Scene();

  // Pure void background — what shows through any gap should read as
  // "nothing." Cabin and Attic are at distant world coordinates so a
  // peek through a doorway pre-transition just shows black.
  scene.background = new THREE.Color(0x05030a);

  // Light fog that approaches the void color, so any far surface fades
  // gracefully instead of popping. Density is gentle.
  scene.fog = new THREE.FogExp2(0x05030a, 0.035);

  // Ambient — warm violet undertone so shadow sides aren't flat black.
  const ambient = new THREE.AmbientLight(0x6a5878, 0.5);
  ambient.name = 'ambient';
  scene.add(ambient);

  // Directional "moonlight" — cool lavender, top-down. Adds shape to walls.
  const directional = new THREE.DirectionalLight(0xb89dd6, 0.45);
  directional.position.set(20, 30, 10);
  directional.name = 'directional';
  scene.add(directional);

  // Hemisphere — purple sky / dark ground tint adds non-flat ambient variation
  // even in sealed rooms.
  const hemisphere = new THREE.HemisphereLight(0x6c5b7b, 0x1a1424, 0.4);
  hemisphere.name = 'hemisphere';
  scene.add(hemisphere);

  return scene;
}

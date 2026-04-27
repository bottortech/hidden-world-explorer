import * as THREE from 'three';
import { COLORS } from '../utils/colors.js';

// A glowing river plus a small wooden bridge for crossing. The river is a
// flat plane with a custom shader that layers three sine waves to fake
// rippling, scrolling water — cheap, no extra render passes.
//
// The river is not solid (no collider). It's a visual divider; the player
// CAN wade through it, but the bridge is the obvious crossing.
//
// To extend: add a Reflector for true reflections, or a normal-map texture
// for higher-frequency detail. Keep an eye on perf if you do.
export class River {
  constructor(scene, {
    centerX = -7,
    width = 4,
    length = 100,
    bridgeZ = 4,
  } = {}) {
    this.centerX = centerX;
    this.width = width;
    this.bridgeZ = bridgeZ;

    // --- Water plane ---------------------------------------------------------
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        baseColor: { value: new THREE.Color(COLORS.water) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 baseColor;
        varying vec2 vUv;
        void main() {
          // Three layered sines — perpendicular axes plus a slow drift —
          // give a believable "moving water" without a normal map.
          float r1 = sin(vUv.y * 60.0 + time * 1.6) * 0.5 + 0.5;
          float r2 = sin(vUv.x * 28.0 - vUv.y * 40.0 + time * 0.9) * 0.5 + 0.5;
          float r3 = sin(vUv.y * 12.0 + time * 0.35) * 0.5 + 0.5;
          float ripple = r1 * r2 * 0.7 + r3 * 0.3;
          vec3 c = mix(baseColor * 0.4, baseColor * 1.6, ripple);
          gl_FragColor = vec4(c, 0.88);
        }
      `,
      transparent: true,
      depthWrite: false,
      // Fog is intentionally off: ShaderMaterial+fog requires merging in
      // THREE's fog uniforms manually, and the glowing leyline aesthetic
      // works better when the river stays visible at distance.
      fog: false,
    });

    const waterGeo = new THREE.PlaneGeometry(width, length);
    const water = new THREE.Mesh(waterGeo, this.material);
    water.rotation.x = -Math.PI / 2;
    water.position.set(centerX, 0.05, 0);
    water.name = 'river';
    scene.add(water);

    // --- Bridge --------------------------------------------------------------
    // Wooden plank deck spanning the river plus a small overhang on each bank.
    const bridge = new THREE.Group();
    bridge.position.set(centerX, 0, bridgeZ);

    const woodMat = new THREE.MeshStandardMaterial({
      color: COLORS.wood,
      roughness: 1,
    });
    const railMat = new THREE.MeshStandardMaterial({
      color: COLORS.woodAccent,
      roughness: 1,
    });

    const deckLen = width + 2.5;       // overhang each bank by ~1.25m
    const deckDepth = 1.8;
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(deckLen, 0.15, deckDepth),
      woodMat,
    );
    deck.position.y = 0.32;
    deck.rotation.z = 0.015; // slight weathered tilt
    bridge.add(deck);

    // Two rails along the long edges, plus four corner posts for character.
    for (const sideZ of [-deckDepth / 2 + 0.05, deckDepth / 2 - 0.05]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(deckLen - 0.4, 0.05, 0.05),
        railMat,
      );
      rail.position.set(0, 0.7, sideZ);
      bridge.add(rail);
    }
    for (const sx of [-deckLen / 2 + 0.15, deckLen / 2 - 0.15]) {
      for (const sz of [-deckDepth / 2 + 0.05, deckDepth / 2 - 0.05]) {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.75, 0.1),
          railMat,
        );
        post.position.set(sx, 0.7, sz);
        bridge.add(post);
      }
    }

    scene.add(bridge);
  }

  update(dt) {
    this.material.uniforms.time.value += dt;
  }
}

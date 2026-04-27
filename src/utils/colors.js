// Centralized palette. Tweak here to retune the whole world.
// Hex literals are easier to read than strings for this; THREE accepts both.
export const COLORS = {
  // Base atmosphere — dusky mystical purple
  fog: 0x4a3a5c,
  skyTop: 0x2b1a40,           // deep velvet overhead
  skyHorizon: 0x4a3a5c,       // matches fog so the horizon dissolves
  ground: 0x1c1428,           // very dark mossy violet
  trunk: 0x231b2c,            // bark with a violet undertone
  foliage: 0x3a2d4a,          // dusky violet canopy
  distantSilhouette: 0x251a35, // far rocks/spires read as silhouettes in fog

  // Mystery elements
  cube: 0xe8d8ff,             // pale luminous lavender
  cubeEmissive: 0xb89dd6,     // soft mystical glow color
  pillar: 0x4a3a5c,
  portalRing: 0xb89dd6,

  // Atmosphere presets triggered by features
  pillarFog: 0x6e4f92,        // brighter velvet on pillar reveal
  portalFog: 0x5a3858,        // rose-violet inside the portal zone
  mysteryFog: 0x1a0f28,       // dense, near-black violet inside mystery zone

  // Structures & decor
  wood: 0x3a2c30,             // weathered violet-brown for cabin walls
  woodAccent: 0x271c20,       // darker plank for floor / desk
  stone: 0x3a2e48,            // path flagstones (slightly lighter than ground)
  rockDecor: 0x2a2236,        // small scatter rocks
  stumpBark: 0x1f1820,        // tree stumps
  bush: 0x2f2440,             // bush foliage (deeper than canopy)

  // River & light cues
  water: 0x9a82d6,            // glowing mystical river
  rune: 0xc4a8ff,             // glowing rune lavender
  warmLight: 0xe8b078,        // amber warm for cabin interior
};

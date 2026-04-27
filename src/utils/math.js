// Generic numeric helpers. Keep this file dependency-free.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const lerp = (a, b, t) => a + (b - a) * t;

// Smooth Hermite interpolation: returns 0 below `a`, 1 above `b`, eased between.
export const smoothstep = (a, b, t) => {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};

export const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Tiny seeded 3D value noise (pure, no three.js): the lumps of the fluffy
 * beard, fur trims and snow drifts.
 */

function hash3(x: number, y: number, z: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * (3 - 2 * t);

/** Smooth noise in 0..1. */
export function noise3(x: number, y: number, z: number, seed = 1): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const u = fade(x - xi);
  const v = fade(y - yi);
  const w = fade(z - zi);
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz, seed);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w
  );
}

/** Fractal noise (a few octaves), centred on 0, roughly -0.5..0.5. */
export function fbm3(x: number, y: number, z: number, seed = 1, octaves = 3): number {
  let s = 0;
  let a = 0.5;
  let f = 1;
  let n = 0;
  for (let i = 0; i < octaves; i++) {
    s += (noise3(x * f, y * f, z * f, seed + i * 17) - 0.5) * a;
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

/**
 * Billowy "cloud" bumps: rounded puffs rather than noise grain, so fur reads
 * as soft tufts (1 - |n| folded noise, smoothed).
 */
export function puffs3(x: number, y: number, z: number, seed = 1): number {
  const n = noise3(x, y, z, seed);
  const m = noise3(x * 2.1 + 5.3, y * 2.1 + 1.7, z * 2.1 + 9.1, seed + 3);
  return Math.pow(n, 0.8) * 0.75 + m * 0.25;
}

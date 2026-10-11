import type { Noise } from "./catalog";

/** Seeded uniform noise in [-1, 1] (mulberry32), so tests and exports are reproducible. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

function normalise(x: Float32Array, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]!));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] = (x[i]! / m) * peak;
  return x;
}

/**
 * Coloured noise, `length` samples, ready to loop:
 * white (flat), pink (−3 dB/oct, Paul Kellet's filter), brown (−6 dB/oct, leaky
 * integrator), ocean (brown under a slow 0.08 Hz swell), rain (pink with sparse drops).
 */
export function noise(kind: Exclude<Noise, "none">, length: number, sampleRate: number, seed = 1): Float32Array {
  const r = rng(seed);
  const x = new Float32Array(length);
  if (kind === "white") {
    for (let i = 0; i < length; i++) x[i] = r();
    return normalise(x, 0.6);
  }
  if (kind === "pink" || kind === "rain") {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const w = r();
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      x[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    }
    if (kind === "rain") {
      // Drops: short decaying clicks, a few per second, at random places.
      const drops = Math.round((length / sampleRate) * 14);
      for (let d = 0; d < drops; d++) {
        const at = Math.floor(((r() + 1) / 2) * (length - 400));
        const amp = 1.5 + ((r() + 1) / 2) * 2.5;
        for (let k = 0; k < 400; k++) x[at + k]! += amp * Math.exp(-k / 40) * r();
      }
    }
    return normalise(x, 0.6);
  }
  // brown / ocean
  let last = 0;
  for (let i = 0; i < length; i++) {
    last = (last + 0.02 * r()) / 1.02;
    x[i] = last;
  }
  normalise(x, 0.8);
  if (kind === "ocean") {
    for (let i = 0; i < length; i++) {
      const swell = 0.55 + 0.45 * Math.sin((2 * Math.PI * 0.08 * i) / sampleRate) ** 2;
      x[i] = x[i]! * swell;
    }
  }
  return x;
}

/** Spectral slope check used by the tests: energy ratio of the top and bottom octaves. */
export function bandEnergy(x: Float32Array, sampleRate: number, lo: number, hi: number): number {
  // Single-bin Goertzel sweep across the band, coarse but enough to tell colours apart.
  let total = 0;
  const n = Math.min(x.length, 8192);
  for (let f = lo; f <= hi; f *= 1.25) {
    const k = Math.round((f * n) / sampleRate);
    const w = (2 * Math.PI * k) / n;
    const c = 2 * Math.cos(w);
    let s0 = 0, s1 = 0, s2 = 0;
    for (let i = 0; i < n; i++) {
      s0 = x[i]! + c * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    total += s1 * s1 + s2 * s2 - c * s1 * s2;
  }
  return total;
}

/**
 * Small pure helpers of the sound engine: numbers only, no Web Audio, so they
 * run (and are tested) anywhere.
 */

export const clamp = (x: number, lo: number, hi: number) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo);

export const dbToGain = (db: number) => 10 ** (db / 20);
export const gainToDb = (g: number) => (g > 0 ? 20 * Math.log10(g) : -Infinity);

/** MIDI note number → frequency (A4 = 69 = 440 Hz). */
export const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** Seeded random numbers in [0, 1): the same seed always gives the same sound. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 32-bit seed from a word (FNV-1a). */
export function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The loudest the master bus can ever output: −3.1 dBFS. */
export const CEILING = 0.7;
/** Below this level the soft clipper is a plain wire (−6 dBFS). */
export const KNEE = 0.5;

/**
 * Transfer curve of the master bus's last stage (a WaveShaper): straight line
 * up to `knee`, then a tanh shoulder that never goes past `ceiling`. Inputs
 * beyond ±1 are held at the curve's ends by the WaveShaper, so the output peak
 * is bounded whatever piles up before it.
 */
export function softClipCurve(n = 2049, knee = KNEE, ceiling = CEILING): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const room = ceiling - knee;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const ax = Math.abs(x);
    const y = ax <= knee ? ax : knee + room * Math.tanh((ax - knee) / room);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

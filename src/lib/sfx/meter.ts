/**
 * Loudness meter for the offline measurements (pure, runs in Node or a page).
 *
 * Peak in dBFS, and loudness in LUFS with the ITU-R BS.1770 K-weighting (the
 * same filter as broadcast meters), taken as the loudest sliding window: 400 ms
 * is the standard "momentary" loudness; 200 ms suits very short UI sounds.
 * `gains.ts` is computed from these numbers so every sound sits at its target.
 */

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

/** The two BS.1770 pre-filters (high shelf + high pass) for any sample rate. */
export function kWeightingCoefficients(sampleRate: number): [Biquad, Biquad] {
  // Stage 1: high shelf, +4 dB above ~1.7 kHz (the head's acoustics).
  let K = Math.tan((Math.PI * 1681.974450955533) / sampleRate);
  const Q1 = 0.7071752369554196;
  const Vh = 10 ** (3.999843853973347 / 20);
  const Vb = Vh ** 0.4996667741545416;
  let a0 = 1 + K / Q1 + K * K;
  const shelf: Biquad = {
    b0: (Vh + (Vb * K) / Q1 + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q1 + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q1 + K * K) / a0,
  };
  // Stage 2: high pass at ~38 Hz (the "RLB" curve).
  K = Math.tan((Math.PI * 38.13547087602444) / sampleRate);
  const Q2 = 0.5003270373238773;
  a0 = 1 + K / Q2 + K * K;
  const highpass: Biquad = { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q2 + K * K) / a0 };
  return [shelf, highpass];
}

function biquad(x: Float32Array, c: Biquad): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = c.b0 * xi + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = yi;
    y[i] = yi;
  }
  return y;
}

export function kWeight(x: Float32Array, sampleRate: number): Float32Array {
  const [shelf, hp] = kWeightingCoefficients(sampleRate);
  return biquad(biquad(x, shelf), hp);
}

/** Highest absolute sample over all channels, in dBFS. */
export function peakDb(channels: Float32Array[]): number {
  let peak = 0;
  for (const ch of channels) for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}

/**
 * Loudest `windowSec` window (10 ms hop) in LUFS, BS.1770 channel sum
 * (left and right weighted 1). A sound shorter than the window is measured
 * over the whole window, silence included, as a meter would.
 */
export function maxLoudness(channels: Float32Array[], sampleRate: number, windowSec = 0.4): number {
  const weighted = channels.map((c) => kWeight(c, sampleRate));
  const n = weighted[0]?.length ?? 0;
  const win = Math.max(1, Math.round(windowSec * sampleRate));
  const hop = Math.max(1, Math.round(0.01 * sampleRate));
  // Running sum of squares per channel, summed.
  const sq = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const w of weighted) s += w[i] * w[i];
    sq[i + 1] = sq[i] + s;
  }
  let best = 0;
  for (let start = 0; start === 0 || start + win <= n; start += hop) {
    const end = Math.min(n, start + win);
    best = Math.max(best, (sq[end] - sq[start]) / win);
    if (end === n) break;
  }
  return best > 0 ? -0.691 + 10 * Math.log10(best) : -Infinity;
}

/**
 * The gain that brings a sound to its loudness target, without letting its
 * peak go above `maxPeakDb` (the master bus keeps the rest of the headroom).
 */
export function normalisingGain(measuredLufs: number, measuredPeakDb: number, targetLufs: number, maxPeakDb: number): number {
  if (!Number.isFinite(measuredLufs) || !Number.isFinite(measuredPeakDb)) return 1;
  const byLoudness = targetLufs - measuredLufs;
  const byPeak = maxPeakDb - measuredPeakDb;
  return 10 ** (Math.min(byLoudness, byPeak) / 20);
}

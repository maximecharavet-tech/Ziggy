/**
 * Audio features for the web fallback lip sync: loudness, zero-crossing rate
 * and the energy share of five frequency bands chosen around the vowel
 * formants (F1 / F2) and frication noise. Pure TypeScript, no dependency.
 */
import type { SpectrumInput } from './types';

/** A finite number in 0..1 (NaN / ±Infinity → 0). */
export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** A finite number in lo..hi (NaN → fallback). */
export function clampRange(v: number, lo: number, hi: number, fallback = lo): number {
  if (!Number.isFinite(v)) return fallback;
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Band edges in Hz:
 * - b0  80–400   voice fundamental, nasal murmur (m, n), F1 of closed vowels (i, ou)
 * - b1 400–1000  F1 of open vowels (a), F2 of back rounded vowels (o, ou)
 * - b2 1000–1600 F2 of open / central vowels (a)
 * - b3 1600–3200 F2 of front vowels (i, é)
 * - b4 3200–8000 frication (f, s, ch, v)
 */
export const BAND_EDGES = [80, 400, 1000, 1600, 3200, 8000] as const;

export interface AudioFeatures {
  /** Root mean square of the window (time domain), or an estimate from the spectrum. */
  rms: number;
  /** Zero crossings per sample 0..1 (high for noise-like sounds), -1 when unknown. */
  zcr: number;
  /** Energy share of each band, sum = 1 (all 0 when silent). */
  bands: [number, number, number, number, number];
  /** Total band energy (unnormalised). */
  energy: number;
}

const SILENT: AudioFeatures = { rms: 0, zcr: -1, bands: [0, 0, 0, 0, 0], energy: 0 };

/** Band shares from a linear magnitude spectrum. */
export function bandsFromSpectrum(spec: SpectrumInput): { bands: AudioFeatures['bands']; energy: number } {
  const { magnitudes, sampleRate, fftSize } = spec;
  const e = [0, 0, 0, 0, 0];
  if (!(sampleRate > 0) || !(fftSize > 0) || !magnitudes || magnitudes.length === 0) return { bands: [0, 0, 0, 0, 0], energy: 0 };
  const hz = sampleRate / fftSize;
  const n = Math.min(magnitudes.length, Math.floor(fftSize / 2) + 1);
  let band = 0;
  for (let i = 1; i < n; i++) {
    const f = i * hz;
    if (f < BAND_EDGES[0]) continue;
    while (band < 5 && f >= BAND_EDGES[band + 1]) band++;
    if (band >= 5) break;
    const m = magnitudes[i];
    if (!Number.isFinite(m) || m <= 0) continue;
    e[band] += m * m;
  }
  const total = e[0] + e[1] + e[2] + e[3] + e[4];
  if (!(total > 1e-12) || !Number.isFinite(total)) return { bands: [0, 0, 0, 0, 0], energy: 0 };
  return { bands: [e[0] / total, e[1] / total, e[2] / total, e[3] / total, e[4] / total], energy: total };
}

/** In-place iterative radix-2 FFT (re, im have the same power-of-two length). */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

const MAX_FFT = 4096;

/** Magnitude spectrum of a window of samples (Hann window, zero-padded to a power of two). */
export function spectrumFromSamples(samples: ArrayLike<number>, sampleRate: number): SpectrumInput {
  const len = Math.min(samples.length, MAX_FFT);
  let size = 64;
  while (size < len) size <<= 1;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < len; i++) {
    const s = samples[i];
    const w = len > 1 ? 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (len - 1)) : 1;
    re[i] = Number.isFinite(s) ? s * w : 0;
  }
  fft(re, im);
  const half = size / 2 + 1;
  const mags = new Float64Array(half);
  for (let i = 0; i < half; i++) mags[i] = Math.hypot(re[i], im[i]);
  return { magnitudes: mags, sampleRate, fftSize: size };
}

/** Full features of a time-domain window. */
export function analyseSamples(samples: ArrayLike<number> | undefined, sampleRate: number | undefined): AudioFeatures {
  if (!samples || samples.length < 16 || !(sampleRate !== undefined && sampleRate >= 8000)) return SILENT;
  let sum = 0;
  let crossings = 0;
  let prev = 0;
  let n = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const v = Number.isFinite(s) ? clampRange(s, -1, 1) : 0;
    sum += v * v;
    if (i > 0 && (v >= 0) !== (prev >= 0)) crossings++;
    prev = v;
    n++;
  }
  const rms = Math.sqrt(sum / Math.max(1, n));
  if (!(rms > 1e-5)) return { ...SILENT, zcr: 0 };
  const { bands, energy } = bandsFromSpectrum(spectrumFromSamples(samples, sampleRate));
  return { rms, zcr: crossings / Math.max(1, n - 1), bands, energy };
}

/** Features from a spectrum only (rms is estimated from Parseval's theorem). */
export function analyseSpectrum(spec: SpectrumInput | undefined): AudioFeatures {
  if (!spec) return SILENT;
  const { bands, energy } = bandsFromSpectrum(spec);
  if (!(energy > 0)) return SILENT;
  // Hann-windowed one-sided spectrum: sum|X|² ≈ N² · rms² · 0.375 / 2.
  const rms = Math.sqrt((2 * energy) / (0.375 * spec.fftSize * spec.fftSize));
  return { rms: Number.isFinite(rms) ? rms : 0, zcr: -1, bands, energy };
}

/** AnalyserNode.getFloatFrequencyData (dB) → linear magnitudes, scaled like our own FFT. */
export function dbToMagnitudes(db: ArrayLike<number>, fftSize: number): Float64Array {
  const out = new Float64Array(db.length);
  // The analyser reports 20·log10(|X| / N): undo the 1/N so analyseSpectrum's rms estimate holds.
  for (let i = 0; i < db.length; i++) {
    const v = db[i];
    out[i] = Number.isFinite(v) ? Math.pow(10, v / 20) * fftSize : 0;
  }
  return out;
}

/** AnalyserNode.getByteFrequencyData (0..255 over minDb..maxDb) → linear magnitudes. */
export function bytesToMagnitudes(bytes: ArrayLike<number>, fftSize: number, minDb = -100, maxDb = -30): Float64Array {
  const db = new Float64Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    db[i] = Number.isFinite(b) && b > 0 ? minDb + (b / 255) * (maxDb - minDb) : -Infinity;
  }
  return dbToMagnitudes(db, fftSize);
}

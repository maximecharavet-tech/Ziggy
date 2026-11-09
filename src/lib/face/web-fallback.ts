/**
 * WebFallbackAnimator: lip sync computed live in the browser from the audio
 * that is playing (no model, no network, no GPU, works offline).
 *
 * Every frame: features (loudness, zero crossings, five formant bands) →
 * soft viseme scores (AA / EE / OO / MM / FF, or rest when quiet) → attack /
 * release smoothing → jaw opening, plus the happy emotion mix of EmotionMixer.
 *
 * Feed it whatever is cheapest: `spectrum` (AnalyserNode frequency data, see
 * dbToMagnitudes), `samples` (time-domain window) or just `level` (0..1).
 */
import { EmotionMixer } from './emotion';
import { analyseSamples, analyseSpectrum, clamp01, clampRange, type AudioFeatures } from './features';
import { VISEMES, type Emotion, type FaceAnimator, type FaceFrame, type FaceInput, type Viseme, type VisemeWeights } from './types';

/** How open the jaw is for each viseme at full loudness. */
export const VISEME_OPENNESS: Record<Viseme, number> = { rest: 0, AA: 1, EE: 0.5, OO: 0.6, MM: 0.04, FF: 0.18 };

export function emptyVisemes(): VisemeWeights {
  return { rest: 0, AA: 0, EE: 0, OO: 0, MM: 0, FF: 0 };
}

/** Clamp, then scale to sum 1 (all-zero → rest). */
export function normalizeVisemes(w: Partial<VisemeWeights>): VisemeWeights {
  const out = emptyVisemes();
  let sum = 0;
  for (const v of VISEMES) {
    out[v] = clamp01(w[v] ?? 0);
    sum += out[v];
  }
  if (!(sum > 1e-9)) return { ...emptyVisemes(), rest: 1 };
  for (const v of VISEMES) out[v] /= sum;
  return out;
}

export function dominantViseme(w: VisemeWeights): Viseme {
  let best: Viseme = 'rest';
  for (const v of VISEMES) if (w[v] > w[best]) best = v;
  return best;
}

/**
 * Raw (unnormalised, ≥ 0) mouth-shape scores from band shares. Hand-tuned on
 * formant positions: a (F1 ~750, F2 ~1250), i/é (F1 ~300, F2 ~2300),
 * o/ou (F1 ~350, F2 ~800), m/b/p (low murmur only), f/s (noise above 3 kHz).
 */
export function visemeScores(f: AudioFeatures): Omit<VisemeWeights, 'rest'> {
  const [b0, b1, b2, b3, b4] = f.bands;
  // Zero crossings only count as frication when there is some energy up high
  // (a bright "i" also crosses zero often, but has little above 3.2 kHz).
  const noisy = f.zcr < 0 ? b4 : Math.max(b4, clamp01((f.zcr - 0.12) * 3) * clamp01(b4 * 4));
  const upper = b1 + b2 + b3 + b4;
  return {
    // "a": energy in both the F1 (400–1000) and F2 (1000–1600) bands.
    AA: Math.max(0, 2 * Math.min(b1, b2) - 0.5 * b0 - 0.5 * b3 - b4),
    // "i / é": a strong F2 high up (1600–3200).
    EE: Math.max(0, 1.6 * b3 - 0.6 * b1 - 0.8 * b4),
    // "o / ou": everything below 1 kHz, with some of it above 400 Hz (else it is a hum: m).
    OO: Math.max(0, (b0 + b1) * clamp01(b1 * 3) - 3 * b2 - 3 * b3 - b4),
    // "m / b / p": only the low murmur.
    MM: Math.max(0, b0 - 2.5 * upper),
    // "f / s / ch": noise above 3.2 kHz.
    FF: Math.max(0, 1.6 * noisy - 0.3),
  };
}

/** Viseme weights for one frame, given features and a 0..1 voicing amount. */
export function classifyFrame(f: AudioFeatures, voicing: number, sharpness = 6): VisemeWeights {
  const v = clamp01(voicing);
  const s = visemeScores(f);
  const keys = ['AA', 'EE', 'OO', 'MM', 'FF'] as const;
  let max = 0;
  for (const k of keys) max = Math.max(max, s[k]);
  const out = emptyVisemes();
  if (!(max > 1e-6)) {
    // Voiced but ambiguous: a neutral half-open "a".
    out.AA = v * 0.6;
    out.rest = 1 - out.AA;
    return normalizeVisemes(out);
  }
  let sum = 0;
  const e: Record<string, number> = {};
  for (const k of keys) {
    e[k] = Math.exp(sharpness * (s[k] / max - 1));
    sum += e[k];
  }
  for (const k of keys) out[k] = (v * e[k]) / sum;
  out.rest = 1 - v;
  return normalizeVisemes(out);
}

/** Exponential approach with separate attack (rising) and release (falling) time constants. */
export function smoothTowards(cur: number, target: number, dt: number, attack: number, release: number): number {
  const c = Number.isFinite(cur) ? cur : 0;
  const t = Number.isFinite(target) ? target : 0;
  const d = clampRange(dt, 0, 0.25, 0);
  const tau = t > c ? attack : release;
  if (!(tau > 0)) return t;
  return c + (t - c) * (1 - Math.exp(-d / tau));
}

export interface WebFallbackOptions {
  /** Rise time of mouth shapes (s). Default 0.03. */
  attack?: number;
  /** Fall time of mouth shapes (s). Default 0.08. */
  release?: number;
  /** Below this rms the voice is considered silent. Default 0.004. */
  gate?: number;
  /** How fast the automatic gain forgets a loud peak (s). Default 1.5. */
  peakDecay?: number;
  /** Overall jaw gain. Default 1. */
  jawGain?: number;
}

export class WebFallbackAnimator implements FaceAnimator {
  readonly kind = 'web-fallback' as const;
  private visemes: VisemeWeights = { ...emptyVisemes(), rest: 1 };
  private jaw = 0;
  private loud = 0;
  private peak = 0.05;
  private mixer = new EmotionMixer();
  private o: Required<WebFallbackOptions>;

  constructor(opts: WebFallbackOptions = {}) {
    this.o = {
      attack: clampRange(opts.attack ?? 0.03, 0.001, 1, 0.03),
      release: clampRange(opts.release ?? 0.08, 0.001, 2, 0.08),
      gate: clampRange(opts.gate ?? 0.004, 0, 0.5, 0.004),
      peakDecay: clampRange(opts.peakDecay ?? 1.5, 0.05, 30, 1.5),
      jawGain: clampRange(opts.jawGain ?? 1, 0, 3, 1),
    };
  }

  setEmotion(emotion: Emotion | string, intensity = 1) {
    this.mixer.hold(emotion, intensity);
  }

  cue(emotion: Emotion | string, seconds?: number) {
    this.mixer.cue(emotion, seconds);
  }

  reset() {
    this.visemes = { ...emptyVisemes(), rest: 1 };
    this.jaw = 0;
    this.loud = 0;
    this.peak = 0.05;
    this.mixer.reset();
  }

  /** Features of this frame, from the richest input available. */
  private features(input: FaceInput): AudioFeatures {
    if (input.spectrum) return analyseSpectrum(input.spectrum);
    if (input.samples) return analyseSamples(input.samples, input.sampleRate);
    const lvl = clamp01(input.level ?? 0);
    // Level only: no spectral shape, an "a"-ish mouth that follows loudness.
    return { rms: lvl * 0.2, zcr: -1, bands: lvl > 0 ? [0.2, 0.45, 0.35, 0, 0] : [0, 0, 0, 0, 0], energy: lvl };
  }

  update(input: FaceInput): FaceFrame {
    const dt = clampRange(input?.dt ?? 0, 0, 0.25, 0);
    const f = this.features(input ?? { dt: 0 });
    const rms = Number.isFinite(f.rms) ? Math.max(0, f.rms) : 0;

    // Automatic gain: loudness relative to a slowly decaying recent peak.
    this.peak = Math.max(rms, this.peak * Math.exp(-dt / this.o.peakDecay), 0.02);
    const rel = rms > this.o.gate ? clamp01(rms / this.peak) : 0;
    this.loud = smoothTowards(this.loud, rel, dt, this.o.attack, this.o.release);

    const voicing = clamp01((rel - 0.06) / 0.25);
    const target = classifyFrame(f, voicing);
    const next = emptyVisemes();
    for (const v of VISEMES) next[v] = smoothTowards(this.visemes[v], target[v], dt, this.o.attack, this.o.release);
    this.visemes = normalizeVisemes(next);

    let open = 0;
    for (const v of VISEMES) open += this.visemes[v] * VISEME_OPENNESS[v];
    const jawTarget = clamp01(Math.pow(clamp01(rel), 0.7) * open * this.o.jawGain);
    this.jaw = smoothTowards(this.jaw, jawTarget, dt, this.o.attack, this.o.release);

    const { weights, expression } = this.mixer.update(dt);
    return {
      jaw: clamp01(Math.max(this.jaw, expression.jawBias * (1 - this.loud))),
      visemes: { ...this.visemes },
      viseme: dominantViseme(this.visemes),
      emotion: weights,
      expression,
      loudness: clamp01(this.loud),
    };
  }
}

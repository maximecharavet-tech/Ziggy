/**
 * PrecomputedTrackAnimator: plays a face track baked offline (Audio2Face-3D
 * ARKit weights, or our own viseme channels) in sync with the clip's playback
 * time. No audio analysis at runtime; the result has the same shape as the
 * WebFallbackAnimator's, so characters never know which one drives them.
 */
import { EmotionMixer } from './emotion';
import { clamp01, clampRange } from './features';
import { emotionAt, sampleTrack, type FaceTrack } from './track';
import { type Emotion, type FaceAnimator, type FaceFrame, type FaceInput, type VisemeWeights } from './types';
import { dominantViseme, emptyVisemes, normalizeVisemes, smoothTowards } from './web-fallback';

const avg = (a = 0, b = 0) => (a + b) / 2;

/** Our six visemes from ARKit blendshape weights (missing channels count as 0). */
export function visemesFromArkit(w: Record<string, number>): { visemes: VisemeWeights; jaw: number } {
  const g = (k: string) => clamp01(w[k] ?? 0);
  const jaw = g('jawOpen');
  const OO = Math.max(g('mouthPucker'), g('mouthFunnel'));
  const MM = Math.max(g('mouthClose'), avg(g('mouthPressLeft'), g('mouthPressRight'))) * (1 - jaw);
  const FF = Math.max(g('mouthRollLower'), 0.6 * avg(g('mouthUpperUpLeft'), g('mouthUpperUpRight'))) * (1 - jaw * 0.5);
  const EE = clamp01(1.5 * avg(g('mouthStretchLeft'), g('mouthStretchRight')));
  const AA = jaw * (1 - OO) * (1 - EE * 0.5);
  const sum = AA + EE + OO + MM + FF;
  return { visemes: normalizeVisemes({ AA, EE, OO, MM, FF, rest: Math.max(0, 1 - sum) }), jaw };
}

/** Visemes from a sample: our own channels if the track has them, else derived from ARKit. */
export function visemesFromSample(s: Record<string, number>): { visemes: VisemeWeights; jaw: number } {
  if ('AA' in s || 'EE' in s || 'OO' in s || 'MM' in s || 'FF' in s) {
    const w = { AA: s.AA ?? 0, EE: s.EE ?? 0, OO: s.OO ?? 0, MM: s.MM ?? 0, FF: s.FF ?? 0 };
    const sum = w.AA + w.EE + w.OO + w.MM + w.FF;
    return { visemes: normalizeVisemes({ ...w, rest: Math.max(0, 1 - sum) }), jaw: clamp01(s.jaw ?? s.jawOpen ?? w.AA) };
  }
  const r = visemesFromArkit(s);
  if ('jaw' in s) r.jaw = clamp01(s.jaw);
  return r;
}

export class PrecomputedTrackAnimator implements FaceAnimator {
  readonly kind = 'precomputed' as const;
  private clock = 0;
  private jaw = 0;
  private mixer = new EmotionMixer();
  private lastKey: string | null = null;

  constructor(readonly track: FaceTrack) {}

  /** True once playback time is past the end of the track. */
  get ended() {
    return this.clock > this.track.duration;
  }

  setEmotion(emotion: Emotion | string, intensity = 1) {
    this.mixer.hold(emotion, intensity);
  }

  cue(emotion: Emotion | string, seconds?: number) {
    this.mixer.cue(emotion, seconds);
  }

  reset() {
    this.clock = 0;
    this.jaw = 0;
    this.lastKey = null;
    this.mixer.reset();
  }

  update(input: FaceInput): FaceFrame {
    const dt = clampRange(input?.dt ?? 0, 0, 0.25, 0);
    this.clock = Number.isFinite(input?.time) ? Math.max(0, input.time as number) : this.clock + dt;
    const t = this.clock;
    const inClip = t <= this.track.duration;

    const key = emotionAt(this.track, t);
    const id = key ? `${key.emotion}:${key.weight}` : null;
    if (key && id !== this.lastKey) this.mixer.hold(key.emotion, key.weight);
    this.lastKey = id;

    const s = inClip ? sampleTrack(this.track, t) : {};
    const { visemes, jaw } = inClip ? visemesFromSample(s) : { visemes: { ...emptyVisemes(), rest: 1 }, jaw: 0 };
    this.jaw = smoothTowards(this.jaw, jaw, dt, 0.015, 0.05);
    if (dt === 0) this.jaw = jaw;

    const { weights, expression } = this.mixer.update(dt);
    // Let the track's own eyes / brows / cheeks through, never below the mixer's happy face.
    const g = (k: string) => clamp01(s[k] ?? 0);
    expression.smile = clamp01(Math.max(expression.smile, avg(g('mouthSmileLeft'), g('mouthSmileRight'))));
    expression.cheek = clamp01(Math.max(expression.cheek, avg(g('cheekSquintLeft'), g('cheekSquintRight'))));
    expression.browUp = clamp01(Math.max(expression.browUp, g('browInnerUp'), avg(g('browOuterUpLeft'), g('browOuterUpRight'))));
    expression.eyeWide = clamp01(Math.max(expression.eyeWide, avg(g('eyeWideLeft'), g('eyeWideRight'))));
    expression.blinkL = clamp01(Math.max(expression.blinkL, g('eyeBlinkLeft')));
    expression.blinkR = clamp01(Math.max(expression.blinkR, g('eyeBlinkRight')));

    return {
      jaw: clamp01(Math.max(this.jaw, expression.jawBias * (inClip ? 0.3 : 1))),
      visemes,
      viseme: dominantViseme(visemes),
      emotion: weights,
      expression,
      loudness: clamp01(this.jaw),
    };
  }
}

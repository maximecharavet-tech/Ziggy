/**
 * Emotion presets and blending. Only happy or attentive faces exist here:
 * Ziggy and companions are never sad (child-safety red line). Any other label,
 * including the sad / angry / afraid emotions Audio2Face-3D and Audio2Emotion
 * know about, is mapped to a happy emotion or dropped.
 */
import { clamp01, clampRange } from './features';
import { EMOTIONS, type Emotion, type EmotionWeights, type ExpressionParams } from './types';

export const NEUTRAL_EXPRESSION: ExpressionParams = {
  smile: 0.35, // our characters rest on a soft smile
  cheek: 0.1,
  browUp: 0,
  eyeWide: 0,
  blinkL: 0,
  blinkR: 0,
  headTilt: 0,
  jawBias: 0,
};

/** What each emotion looks like at full intensity. */
export const EMOTION_PRESETS: Record<Emotion, ExpressionParams> = {
  neutral: NEUTRAL_EXPRESSION,
  smile: { smile: 0.8, cheek: 0.45, browUp: 0.15, eyeWide: 0, blinkL: 0.1, blinkR: 0.1, headTilt: 0.05, jawBias: 0 },
  laugh: { smile: 1, cheek: 0.9, browUp: 0.35, eyeWide: 0, blinkL: 0.55, blinkR: 0.55, headTilt: 0, jawBias: 0.45 },
  surprise: { smile: 0.4, cheek: 0.1, browUp: 1, eyeWide: 0.9, blinkL: 0, blinkR: 0, headTilt: 0, jawBias: 0.35 },
  listen: { smile: 0.5, cheek: 0.2, browUp: 0.45, eyeWide: 0.2, blinkL: 0, blinkR: 0, headTilt: 0.6, jawBias: 0 },
  wink: { smile: 0.85, cheek: 0.6, browUp: 0.2, eyeWide: 0, blinkL: 1, blinkR: 0, headTilt: 0.25, jawBias: 0 },
};

const ALIASES: Record<string, Emotion | null> = {
  // our own words
  idle: 'neutral', calm: 'neutral', happy: 'smile', joy: 'smile', excited: 'laugh', giggle: 'laugh', cheer: 'laugh',
  amazement: 'surprise', amazed: 'surprise', wow: 'surprise', curious: 'listen', think: 'listen', cheekiness: 'wink', cheeky: 'wink',
  // never shown: these become a gentle smile
  sad: 'smile', sadness: 'smile', grief: 'smile', cry: 'smile', anger: 'smile', angry: 'smile', fear: 'smile', afraid: 'smile',
  pain: 'smile', disgust: 'smile', outofbreath: 'smile', oops: 'smile', worried: 'smile', bored: 'smile', sleepy: 'neutral',
};

/** Any label → one of our happy emotions (unknown → smile). */
export function sanitizeEmotion(label: string): Emotion {
  const k = String(label ?? '').trim().toLowerCase();
  if ((EMOTIONS as readonly string[]).includes(k)) return k as Emotion;
  const a = ALIASES[k];
  return a ?? 'smile';
}

/**
 * Audio2Face-3D / Audio2Emotion emotion vector (labels from the model's
 * network_info.json) → our weights. Only amazement, joy and cheekiness are
 * kept; every negative emotion is dropped (weight discarded, never shown).
 */
export const A2F_EMOTION_MAP: Record<string, Emotion | null> = {
  amazement: 'surprise', joy: 'smile', cheekiness: 'wink',
  anger: null, disgust: null, fear: null, grief: null, outofbreath: null, pain: null, sadness: null,
};

export function weightsFromA2fEmotions(labels: readonly string[], values: readonly number[]): EmotionWeights {
  const w = emptyWeights();
  labels.forEach((l, i) => {
    const e = A2F_EMOTION_MAP[l.toLowerCase()];
    if (e) w[e] += clamp01(values[i] ?? 0);
  });
  return normalizeEmotions(w);
}

export function emptyWeights(): EmotionWeights {
  return { neutral: 0, smile: 0, laugh: 0, surprise: 0, listen: 0, wink: 0 };
}

/** Clamp to 0..1, scale down if the non-neutral total exceeds 1, neutral = the rest. */
export function normalizeEmotions(w: Partial<EmotionWeights>): EmotionWeights {
  const out = emptyWeights();
  let sum = 0;
  for (const e of EMOTIONS) {
    if (e === 'neutral') continue;
    out[e] = clamp01(w[e] ?? 0);
    sum += out[e];
  }
  if (sum > 1) for (const e of EMOTIONS) if (e !== 'neutral') out[e] /= sum;
  out.neutral = clamp01(1 - Math.min(1, sum));
  return out;
}

/** Weighted mix of the presets (weights are normalised first). */
export function blendExpression(weights: Partial<EmotionWeights>): ExpressionParams {
  const w = normalizeEmotions(weights);
  const out: ExpressionParams = { smile: 0, cheek: 0, browUp: 0, eyeWide: 0, blinkL: 0, blinkR: 0, headTilt: 0, jawBias: 0 };
  const keys = Object.keys(out) as (keyof ExpressionParams)[];
  for (const e of EMOTIONS) {
    const p = EMOTION_PRESETS[e];
    for (const k of keys) out[k] += w[e] * p[k];
  }
  for (const k of keys) out[k] = k === 'headTilt' ? clampRange(out[k], -1, 1, 0) : clamp01(out[k]);
  // Never below the resting smile: a mouth that drops would read as sad.
  out.smile = Math.max(out.smile, NEUTRAL_EXPRESSION.smile * 0.8);
  return out;
}

/**
 * Smoothly moves between emotions. `hold` sets the base emotion, `cue` plays a
 * one-shot on top that fades back. Laughing adds a "ho ho ho" jaw bounce and
 * the face blinks by itself every few seconds.
 */
export class EmotionMixer {
  private base: Emotion = 'neutral';
  private baseIntensity = 0;
  private cueEmotion: Emotion | null = null;
  private cueLeft = 0;
  private cueTotal = 0;
  private w = emptyWeights();
  private clock = 0;
  private nextBlink = 2.4;
  private blinkT = -1;

  constructor(private rate = 6) {
    this.w.neutral = 1;
  }

  hold(label: Emotion | string, intensity = 1) {
    this.base = sanitizeEmotion(label);
    this.baseIntensity = clamp01(intensity);
  }

  cue(label: Emotion | string, seconds = 0.8) {
    this.cueEmotion = sanitizeEmotion(label);
    this.cueTotal = clampRange(seconds, 0.1, 10, 0.8);
    this.cueLeft = this.cueTotal;
  }

  reset() {
    this.base = 'neutral';
    this.baseIntensity = 0;
    this.cueEmotion = null;
    this.cueLeft = 0;
    this.w = emptyWeights();
    this.w.neutral = 1;
    this.blinkT = -1;
  }

  /** The target weights right now (before smoothing). */
  target(): EmotionWeights {
    const t = emptyWeights();
    if (this.base !== 'neutral') t[this.base] = this.baseIntensity;
    if (this.cueEmotion && this.cueLeft > 0 && this.cueEmotion !== 'neutral') {
      // The cue takes over, then hands back over its last 30 %.
      const k = clamp01(this.cueLeft / (this.cueTotal * 0.3));
      for (const e of EMOTIONS) t[e] *= 1 - k;
      t[this.cueEmotion] += k;
    }
    return normalizeEmotions(t);
  }

  update(dtIn: number): { weights: EmotionWeights; expression: ExpressionParams } {
    const dt = clampRange(dtIn, 0, 0.25, 0);
    this.clock += dt;
    if (this.cueLeft > 0) {
      this.cueLeft = Math.max(0, this.cueLeft - dt);
      if (this.cueLeft === 0) this.cueEmotion = null;
    }
    const tgt = this.target();
    const k = 1 - Math.exp(-dt * this.rate);
    for (const e of EMOTIONS) this.w[e] += (tgt[e] - this.w[e]) * k;
    this.w = normalizeEmotions(this.w);
    const expression = blendExpression(this.w);

    // Laugh bounce (~4.5 Hz, only while laughing).
    if (this.w.laugh > 0.05) {
      const bounce = 0.5 + 0.5 * Math.sin(this.clock * Math.PI * 2 * 4.5);
      expression.jawBias = clamp01(expression.jawBias * (0.4 + 0.6 * bounce));
    }

    // Natural blinks (both eyes, 0.15 s), added on top of the preset lids.
    if (this.blinkT < 0 && this.clock >= this.nextBlink) {
      this.blinkT = 0;
      this.nextBlink = this.clock + 2.6 + 2.2 * (0.5 + 0.5 * Math.sin(this.clock * 12.9898));
    }
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      const b = this.blinkT >= 0.15 ? 0 : Math.sin((this.blinkT / 0.15) * Math.PI);
      expression.blinkL = clamp01(Math.max(expression.blinkL, b));
      expression.blinkR = clamp01(Math.max(expression.blinkR, b));
      if (this.blinkT >= 0.15) this.blinkT = -1;
    }
    return { weights: { ...this.w }, expression };
  }
}

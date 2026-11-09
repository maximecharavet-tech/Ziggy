/**
 * Face animation: shared types (pure, no DOM, no three.js, no NVIDIA).
 *
 * A `FaceAnimator` turns "what is being said right now" into a `FaceFrame`
 * (jaw opening, a handful of visemes, a happy emotion mix, expression
 * parameters) that each character maps onto its own rig (see mapping.ts):
 *
 * - `PrecomputedTrackAnimator` plays a track baked offline (Audio2Face-3D on a
 *   GPU box, once, see research/nvidia/offline-bake.md) and shipped as a small
 *   JSON file (track.ts).
 * - `WebFallbackAnimator` computes the same frame live, in the browser, from
 *   the audio itself (loudness + a few spectral bands).
 *
 * Red line: Ziggy and companions are never sad. There is no sad / angry /
 * afraid emotion in this module, and anything unknown maps to a happy one.
 */

/** Mouth shapes we animate (a small, cartoon-friendly set). */
export type Viseme = 'rest' | 'AA' | 'EE' | 'OO' | 'MM' | 'FF';
export const VISEMES: readonly Viseme[] = ['rest', 'AA', 'EE', 'OO', 'MM', 'FF'];

/** The only emotions our characters show. All happy or attentive, never sad. */
export type Emotion = 'neutral' | 'smile' | 'laugh' | 'surprise' | 'listen' | 'wink';
export const EMOTIONS: readonly Emotion[] = ['neutral', 'smile', 'laugh', 'surprise', 'listen', 'wink'];

export type VisemeWeights = Record<Viseme, number>;
export type EmotionWeights = Record<Emotion, number>;

/**
 * Expression parameters blended from the emotion presets. All in 0..1 except
 * `headTilt` (-1..1, + = toward the character's left).
 */
export interface ExpressionParams {
  /** Mouth corners up. Never below 0: no frown exists. */
  smile: number;
  /** Cheeks raised (eyes squint happily). */
  cheek: number;
  /** Brows raised (surprise, listening). */
  browUp: number;
  /** Eyes wide open (surprise). */
  eyeWide: number;
  /** Eyelid closure, left / right (wink = one side only). */
  blinkL: number;
  blinkR: number;
  /** Head tilt for listening / cheeky looks. */
  headTilt: number;
  /** Extra jaw opening added by the emotion (laugh bounce, surprise "oh"). */
  jawBias: number;
}

export interface FaceFrame {
  /** Jaw / mouth opening 0..1 (what `setTalk` / `setMouth` want). */
  jaw: number;
  /** Viseme weights, sum = 1. */
  visemes: VisemeWeights;
  /** The dominant viseme (argmax of `visemes`). */
  viseme: Viseme;
  /** Emotion weights, sum = 1 (`neutral` takes the rest). */
  emotion: EmotionWeights;
  /** Blended expression parameters. */
  expression: ExpressionParams;
  /** Smoothed loudness 0..1 (after automatic gain). */
  loudness: number;
}

/** A magnitude spectrum, e.g. from an AnalyserNode (see features.ts helpers). */
export interface SpectrumInput {
  /** Linear magnitudes, bin i = i * sampleRate / fftSize Hz. */
  magnitudes: ArrayLike<number>;
  sampleRate: number;
  fftSize: number;
}

/** What an animator is given every animation frame. */
export interface FaceInput {
  /** Seconds since the previous update (clamped internally to 0..0.25). */
  dt: number;
  /** Playback time of the clip in seconds (used by precomputed tracks). */
  time?: number;
  /** Time-domain samples of the current audio window (-1..1). */
  samples?: ArrayLike<number>;
  /** Sample rate of `samples`. */
  sampleRate?: number;
  /** A ready-made magnitude spectrum (cheaper than giving samples). */
  spectrum?: SpectrumInput;
  /** Last resort: a plain 0..1 loudness (like Santa's `setTalk(level)` today). */
  level?: number;
}

export interface FaceAnimator {
  readonly kind: 'precomputed' | 'web-fallback';
  /** Advance by `input.dt` and return the face to show now. */
  update(input: FaceInput): FaceFrame;
  /**
   * Hold an emotion (0..1 intensity). Accepts any string: unknown or negative
   * labels ("sad", "anger"…) are mapped to a happy emotion, never shown.
   */
  setEmotion(emotion: Emotion | string, intensity?: number): void;
  /** A short one-shot emotion (a wink, a surprise) that then fades back. */
  cue(emotion: Emotion | string, seconds?: number): void;
  /** Back to a resting, smiling face. */
  reset(): void;
}

/** The 52 ARKit blendshape names (Audio2Face-3D's blendshape solver output order). */
export const ARKIT_52 = [
  'eyeBlinkLeft', 'eyeLookDownLeft', 'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookUpLeft', 'eyeSquintLeft', 'eyeWideLeft',
  'eyeBlinkRight', 'eyeLookDownRight', 'eyeLookInRight', 'eyeLookOutRight', 'eyeLookUpRight', 'eyeSquintRight', 'eyeWideRight',
  'jawForward', 'jawLeft', 'jawRight', 'jawOpen',
  'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthDimpleLeft', 'mouthDimpleRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
  'mouthPressLeft', 'mouthPressRight', 'mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthUpperUpLeft', 'mouthUpperUpRight',
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight', 'noseSneerLeft', 'noseSneerRight', 'tongueOut',
] as const;
export type ArkitName = (typeof ARKIT_52)[number];

/**
 * ARKit shapes that read as sad / cross on a plush face. Tracks must not carry
 * them (the bake drops them, the validator refuses them).
 */
export const FORBIDDEN_ARKIT: readonly ArkitName[] = ['mouthFrownLeft', 'mouthFrownRight', 'browDownLeft', 'browDownRight', 'noseSneerLeft', 'noseSneerRight'];

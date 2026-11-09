/**
 * Face animation for Ziggy, Santa and the elves (see README.md in this folder).
 * Pure and framework-agnostic: no DOM, no three.js, no NVIDIA at runtime.
 */
export * from './types';
export { clamp01, analyseSamples, analyseSpectrum, spectrumFromSamples, dbToMagnitudes, bytesToMagnitudes, BAND_EDGES, type AudioFeatures } from './features';
export { EMOTION_PRESETS, EmotionMixer, sanitizeEmotion, blendExpression, normalizeEmotions, weightsFromA2fEmotions, A2F_EMOTION_MAP } from './emotion';
export { WebFallbackAnimator, classifyFrame, visemeScores, smoothTowards, VISEME_OPENNESS, type WebFallbackOptions } from './web-fallback';
export { PrecomputedTrackAnimator, visemesFromArkit } from './precomputed';
export {
  validateTrack,
  encodeTrack,
  sampleTrack,
  emotionAt,
  ALLOWED_CHANNELS,
  VISEME_CHANNELS,
  TRACK_FORMAT,
  TRACK_VERSION,
  type FaceTrack,
  type FaceTrackFile,
  type ValidationResult,
} from './track';
export { toSantaTalk, toSantaExpression, toZiggyMouth, toElfMouth, toArkitWeights, CHARACTER_PROFILES, type CharacterId, type ZiggyMouth, type SantaExpression } from './mapping';

import type { FaceAnimator } from './types';
import { PrecomputedTrackAnimator } from './precomputed';
import { validateTrack } from './track';
import { WebFallbackAnimator, type WebFallbackOptions } from './web-fallback';

/**
 * The animator for a clip: the baked track when there is a valid one, else the
 * live web fallback. A missing, broken or refused track never breaks the scene.
 */
export function createFaceAnimator(track?: unknown, fallback: WebFallbackOptions = {}): FaceAnimator {
  if (track !== undefined && track !== null) {
    const r = validateTrack(track);
    if (r.ok) return new PrecomputedTrackAnimator(r.track);
  }
  return new WebFallbackAnimator(fallback);
}

/**
 * Loudness balance of every sound (linear gain), measured offline: each sound
 * is rendered dry in Chromium (OfflineAudioContext, no variation), measured
 * with `meter.ts` (K-weighted loudness, 200 ms window), and brought to its
 * catalog `target` with its peak kept at or below −8 dBFS before the master bus.
 * Re-measure after changing a recipe.
 */
import type { SoundName } from './catalog';

export const MAX_PEAK_DB = -8;

export const GAINS: Record<SoundName, number> = {
  tap: 0.347,
  correct: 0.312,
  wrong: 0.211,
  star: 0.36,
  win: 0.469,
  reward: 0.367,
  pop: 0.474,
  boing: 0.311,
  squeak: 0.43,
  whoosh: 0.547,
  sparkle: 0.458,
  bubble: 0.411,
  giggle: 0.797,
  slideUp: 0.145,
  slideDown: 0.137,
  drumroll: 0.546,
  tada: 0.702,
  honk: 0.185,
  plop: 0.392,
  magic: 0.506,
  hover: 0.201,
  unlock: 0.302,
  bonk: 0.457,
  pageIn: 0.55,
  confetti: 1.414,
  snore: 0.231,
  yay: 0.258,
};

/**
 * What the measurement found after balancing (dry, before the master bus):
 * peak in dBFS, loudness in LUFS (200 ms window). Written with GAINS; the tests
 * check it against the catalog targets, so a retargeted sound must be re-measured.
 */
export const MEASURED: Record<SoundName, { peak: number; loudness: number }> = {
  tap: { peak: -14.5, loudness: -30 },
  correct: { peak: -14.3, loudness: -23.5 },
  wrong: { peak: -21.3, loudness: -26 },
  star: { peak: -16.5, loudness: -23 },
  win: { peak: -15.6, loudness: -21.5 },
  reward: { peak: -11.9, loudness: -19 },
  pop: { peak: -13, loudness: -26 },
  boing: { peak: -14.7, loudness: -25 },
  squeak: { peak: -20.1, loudness: -26 },
  whoosh: { peak: -19.1, loudness: -27 },
  sparkle: { peak: -21, loudness: -26 },
  bubble: { peak: -13.9, loudness: -27 },
  giggle: { peak: -18.2, loudness: -25 },
  slideUp: { peak: -24, loudness: -26 },
  slideDown: { peak: -24.4, loudness: -26 },
  drumroll: { peak: -12, loudness: -24 },
  tada: { peak: -13.3, loudness: -21.5 },
  honk: { peak: -17.7, loudness: -26 },
  plop: { peak: -11.7, loudness: -27 },
  magic: { peak: -9.7, loudness: -24 },
  hover: { peak: -24.6, loudness: -40 },
  unlock: { peak: -16, loudness: -24 },
  bonk: { peak: -11, loudness: -26 },
  pageIn: { peak: -20.4, loudness: -32 },
  confetti: { peak: -11.1, loudness: -24 },
  snore: { peak: -21.2, loudness: -31 },
  yay: { peak: -19.1, loudness: -24 },
};

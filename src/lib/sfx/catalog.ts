/**
 * The list of Ziggy's sound effects and how each one behaves in the mix.
 *
 * Pure data (no Web Audio here), shared by the synthesiser, the player's
 * limits and the tests. The loudness of each sound is balanced by the measured
 * gains in `./gains.ts`, not by hand. Names and emoji for people are in
 * `./labels.ts` (only the Lab gallery loads them).
 */
export const SOUND_NAMES = [
  // The original seven (52 files call them): same names, richer voices.
  'tap',
  'correct',
  'wrong',
  'star',
  'win',
  'reward',
  'pop',
  // The funny ones.
  'boing',
  'squeak',
  'whoosh',
  'sparkle',
  'bubble',
  'giggle',
  'slideUp',
  'slideDown',
  'drumroll',
  'tada',
  'honk',
  'plop',
  'magic',
  'hover',
  'unlock',
  'bonk',
  'pageIn',
  'confetti',
  'snore',
  'yay',
] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

/** How much a sound may change from one play to the next (so repeats never sound robotic). */
export type Variation = {
  /** Random detune, ± cents. */
  cents: number;
  /** Random time stretch, ± fraction (0.05 = ±5 %). */
  time: number;
  /** Random level, ± dB (kept small: loudness must stay consistent). */
  db: number;
};

export type SoundMeta = {
  /** Loudness target used to measure `gains.ts` (LUFS, 200 ms window max, dry). */
  target: number;
  /** Minimum time between two plays of this sound (spam-tapping never makes a wall of noise). */
  minGapMs: number;
  /** 1 = tiny UI tick, 2 = effect, 3 = feedback/celebration (wins a voice when the mix is full). */
  priority: 1 | 2 | 3;
  /** At most this many copies at once. */
  maxPerName: number;
  /** When that many already play: cut the oldest copy ('steal') or skip the new one ('drop'). */
  onFull: 'steal' | 'drop';
  /** Send to the little room (0 = dry). */
  room: number;
  vary: Variation;
};

const v = (cents: number, time: number, db: number): Variation => ({ cents, time, db });

export const SOUNDS: Record<SoundName, SoundMeta> = {
  tap: { target: -30, minGapMs: 35, priority: 1, maxPerName: 3, onFull: 'steal', room: 0.04, vary: v(80, 0.06, 0.75) },
  correct: { target: -23.5, minGapMs: 80, priority: 3, maxPerName: 2, onFull: 'steal', room: 0.15, vary: v(30, 0.03, 0.5) },
  wrong: { target: -26, minGapMs: 150, priority: 3, maxPerName: 1, onFull: 'steal', room: 0.1, vary: v(40, 0.04, 0.5) },
  star: { target: -23, minGapMs: 80, priority: 3, maxPerName: 3, onFull: 'steal', room: 0.25, vary: v(40, 0.04, 0.5) },
  win: { target: -21.5, minGapMs: 400, priority: 3, maxPerName: 1, onFull: 'drop', room: 0.22, vary: v(20, 0.02, 0.3) },
  reward: { target: -19, minGapMs: 600, priority: 3, maxPerName: 1, onFull: 'drop', room: 0.3, vary: v(15, 0.02, 0.3) },
  pop: { target: -26, minGapMs: 50, priority: 2, maxPerName: 2, onFull: 'steal', room: 0.08, vary: v(60, 0.05, 0.5) },
  boing: { target: -25, minGapMs: 90, priority: 2, maxPerName: 2, onFull: 'steal', room: 0.15, vary: v(100, 0.08, 0.5) },
  squeak: { target: -26, minGapMs: 70, priority: 2, maxPerName: 2, onFull: 'steal', room: 0.08, vary: v(150, 0.08, 0.75) },
  whoosh: { target: -27, minGapMs: 90, priority: 2, maxPerName: 2, onFull: 'steal', room: 0.1, vary: v(150, 0.12, 0.75) },
  sparkle: { target: -26, minGapMs: 120, priority: 2, maxPerName: 2, onFull: 'steal', room: 0.3, vary: v(100, 0.1, 0.5) },
  bubble: { target: -27, minGapMs: 45, priority: 2, maxPerName: 3, onFull: 'steal', room: 0.12, vary: v(200, 0.1, 0.75) },
  giggle: { target: -25, minGapMs: 400, priority: 2, maxPerName: 1, onFull: 'drop', room: 0.12, vary: v(120, 0.06, 0.5) },
  slideUp: { target: -26, minGapMs: 200, priority: 2, maxPerName: 1, onFull: 'steal', room: 0.12, vary: v(80, 0.08, 0.5) },
  slideDown: { target: -26, minGapMs: 200, priority: 2, maxPerName: 1, onFull: 'steal', room: 0.12, vary: v(80, 0.08, 0.5) },
  drumroll: { target: -24, minGapMs: 700, priority: 2, maxPerName: 1, onFull: 'drop', room: 0.15, vary: v(30, 0.03, 0.3) },
  tada: { target: -21.5, minGapMs: 400, priority: 3, maxPerName: 1, onFull: 'drop', room: 0.25, vary: v(25, 0.02, 0.3) },
  honk: { target: -26, minGapMs: 150, priority: 2, maxPerName: 2, onFull: 'steal', room: 0.12, vary: v(100, 0.05, 0.5) },
  plop: { target: -27, minGapMs: 50, priority: 2, maxPerName: 2, onFull: 'steal', room: 0.06, vary: v(120, 0.08, 0.75) },
  magic: { target: -24, minGapMs: 300, priority: 3, maxPerName: 1, onFull: 'steal', room: 0.35, vary: v(50, 0.05, 0.5) },
  hover: { target: -40, minGapMs: 60, priority: 1, maxPerName: 1, onFull: 'steal', room: 0, vary: v(60, 0.05, 0.5) },
  unlock: { target: -24, minGapMs: 200, priority: 3, maxPerName: 2, onFull: 'steal', room: 0.15, vary: v(40, 0.03, 0.5) },
  bonk: { target: -26, minGapMs: 90, priority: 2, maxPerName: 2, onFull: 'steal', room: 0.1, vary: v(120, 0.08, 0.5) },
  pageIn: { target: -32, minGapMs: 200, priority: 1, maxPerName: 1, onFull: 'steal', room: 0.06, vary: v(80, 0.08, 0.5) },
  confetti: { target: -24, minGapMs: 200, priority: 3, maxPerName: 2, onFull: 'steal', room: 0.2, vary: v(80, 0.08, 0.5) },
  snore: { target: -31, minGapMs: 1200, priority: 1, maxPerName: 1, onFull: 'drop', room: 0.1, vary: v(80, 0.08, 0.5) },
  yay: { target: -24, minGapMs: 300, priority: 3, maxPerName: 1, onFull: 'steal', room: 0.15, vary: v(80, 0.05, 0.5) },
};


export const isSoundName = (name: unknown): name is SoundName =>
  typeof name === 'string' && Object.prototype.hasOwnProperty.call(SOUNDS, name);

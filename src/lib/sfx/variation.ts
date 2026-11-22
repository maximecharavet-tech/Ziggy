/**
 * Per-play variation: each tap is a hair higher or lower, a touch quicker or
 * slower, so repeated sounds feel alive instead of robotic. Pure (the random
 * source is passed in) and bounded by the sound's `Variation` limits.
 */
import { clamp } from './math';
import type { Variation } from './catalog';

export type Varied = { cents: number; time: number; db: number };

export const NO_VARIATION: Varied = { cents: 0, time: 1, db: 0 };

/**
 * Draw one variation. When `last` (the previous play's detune) is given, a
 * draw too close to it is reflected to the other side, so two plays in a row
 * never sound the same.
 */
export function vary(spec: Variation, rng: () => number, enabled = true, last?: number): Varied {
  if (!enabled) return NO_VARIATION;
  const span = (x: number) => (rng() * 2 - 1) * x;
  let cents = span(spec.cents);
  if (last !== undefined && spec.cents > 0 && Math.abs(cents - last) < spec.cents * 0.3) {
    cents = clamp(last > 0 ? last - spec.cents * 0.6 : last + spec.cents * 0.6, -spec.cents, spec.cents);
  }
  return {
    cents: clamp(cents, -spec.cents, spec.cents),
    time: clamp(1 + span(spec.time), 1 - spec.time, 1 + spec.time),
    db: clamp(span(spec.db), -spec.db, spec.db),
  };
}

/** The caller's pitch option: semitones, kept within an octave either way. */
export const PITCH_RANGE = 12;

/**
 * Pitch ratio and time stretch for a play. Pitch moves time a little the way
 * a tape does (higher = a bit quicker), which keeps cartoon sounds natural.
 */
export function pitchAndTime(semitones: number | undefined, v: Varied): { ratio: number; stretch: number } {
  const semis = clamp(semitones ?? 0, -PITCH_RANGE, PITCH_RANGE);
  return {
    ratio: 2 ** ((semis * 100 + v.cents) / 1200),
    stretch: v.time * 2 ** (-semis / 24),
  };
}

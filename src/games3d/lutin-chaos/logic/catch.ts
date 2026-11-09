/**
 * The catch: a game of tag the elves love, never a chase that can fail.
 * - Tickling the elf ALWAYS succeeds (`tickle`), with a funny reaction.
 * - Tapping a hiding place that is not the right one gives a funny miss gag
 *   plus a warm/cold hint, and the right place wiggles more. After a couple of
 *   misses (or at once for little ones) the elf peeks out by itself.
 */
import { pickLine, type Line } from './lines';
import type { Rng } from './rand';
import type { Band, ElfId } from './types';

export interface HidingSpot {
  id: string;
  at: [number, number, number];
}

export interface CatchResult {
  caught: true;
  elf: ElfId;
  /** The elf's laugh line + catch animation id. */
  reaction: Line;
  /** Ziggy's high five. */
  ziggy: Line;
}

/** Tickle tap on the elf: always a catch. */
export function tickle(elf: ElfId, rng: Rng): CatchResult {
  return { caught: true, elf, reaction: pickLine(rng, 'caught', elf), ziggy: pickLine(rng, 'high-five') };
}

/** Misses before the elf peeks out on its own. */
export const PEEK_AFTER: Record<Band, number> = { little: 0, middle: 2, big: 2 };

export type SpotTap =
  | { found: true; spot: string }
  | {
      found: false;
      spot: string;
      /** Funny miss (cuckoo, yawning plush cat…). */
      gag: Line;
      /** Closer than the previous tap? (first miss: compared to the room's middle) */
      heat: 'warmer' | 'colder';
      /** The right place wiggles this much (grows with every miss). */
      wiggle: { spot: string; strength: number };
      /** The elf peeks out: the next tap anywhere on it catches it. */
      peek: boolean;
    };

const dist = (a: [number, number, number], b: [number, number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Tap on a hiding place while looking for `elf` hidden at `hideSpot`. */
export function tapSpot(args: {
  tapped: string;
  hideSpot: string;
  spots: readonly HidingSpot[];
  /** Misses so far (before this tap). */
  misses: number;
  previous?: string | null;
  band: Band;
  rng: Rng;
}): SpotTap {
  const { tapped, hideSpot, spots, misses, previous, band, rng } = args;
  if (tapped === hideSpot) return { found: true, spot: tapped };
  const at = (id: string | null | undefined) => spots.find((s) => s.id === id)?.at;
  const goal = at(hideSpot) ?? [0, 0, 0];
  const now = at(tapped) ?? [0, 0, 0];
  const before = at(previous) ?? [0, 0, 0];
  const heat = dist(now, goal) <= dist(before, goal) ? 'warmer' : 'colder';
  const n = misses + 1;
  return { found: false, spot: tapped, gag: pickLine(rng, 'miss'), heat, wiggle: { spot: hideSpot, strength: Math.min(1, 0.35 + 0.25 * n) }, peek: n >= Math.max(1, PEEK_AFTER[band]) };
}

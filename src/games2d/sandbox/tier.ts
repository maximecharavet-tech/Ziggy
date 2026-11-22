/**
 * Adaptive quality of the sandbox picture. The Rust renderer draws at 3×
 * (high: refraction, caustics, wider glow), 2× (low) or 1× (rescue) the grid.
 *
 * The page measures what each frame costs (brush + step + render + blit) and
 * feeds it here. Every `every` frames the median of the last `window` frames
 * is compared to the budget:
 * - above the budget for `downChecks` checks in a row → one tier down;
 * - under `upRatio` × budget for `upChecks` checks in a row → one tier up
 *   (never above the device's starting tier). Hysteresis: the up threshold is
 *   well below the budget, and each time a climb has to be undone the wait
 *   before the next climb doubles, so the tier never flickers.
 * The median (not the mean) ignores a lone slow frame (a GC, a tab switch).
 */
export type Tier = 'rescue' | 'low' | 'high';
export const TIERS: Tier[] = ['rescue', 'low', 'high'];
/** Frame pixels per cell, and the extra effects, of each tier. */
export const TIER_SCALE: Record<Tier, { scale: number; high: boolean }> = { rescue: { scale: 1, high: false }, low: { scale: 2, high: false }, high: { scale: 3, high: true } };

export interface TierOptions {
  /** Frame budget, ms (8 ms: half of a 60 Hz frame, the rest is for the browser). */
  budget?: number;
  /** Frames in the median window. */
  window?: number;
  /** A check every this many frames. */
  every?: number;
  downChecks?: number;
  upChecks?: number;
  upRatio?: number;
  /** Where to start (never above `start`): the tier reached before a rebuild of the world. */
  at?: Tier;
}

export interface TierGovernor {
  readonly tier: Tier;
  /** The last median checked (ms), or 0 before the first check. */
  readonly median: number;
  /** Feeds one frame's cost; returns the new tier when it changes, else null. */
  push(ms: number): Tier | null;
  /** Forgets the measurements (a new world, a new canvas size): the tier stays. */
  reset(): void;
}

export function createTierGovernor(start: Tier, opts: TierOptions = {}): TierGovernor {
  const budget = opts.budget ?? 8;
  const size = opts.window ?? 45;
  const every = opts.every ?? 15;
  const downChecks = opts.downChecks ?? 3;
  const upChecks = opts.upChecks ?? 12;
  const upRatio = opts.upRatio ?? 0.55;
  const max = TIERS.indexOf(start);
  let level = opts.at ? Math.min(max, TIERS.indexOf(opts.at)) : max;
  const ring = new Float64Array(size);
  const sorted = new Float64Array(size);
  let n = 0;
  let head = 0;
  let frames = 0;
  let over = 0;
  let under = 0;
  let median = 0;
  // Each climb that had to be undone doubles the wait before the next one.
  let upNeed = upChecks;
  let climbedAt = -1;

  const clear = () => {
    n = 0;
    head = 0;
    frames = 0;
    over = 0;
    under = 0;
  };

  return {
    get tier() {
      return TIERS[level];
    },
    get median() {
      return median;
    },
    reset: clear,
    push(ms: number) {
      if (!Number.isFinite(ms) || ms < 0) return null;
      ring[head] = ms;
      head = (head + 1) % size;
      n = Math.min(size, n + 1);
      frames++;
      if (n < size || frames % every !== 0) return null;
      sorted.set(ring);
      sorted.sort();
      median = (sorted[(size - 1) >> 1] + sorted[size >> 1]) / 2;
      if (median > budget) {
        over++;
        under = 0;
      } else if (median < budget * upRatio) {
        under++;
        over = 0;
      } else {
        over = 0;
        under = 0;
      }
      if (over >= downChecks && level > 0) {
        // A climb undone soon after it happened: wait twice as long next time.
        if (climbedAt >= 0 && frames - climbedAt < upNeed * every * 2) upNeed = Math.min(upNeed * 2, upChecks * 16);
        climbedAt = -1;
        level--;
        clear();
        return TIERS[level];
      }
      if (under >= upNeed && level < max) {
        level++;
        clear();
        climbedAt = 0; // frames restart at 0: the climb happened now
        return TIERS[level];
      }
      return null;
    },
  };
}

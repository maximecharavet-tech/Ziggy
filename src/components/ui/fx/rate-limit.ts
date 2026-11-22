/**
 * A tiny sliding-window rate limit, with an injected clock so tests can drive it.
 * Used for counter ticks, hover sounds and celebration cooldowns.
 */

export interface RateLimit {
  /** True (and counted) when the action may happen at `now` (ms). */
  take(now: number): boolean;
  reset(): void;
}

export function createRateLimit({ perSecond = Infinity, minGapMs = 0 }: { perSecond?: number; minGapMs?: number }): RateLimit {
  const times: number[] = [];
  return {
    take(now) {
      while (times.length && now - times[0] >= 1000) times.shift();
      const last = times[times.length - 1];
      if (last !== undefined && now - last < minGapMs) return false;
      if (times.length >= perSecond) return false;
      times.push(now);
      return true;
    },
    reset() {
      times.length = 0;
    },
  };
}

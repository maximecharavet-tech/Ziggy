/**
 * Mix hygiene, pure and clock-agnostic: a per-sound rate limit and a polyphony
 * cap with voice stealing. Spam-tapping a button gives a lively patter, never
 * a wall of noise, and celebrations always win a voice over tiny ticks.
 */

/** At most one play of each name per `gapMs`. Only accepted plays count. */
export class RateLimiter {
  private last = new Map<string, number>();

  ready(name: string, nowMs: number, gapMs: number): boolean {
    const prev = this.last.get(name);
    return prev === undefined || nowMs - prev >= gapMs || nowMs < prev;
  }

  mark(name: string, nowMs: number): void {
    this.last.set(name, nowMs);
  }

  /** ready + mark in one go. */
  allow(name: string, nowMs: number, gapMs: number): boolean {
    if (!this.ready(name, nowMs, gapMs)) return false;
    this.mark(name, nowMs);
    return true;
  }

  reset(): void {
    this.last.clear();
  }
}

export type PoolVoice<T> = { name: string; priority: number; start: number; end: number; handle: T };

export type Admission<T> = { ok: true; steal: PoolVoice<T>[] } | { ok: false; steal: [] };

export type AdmitRequest = {
  name: string;
  priority: number;
  /** Current time, same unit as the voices' start/end. */
  now: number;
  maxPerName: number;
  onFull: 'steal' | 'drop';
};

/** A fixed number of voices; finished voices free themselves by time. */
export class VoicePool<T> {
  private voices: PoolVoice<T>[] = [];

  /**
   * @param max most voices at once
   * @param minAge a voice of the same priority younger than this is never cut
   *   (a pile-up at one instant then keeps the first sounds instead of churning
   *   through blips)
   */
  constructor(
    readonly max = 8,
    readonly minAge = 0,
  ) {}

  /** Voices still sounding at `now`. */
  active(now: number): PoolVoice<T>[] {
    this.voices = this.voices.filter((v) => v.end > now);
    return this.voices;
  }

  /**
   * May a new voice start? Returns the voices to cut first (they are removed
   * from the pool; the caller fades them out). Nothing changes on a refusal.
   */
  admit(req: AdmitRequest): Admission<T> {
    const live = this.active(req.now);
    const steal: PoolVoice<T>[] = [];

    const same = live.filter((v) => v.name === req.name);
    if (same.length >= req.maxPerName) {
      if (req.onFull === 'drop') return { ok: false, steal: [] };
      steal.push(...[...same].sort((a, b) => a.start - b.start).slice(0, same.length - req.maxPerName + 1));
    }

    if (live.length - steal.length >= this.max) {
      const victim = live
        .filter((v) => !steal.includes(v) && (v.priority < req.priority || (v.priority === req.priority && req.now - v.start >= this.minAge)))
        .sort((a, b) => a.priority - b.priority || a.start - b.start)[0];
      if (!victim) return { ok: false, steal: [] };
      steal.push(victim);
    }

    this.voices = live.filter((v) => !steal.includes(v));
    return { ok: true, steal };
  }

  add(voice: PoolVoice<T>): void {
    this.voices.push(voice);
  }

  /** Empty the pool, returning what was playing (to fade it out). */
  clear(): PoolVoice<T>[] {
    const all = this.voices;
    this.voices = [];
    return all;
  }
}

import { describe, expect, it } from 'vitest';
import { SOUND_NAMES, SOUNDS } from './catalog';
import { RateLimiter, VoicePool, type AdmitRequest } from './limits';
import { mulberry32 } from './math';

describe('rate limiter', () => {
  it('lets one play through per gap', () => {
    const r = new RateLimiter();
    expect(r.allow('hover', 0, 60)).toBe(true);
    expect(r.allow('hover', 59, 60)).toBe(false);
    expect(r.allow('hover', 60, 60)).toBe(true);
  });

  it('counts only accepted plays, so steady spam still gets through regularly', () => {
    const r = new RateLimiter();
    let played = 0;
    for (let t = 0; t < 1000; t += 10) if (r.allow('hover', t, 60)) played++;
    expect(played).toBe(17); // 0, 60, 120 … 960
  });

  it('keeps names apart and recovers from a clock that went back', () => {
    const r = new RateLimiter();
    expect(r.allow('tap', 100, 35)).toBe(true);
    expect(r.allow('pop', 100, 50)).toBe(true);
    expect(r.allow('tap', 50, 35)).toBe(true); // new context: time restarted
    r.reset();
    expect(r.ready('tap', 51, 35)).toBe(true);
  });
});

const req = (name: string, now: number, over: Partial<AdmitRequest> = {}): AdmitRequest => ({ name, priority: 2, now, maxPerName: 2, onFull: 'steal', ...over });

describe('voice pool', () => {
  it('caps the number of voices', () => {
    const pool = new VoicePool<string>(3);
    for (let i = 0; i < 3; i++) {
      expect(pool.admit(req(`s${i}`, 0)).ok).toBe(true);
      pool.add({ name: `s${i}`, priority: 2, start: 0, end: 1, handle: `s${i}` });
    }
    expect(pool.admit(req('late', 0.5, { priority: 1 })).ok).toBe(false);
    expect(pool.active(0.5)).toHaveLength(3);
  });

  it('lets a celebration steal the oldest, least important voice', () => {
    const pool = new VoicePool<string>(2);
    pool.add({ name: 'tap', priority: 1, start: 0, end: 1, handle: 'tap' });
    pool.add({ name: 'boing', priority: 2, start: 0.1, end: 1, handle: 'boing' });
    const a = pool.admit(req('win', 0.2, { priority: 3 }));
    expect(a.ok).toBe(true);
    expect(a.steal.map((v) => v.handle)).toEqual(['tap']);
    expect(pool.active(0.2).map((v) => v.handle)).toEqual(['boing']);
  });

  it('retriggers a sound by cutting its oldest copy, or drops the new one', () => {
    const pool = new VoicePool<number>(8);
    pool.add({ name: 'tap', priority: 1, start: 0, end: 1, handle: 1 });
    pool.add({ name: 'tap', priority: 1, start: 0.1, end: 1, handle: 2 });
    const steal = pool.admit(req('tap', 0.2, { priority: 1, maxPerName: 2, onFull: 'steal' }));
    expect(steal.ok && steal.steal.map((v) => v.handle)).toEqual([1]);
    pool.add({ name: 'drumroll', priority: 2, start: 0.2, end: 1, handle: 3 });
    expect(pool.admit(req('drumroll', 0.3, { maxPerName: 1, onFull: 'drop' })).ok).toBe(false);
  });

  it('frees voices once they have ended', () => {
    const pool = new VoicePool<number>(1);
    pool.add({ name: 'pop', priority: 2, start: 0, end: 0.3, handle: 1 });
    expect(pool.admit(req('star', 0.2, { priority: 1 })).ok).toBe(false);
    expect(pool.admit(req('star', 0.31, { priority: 1 })).ok).toBe(true);
  });

  it('does not churn through voices that only just started', () => {
    const pool = new VoicePool<number>(1, 0.08);
    pool.add({ name: 'pop', priority: 2, start: 0, end: 1, handle: 1 });
    expect(pool.admit(req('boing', 0.05)).ok).toBe(false);
    expect(pool.admit(req('boing', 0.09)).ok).toBe(true);
  });

  it('a refusal changes nothing; clear hands back everything', () => {
    const pool = new VoicePool<number>(1);
    pool.add({ name: 'win', priority: 3, start: 0, end: 1, handle: 1 });
    pool.admit(req('tap', 0.1, { priority: 1 }));
    expect(pool.clear().map((v) => v.handle)).toEqual([1]);
    expect(pool.active(0.1)).toHaveLength(0);
  });

  it('never exceeds the cap under random spam with the real catalog', () => {
    const rng = mulberry32(2024);
    const pool = new VoicePool<number>(8, 0.08);
    const limiter = new RateLimiter();
    let t = 0;
    let played = 0;
    for (let i = 0; i < 5000; i++) {
      t += rng() * 0.02;
      const name = SOUND_NAMES[Math.floor(rng() * SOUND_NAMES.length)];
      const m = SOUNDS[name];
      if (!limiter.ready(name, t * 1000, m.minGapMs)) continue;
      const a = pool.admit({ name, priority: m.priority, now: t, maxPerName: m.maxPerName, onFull: m.onFull });
      if (!a.ok) continue;
      limiter.mark(name, t * 1000);
      pool.add({ name, priority: m.priority, start: t, end: t + 0.2 + rng() * 1.5, handle: i });
      played++;
      const live = pool.active(t);
      expect(live.length).toBeLessThanOrEqual(8);
      for (const n of new Set(live.map((v) => v.name))) expect(live.filter((v) => v.name === n).length).toBeLessThanOrEqual(SOUNDS[n as typeof name].maxPerName);
    }
    expect(played).toBeGreaterThan(100);
  });
});

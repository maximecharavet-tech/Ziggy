import { describe, expect, it } from 'vitest';
import { SOUND_NAMES, SOUNDS } from './catalog';
import { mulberry32 } from './math';
import { NO_VARIATION, PITCH_RANGE, pitchAndTime, vary } from './variation';

describe('per-play variation', () => {
  it('does nothing when turned off', () => {
    expect(vary(SOUNDS.tap.vary, Math.random, false)).toEqual(NO_VARIATION);
  });

  it('stays within each sound’s bounds', () => {
    const rng = mulberry32(42);
    for (const n of SOUND_NAMES) {
      const spec = SOUNDS[n].vary;
      let last: number | undefined;
      for (let i = 0; i < 400; i++) {
        const v = vary(spec, rng, true, last);
        expect(Math.abs(v.cents), n).toBeLessThanOrEqual(spec.cents);
        expect(Math.abs(v.time - 1), n).toBeLessThanOrEqual(spec.time + 1e-12);
        expect(Math.abs(v.db), n).toBeLessThanOrEqual(spec.db);
        last = v.cents;
      }
    }
  });

  it('never plays the same pitch twice in a row', () => {
    const rng = mulberry32(7);
    const spec = SOUNDS.tap.vary;
    let last = vary(spec, rng).cents;
    for (let i = 0; i < 5000; i++) {
      const next = vary(spec, rng, true, last).cents;
      expect(Math.abs(next - last)).toBeGreaterThanOrEqual(spec.cents * 0.3 - 1e-9);
      last = next;
    }
  });

  it('actually varies (spread over most of the range)', () => {
    const rng = mulberry32(3);
    const cents = Array.from({ length: 500 }, () => vary(SOUNDS.bubble.vary, rng).cents);
    expect(Math.max(...cents) - Math.min(...cents)).toBeGreaterThan(SOUNDS.bubble.vary.cents * 1.5);
  });

  it('is reproducible with a seeded source', () => {
    const a = mulberry32(99), b = mulberry32(99);
    for (let i = 0; i < 20; i++) expect(vary(SOUNDS.boing.vary, a)).toEqual(vary(SOUNDS.boing.vary, b));
  });
});

describe('pitch option', () => {
  it('is neutral by default', () => {
    expect(pitchAndTime(undefined, NO_VARIATION)).toEqual({ ratio: 1, stretch: 1 });
  });

  it('transposes by semitones and quickens a little when higher, like a tape', () => {
    const up = pitchAndTime(12, NO_VARIATION);
    expect(up.ratio).toBeCloseTo(2, 10);
    expect(up.stretch).toBeCloseTo(Math.SQRT1_2, 10);
    const down = pitchAndTime(-7, NO_VARIATION);
    expect(down.ratio).toBeCloseTo(2 ** (-7 / 12), 10);
    expect(down.stretch).toBeGreaterThan(1);
  });

  it('clamps to an octave either way, and survives nonsense', () => {
    expect(pitchAndTime(48, NO_VARIATION).ratio).toBeCloseTo(2 ** (PITCH_RANGE / 12), 10);
    expect(pitchAndTime(-48, NO_VARIATION).ratio).toBeCloseTo(2 ** (-PITCH_RANGE / 12), 10);
    expect(Number.isFinite(pitchAndTime(Number.NaN, NO_VARIATION).ratio)).toBe(true);
  });

  it('adds the per-play detune on top', () => {
    expect(pitchAndTime(0, { cents: 100, time: 1, db: 0 }).ratio).toBeCloseTo(2 ** (1 / 12), 10);
  });
});

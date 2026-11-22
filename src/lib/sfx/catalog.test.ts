import { describe, expect, it } from 'vitest';
import { SOUND_NAMES, SOUNDS, isSoundName } from './catalog';
import { GROUP_LABELS, SOUND_LABELS } from './labels';
import { GAINS, MAX_PEAK_DB, MEASURED } from './gains';
import { RECIPES } from './recipes';

const ORIGINAL = ['tap', 'correct', 'wrong', 'star', 'win', 'reward', 'pop'];
/** The names the visual-effects layer calls: all must exist. */
const FUNNY = ['boing', 'squeak', 'whoosh', 'sparkle', 'bubble', 'giggle', 'slideUp', 'slideDown', 'drumroll', 'tada', 'honk', 'plop', 'magic', 'hover', 'unlock', 'bonk', 'pageIn', 'confetti', 'snore', 'yay'];

describe('sound catalog', () => {
  it('keeps the seven original names and adds the twenty funny ones, no duplicates', () => {
    expect(new Set(SOUND_NAMES).size).toBe(SOUND_NAMES.length);
    expect([...SOUND_NAMES].sort()).toEqual([...ORIGINAL, ...FUNNY].sort());
  });

  it('has metadata, labels, a recipe, a gain and a measurement for every sound, nothing extra', () => {
    for (const table of [SOUNDS, SOUND_LABELS, RECIPES, GAINS, MEASURED]) expect(Object.keys(table).sort()).toEqual([...SOUND_NAMES].sort());
    for (const n of SOUND_NAMES) expect(typeof RECIPES[n]).toBe('function');
  });

  it('labels every sound and group in French and English, with an emoji', () => {
    for (const n of SOUND_NAMES) {
      const m = SOUND_LABELS[n];
      for (const text of [m.label.fr, m.label.en, m.about.fr, m.about.en, m.emoji]) expect(text.trim().length, n).toBeGreaterThan(0);
    }
    for (const g of Object.values(GROUP_LABELS)) expect(g.fr && g.en).toBeTruthy();
    for (const n of SOUND_NAMES) expect(Object.keys(GROUP_LABELS)).toContain(SOUND_LABELS[n].group);
  });

  it('keeps every parameter in a sane range', () => {
    for (const n of SOUND_NAMES) {
      const m = SOUNDS[n];
      expect(m.priority, n).toBeGreaterThanOrEqual(1);
      expect(m.priority, n).toBeLessThanOrEqual(3);
      expect(m.minGapMs, n).toBeGreaterThanOrEqual(30);
      expect(m.maxPerName, n).toBeGreaterThanOrEqual(1);
      expect(m.maxPerName, n).toBeLessThanOrEqual(3);
      expect(m.room, n).toBeGreaterThanOrEqual(0);
      expect(m.room, n).toBeLessThanOrEqual(0.4);
      expect(m.vary.cents, n).toBeLessThanOrEqual(200);
      expect(m.vary.time, n).toBeLessThanOrEqual(0.15);
      expect(m.vary.db, n).toBeLessThanOrEqual(1);
    }
  });

  it('rate-limits the hover tick to at most one every 60 ms and keeps long sounds single', () => {
    expect(SOUNDS.hover.minGapMs).toBeGreaterThanOrEqual(60);
    expect(SOUNDS.hover.maxPerName).toBe(1);
    for (const n of ['drumroll', 'snore', 'win', 'reward', 'tada', 'giggle'] as const) {
      expect(SOUNDS[n].maxPerName, n).toBe(1);
      expect(SOUNDS[n].onFull, n).toBe('drop');
    }
  });

  it('orders loudness gently: tiny ticks quietest, celebrations loudest, "wrong" and "bonk" never louder than "correct"', () => {
    const t = (n: keyof typeof SOUNDS) => SOUNDS[n].target;
    expect(t('hover')).toBeLessThan(t('tap'));
    expect(t('tap')).toBeLessThan(t('correct'));
    expect(t('correct')).toBeLessThan(t('win'));
    expect(t('win')).toBeLessThanOrEqual(t('reward'));
    expect(t('wrong')).toBeLessThan(t('correct'));
    expect(t('bonk')).toBeLessThan(t('correct'));
    expect(t('snore')).toBeLessThanOrEqual(t('tap'));
  });

  it('recognises its own names only', () => {
    expect(isSoundName('boing')).toBe(true);
    expect(isSoundName('toString')).toBe(false);
    expect(isSoundName('land')).toBe(false);
    expect(isSoundName(undefined)).toBe(false);
  });
});

describe('gain table (measured offline)', () => {
  it('is finite and modest', () => {
    for (const n of SOUND_NAMES) {
      expect(Number.isFinite(GAINS[n]), n).toBe(true);
      expect(GAINS[n], n).toBeGreaterThan(0.05);
      expect(GAINS[n], n).toBeLessThan(2);
    }
  });

  it('puts every sound within 1 dB of its loudness target with its peak under the pre-bus limit', () => {
    for (const n of SOUND_NAMES) {
      expect(Math.abs(MEASURED[n].loudness - SOUNDS[n].target), `${n}: re-measure gains.ts after changing the recipe or target`).toBeLessThanOrEqual(1);
      expect(MEASURED[n].peak, n).toBeLessThanOrEqual(MAX_PEAK_DB);
    }
  });
});

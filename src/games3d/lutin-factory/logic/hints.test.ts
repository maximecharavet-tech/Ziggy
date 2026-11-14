import { describe, expect, it } from 'vitest';
import { applyHint, dialText, followHints, suggestNextStep } from './hints';
import { LEVELS, referenceLayout, runAndCheck, startLayout } from './levels';
import { BANDS } from './types';

describe('hints', () => {
  it('says "all set" on a solved layout', () => {
    const b = LEVELS[1].bands.middle;
    expect(suggestNextStep(b, referenceLayout(b)).kind).toBe('done');
  });

  it('little ones get the glowing slot first', () => {
    const b = LEVELS[0].bands.little;
    const h = suggestNextStep(b, startLayout(b));
    expect(h.kind).toBe('slot');
    expect(h.at).toEqual([2, 1]);
  });

  it('a path that stops: suggests the next belt / machine on that tile', () => {
    const b = LEVELS[0].bands.middle;
    const h = suggestNextStep(b, startLayout(b));
    expect(['stuck', 'place']).toContain(h.kind);
    expect(h.at).toEqual([1, 1]);
  });

  it('a wrong dial: points at the machine and the value', () => {
    const b = LEVELS[1].bands.middle; // red balls
    const layout = referenceLayout(b);
    const painted = { ...layout, pieces: layout.pieces.map((p) => (p.machine === 'painter' ? { ...p, dial: { color: 'blue' } } : p)) };
    const h = suggestNextStep(b, painted);
    expect(h.kind).toBe('dial');
    expect(h.focus).toBe('color');
    expect(h.text.fr).toBe('La machine à peindre en D2 : essaie rouge.');
    expect(h.text.en).toBe('The painter on D2: try red.');
  });

  it('a machine facing the wrong way: turn it', () => {
    const b = LEVELS[1].bands.middle;
    const layout = referenceLayout(b);
    const turned = { ...layout, pieces: layout.pieces.map((p) => (p.at[0] === 4 && p.at[1] === 1 ? { ...p, dir: 'S' as const } : p)) };
    const h = suggestNextStep(b, turned);
    expect(h.kind).toBe('turn');
    expect(h.dir).toBe('E');
  });

  it('an assembler waiting for parts says which ones, and where they come from', () => {
    const b = LEVELS[6].bands.big; // 3 trains × 4 wagons
    const layout = referenceLayout(b);
    const fewer = { ...layout, pieces: layout.pieces.map((p) => (p.machine === 'chute' && p.at[1] === 2 ? { ...p, dial: { material: 'wood', count: 10 } } : p)) };
    const h = suggestNextStep(b, fewer);
    expect(h.kind).toBe('dial');
    expect(h.at).toEqual([0, 2]);
    expect(h.text.en).toBe('The assembler on C2 is still waiting for 2 cubes. The chute on A3: try 12 (wood).');
  });

  it('from every starting layout, following the hints always reaches the letter (no dead end)', () => {
    for (const lv of LEVELS)
      for (const band of BANDS) {
        const b = lv.bands[band];
        const run = followHints(b, startLayout(b));
        expect(run.done, `${lv.id}/${band}: ${run.steps.map((s) => s.kind).join(' → ')}`).toBe(true);
        expect(runAndCheck(b, run.layout).result.complete).toBe(true);
      }
  });

  it('every hint text is filled in FR and EN', () => {
    for (const lv of LEVELS)
      for (const band of BANDS) {
        const b = lv.bands[band];
        for (const h of followHints(b, startLayout(b)).steps) {
          expect(h.text.fr).not.toMatch(/\{\w+\}/);
          expect(h.text.en).not.toMatch(/\{\w+\}/);
        }
      }
  });

  it('applyHint does nothing for a hint without a tile', () => {
    const b = LEVELS[0].bands.middle;
    expect(applyHint(b, startLayout(b), { kind: 'run', text: { fr: 'x', en: 'x' } })).toBeNull();
  });

  it('describes dials in words', () => {
    expect(dialText('painter', { colors: ['red', 'blue'] })).toEqual({ fr: 'rouge, bleu', en: 'red, blue' });
    expect(dialText('assembler', { toy: 'train', n: 3 })).toEqual({ fr: 'train à 3 wagons', en: 'train with 3 wagons' });
    expect(dialText('counter', { n: 3, mode: 'every' }).en).toBe('every 3rd one to the right');
    expect(dialText('loop', { times: 5 }).fr).toBe('×5');
  });
});

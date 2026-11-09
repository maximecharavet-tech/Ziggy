import { describe, expect, it } from 'vitest';
import { assets } from '@/lib/assets/registry';
import { BANDS } from './types';
import {
  BANNED_KEY,
  LEVELS,
  applyPlacements,
  machinesUsed,
  referenceLayout,
  runAndCheck,
  startLayout,
  validateLevel,
  validateLevelSet,
  type FactoryLevel,
} from './levels';
import { getMachine } from './machines/registry';

const fmt = (issues: { level: string; band?: string; message: string }[]) =>
  issues.map((i) => `${i.level}${i.band ? `/${i.band}` : ''}: ${i.message}`).join('\n');

describe('levels', () => {
  it('ships 15 levels numbered 1..15', () => {
    expect(LEVELS.map((l) => l.number)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it.each(LEVELS.map((l) => [l.id, l] as const))('%s passes the validator (schema, caps, reference solves it)', (_id, lv) => {
    const issues = validateLevel(lv, { assetExists: (id) => assets.has(id) });
    expect(fmt(issues)).toBe('');
  });

  it('the set: difficulty never goes down inside a band, machines introduced before use', () => {
    expect(fmt(validateLevelSet(LEVELS))).toBe('');
  });

  describe.each(LEVELS.map((l) => [l.id, l] as const))('%s', (_id, lv) => {
    it.each(BANDS.map((b) => [b]))('%s: the reference solution fulfils the letter, the start does not', (band) => {
      const b = lv.bands[band];
      const ref = runAndCheck(b, referenceLayout(b));
      expect(ref.result.complete, ref.result.reason.en).toBe(true);
      expect(ref.result.status).toBe('done');
      expect(ref.sim.finished).toBe(true);
      expect(runAndCheck(b, startLayout(b)).result.complete).toBe(false);
    });
  });

  it('no level contains a timer, lives, score or fail field (child safety by construction)', () => {
    const keys = (v: unknown, out: string[] = []): string[] => {
      if (Array.isArray(v)) v.forEach((x) => keys(x, out));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) (out.push(k), keys(x, out));
      return out;
    };
    for (const lv of LEVELS) for (const k of keys(lv)) expect(BANNED_KEY.test(k), `${lv.id}: ${k}`).toBe(false);
  });

  it('rejects a level that sneaks in a timer, lives or a fail field', () => {
    const lv = JSON.parse(JSON.stringify(LEVELS[0])) as FactoryLevel & Record<string, unknown>;
    lv.timeLimit = 30;
    (lv.bands.little as unknown as Record<string, unknown>).lives = 3;
    (lv.bands.middle as unknown as Record<string, unknown>).failScreen = true;
    const msgs = validateLevel(lv).map((i) => i.message).join('\n');
    expect(msgs).toMatch(/timeLimit/);
    expect(msgs).toMatch(/lives/);
    expect(msgs).toMatch(/failScreen/);
  });

  it('rejects a broken reference, a locked dial change and an out-of-cap count', () => {
    const lv = JSON.parse(JSON.stringify(LEVELS[1])) as FactoryLevel;
    lv.bands.middle.reference = lv.bands.middle.reference.filter((p) => p.machine !== 'painter');
    lv.bands.middle.reference.push({ machine: 'belt', at: [3, 1], dir: 'E' });
    lv.bands.little.orders[0].count = 9;
    lv.bands.big.reference.push({ machine: 'chute', at: [0, 1], dir: 'E', dial: { count: 5 } });
    const msgs = fmt(validateLevel(lv));
    expect(msgs).toMatch(/middle: reference does not fulfil/);
    expect(msgs).toMatch(/little: orders\[0\]: count must be 1–5/);
    expect(msgs).toMatch(/big: reference\[\d+\]: changes a locked dial/);
  });

  it('every machine in a tray is offered only from its band on', () => {
    const rank = { little: 0, middle: 1, big: 2 } as const;
    for (const lv of LEVELS)
      for (const band of BANDS)
        for (const m of lv.bands[band].tray) expect(rank[getMachine(m)!.minBand] <= rank[band], `${lv.id}/${band}: ${m}`).toBe(true);
  });

  it('every band teaches with at least one machine to use or one dial to set', () => {
    for (const lv of LEVELS) for (const band of BANDS) expect(machinesUsed(lv.bands[band]).size, `${lv.id}/${band}`).toBeGreaterThan(0);
  });

  it('applyPlacements never mutates the level', () => {
    const lv = LEVELS[2];
    const before = JSON.stringify(lv);
    applyPlacements(lv.bands.little, lv.bands.little.reference);
    expect(JSON.stringify(lv)).toBe(before);
  });
});

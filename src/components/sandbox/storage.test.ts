import { describe, expect, it } from 'vitest';
import v1 from './__fixtures__/save-v1.json';
import { earnsRound, emptySave, parseSave } from './storage';
import { discoveryById } from '@/games2d/sandbox/content';

describe('sandbox notebook save', () => {
  it('reads a version 1 notebook without losing anything', () => {
    const s = parseSave(v1);
    expect(s.v).toBe(2);
    expect(s.discoveries).toEqual({ sprout: 1731400000000, bloom: 1731400100000, rain: 1731400200000 });
    expect(s.challenges).toEqual({ flowers: 1731400300000, cloud: 1731400400000 });
    expect(s.totals).toEqual({ bloom: 7, rain: 42, sprout: 3 });
    expect(s.world).toBe('garden');
    // Version 1 already paid one World Memory round per discovery.
    expect(s.rounds).toBe(3);
  });

  it('survives damaged data', () => {
    for (const bad of [null, 1, 'x', [], { discoveries: 'no', world: 'nowhere', saucer: [1, 'moon', 'moon'] }]) {
      const s = parseSave(bad);
      expect(s.v).toBe(2);
      expect(s.world).toBe('garden');
    }
    expect(parseSave({ saucer: [1, 'moon', 'moon'] }).saucer).toEqual(['moon']);
  });

  it('round-trips a version 2 notebook', () => {
    const s = { ...emptySave(), world: 'mars' as const, saucer: ['mars' as const], discoveries: { sublimate: 9 }, rounds: 1 };
    expect(parseSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('awards a World Memory round for the first discovery of each world, then every 5th', () => {
    const worldOf = (r: Parameters<typeof discoveryById>[0]) => discoveryById(r)?.world ?? 'garden';
    let s = emptySave();
    const order = ['sprout', 'bloom', 'mud', 'tint', 'rain', 'melt_ice', 'reed'] as const;
    const got: boolean[] = [];
    for (const id of order) {
      got.push(earnsRound(s, id, worldOf(id), worldOf));
      s = { ...s, discoveries: { ...s.discoveries, [id]: 1 } };
    }
    // garden first ✓, then 5th (rain) ✓, mountain first (melt_ice) ✓.
    expect(got).toEqual([true, false, false, false, true, true, false]);
  });
});

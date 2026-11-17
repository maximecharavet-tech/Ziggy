import { beforeAll, describe, expect, it } from 'vitest';
import { PRANKS, PRANK_CATEGORIES, prankById } from '@/data/lutins/pranks';
import { loadEngine, type LutinsEngine } from './engine';
import { checkIdeaFallback, fnv32, planTonight, tonightSeed } from './tonight';
import type { PlanRequest } from './types';

let engine: LutinsEngine;
beforeAll(async () => {
  engine = await loadEngine();
});

describe('prank of the night: Rust engine and TypeScript fallback agree', () => {
  const cases: PlanRequest[] = [
    { seed: 0 },
    { seed: 7 },
    { seed: 4_294_967_295 },
    { seed: 2026, count: 31 },
    { seed: 12, place: 'cuisine', recent: ['pancakes', 'biscuits'] },
    { seed: 99, recent: ['livres', 'nope', 'bulles'], no_repeat: 5, count: 8 },
    { seed: 5, place: 'sapin', recent: PRANKS.filter((p) => p.cat === 'sapin').map((p) => p.id), count: 3 },
    { seed: 31, no_repeat: 0, count: 12 },
  ];
  it.each(cases.map((c, i) => [i, c] as const))('case %i', (_i, req) => {
    expect(planTonight(req)).toEqual(engine.planPranks(req));
  });

  it('is deterministic, varies the places and never repeats within the window', () => {
    const seed = tonightSeed(new Date(2026, 11, 1));
    const plan = engine.planPranks({ seed, count: 24 });
    expect(plan.ids).toHaveLength(24);
    expect(new Set(plan.ids).size).toBe(24);
    for (let i = 1; i < plan.ids.length; i++) expect(prankById(plan.ids[i])!.cat).not.toBe(prankById(plan.ids[i - 1])!.cat);
    expect(engine.planPranks({ seed, count: 24 })).toEqual(plan);
  });

  it('keeps the evening seed stable and the place filter honest', () => {
    expect(tonightSeed(new Date(2026, 11, 24))).toBe(tonightSeed(new Date(2026, 11, 24, 22, 30)));
    expect(tonightSeed(new Date(2026, 11, 24))).not.toBe(tonightSeed(new Date(2026, 11, 24), 1));
    expect(fnv32('')).toBe(0x811c9dc5);
    for (const c of PRANK_CATEGORIES) {
      const { ids } = engine.planPranks({ seed: 3, place: c.id });
      expect(prankById(ids[0])!.cat).toBe(c.id);
    }
    expect(() => engine.planPranks({ seed: 1, place: 'lune' })).toThrow();
    expect(() => planTonight({ seed: 1, place: 'lune' })).toThrow();
  });

  it('knows the ids of the catalogue', () => {
    for (const p of PRANKS) expect(engine.isPrankId(p.id)).toBe(true);
    expect(engine.isPrankId('nope')).toBe(false);
  });
});

describe('a parent’s own idea', () => {
  const ideas = [
    'ils font une course de chaussettes',
    'they build a pillow castle',
    'ab',
    "ils font du ski sur la rampe d'escalier",
    'they play with a KNIFE',
    'x https://fire.example/knife y <b>ski</b>',
    'four elves bake cookies',
    'a'.repeat(400),
    'ils allument le FEU !',
  ];
  it.each(ideas)('Rust and TypeScript agree on %s', (idea) => {
    expect(engine.checkIdea(idea)).toEqual(checkIdeaFallback(idea));
  });
  it('refuses what a child could copy to get hurt', () => {
    expect(engine.checkIdea("ils font du ski sur la rampe d'escalier").ok).toBe(false);
    expect(engine.checkIdea('ils font une course de chaussettes').ok).toBe(true);
    expect(engine.checkIdea('ab').reasons).toEqual(['too_short']);
  });
});

import { describe, expect, it } from 'vitest';
import {
  CASES_PER_GAME,
  CLUE_SPOTS,
  MYSTERIES,
  MYSTERY_INFO,
  SPECIES,
  SPECIES_INFO,
  accusePrompt,
  checkAccuse,
  checkClear,
  clearPrompt,
  clueCount,
  clueText,
  describe as describeSuspect,
  isLastClue,
  matches,
  planCase,
  planGame,
  remainingAt,
  suspectCount,
  toClear,
  whyMatch,
  whyNot,
  type Band,
  type Case,
} from './logic';

const BANDS: Band[] = ['little', 'middle', 'big'];
const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 13);

function allCases(): Case[] {
  const out: Case[] = [];
  for (const band of BANDS)
    for (let level = 1; level <= 5; level++)
      for (const seed of SEEDS.slice(0, 25)) {
        const mystery = MYSTERIES[seed % MYSTERIES.length];
        out.push(planCase(seed, band, level, seed % 3, mystery));
      }
  return out;
}
const CASES = allCases();

describe('detective — every mystery has exactly one solution', () => {
  it('the culprit matches every clue, and nobody else does', () => {
    for (const c of CASES) {
      const culprit = c.suspects.find((s) => s.id === c.culprit)!;
      expect(culprit).toBeTruthy();
      for (const clue of c.clues) expect(matches(culprit, clue)).toBe(true);
      const all = c.suspects.filter((s) => c.clues.every((cl) => matches(s, cl)));
      expect(all.map((s) => s.id)).toEqual([c.culprit]);
    }
  });

  it('every clue clears at least one friend, and the last one is a real choice', () => {
    for (const c of CASES) {
      for (let step = 0; step < c.clues.length; step++) {
        const before = remainingAt(c, step).length;
        const after = remainingAt(c, step + 1).length;
        expect(after).toBeLessThan(before);
        if (isLastClue(c, step)) {
          expect(before).toBeGreaterThanOrEqual(2);
          expect(after).toBe(1);
        } else {
          expect(after).toBeGreaterThanOrEqual(2);
          expect(toClear(c, step).length).toBe(before - after);
        }
      }
    }
  });

  it('suspects are all different friends in different places, clues in different spots', () => {
    for (const c of CASES) {
      expect(new Set(c.suspects.map((s) => s.id)).size).toBe(c.suspects.length);
      expect(new Set(c.suspects.map((s) => `${s.col}-${s.row}`)).size).toBe(c.suspects.length);
      const spots = c.clues.map((cl) => cl.spot);
      expect(new Set(spots).size).toBe(spots.length);
      for (const s of spots) expect(s >= 0 && s < CLUE_SPOTS).toBe(true);
      // Never a hat or scarf the same colour as the fur.
      for (const s of c.suspects) {
        const avoid = SPECIES_INFO[s.id].avoid;
        if (avoid) {
          expect(s.hat).not.toBe(avoid);
          expect(s.scarf).not.toBe(avoid);
        }
      }
    }
  });
});

describe('detective — difficulty follows the age', () => {
  it('more suspects and more clues for older children', () => {
    for (let level = 1; level <= 5; level++) {
      expect(suspectCount('little', level)).toBeLessThanOrEqual(suspectCount('middle', level));
      expect(suspectCount('middle', level)).toBeLessThanOrEqual(suspectCount('big', level));
      expect(clueCount('little', level)).toBeLessThanOrEqual(clueCount('big', level));
    }
    for (const c of CASES) {
      expect(c.suspects.length).toBe(suspectCount(c.band, c.level));
      expect(c.clues.length).toBe(clueCount(c.band, c.level));
    }
  });

  it('little ones: one simple thing at a time (colours, glasses, big or small), no "not", no places', () => {
    for (const c of CASES.filter((x) => x.band === 'little')) {
      for (const clue of c.clues) {
        expect(clue.lits.length).toBe(1);
        expect(clue.lits[0].not).toBe(false);
        expect(['hat', 'scarf', 'glasses', 'size']).toContain(clue.lits[0].trait.k);
      }
      // They clear at most two friends per clue.
      for (let step = 0; step < c.clues.length - 1; step++) expect(toClear(c, step).length).toBeLessThanOrEqual(2);
    }
  });

  it('6-8: places around the fountain, two things at once from level 2, never "not"', () => {
    for (const c of CASES.filter((x) => x.band === 'middle')) {
      const lits = c.clues.flatMap((cl) => cl.lits);
      expect(lits.some((l) => l.trait.k === 'side' || l.trait.k === 'row')).toBe(true);
      expect(lits.every((l) => !l.not)).toBe(true);
      if (c.level >= 2) expect(c.clues.some((cl) => cl.lits.length === 2)).toBe(true);
    }
  });

  it('8-12: negations and combinations, several steps', () => {
    for (const c of CASES.filter((x) => x.band === 'big')) {
      expect(c.clues.length).toBeGreaterThanOrEqual(3);
      expect(c.clues.some((cl) => cl.lits.some((l) => l.not))).toBe(true);
      expect(c.clues.some((cl) => cl.lits.length === 2)).toBe(true);
      expect(c.suspects.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('a combination really needs both of its halves', () => {
    for (const c of CASES)
      c.clues.forEach((clue, step) => {
        if (clue.lits.length < 2) return;
        const cand = remainingAt(c, step);
        const both = cand.filter((s) => matches(s, clue)).length;
        for (const l of clue.lits) expect(cand.filter((s) => matches(s, { lits: [l], spot: 0 })).length).toBeGreaterThan(both);
      });
  });
});

describe('detective — the child’s taps', () => {
  it('clearing: right friends are cleared, matching friends stay, cleared ones are done', () => {
    for (const c of CASES.slice(0, 120)) {
      for (let step = 0; step < c.clues.length - 1; step++) {
        const clear = new Set(toClear(c, step));
        for (const s of remainingAt(c, step)) expect(checkClear(c, step, s.id)).toBe(clear.has(s.id) ? 'cleared' : 'matches');
        for (const s of c.suspects.filter((x) => !remainingAt(c, step).includes(x))) expect(checkClear(c, step, s.id)).toBe('already');
      }
    }
  });

  it('accusing: only the culprit', () => {
    for (const c of CASES.slice(0, 80)) for (const s of c.suspects) expect(checkAccuse(c, s.id)).toBe(s.id === c.culprit);
  });
});

describe('detective — a whole game', () => {
  it('three different mysteries and three different culprits, same seed same game', () => {
    for (const band of BANDS)
      for (const seed of SEEDS) {
        const g = planGame(seed, band, [1, 2, 3]);
        expect(g.length).toBe(CASES_PER_GAME);
        expect(new Set(g.map((c) => c.mystery)).size).toBe(CASES_PER_GAME);
        expect(new Set(g.map((c) => c.culprit)).size).toBe(CASES_PER_GAME);
        expect(planGame(seed, band, [1, 2, 3])).toEqual(g);
      }
    const a = JSON.stringify(planGame(1, 'middle', 2));
    const b = JSON.stringify(planGame(2, 'middle', 2));
    expect(a).not.toBe(b);
  });

  it('skills are logic, reading or vocabulary', () => {
    for (const c of CASES) expect(['logic', 'reading', 'vocabulary']).toContain(c.skill);
  });

  it('levels are clamped', () => {
    expect(planCase(3, 'big', 99, 0, 'cake').level).toBe(5);
    expect(planCase(3, 'little', -4, 0, 'cake').level).toBe(1);
  });
});

describe('detective — words in French and English', () => {
  const ok = (s: string) => {
    expect(s.trim().length).toBeGreaterThan(2);
    expect(s).not.toMatch(/undefined|null|NaN|\[object/);
  };

  it('every clue, prompt and explanation reads well in both languages', () => {
    for (const c of CASES) {
      for (const clue of c.clues) {
        const f = clueText(clue, 'fr');
        const e = clueText(clue, 'en');
        ok(f);
        ok(e);
        expect(f.startsWith('Le coupable ')).toBe(true);
        expect(e.startsWith('The culprit ')).toBe(true);
        expect(f.endsWith('.')).toBe(true);
        if (clue.lits.length === 2) {
          expect(f).toContain(' et ');
          expect(e).toContain(' and ');
        }
        ok(clearPrompt(clue, 'fr'));
        ok(clearPrompt(clue, 'en'));
        for (const s of c.suspects) {
          if (matches(s, clue)) {
            ok(whyMatch(s, clue, 'fr'));
            ok(whyMatch(s, clue, 'en'));
          } else {
            ok(whyNot(s, clue, 'fr'));
            ok(whyNot(s, clue, 'en'));
          }
        }
      }
      ok(accusePrompt(c, 'fr'));
      ok(accusePrompt(c, 'en'));
      for (const s of c.suspects) {
        ok(describeSuspect(s, 'fr'));
        ok(describeSuspect(s, 'en'));
      }
    }
  });

  it('French colours agree with the noun', () => {
    const scarf = { lits: [{ trait: { k: 'scarf', hue: 'green' } as const, not: false }], spot: 0 };
    expect(clueText(scarf, 'fr')).toBe('Le coupable porte une écharpe verte.');
    const hat = { lits: [{ trait: { k: 'hat', hue: 'purple' } as const, not: false }], spot: 0 };
    expect(clueText(hat, 'fr')).toBe('Le coupable porte un chapeau violet.');
    expect(clueText(hat, 'en')).toBe('The culprit wears a purple hat.');
    const no = { lits: [{ trait: { k: 'glasses' } as const, not: true }], spot: 0 };
    expect(clueText(no, 'fr')).toBe('Le coupable ne porte pas de lunettes.');
    expect(clearPrompt(no, 'fr')).toBe('Touche chaque suspect qui porte des lunettes : ce n’est pas lui !');
    const big = { lits: [{ trait: { k: 'size', size: 'big' } as const, not: false }], spot: 0 };
    expect(clearPrompt(big, 'en')).toBe('Tap every suspect who is small: it wasn’t them!');
  });

  it('every friend and every mystery has its words', () => {
    for (const id of SPECIES) {
      const i = SPECIES_INFO[id];
      for (const l of [i.name, i.short, i.alibi]) {
        ok(l.fr);
        ok(l.en);
      }
      expect(i.name.fr).not.toBe(i.name.en);
      expect(i.alibi.fr).not.toBe(i.alibi.en);
      expect(i.emoji.length).toBeGreaterThan(0);
    }
    for (const m of MYSTERIES) {
      const i = MYSTERY_INFO[m];
      for (const l of [i.title, i.intro, i.question, i.confession, i.party]) {
        ok(l.fr);
        ok(l.en);
        expect(l.fr).not.toBe(l.en);
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import {
  DECOR,
  DECOR_SPOTS,
  FOOD_INFO,
  NEEDS,
  NEED_MAX,
  RUB_PX_PER_HEART,
  STAGES,
  allFull,
  bubblesDone,
  careNeed,
  celebrate,
  challengeText,
  checkBubble,
  checkChoice,
  checkPick,
  checkThrow,
  decorUnlocked,
  emptyNeeds,
  emptySave,
  growthFrom,
  growthOf,
  heartsFromRub,
  hintText,
  nextStageHint,
  parseSave,
  placeDecor,
  planChallenge,
  stepsOf,
  type Band,
  type Challenge,
  type NeedId,
} from './logic';
import { emptyMemory } from '@/lib/world/memory';
import { INITIAL_SKILL } from '@/lib/learning/adaptive';
import { classify } from '@/lib/safety/policy';

const BANDS: Band[] = ['little', 'middle', 'big'];

/** Play a challenge perfectly through the checkers: proves it can be finished. */
function solve(ch: Challenge): boolean {
  switch (ch.kind) {
    case 'pick': {
      if (ch.target - ch.start > ch.apples) return false;
      let count = ch.start;
      while (checkPick(ch, count) === 'more') count++;
      return checkPick(ch, count) === 'done';
    }
    case 'choose':
      return ch.choices.filter((f) => checkChoice(ch, f)).length === 1;
    case 'throw':
      return ch.rounds.every((rd, i) => rd.targets.some((t) => checkThrow(ch, i, t)));
    case 'rub':
      return heartsFromRub(ch, ch.hearts * RUB_PX_PER_HEART) === ch.hearts;
    case 'bubbles': {
      const popped: string[] = [];
      const left = [...ch.labels];
      while (!bubblesDone(ch, popped)) {
        const i = left.findIndex((l) => checkBubble(ch, popped, l));
        if (i < 0) return false;
        popped.push(left[i]);
        left.splice(i, 1);
      }
      return true;
    }
  }
}

describe('Le Nid — wishes only go up', () => {
  it('a care raises one wish by one, capped, and never lowers anything', () => {
    let n = emptyNeeds();
    const seq: NeedId[] = ['food', 'food', 'hug', 'food', 'food', 'food', 'bath', 'play', 'play'];
    for (const id of seq) {
      const next = careNeed(n, id);
      for (const k of NEEDS) expect(next[k]).toBeGreaterThanOrEqual(n[k]);
      expect(next[id]).toBe(Math.min(NEED_MAX, n[id] + 1));
      n = next;
    }
    expect(n.food).toBe(NEED_MAX);
  });

  it('has no function that decays wishes with time; only the child’s party restarts them', () => {
    const save = emptySave();
    expect(celebrate(save)).toBe(save); // not full: nothing happens
    let needs = emptyNeeds();
    for (const id of NEEDS) for (let i = 0; i < NEED_MAX; i++) needs = careNeed(needs, id);
    expect(allFull(needs)).toBe(true);
    const after = celebrate({ ...save, needs });
    expect(after.parties).toBe(1);
    expect(after.needs).toEqual(emptyNeeds());
  });
});

describe('Le Nid — growth comes from learning, never from time', () => {
  it('maps points to stages', () => {
    expect(growthFrom(0, 0).stage).toBe('baby');
    expect(growthFrom(4, 0).stage).toBe('baby');
    expect(growthFrom(5, 0).stage).toBe('small');
    expect(growthFrom(2, 1).stage).toBe('small'); // 2 stars + 1 mastered skill (3 pts)
    expect(growthFrom(15, 0).stage).toBe('big');
    expect(growthFrom(20, 5).stage).toBe('legend');
    expect(growthFrom(99, 9).missing).toBeNull();
  });

  it('is monotonic in stars and mastered skills', () => {
    for (let s = 0; s < 60; s++)
      for (let k = 0; k < 8; k++) {
        const g = growthFrom(s, k);
        expect(growthFrom(s + 1, k).index).toBeGreaterThanOrEqual(g.index);
        expect(growthFrom(s, k + 1).index).toBeGreaterThanOrEqual(g.index);
        expect(g.progress).toBeGreaterThanOrEqual(0);
        expect(g.progress).toBeLessThanOrEqual(1);
        if (g.missing !== null) expect(g.missing).toBeGreaterThan(0);
      }
  });

  it('reads stars and mastery from World Memory, ignoring play time', () => {
    const m = emptyMemory();
    m.playMs = 1e9;
    m.gamesPlayed = { nid: 500 };
    expect(growthOf(m).stage).toBe('baby');
    m.completedQuests = { a: { stars: 3, plays: 1, at: '' }, b: { stars: 2, plays: 1, at: '' } };
    m.skills = { counting: { ...INITIAL_SKILL, masteryEstimate: 0.7 }, letters: { ...INITIAL_SKILL, masteryEstimate: 0.4 } };
    const g = growthOf(m);
    expect(g.stars).toBe(5);
    expect(g.mastered).toBe(1);
    expect(g.stage).toBe('small');
  });

  it('gives a next-step hint in both languages', () => {
    expect(nextStageHint(growthFrom(0, 0), 'fr')).toBe('Encore 5 étoiles dans Ziggy World pour devenir petit !');
    expect(nextStageHint(growthFrom(4, 0), 'en')).toBe('1 more star in Ziggy World to become little one!');
    expect(nextStageHint(growthFrom(50, 0), 'fr')).toMatch(/légendaire/);
  });
});

describe('Le Nid — micro-challenges', () => {
  it('plans deterministically for a seed', () => {
    for (const band of BANDS)
      for (const need of NEEDS) {
        expect(planChallenge(7, band, need, 2, 3, 'fr')).toEqual(planChallenge(7, band, need, 2, 3, 'fr'));
      }
    // Different index → the plan can change (variety), but stays valid.
    const kinds = new Set(Array.from({ length: 12 }, (_, i) => planChallenge(1, 'middle', 'food', i).kind));
    expect(kinds).toEqual(new Set(['pick', 'choose']));
  });

  it('every challenge is solvable, for every band, level and many seeds', () => {
    for (let seed = 0; seed < 150; seed++)
      for (const band of BANDS)
        for (const need of NEEDS)
          for (const level of [1, 3, 5])
            for (const locale of ['fr', 'en']) {
              const ch = planChallenge(seed, band, need, seed % 5, level, locale);
              expect(ch.need).toBe(need);
              expect(solve(ch), JSON.stringify(ch)).toBe(true);
              expect(stepsOf(ch)).toBeGreaterThan(0);
            }
  });

  it('adapts to age', () => {
    const little = planChallenge(3, 'little', 'bath', 0);
    const big = planChallenge(3, 'big', 'bath', 0, 1, 'fr');
    expect(little.kind === 'bubbles' && little.mode).toBe('any');
    expect(big.kind === 'bubbles' && big.mode).toBe('word');
    for (let s = 0; s < 40; s++) {
      const p = planChallenge(s, 'little', 'play', 0);
      expect(p.kind === 'throw' && p.mode).toBe('count');
      const h = planChallenge(s, 'little', 'hug', 0);
      expect(h.kind === 'rub' && h.hearts).toBeLessThanOrEqual(3);
      const b = planChallenge(s, 'big', 'hug', 0);
      expect(b.kind === 'rub' && b.expr && b.expr[0] + b.expr[1]).toBe(b.kind === 'rub' ? b.hearts : -1);
    }
  });

  it('choose: exactly one right answer among three different foods', () => {
    for (let s = 0; s < 200; s++)
      for (const band of BANDS) {
        const ch = planChallenge(s, band, 'food', 1);
        if (ch.kind !== 'choose') continue;
        expect(new Set(ch.choices).size).toBe(3);
        const right = ch.choices.filter((f) => (ch.mode === 'yes' ? FOOD_INFO[f].group === ch.group : FOOD_INFO[f].group !== ch.group));
        expect(right).toEqual([ch.answer]);
      }
  });

  it('pick: wrong steps are hints, never a fail', () => {
    const ch = Array.from({ length: 20 }, (_, i) => planChallenge(4, 'middle', 'food', i)).find((c) => c.kind === 'pick');
    if (ch?.kind !== 'pick') throw new Error('expected pick');
    expect(checkPick(ch, ch.target - 1)).toBe('more');
    expect(checkPick(ch, ch.target + 1)).toBe('over');
    expect(hintText(ch, 'over', 'fr')).toMatch(/remets/);
  });

  it('bubbles in order accept duplicates of the expected label', () => {
    const ch: Challenge = { kind: 'bubbles', need: 'bath', skill: 'vocabulary', mode: 'word', labels: ['L', 'B', 'L', 'U', 'E', 'L'], order: ['B', 'U', 'L', 'L', 'E'] };
    expect(checkBubble(ch, [], 'L')).toBe(false);
    expect(checkBubble(ch, ['B', 'U'], 'L')).toBe(true);
    expect(checkBubble(ch, ['B', 'U', 'L'], 'L')).toBe(true);
  });

  it('every sentence is kind (safety policy) and never mentions sickness or sadness', () => {
    for (let s = 0; s < 30; s++)
      for (const band of BANDS)
        for (const need of NEEDS)
          for (const locale of ['fr', 'en']) {
            const ch = planChallenge(s, band, need, s, 2, locale);
            const lines = [challengeText(ch, locale, 'Pépin'), hintText(ch, 'wrong', locale, { round: 0, popped: [] }), hintText(ch, 'more', locale, { count: 2 })];
            for (const line of lines) {
              expect(classify(line), line).toBeNull();
              expect(line).not.toMatch(/malade|triste|faim|sick|sad|hungry|starv/i);
            }
          }
  });
});

describe('Le Nid — garden & save', () => {
  it('places and removes decorations within the spots', () => {
    let d = emptySave().decor;
    d = placeDecor(d, 2, 'lantern');
    expect(d[2]).toBe('lantern');
    d = placeDecor(d, 2, null);
    expect(d[2]).toBeNull();
    expect(placeDecor(d, DECOR_SPOTS + 3, 'slide')).toBe(d);
    expect(d).toHaveLength(DECOR_SPOTS);
  });

  it('unlocks decorations with growth', () => {
    const baby = growthFrom(0, 0);
    const legend = growthFrom(60, 0);
    expect(decorUnlocked('flowers', baby)).toBe(true);
    expect(decorUnlocked('slide', baby)).toBe(false);
    expect(DECOR.every((x) => decorUnlocked(x, legend))).toBe(true);
    expect(STAGES).toHaveLength(4);
  });

  it('parses any stored value into a valid save', () => {
    expect(parseSave(null)).toEqual(emptySave());
    expect(parseSave('oops')).toEqual(emptySave());
    const s = parseSave({ needs: { food: 99, play: -3, hug: 'x' }, parties: 2.7, decor: ['slide', 'bomb', 3, null, 'lantern'] });
    expect(s.needs).toEqual({ food: NEED_MAX, play: 0, hug: 0, bath: 0 });
    expect(s.parties).toBe(2);
    expect(s.decor.slice(0, 5)).toEqual(['slide', null, null, null, 'lantern']);
    expect(s.decor).toHaveLength(DECOR_SPOTS);
  });
});

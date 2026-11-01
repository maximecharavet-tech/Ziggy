import { describe, expect, it } from 'vitest';
import { MISSIONS, canPick, isReady, missionKind, missionText, planMission, planPattern, progressOf, type Band, type Gift } from './missions';
import { classify } from '@/lib/safety/policy';

const BANDS: Band[] = ['little', 'middle', 'big'];

/** Find a set of gifts that completes the mission (proves it is solvable). */
function solve(plan: ReturnType<typeof planMission>): Gift[] | null {
  const m = plan.mission;
  if (m.kind === 'color') {
    const ok = plan.gifts.filter((g) => g.color === m.color);
    return ok.length >= m.count ? ok.slice(0, m.count) : null;
  }
  if (m.kind === 'count') return plan.gifts.length >= m.count ? plan.gifts.slice(0, m.count) : null;
  const gifts = plan.gifts;
  for (let mask = 1; mask < 1 << gifts.length; mask++) {
    const pick = gifts.filter((_, i) => mask & (1 << i));
    if (pick.reduce((s, g) => s + (g.value ?? 0), 0) === m.target) return pick;
  }
  return null;
}

describe('Le Noël de Ziggy — missions', () => {
  it('is deterministic for a seed', () => {
    expect(planMission(42, 'middle', 2, 1)).toEqual(planMission(42, 'middle', 2, 1));
    expect(planPattern(42, 'big')).toEqual(planPattern(42, 'big'));
  });

  it('adapts the kind of mission to the age band', () => {
    expect(missionKind('little', 1, 0)).toBe('color');
    expect(missionKind('little', 3, 1)).toBe('count');
    expect(missionKind('big', 1, 0)).toBe('sum');
  });

  it('every mission of every band and level can be completed', () => {
    for (const band of BANDS)
      for (let level = 1; level <= 5; level++)
        for (let seed = 0; seed < 40; seed++)
          for (let i = 0; i < MISSIONS; i++) {
            const plan = planMission(seed, band, level, i);
            const sol = solve(plan);
            expect(sol, `${band} L${level} seed ${seed} #${i}`).not.toBeNull();
            // Picking the solution one by one is always allowed and completes it.
            const carried: Gift[] = [];
            for (const g of sol!) {
              expect(canPick(plan.mission, carried, g).ok).toBe(true);
              carried.push(g);
            }
            expect(isReady(plan.mission, carried)).toBe(true);
            // The target house shows the right number.
            if (plan.mission.kind === 'count') expect(plan.signs[plan.mission.house]).toBe(plan.mission.count);
            if (plan.mission.kind === 'sum') expect(plan.signs[plan.mission.house]).toBe(plan.mission.target);
            const signs = plan.signs.filter((_, h) => h !== plan.mission.house);
            expect(signs).not.toContain(plan.signs[plan.mission.house]);
          }
  });

  it('keeps little ones to small numbers', () => {
    for (let seed = 0; seed < 50; seed++) {
      const p = planMission(seed, 'little', 5, 1);
      if (p.mission.kind === 'count') expect(p.mission.count).toBeLessThanOrEqual(5);
      if (p.mission.kind === 'color') expect(p.mission.count).toBeLessThanOrEqual(5);
    }
  });

  it('never loses a gift: wrong picks just explain why', () => {
    const plan = { mission: { kind: 'sum' as const, target: 7, house: 0 }, gifts: [], signs: [] };
    const carried: Gift[] = [{ id: 1, color: 'red', value: 5 }];
    expect(canPick(plan.mission, carried, { id: 2, color: 'blue', value: 4 })).toEqual({ ok: false, reason: 'too_much', missing: 2 });
    expect(canPick(plan.mission, carried, { id: 3, color: 'blue', value: 2 })).toEqual({ ok: true });
    expect(progressOf(plan.mission, carried)).toEqual({ have: 5, need: 7 });
    const color = { kind: 'color' as const, color: 'red' as const, count: 2, house: 0 };
    expect(canPick(color, [], { id: 4, color: 'blue' })).toEqual({ ok: false, reason: 'wrong_color' });
  });

  it('patterns have a single right answer among 3 choices', () => {
    for (const band of BANDS)
      for (let seed = 0; seed < 30; seed++)
        for (const r of planPattern(seed, band)) {
          expect(r.choices).toHaveLength(3);
          expect(new Set(r.choices).size).toBe(3);
          expect(r.choices).toContain(r.answer);
          expect(r.shown.length).toBeGreaterThanOrEqual(4);
        }
  });

  it('speaks kindly in French and English', () => {
    for (const band of BANDS)
      for (let i = 0; i < MISSIONS; i++) {
        const p = planMission(7, band, 3, i);
        for (const l of ['fr', 'en']) {
          const t = missionText(p, l);
          expect(t.length).toBeGreaterThan(20);
          expect(classify(t)).toBeNull();
        }
      }
  });
});

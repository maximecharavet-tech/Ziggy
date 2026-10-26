import { describe, expect, it } from 'vitest';
import { QUESTIONS_PER_RUN, mainSkill, planRun, speedFor } from './questions';
import type { Band } from '../noel/missions';

const BANDS: Band[] = ['little', 'middle', 'big'];

describe('La Luge des nombres — questions', () => {
  it('is deterministic for a seed', () => {
    expect(planRun(5, 'big', 3)).toEqual(planRun(5, 'big', 3));
  });

  it('always offers 3 different answers, one of them right', () => {
    for (const band of BANDS)
      for (let level = 1; level <= 5; level++)
        for (let seed = 0; seed < 60; seed++) {
          const run = planRun(seed, band, level);
          expect(run).toHaveLength(QUESTIONS_PER_RUN);
          for (const q of run) {
            expect(new Set(q.options).size).toBe(3);
            expect(q.options).toContain(q.answer);
            expect(Math.min(...q.options)).toBeGreaterThanOrEqual(0);
          }
        }
  });

  it('computes the right answers', () => {
    for (const q of planRun(11, 'big', 4)) {
      const m = /(\d+) ([+−×]) (\d+)/.exec(q.text.fr);
      if (!m) continue;
      const [a, op, b] = [Number(m[1]), m[2], Number(m[3])];
      expect(q.answer).toBe(op === '+' ? a + b : op === '−' ? a - b : a * b);
    }
  });

  it('keeps little ones to counting and tiny sums, with pictures', () => {
    for (let seed = 0; seed < 40; seed++)
      for (const q of planRun(seed, 'little', 5)) {
        expect(q.answer).toBeLessThanOrEqual(10);
        expect(q.visual).toBeTruthy();
        expect(['counting', 'addition']).toContain(q.skill);
      }
  });

  it('goes gently for little ones', () => {
    expect(speedFor('little', 1)).toBeLessThan(speedFor('big', 1));
    expect(['counting', 'addition', 'multiplication', 'subtraction']).toContain(mainSkill(planRun(1, 'middle', 3)));
  });
});

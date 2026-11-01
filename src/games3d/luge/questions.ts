/**
 * La Luge des nombres — questions decided by the engine (seeded, by age band
 * and level). Each question has exactly 3 answers, one per lane.
 */
import { rng } from '../kit/rng';
import type { Band } from '../noel/missions';

export interface LugeQuestion {
  /** Shown and read aloud. */
  text: { fr: string; en: string };
  /** Visual help for little ones (e.g. "⭐⭐⭐"). */
  visual?: string;
  options: [number, number, number];
  answer: number;
  skill: 'counting' | 'addition' | 'subtraction' | 'multiplication';
}

export const QUESTIONS_PER_RUN = 10;

function three(answer: number, r: () => number, spread: number, min = 0): [number, number, number] {
  const set = new Set([answer]);
  while (set.size < 3) {
    const d = 1 + Math.floor(r() * spread);
    const v = r() < 0.5 ? answer - d : answer + d;
    if (v >= min) set.add(v);
  }
  const arr = [...set];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr as [number, number, number];
}

export function planRun(seed: number, band: Band, level: number): LugeQuestion[] {
  const r = rng(seed * 7 + 3);
  const out: LugeQuestion[] = [];
  const icons = ['⭐', '🎁', '❄️', '🍪', '🔔'];
  for (let i = 0; i < QUESTIONS_PER_RUN; i++) {
    if (band === 'little') {
      if (level <= 1 || i % 2 === 0) {
        const n = 1 + Math.floor(r() * Math.min(10, 4 + level));
        const icon = icons[Math.floor(r() * icons.length)];
        out.push({ text: { fr: 'Combien y en a-t-il ?', en: 'How many are there?' }, visual: icon.repeat(n), options: three(n, r, 2, 1), answer: n, skill: 'counting' });
      } else {
        const a = 1 + Math.floor(r() * 4);
        const b = 1 + Math.floor(r() * 3);
        out.push({ text: { fr: `${a} + ${b} = ?`, en: `${a} + ${b} = ?` }, visual: `${'🍎'.repeat(a)} + ${'🍎'.repeat(b)}`, options: three(a + b, r, 2, 1), answer: a + b, skill: 'addition' });
      }
      continue;
    }
    if (band === 'middle') {
      const max = Math.min(20, 6 + level * 3);
      if (i % 3 === 2 && level >= 2) {
        const a = 3 + Math.floor(r() * (max - 3));
        const b = 1 + Math.floor(r() * (a - 1));
        out.push({ text: { fr: `${a} − ${b} = ?`, en: `${a} − ${b} = ?` }, options: three(a - b, r, 3), answer: a - b, skill: 'subtraction' });
      } else {
        const a = 1 + Math.floor(r() * (max / 2));
        const b = 1 + Math.floor(r() * (max / 2));
        out.push({ text: { fr: `${a} + ${b} = ?`, en: `${a} + ${b} = ?` }, options: three(a + b, r, 3), answer: a + b, skill: 'addition' });
      }
      continue;
    }
    // big: tables and bigger sums
    if (i % 2 === 0) {
      const a = 2 + Math.floor(r() * Math.min(8, 3 + level));
      const b = 2 + Math.floor(r() * 8);
      out.push({ text: { fr: `${a} × ${b} = ?`, en: `${a} × ${b} = ?` }, options: three(a * b, r, Math.max(3, a)), answer: a * b, skill: 'multiplication' });
    } else {
      const a = 10 + Math.floor(r() * (10 + level * 8));
      const b = 5 + Math.floor(r() * (10 + level * 5));
      out.push({ text: { fr: `${a} + ${b} = ?`, en: `${a} + ${b} = ?` }, options: three(a + b, r, 10), answer: a + b, skill: 'addition' });
    }
  }
  return out;
}

/** Sledding speed (units/s) by level: always calm for little ones. */
export function speedFor(band: Band, level: number): number {
  const base = band === 'little' ? 7 : band === 'middle' ? 8.5 : 10;
  return base + (level - 1) * 0.8;
}

/** The skill trained most in a run (for the adaptive engine). */
export function mainSkill(qs: LugeQuestion[]): LugeQuestion['skill'] {
  const n: Record<string, number> = {};
  for (const q of qs) n[q.skill] = (n[q.skill] ?? 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1])[0][0] as LugeQuestion['skill'];
}

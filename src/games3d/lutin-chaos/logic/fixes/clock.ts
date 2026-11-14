/**
 * clock: set the time back. little: o'clock, pick one of 3 clocks · middle:
 * o'clock / half / quarter, set the hands · big: "the clock is 2 h 15 fast",
 * work out and set the real time (5-minute steps).
 * Answers are "h:mm" with h in 1–12.
 */
import { int, pick, shuffle } from '../rand';
import { FIX_TEXT, HINT, fill } from '../texts';
import type { L } from '../types';
import { defineFix, isStr, type BasePuzzle } from './define';

export interface ClockPuzzle extends BasePuzzle {
  fix: 'clock';
  /** What the pranked clock shows now. */
  shown: string;
  /** little: the 3 clocks to pick from; others set the hands freely. */
  options: string[];
  solution: string;
}

export const fmt = (h: number, m: number) => `${h}:${String(m).padStart(2, '0')}`;
export function parseTime(s: string): { h: number; m: number } | null {
  const mm = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!mm) return null;
  const h = Number(mm[1]);
  const m = Number(mm[2]);
  return h >= 1 && h <= 12 && m >= 0 && m < 60 ? { h, m } : null;
}
/** Minutes since 12:00 on a 12-hour dial. */
const toMin = (h: number, m: number) => (h % 12) * 60 + m;
const fromMin = (t: number) => {
  const x = ((t % 720) + 720) % 720;
  const h = Math.floor(x / 60);
  return { h: h === 0 ? 12 : h, m: x % 60 };
};

const say = (h: number, m: number): L => {
  if (m === 0) return { fr: `${h} heures`, en: `${h} o’clock` };
  if (m === 30) return { fr: `${h} heures et demie`, en: `half past ${h}` };
  if (m === 15) return { fr: `${h} heures et quart`, en: `quarter past ${h}` };
  if (m === 45) return { fr: `${h === 12 ? 1 : h + 1} heures moins le quart`, en: `quarter to ${h === 12 ? 1 : h + 1}` };
  return { fr: `${h} h ${String(m).padStart(2, '0')}`, en: fmt(h, m) };
};

export const clockFix = defineFix<ClockPuzzle, string>({
  id: 'clock',
  label: { fr: 'Remettre l’heure', en: 'Set the clock' },
  icon: '🕰️',
  goal: 'time',
  params: {},
  make(ctx) {
    const { band, rng } = ctx;
    if (band === 'little') {
      const h = int(rng, 1, 12);
      const others = shuffle(rng, Array.from({ length: 12 }, (_, i) => i + 1).filter((x) => x !== h)).slice(0, 2);
      const shownH = others[0];
      return {
        fix: 'clock',
        band,
        prompt: fill(FIX_TEXT.clockOclock, { h }),
        seconds: 11,
        goal: 'time',
        skill: 'sequencing',
        shown: fmt(shownH, 0),
        options: shuffle(rng, [h, ...others].map((x) => fmt(x, 0))),
        solution: fmt(h, 0),
      };
    }
    if (band === 'middle') {
      const h = int(rng, 1, 12);
      const m = pick(rng, [0, 15, 30, 45]);
      const shown = fromMin(toMin(h, m) + pick(rng, [60, 90, 120, 180]));
      return {
        fix: 'clock',
        band,
        prompt: fill(FIX_TEXT.clockSet, { time: say(h, m) }),
        seconds: 14,
        goal: 'time',
        skill: 'sequencing',
        shown: fmt(shown.h, shown.m),
        options: [],
        solution: fmt(h, m),
      };
    }
    const h = int(rng, 1, 12);
    const m = 5 * int(rng, 0, 11);
    const delta = pick(rng, [45, 75, 90, 135, 150]);
    const shown = fromMin(toMin(h, m) + delta);
    const dh = Math.floor(delta / 60);
    const dm = delta % 60;
    const deltaL: L = dh ? { fr: `${dh} h ${dm}`, en: `${dh} h ${dm} min` } : { fr: `${dm} minutes`, en: `${dm} minutes` };
    return {
      fix: 'clock',
      band,
      prompt: fill(FIX_TEXT.clockAhead, { delta: deltaL, shown: say(shown.h, shown.m) }),
      seconds: 18,
      goal: 'time',
      skill: 'subtraction',
      shown: fmt(shown.h, shown.m),
      options: [],
      solution: fmt(h, m),
    };
  },
  solve: (p) => p.solution,
  isAnswer: isStr,
  check(p, a) {
    const t = parseTime(a);
    const s = parseTime(p.solution)!;
    if (t && t.h === s.h && t.m === s.m) return { ok: true };
    if (t && t.h === s.h) return { ok: false, hints: [HINT.hourRight, HINT.together], focus: ['minute-hand'] };
    if (t && t.m === s.m) return { ok: false, hints: [HINT.minuteRight, HINT.together], focus: ['hour-hand'] };
    return { ok: false, hints: [HINT.almost, HINT.together], focus: ['clock'] };
  },
  wrong: (p) => {
    const s = parseTime(p.solution)!;
    return p.options.find((o) => o !== p.solution) ?? fmt(s.h === 12 ? 1 : s.h + 1, s.m);
  },
});

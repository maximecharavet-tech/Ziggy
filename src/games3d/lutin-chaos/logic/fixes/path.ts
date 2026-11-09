/**
 * path: follow the footprints. little: 3×3, 2 arrow steps · middle: 4×4,
 * 3 steps with words and counts · big: 5×5 grid coordinates (A–E, 1–5).
 * x grows to the right, y grows up (row 1 at the bottom).
 */
import { int, pick, type Rng } from '../rand';
import { DIRECTION, FIX_TEXT, HINT, fill } from '../texts';
import type { L } from '../types';
import { defineFix, isStr, type BasePuzzle } from './define';

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface PathStep {
  dir: Dir;
  n: number;
}

export interface PathPuzzle extends BasePuzzle {
  fix: 'path';
  size: number;
  start: [number, number];
  steps: PathStep[];
  /** big: show A–E / 1–5 labels. */
  coords: boolean;
  solution: string;
}

const D: Record<Dir, [number, number]> = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };

export const cellId = (x: number, y: number) => `${x},${y}`;
/** "C4" style label (big kids). */
export const coordLabel = (x: number, y: number) => `${'ABCDE'[x]}${y + 1}`;

/** Walk the steps; null if a step leaves the grid. */
export function walk(size: number, start: [number, number], steps: PathStep[]): [number, number][] | null {
  const out: [number, number][] = [start];
  let [x, y] = start;
  for (const s of steps) {
    x += D[s.dir][0] * s.n;
    y += D[s.dir][1] * s.n;
    if (x < 0 || y < 0 || x >= size || y >= size) return null;
    out.push([x, y]);
  }
  return out;
}

function randomSteps(rng: Rng, size: number, start: [number, number], count: number, maxN: number): PathStep[] {
  for (let tries = 0; tries < 200; tries++) {
    const steps: PathStep[] = [];
    let prev: Dir | null = null;
    for (let i = 0; i < count; i++) {
      const dirs = (Object.keys(D) as Dir[]).filter((d) => d !== prev);
      const dir: Dir = pick(rng, dirs);
      steps.push({ dir, n: int(rng, 1, maxN) });
      prev = dir;
    }
    const w = walk(size, start, steps);
    if (w && cellId(...w[w.length - 1]) !== cellId(...start)) return steps;
  }
  throw new Error('no path found');
}

const stepWords = (steps: PathStep[]): L => ({
  fr: steps.map((s) => `${s.n} ${DIRECTION[s.dir].name.fr}`).join(', '),
  en: steps.map((s) => `${s.n} ${DIRECTION[s.dir].name.en}`).join(', '),
});

export const pathFix = defineFix<PathPuzzle, string>({
  id: 'path',
  label: { fr: 'Suivre les empreintes', en: 'Follow the footprints' },
  icon: '👣',
  goal: 'spatial',
  params: {},
  make(ctx) {
    const { band, rng } = ctx;
    const size = band === 'little' ? 3 : band === 'middle' ? 4 : 5;
    const start: [number, number] = [int(rng, 0, size - 1), int(rng, 0, size - 1)];
    const steps = randomSteps(rng, size, start, band === 'little' ? 2 : 3, band === 'little' ? 1 : band === 'middle' ? 2 : 3);
    const end = walk(size, start, steps)!.at(-1)!;
    const prompt =
      band === 'little'
        ? FIX_TEXT.pathArrows
        : band === 'middle'
          ? fill(FIX_TEXT.pathWords, { steps: stepWords(steps) })
          : fill(FIX_TEXT.pathCoords, { start: coordLabel(...start), steps: stepWords(steps) });
    return {
      fix: 'path',
      band,
      prompt,
      seconds: band === 'little' ? 11 : band === 'middle' ? 15 : 18,
      goal: 'spatial',
      skill: band === 'big' ? 'logic' : 'shapes',
      size,
      start,
      steps,
      coords: band === 'big',
      solution: cellId(...end),
    };
  },
  solve: (p) => p.solution,
  isAnswer: isStr,
  check(p, a) {
    if (a === p.solution) return { ok: true };
    const first = walk(p.size, p.start, p.steps)![1];
    return { ok: false, hints: [HINT.firstStep, HINT.together], focus: [cellId(...first)] };
  },
  wrong(p) {
    const [x, y] = p.solution.split(',').map(Number);
    return cellId(x > 0 ? x - 1 : x + 1, y);
  },
});

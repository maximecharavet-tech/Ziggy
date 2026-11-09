/**
 * rotate: turn it the right way. little: upside down, tap ↻ until it's right ·
 * middle: any quarter turn · big: mental rotation — which picture is the same
 * shape only turned (the others are mirror images)?
 */
import { int, shuffle } from '../rand';
import { FIX_TEXT, HINT, fill } from '../texts';
import { the, word } from '../vocab';
import { defineFix, itemOf, type BasePuzzle } from './define';

export type Cells = [number, number][];

export interface RotateOption {
  id: string;
  cells: Cells;
}

export interface RotatePuzzle extends BasePuzzle {
  fix: 'rotate';
  mode: 'turn' | 'match';
  item: string;
  /** turn: quarter turns clockwise the item is off by. */
  startRot: number;
  /** match: the reference shape and the options. */
  shape: Cells | null;
  options: RotateOption[];
  /** turn: taps of ↻ (90° clockwise) that fix it; match: the option id. */
  solution: number | string;
}

/** Chiral polyominoes: no rotation equals their mirror image. */
export const CHIRAL_SHAPES: Cells[] = [
  [[0, 0], [0, 1], [0, 2], [1, 0]], // L
  [[0, 0], [1, 0], [1, 1], [2, 1]], // S
  [[1, 0], [1, 1], [1, 2], [0, 1], [2, 2]], // F
  [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1]], // Y
  [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2], [0, 1]], // a felt boot
];

const norm = (c: Cells): Cells => {
  const mx = Math.min(...c.map((p) => p[0]));
  const my = Math.min(...c.map((p) => p[1]));
  return c.map(([x, y]) => [x - mx, y - my] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
};
export const rotateCells = (c: Cells, q: number): Cells => {
  let out = c;
  for (let i = 0; i < ((q % 4) + 4) % 4; i++) out = out.map(([x, y]) => [y, -x] as [number, number]);
  return norm(out);
};
export const mirrorCells = (c: Cells): Cells => norm(c.map(([x, y]) => [-x, y] as [number, number]));
const key = (c: Cells) => JSON.stringify(norm(c));
/** Same shape up to rotation (not mirroring)? */
export const sameUpToRotation = (a: Cells, b: Cells) => [0, 1, 2, 3].some((q) => key(rotateCells(a, q)) === key(b));

export const rotateFix = defineFix<RotatePuzzle, number | string>({
  id: 'rotate',
  label: { fr: 'Remettre à l’endroit', en: 'Turn it right' },
  icon: '🔄',
  goal: 'spatial',
  params: { item: { type: 'string' } },
  make(ctx) {
    const { band, rng } = ctx;
    const item = itemOf(ctx, 'frame');
    if (band !== 'big') {
      const fromPrank = ctx.prank?.changes.find((c) => c.field === 'rot');
      const prankRot = fromPrank && typeof fromPrank.to === 'number' && typeof fromPrank.from === 'number' ? (fromPrank.to - fromPrank.from + 4) % 4 : 0;
      const startRot = band === 'little' ? 2 : prankRot || int(rng, 1, 3);
      return {
        fix: 'rotate',
        band,
        prompt: fill(FIX_TEXT.rotateTurn, { item: the(word(item)) }),
        seconds: band === 'little' ? 10 : 12,
        goal: 'spatial',
        skill: 'shapes',
        mode: 'turn',
        item,
        startRot,
        shape: null,
        options: [],
        solution: (4 - startRot) % 4,
      };
    }
    const shape = norm(CHIRAL_SHAPES[int(rng, 0, CHIRAL_SHAPES.length - 1)]);
    const right = rotateCells(shape, int(rng, 1, 3));
    const mirrors = shuffle(rng, [0, 1, 2, 3]).slice(0, 3).map((q) => rotateCells(mirrorCells(shape), q));
    const options = shuffle(rng, [right, ...mirrors]).map((cells, i) => ({ id: `r${i}`, cells }));
    const sol = options.find((o) => o.cells === right)!.id;
    if (options.filter((o) => sameUpToRotation(shape, o.cells)).length !== 1) throw new Error('rotation puzzle is ambiguous');
    return { fix: 'rotate', band, prompt: FIX_TEXT.rotateMatch, seconds: 16, goal: 'spatial', skill: 'shapes', mode: 'match', item, startRot: 0, shape, options, solution: sol };
  },
  solve: (p) => p.solution,
  isAnswer: (a): a is number | string => typeof a === 'string' || (typeof a === 'number' && Number.isInteger(a) && a >= 0),
  check(p, a) {
    if (p.mode === 'turn') {
      if (typeof a === 'number' && (p.startRot + a) % 4 === 0) return { ok: true };
      return { ok: false, hints: [HINT.almost, HINT.together], focus: [p.item] };
    }
    if (a === p.solution) return { ok: true };
    return { ok: false, hints: [HINT.lookAt, HINT.together], focus: typeof a === 'string' ? [a] : [] };
  },
  wrong: (p) => (p.mode === 'turn' ? ((p.solution as number) + 1) % 4 : p.options.find((o) => o.id !== p.solution)!.id),
});

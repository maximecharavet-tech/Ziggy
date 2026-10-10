/**
 * Pure helpers shared by the arcade mechanics. No React, no DOM: everything
 * here is unit-tested in node (arcade-ui.test.ts).
 */

export type Rng = () => number;

/** Fisher–Yates shuffle, returning a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Shuffle, but avoid giving back the original order when another one exists. */
export function shuffleNotIdentity<T>(items: readonly T[], rng: Rng = Math.random, same = (a: T, b: T) => a === b): T[] {
  const distinct = items.some((x) => !same(x, items[0]));
  if (items.length < 2 || !distinct) return [...items];
  for (let tries = 0; tries < 12; tries++) {
    const out = shuffle(items, rng);
    if (out.some((x, i) => !same(x, items[i]))) return out;
  }
  // Deterministic fallback: rotate by one.
  return [...items.slice(1), items[0]];
}

/* ── Colours ── */

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = Number.parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** Average the RGB of the given colours (a friendly "paint mix"). Empty → null. */
export function mixHex(hexes: readonly string[]): string | null {
  if (hexes.length === 0) return null;
  const sum = hexes.map(hexToRgb).reduce<[number, number, number]>(
    (acc, [r, g, b]) => [acc[0] + r, acc[1] + g, acc[2] + b],
    [0, 0, 0],
  );
  return rgbToHex([sum[0] / hexes.length, sum[1] / hexes.length, sum[2] / hexes.length]);
}

/** Order-insensitive multiset equality (["red","red","blue"] ≠ ["red","blue"]). */
export function sameMultiset(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const count = new Map<string, number>();
  for (const x of a) count.set(x, (count.get(x) ?? 0) + 1);
  for (const x of b) {
    const n = count.get(x);
    if (!n) return false;
    count.set(x, n - 1);
  }
  return true;
}

/** Black or white text, whichever reads better on the background. */
export function readableOn(hex: string): '#1A1A2E' | '#FFFFFF' {
  const [r, g, b] = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#1A1A2E' : '#FFFFFF';
}

/* ── Order ── */

/** Indices (into `current`) that already sit in their right place. */
export function orderCorrectPositions(current: readonly string[], steps: readonly string[]): boolean[] {
  return current.map((s, i) => s === steps[i]);
}

export function isOrderCorrect(current: readonly string[], steps: readonly string[]): boolean {
  return current.length === steps.length && current.every((s, i) => s === steps[i]);
}

export function swap<T>(items: readonly T[], i: number, j: number): T[] {
  const out = [...items];
  if (i < 0 || j < 0 || i >= out.length || j >= out.length) return out;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/* ── Spell ── */

/** Normalise a word for comparison (case-insensitive, trimmed). */
export function normWord(word: string): string {
  return word.trim().toLocaleUpperCase();
}

/** The letters a child places (spaces are fixed gaps, not tiles). */
export function spellLetters(word: string): string[] {
  return Array.from(normWord(word)).filter((c) => c !== ' ');
}

/* ── Pairs ── */

export interface PairCard {
  id: number;
  pairId: number;
  text: string;
}

export function buildPairDeck(pairs: readonly [string, string][], rng: Rng = Math.random): PairCard[] {
  const cards = pairs.flatMap(([a, b], pairId) => [
    { pairId, text: a },
    { pairId, text: b },
  ]);
  return shuffle(cards, rng).map((c, id) => ({ ...c, id }));
}

/* ── Dig ── */

/**
 * How many tiles to uncover after one answer: a right answer clears a full
 * share of the grid, a "not yet" still brushes away one tile.
 */
export function digTilesFor(right: boolean, tileCount: number, itemCount: number): number {
  const share = Math.ceil(tileCount / Math.max(1, itemCount));
  return right ? share : Math.min(1, share);
}

/* ── Slide puzzle ── */

/** Solved board: 1..n²-1 then 0 (the hole). */
export function solvedBoard(size: number): number[] {
  return Array.from({ length: size * size }, (_, i) => (i === size * size - 1 ? 0 : i + 1));
}

export function isSolved(board: readonly number[]): boolean {
  return board.every((v, i) => (i === board.length - 1 ? v === 0 : v === i + 1));
}

/** Cells next to `index` (no wrapping). */
export function neighbours(index: number, size: number): number[] {
  const r = Math.floor(index / size);
  const c = index % size;
  const out: number[] = [];
  if (r > 0) out.push(index - size);
  if (r < size - 1) out.push(index + size);
  if (c > 0) out.push(index - 1);
  if (c < size - 1) out.push(index + 1);
  return out;
}

/** Slide the tile at `index` into the hole; null when it is not next to it. */
export function moveTile(board: readonly number[], size: number, index: number): number[] | null {
  const hole = board.indexOf(0);
  if (!neighbours(hole, size).includes(index)) return null;
  const out = [...board];
  out[hole] = out[index];
  out[index] = 0;
  return out;
}

/** Classic inversion-parity test for an n×n sliding puzzle. */
export function isSolvable(board: readonly number[], size: number): boolean {
  const tiles = board.filter((v) => v !== 0);
  let inversions = 0;
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) if (tiles[i] > tiles[j]) inversions++;
  }
  if (size % 2 === 1) return inversions % 2 === 0;
  const holeRowFromBottom = size - Math.floor(board.indexOf(0) / size);
  return (inversions + holeRowFromBottom) % 2 === 1;
}

/**
 * Shuffle by random legal moves from the solved board, so it is always
 * solvable. Returns the board and the trail of hole positions (start → now),
 * which lets "help" walk back towards the solution.
 */
export function shuffleBoard(size: number, moves: number, rng: Rng = Math.random): { board: number[]; trail: number[] } {
  let board = solvedBoard(size);
  let trail = [board.indexOf(0)];
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let m = 0; m < moves; m++) {
      const hole = board.indexOf(0);
      const prev = trail.length > 1 ? trail[trail.length - 2] : -1;
      const options = neighbours(hole, size).filter((n) => n !== prev);
      const pick = options[Math.floor(rng() * options.length)];
      board = moveTile(board, size, pick) ?? board;
      trail = stepTrail(trail, pick);
    }
    if (!isSolved(board)) break;
  }
  return { board, trail };
}

/** Record that the hole moved to `newHole`, folding back-and-forth moves. */
export function stepTrail(trail: readonly number[], newHole: number): number[] {
  if (trail.length > 1 && trail[trail.length - 2] === newHole) return trail.slice(0, -1);
  return [...trail, newHole];
}

/** The tile index that "help" should slide (walks the trail back), or null if solved. */
export function helpMove(trail: readonly number[]): number | null {
  return trail.length > 1 ? trail[trail.length - 2] : null;
}

/** Shuffle length per size. */
export function slideShuffleMoves(size: number): number {
  return size <= 3 ? 24 : 40;
}

/** Gentle "extra moves" count: every size² moves beyond twice the shuffle is one, capped at 5. */
export function slideMistakes(moves: number, size: number): number {
  const budget = 2 * slideShuffleMoves(size);
  return Math.min(5, Math.floor(Math.max(0, moves - budget) / (size * size)));
}

/* ── Melody ── */

/** C major pentatonic, C5 → A5. */
export const PENTATONIC_HZ = [523.25, 587.33, 659.25, 783.99, 880.0] as const;

/** Clamp note indices into the 5 pads. */
export function cleanSequence(seq: readonly number[]): number[] {
  return seq.map((n) => ((Math.round(n) % 5) + 5) % 5);
}

/** Keyboard: 1–5 / arrow keys to a lane or pad index. */
export function clampIndex(i: number, length: number): number {
  return Math.max(0, Math.min(length - 1, i));
}

/* ── Runner ── */

/** Fit a question into 2–4 lanes, always keeping the right answer. */
export function runnerLanes(options: readonly string[], answer: number, maxLanes = 4): { options: string[]; answer: number } {
  const safeAnswer = clampIndex(answer, options.length);
  if (options.length <= maxLanes) return { options: [...options], answer: safeAnswer };
  const keep = options.map((_, i) => i).filter((i) => i !== safeAnswer).slice(0, maxLanes - 1);
  // Put the answer back where it would naturally sit among the kept ones.
  const idx = [...keep, safeAnswer].sort((a, b) => a - b);
  return { options: idx.map((i) => options[i]), answer: idx.indexOf(safeAnswer) };
}

/**
 * TV spatial navigation: where ↑ → ↓ ← move the focus.
 *
 * The engine is Rust compiled to WebAssembly (rust/ziggy-tv-nav, loaded only
 * on TVs, see wasm-nav.ts). This is the same algorithm in TypeScript, used
 * for the very first key presses while the WebAssembly loads, and as a
 * fallback if it cannot load. A test keeps both identical.
 *
 * Scoring ported from Norigin Spatial Navigation (MIT, © 2022 NoriginMedia):
 * cut-off at the edge being left, "adjacent slice" (20 % overlap) preferred,
 * priority = (5 × main + other + 1) / (5 if adjacent), inside the row first,
 * then the row as a whole, with each row's last focused child restored.
 * See the crate for the details and Ziggy's additions.
 */

export type Dir = 'up' | 'right' | 'down' | 'left';
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Direction codes shared with the WebAssembly engine. */
export const DIR_CODE: Record<Dir, number> = { up: 0, right: 1, down: 2, left: 3 };

export const BOUNDARY_UP = 1;
export const BOUNDARY_RIGHT = 2;
export const BOUNDARY_DOWN = 4;
export const BOUNDARY_LEFT = 8;
export const WRAP_X = 16;
export const WRAP_Y = 32;

const BOUNDARY: Record<Dir, number> = { up: BOUNDARY_UP, right: BOUNDARY_RIGHT, down: BOUNDARY_DOWN, left: BOUNDARY_LEFT };
const vertical = (d: Dir) => d === 'up' || d === 'down';
const right = (r: Box) => r.x + r.w;
const bottom = (r: Box) => r.y + r.h;
const cx = (r: Box) => r.x + r.w / 2;
const cy = (r: Box) => r.y + r.h / 2;

function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(right(a), right(b)) - x, h: Math.max(bottom(a), bottom(b)) - y };
}

/** Norigin's "ref corners": [coordinate along the move, slice start, slice end]. */
function edge(r: Box, dir: Dir, sibling: boolean): [number, number, number] {
  switch (dir) {
    case 'up':
      return [sibling ? bottom(r) : r.y, r.x, right(r)];
    case 'down':
      return [sibling ? r.y : bottom(r), r.x, right(r)];
    case 'right':
      return [sibling ? r.x : right(r), r.y, bottom(r)];
    case 'left':
      return [sibling ? right(r) : r.x, r.y, bottom(r)];
  }
}

/** Is `to` past the edge of `from` (a little overlap forgiven for the 1.06 focus scale)? */
export function isAhead(from: Box, to: Box, dir: Dir): boolean {
  const [cut] = edge(from, dir, false);
  const [side] = edge(to, dir, true);
  const ext = vertical(dir) ? Math.min(from.h, to.h) : Math.min(from.w, to.w);
  const tol = 1 + 0.04 * Math.max(0, ext);
  switch (dir) {
    case 'down':
      return side >= cut - tol && cy(to) > cy(from);
    case 'up':
      return side <= cut + tol && cy(to) < cy(from);
    case 'right':
      return side >= cut - tol && cx(to) > cx(from);
    case 'left':
      return side <= cut + tol && cx(to) < cx(from);
  }
}

function adjacentSlice(from: Box, to: Box, dir: Dir): boolean {
  const [, u, c] = edge(from, dir, false);
  const [, l, d] = edge(to, dir, true);
  const overlap = Math.max(0, Math.min(c, d) - Math.max(u, l));
  const size = Math.max(0, Math.min(c - u, d - l));
  return size > 0 && overlap >= 0.2 * size;
}

/** How good a move is (lower is better); null when `to` is not that way. */
export function priority(from: Box, to: Box, dir: Dir): number | null {
  if (!isAhead(from, to, dir)) return null;
  const [cp, u, c] = edge(from, dir, false);
  const [sp, l, d] = edge(to, dir, true);
  const primary = Math.abs(sp - cp);
  const secondary = Math.min(Math.abs(l - u), Math.abs(l - c), Math.abs(d - u), Math.abs(d - c));
  const adjacent = adjacentSlice(from, to, dir);
  const [main, other] = adjacent ? [primary, secondary] : [secondary, primary];
  return (5 * main + other + 1) / (adjacent ? 5 : 1);
}

function bestOf(rects: Box[], from: Box, dir: Dir, keep: (i: number) => boolean): number {
  let best = -1;
  let bestP = Infinity;
  for (let i = 0; i < rects.length; i++) {
    if (!keep(i)) continue;
    const p = priority(from, rects[i], dir);
    if (p !== null && p < bestP) {
      bestP = p;
      best = i;
    }
  }
  return best;
}

function groupRect(rects: Box[], groups: ArrayLike<number>, g: number): Box | null {
  let r: Box | null = null;
  for (let i = 0; i < rects.length; i++) if (groups[i] === g) r = r ? union(r, rects[i]) : rects[i];
  return r;
}

function farEnd(rects: Box[], groups: ArrayLike<number>, g: number, current: number, dir: Dir): number {
  const cur = rects[current];
  let best = -1;
  let bk: [number, number] = [Infinity, Infinity];
  for (let i = 0; i < rects.length; i++) {
    if (i === current || groups[i] !== g) continue;
    const r = rects[i];
    const key: [number, number] =
      dir === 'right'
        ? [r.x, Math.abs(cy(r) - cy(cur))]
        : dir === 'left'
          ? [-right(r), Math.abs(cy(r) - cy(cur))]
          : dir === 'down'
            ? [r.y, Math.abs(cx(r) - cx(cur))]
            : [-bottom(r), Math.abs(cx(r) - cx(cur))];
    if (best < 0 || key[0] < bk[0] - 0.5 || (Math.abs(key[0] - bk[0]) <= 0.5 && key[1] < bk[1])) {
      best = i;
      bk = key;
    }
  }
  return best;
}

function enter(rects: Box[], groups: ArrayLike<number>, memory: ArrayLike<number>, h: number, cur: Box, dir: Dir): number {
  const m = h < memory.length ? memory[h] : -1;
  if (m >= 0 && m < rects.length && groups[m] === h) return m;
  const b = bestOf(rects, cur, dir, (i) => groups[i] === h);
  if (b >= 0) return b;
  let near = -1;
  let nd = Infinity;
  for (let i = 0; i < rects.length; i++) {
    if (groups[i] !== h) continue;
    const d = (cx(rects[i]) - cx(cur)) ** 2 + (cy(rects[i]) - cy(cur)) ** 2;
    if (d < nd) {
      nd = d;
      near = i;
    }
  }
  return near;
}

/**
 * Index of the element to focus from `current` in `dir`, or -1 to stay.
 * `groups[i]`: row/section id of element i (0 = none); `flags[g]`: BOUNDARY_*
 * and WRAP_* bits of group g; `memory[g]`: last focused child of g, or -1.
 */
export function nextFocus(rects: Box[], groups: ArrayLike<number>, current: number, dir: Dir, flags: ArrayLike<number> = [], memory: ArrayLike<number> = []): number {
  if (current < 0 || current >= rects.length || groups.length !== rects.length) return -1;
  const cur = rects[current];
  const g = groups[current];
  let from = cur;
  if (g !== 0) {
    const inRow = bestOf(rects, cur, dir, (i) => i !== current && groups[i] === g);
    if (inRow >= 0) return inRow;
    const f = g < flags.length ? flags[g] : 0;
    if (f & (vertical(dir) ? WRAP_Y : WRAP_X)) return farEnd(rects, groups, g, current, dir);
    if (f & BOUNDARY[dir]) return -1;
    from = groupRect(rects, groups, g) ?? cur;
  }
  let best = -1;
  let bestP = Infinity;
  let bestGroup = 0;
  for (let i = 0; i < rects.length; i++) {
    if (i === current || groups[i] !== 0) continue;
    const p = priority(from, rects[i], dir);
    if (p !== null && p < bestP) {
      bestP = p;
      best = i;
      bestGroup = 0;
    }
  }
  const seen = new Set<number>();
  for (let i = 0; i < rects.length; i++) {
    const h = groups[i];
    if (h === 0 || h === g || seen.has(h)) continue;
    seen.add(h);
    const r = groupRect(rects, groups, h);
    const p = r ? priority(from, r, dir) : null;
    if (p !== null && p < bestP) {
      bestP = p;
      best = i;
      bestGroup = h;
    }
  }
  if (best < 0) return -1;
  return bestGroup === 0 ? best : enter(rects, groups, memory, bestGroup, cur, dir);
}

/** A next-focus function: the TypeScript one, or the WebAssembly one once loaded. */
export type NextFocusFn = typeof nextFocus;

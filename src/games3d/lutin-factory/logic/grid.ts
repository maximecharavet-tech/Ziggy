/**
 * Grid model: directions, cells, and pure layout edits (place, remove,
 * rotate, set a dial). Every edit returns a NEW layout (immutable), so undo
 * is a plain history of layouts (see history.ts).
 */
import { DIRS, type Cell, type Dial, type Dir, type Layout, type Piece, type Rel } from './types';
import { getMachine } from './machines/registry';

/* ---------- directions ---------- */

export const DELTA: Record<Dir, readonly [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

export const cw = (d: Dir): Dir => DIRS[(DIRS.indexOf(d) + 1) % 4];
export const ccw = (d: Dir): Dir => DIRS[(DIRS.indexOf(d) + 3) % 4];
export const opposite = (d: Dir): Dir => DIRS[(DIRS.indexOf(d) + 2) % 4];

/** Absolute direction of a side of a machine facing `facing`. */
export function relToDir(facing: Dir, rel: Rel): Dir {
  switch (rel) {
    case 'front':
      return facing;
    case 'left':
      return ccw(facing);
    case 'right':
      return cw(facing);
    case 'back':
      return opposite(facing);
  }
}

/** Which side of a machine facing `facing` lies in absolute direction `d`. */
export function dirToRel(facing: Dir, d: Dir): Rel {
  if (d === facing) return 'front';
  if (d === ccw(facing)) return 'left';
  if (d === cw(facing)) return 'right';
  return 'back';
}

export const step = (c: Cell, d: Dir): Cell => [c[0] + DELTA[d][0], c[1] + DELTA[d][1]];
export const key = (c: Cell): string => `${c[0]},${c[1]}`;
export const sameCell = (a: Cell, b: Cell): boolean => a[0] === b[0] && a[1] === b[1];

export function inGrid(l: Pick<Layout, 'w' | 'h'>, c: Cell): boolean {
  return Number.isInteger(c[0]) && Number.isInteger(c[1]) && c[0] >= 0 && c[1] >= 0 && c[0] < l.w && c[1] < l.h;
}

export function isBlocked(l: Layout, c: Cell): boolean {
  return (l.blocked ?? []).some((b) => sameCell(b, c));
}

/**
 * Coordinates as the dispatch hall prints them on the sleigh bays: column
 * letter + row number, "A1" is the top-left tile.
 */
export function cellLabel(c: Cell): string {
  return `${String.fromCharCode(65 + c[0])}${c[1] + 1}`;
}

/* ---------- queries ---------- */

export function pieceAt(l: Layout, c: Cell): Piece | undefined {
  return l.pieces.find((p) => sameCell(p.at, c));
}

export const isDialLocked = (p: Piece): boolean => p.dialLocked ?? p.locked ?? false;

/* ---------- edits ---------- */

export type EditRefusal = 'outside' | 'blocked' | 'occupied' | 'locked' | 'dial-locked' | 'unknown-machine' | 'bad-dial' | 'empty';
export type EditResult = { ok: true; layout: Layout } | { ok: false; why: EditRefusal };

const replacePieces = (l: Layout, pieces: Piece[]): Layout => ({ ...l, pieces });

/** Put a machine on a free tile (its dial is validated / defaulted by the plug-in). */
export function place(l: Layout, piece: Piece): EditResult {
  if (!inGrid(l, piece.at)) return { ok: false, why: 'outside' };
  if (isBlocked(l, piece.at)) return { ok: false, why: 'blocked' };
  if (pieceAt(l, piece.at)) return { ok: false, why: 'occupied' };
  const def = getMachine(piece.machine);
  if (!def) return { ok: false, why: 'unknown-machine' };
  const dial = def.dial.parse(piece.dial ?? {});
  if (!dial) return { ok: false, why: 'bad-dial' };
  const clean: Piece = { machine: piece.machine, at: [piece.at[0], piece.at[1]], dir: piece.dir, dial };
  if (piece.locked) clean.locked = true;
  if (piece.dialLocked !== undefined) clean.dialLocked = piece.dialLocked;
  return { ok: true, layout: replacePieces(l, [...l.pieces, clean]) };
}

export function remove(l: Layout, at: Cell): EditResult {
  const p = pieceAt(l, at);
  if (!p) return { ok: false, why: 'empty' };
  if (p.locked) return { ok: false, why: 'locked' };
  return { ok: true, layout: replacePieces(l, l.pieces.filter((q) => q !== p)) };
}

/** Turn a machine a quarter turn clockwise (the ↻ button). */
export function rotate(l: Layout, at: Cell, times = 1): EditResult {
  const p = pieceAt(l, at);
  if (!p) return { ok: false, why: 'empty' };
  if (p.locked) return { ok: false, why: 'locked' };
  let dir = p.dir;
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) dir = cw(dir);
  return { ok: true, layout: replacePieces(l, l.pieces.map((q) => (q === p ? { ...q, dir } : q))) };
}

export function setDir(l: Layout, at: Cell, dir: Dir): EditResult {
  const p = pieceAt(l, at);
  if (!p) return { ok: false, why: 'empty' };
  if (p.locked) return { ok: false, why: 'locked' };
  return { ok: true, layout: replacePieces(l, l.pieces.map((q) => (q === p ? { ...q, dir } : q))) };
}

export function setDial(l: Layout, at: Cell, dial: Dial): EditResult {
  const p = pieceAt(l, at);
  if (!p) return { ok: false, why: 'empty' };
  if (isDialLocked(p)) return { ok: false, why: 'dial-locked' };
  const def = getMachine(p.machine);
  const clean = def?.dial.parse(dial);
  if (!clean) return { ok: false, why: 'bad-dial' };
  return { ok: true, layout: replacePieces(l, l.pieces.map((q) => (q === p ? { ...q, dial: clean } : q))) };
}

/**
 * Belt auto-connect (fewer taps for little hands): the direction a new belt
 * at `at` should face. Prefers continuing a belt or machine that feeds into
 * this tile, then pointing at a neighbour that can take an item from here.
 */
export function autoBeltDir(l: Layout, at: Cell): Dir {
  // 1. A neighbour pointing at us: keep its flow going straight.
  for (const d of DIRS) {
    const n = pieceAt(l, step(at, d));
    if (n && n.dir === opposite(d)) return opposite(d);
  }
  // 2. A neighbour that accepts items from our side (a machine or a sack).
  for (const d of DIRS) {
    const n = pieceAt(l, step(at, d));
    if (!n) continue;
    const def = getMachine(n.machine);
    if (def && def.accepts(dirToRel(n.dir, opposite(d)))) return d;
  }
  return 'E';
}

export function emptyLayout(w: number, h: number, blocked: Cell[] = []): Layout {
  return { w, h, blocked: blocked.map((c) => [c[0], c[1]] as const), pieces: [] };
}

/** Deep, normalised copy (pieces sorted by row then column) for stable comparison. */
export function normalizeLayout(l: Layout): Layout {
  const pieces = l.pieces
    .map((p) => ({ ...p, at: [p.at[0], p.at[1]] as const, dial: p.dial ? { ...p.dial } : undefined }))
    .sort((a, b) => a.at[1] - b.at[1] || a.at[0] - b.at[0]);
  return { w: l.w, h: l.h, blocked: (l.blocked ?? []).map((c) => [c[0], c[1]] as const), pieces };
}

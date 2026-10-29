/**
 * Le Grand Huit des Nombres (The Number Coaster) — pure logic: no three.js,
 * no DOM.
 *
 * A ride is a number line drawn as a roller coaster. The cart starts at one
 * station and must stop right at the target station; the child builds the
 * path from rail pieces ("+3", "−1", "×2"). ANY path that ends on the target
 * is right. Stopping before or after it is never a failure: the cart does a
 * funny "boing", Ziggy shows the gap ("2 more!") and the child adjusts.
 *
 * Everything is decided here (seeded, by age band and level), the scene only
 * animates it.
 */
import type { L } from '@/lib/i18n-text';
import { rng } from '../kit/rng';

export type Band = 'little' | 'middle' | 'big';

export const GAME_ID = 'grand-huit';
export const RIDES_PER_GAME = 5;

export type CoasterSkill = 'counting' | 'addition' | 'subtraction' | 'multiplication' | 'sequencing';
export const COASTER_SKILLS: readonly CoasterSkill[] = ['counting', 'addition', 'subtraction', 'multiplication', 'sequencing'];

/* ───────────────────────── Rail pieces ───────────────────────── */

export type OpKind = 'add' | 'sub' | 'mul';
export interface Op {
  kind: OpKind;
  n: number;
}

const add = (n: number): Op => ({ kind: 'add', n });
const sub = (n: number): Op => ({ kind: 'sub', n });
const mul = (n: number): Op => ({ kind: 'mul', n });

export const applyOp = (v: number, op: Op): number => (op.kind === 'add' ? v + op.n : op.kind === 'sub' ? v - op.n : v * op.n);
export const opKey = (op: Op) => `${op.kind}${op.n}`;
export const sameOp = (a: Op, b: Op) => a.kind === b.kind && a.n === b.n;

/** Value after riding these pieces from `start`. */
export function valueAfter(start: number, ops: readonly Op[]): number {
  return ops.reduce(applyOp, start);
}

/** Every station the cart stops at: [start, after piece 1, after piece 2…]. */
export function stopsOf(start: number, ops: readonly Op[]): number[] {
  const out = [start];
  for (const op of ops) out.push(applyOp(out[out.length - 1], op));
  return out;
}

/** "+3", "−1" (a real minus sign), "×2". */
export function opLabel(op: Op): string {
  return `${op.kind === 'add' ? '+' : op.kind === 'sub' ? '−' : '×'}${op.n}`;
}

/** How a piece is read aloud. */
export function opSpoken(op: Op, locale: string): string {
  const fr = locale === 'fr';
  if (op.kind === 'add') return `${fr ? 'plus' : 'plus'} ${op.n}`;
  if (op.kind === 'sub') return `${fr ? 'moins' : 'minus'} ${op.n}`;
  return `${fr ? 'fois' : 'times'} ${op.n}`;
}

/* ───────────────────────── Rides ───────────────────────── */

export type RideKind = 'hops' | 'compare' | 'sum' | 'minus' | 'sequence' | 'missing' | 'times' | 'chain';

export interface Ride {
  kind: RideKind;
  skill: CoasterSkill;
  /** Departure station. */
  start: number;
  /** The station where the cart must stop. */
  target: number;
  /** Pieces already on the track (a pattern to continue, the start of the path). */
  preset: Op[];
  /** The rail pieces the child can add (each one as often as wanted). */
  palette: Op[];
  /** How many pieces the child may add (the preset is not counted). */
  slots: number;
  /** The number line shown runs from 0 to `max`. */
  max: number;
  /** The target stays a "?" until the cart gets there (compare, patterns). */
  hidden: boolean;
  /** compare: pick the bigger or the smaller number. */
  compare?: 'more' | 'less';
  /** One tap on a piece launches the ride (one-step rides for little ones). */
  autoLaunch: boolean;
  /** One known solution (pieces after the preset). */
  solution: Op[];
  level: number;
}

const KINDS: Record<Band, RideKind[]> = {
  little: ['hops', 'hops', 'compare', 'hops', 'compare'],
  middle: ['sum', 'sequence', 'missing', 'minus', 'sum'],
  big: ['times', 'chain', 'sequence', 'chain', 'chain'],
};

/** Longest number line per band (the line must stay readable). */
export const LINE_CAP: Record<Band, number> = { little: 10, middle: 30, big: 50 };

type R = () => number;
const between = (lo: number, hi: number, r: R) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T>(arr: readonly T[], r: R): T => arr[Math.floor(r() * arr.length)];
function shuffle<T>(arr: readonly T[], r: R): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const byValue = (a: Op, b: Op) => (a.kind === b.kind ? a.n - b.n : 'asm'.indexOf(a.kind[0]) - 'asm'.indexOf(b.kind[0]));
const ceil5 = (n: number) => Math.ceil(n / 5) * 5;
const clampLevel = (level: number) => Math.max(1, Math.min(5, Math.floor(Number.isFinite(level) ? level : 1)));

/** A line long enough for every station the ride needs (and a little more), capped per band. */
function lineFor(band: Band, values: number[]): number {
  if (band === 'little') return 10;
  const top = Math.max(...values);
  return Math.max(10, top, Math.min(LINE_CAP[band], ceil5(top + 2)));
}

/** Can the child add this piece now? (room left, stays on the line, really moves). */
export function canAdd(ride: Ride, path: readonly Op[], op: Op): boolean {
  if (path.length >= ride.slots) return false;
  const v = valueAfter(ride.start, [...ride.preset, ...path]);
  const w = applyOp(v, op);
  return w !== v && w >= 0 && w <= ride.max;
}

export interface Verdict {
  reached: number;
  ok: boolean;
  /** target − reached: > 0 the cart stopped before the station, < 0 after. */
  gap: number;
}

export function checkPath(ride: Ride, path: readonly Op[]): Verdict {
  const reached = valueAfter(ride.start, [...ride.preset, ...path]);
  return { reached, ok: reached === ride.target, gap: ride.target - reached };
}

/** Shortest list of pieces from a value to the target, within `slots` pieces (breadth-first). */
function shortest(from: number, target: number, palette: readonly Op[], slots: number, max: number): Op[] | null {
  if (from === target) return [];
  let frontier: { v: number; ops: Op[] }[] = [{ v: from, ops: [] }];
  const seen = new Set([from]);
  for (let depth = 0; depth < slots; depth++) {
    const next: { v: number; ops: Op[] }[] = [];
    for (const f of frontier)
      for (const op of palette) {
        const w = applyOp(f.v, op);
        if (w < 0 || w > max || seen.has(w)) continue;
        const ops = [...f.ops, op];
        if (w === target) return ops;
        seen.add(w);
        next.push({ v: w, ops });
      }
    frontier = next;
  }
  return null;
}

/** The shortest way to finish from the current path, or null if the path must change first. */
export function solve(ride: Ride, path: readonly Op[]): Op[] | null {
  const v = valueAfter(ride.start, [...ride.preset, ...path]);
  return shortest(v, ride.target, ride.palette, ride.slots - path.length, ride.max);
}

export type Hint = { kind: 'piece'; op: Op } | { kind: 'undo' } | null;

/** A gentle hint: the next good piece, or "undo" when the path went the wrong way. */
export function nextHint(ride: Ride, path: readonly Op[]): Hint {
  const s = solve(ride, path);
  if (s && s.length) return { kind: 'piece', op: s[0] };
  if (s) return null; // already right
  return path.length ? { kind: 'undo' } : null;
}

/* ── Builders, one per kind of ride ── */

function hops(r: R, lv: number, index: number): Ride {
  const onlyOnes = lv <= 1 && index === 0;
  const target = onlyOnes ? between(2, 5, r) : lv <= 1 ? between(4, 8, r) : between(5, 10, r);
  const start = lv >= 2 && index === 3 ? between(1, 3, r) : 0;
  const palette = onlyOnes ? [add(1)] : [add(1), add(2)];
  const d = target - start;
  const solution = onlyOnes ? Array.from({ length: d }, () => add(1)) : [...Array.from({ length: Math.floor(d / 2) }, () => add(2)), ...(d % 2 ? [add(1)] : [])];
  return { kind: 'hops', skill: 'counting', start, target, preset: [], palette, slots: 10, max: 10, hidden: false, autoLaunch: false, solution, level: lv };
}

function compare(r: R, lv: number, index: number): Ride {
  const top = lv <= 1 ? 6 : 10;
  const a = between(1, top, r);
  let b = between(1, top, r);
  while (Math.abs(a - b) < 2) b = between(1, top, r);
  const mode: 'more' | 'less' = lv >= 2 && index === 4 ? 'less' : 'more';
  const target = mode === 'more' ? Math.max(a, b) : Math.min(a, b);
  return {
    kind: 'compare',
    skill: 'counting',
    start: 0,
    target,
    preset: [],
    palette: shuffle([add(a), add(b)], r),
    slots: 1,
    max: 10,
    hidden: true,
    compare: mode,
    autoLaunch: true,
    solution: [add(target)],
    level: lv,
  };
}

/** Random pieces from `pool` (with repeats) that keep every stop between 0 and `cap`. */
function walk(r: R, start: number, pool: readonly Op[], n: number, cap: number): Op[] | null {
  const ops: Op[] = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    const ok = pool.filter((op) => {
      const w = applyOp(v, op);
      return w !== v && w >= 0 && w <= cap;
    });
    if (!ok.length) return null;
    const op = pick(ok, r);
    ops.push(op);
    v = applyOp(v, op);
  }
  return ops;
}

function sum(r: R, lv: number): Ride | null {
  const pal = (lv <= 1 ? [1, 2, 5] : lv === 2 ? [1, 2, 3, 5] : [2, 3, 5, 10]).map(add);
  const cap = lv <= 1 ? 15 : lv === 2 ? 20 : 30;
  const start = between(0, lv <= 1 ? 5 : 8, r);
  const solution = walk(r, start, pal, lv <= 1 ? 2 : between(2, 3, r), cap);
  if (!solution) return null;
  const target = valueAfter(start, solution);
  // A real journey: never one single piece away from the start.
  if ((shortest(start, target, pal, 4, cap)?.length ?? 0) < 2) return null;
  return { kind: 'sum', skill: 'addition', start, target, preset: [], palette: pal, slots: 4, max: lineFor('middle', [start, target, cap]), hidden: false, autoLaunch: false, solution, level: lv };
}

function minus(r: R, lv: number): Ride | null {
  const pal = (lv <= 2 ? [1, 2, 5] : [1, 2, 5, 10]).map(sub);
  const start = between(lv <= 1 ? 8 : 12, lv <= 1 ? 12 : lv === 2 ? 20 : 30, r);
  const solution = walk(r, start, pal, lv >= 3 ? between(2, 3, r) : 2, start);
  if (!solution) return null;
  const target = valueAfter(start, solution);
  if ((shortest(start, target, pal, 4, start)?.length ?? 0) < 2) return null;
  return { kind: 'minus', skill: 'subtraction', start, target, preset: [], palette: pal, slots: 4, max: lineFor('middle', [start]), hidden: false, autoLaunch: false, solution, level: lv };
}

/** Three pieces of the same kind around the right one (n−1, n+1, n+2…), all different stops. */
function around(right: Op, r: R, fits: (op: Op) => boolean = () => true): Op[] {
  const cands = [right.n - 1, right.n + 1, right.n + 2, right.n - 2].filter((n) => n >= 1 && fits({ kind: right.kind, n }));
  const two = shuffle(cands, r).slice(0, 2);
  return [right, ...two.map((n) => ({ kind: right.kind, n }))].sort(byValue);
}

function sequenceMiddle(r: R, lv: number): Ride {
  const step = lv <= 1 ? 2 : pick(lv === 2 ? [2, 3, 5] : [3, 4, 5, 10], r);
  const start = lv <= 2 ? step * between(0, 2, r) : between(0, Math.max(0, Math.min(6, 26 - 3 * step)), r);
  const right = add(step);
  const preset = [add(step), add(step)];
  const end = valueAfter(start, preset);
  const target = end + step;
  const palette = around(right, r, (op) => applyOp(end, op) <= LINE_CAP.middle);
  return {
    kind: 'sequence',
    skill: 'sequencing',
    start,
    target,
    preset,
    palette,
    slots: 1,
    max: lineFor('middle', [target, ...palette.map((op) => applyOp(end, op))]),
    hidden: true,
    autoLaunch: false,
    solution: [right],
    level: lv,
  };
}

function missing(r: R, lv: number): Ride {
  const start = between(1, 8, r);
  const first = add(between(2, 6, r));
  const mid = applyOp(start, first);
  const back = lv >= 3 && r() < 0.5;
  const right = back ? sub(between(2, Math.min(5, mid - 1), r)) : add(between(2, 6, r));
  const target = applyOp(mid, right);
  const palette = around(right, r, (op) => applyOp(mid, op) >= 0);
  return {
    kind: 'missing',
    skill: back ? 'subtraction' : 'addition',
    start,
    target,
    preset: [first],
    palette,
    slots: 1,
    max: lineFor('middle', [target, mid, ...palette.map((op) => applyOp(mid, op))]),
    hidden: false,
    autoLaunch: false,
    solution: [right],
    level: lv,
  };
}

function times(r: R, lv: number): Ride | null {
  if (lv <= 2) {
    const pal = (lv <= 1 ? [2, 3, 5] : [2, 3, 4, 5]).map(mul);
    const start = between(2, lv <= 1 ? 5 : 6, r);
    const right = pick(pal, r);
    const target = applyOp(start, right);
    return { kind: 'times', skill: 'multiplication', start, target, preset: [], palette: pal, slots: 1, max: lineFor('big', [target, ...pal.map((op) => applyOp(start, op))]), hidden: false, autoLaunch: false, solution: [right], level: lv };
  }
  const pal = [2, 3, 5].map(mul);
  const start = between(2, 3, r);
  const solution = walk(r, start, pal, 2, 50);
  if (!solution) return null;
  const target = valueAfter(start, solution);
  if ((shortest(start, target, pal, 2, 50)?.length ?? 0) < 2) return null;
  return { kind: 'times', skill: 'multiplication', start, target, preset: [], palette: pal, slots: 2, max: lineFor('big', [target]), hidden: false, autoLaunch: false, solution, level: lv };
}

function chain(r: R, lv: number, steps: number): Ride | null {
  const muls = (lv >= 4 ? [2, 3, 4, 5] : [2, 3, 5]).map(mul);
  const adds = (lv <= 2 ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 10]).map(add);
  const subs = (lv <= 2 ? [1, 2] : [1, 2, 3]).map(sub);
  const start = between(1, 9, r);
  const solution: Op[] = [];
  let v = start;
  for (let i = 0; i < steps; i++) {
    const wantMul = i === steps - 1 && !solution.some((o) => o.kind === 'mul') ? true : r() < 0.5;
    const pool = wantMul ? muls : r() < 0.75 || lv <= 1 ? adds : subs;
    const ok = pool.filter((op) => {
      const w = applyOp(v, op);
      return w !== v && w >= 0 && w <= 50 && !solution.some((s) => sameOp(s, op));
    });
    if (!ok.length) return null;
    const op = pick(ok, r);
    solution.push(op);
    v = applyOp(v, op);
  }
  const target = v;
  const extra = shuffle([...muls, ...adds, ...subs].filter((op) => !solution.some((s) => sameOp(s, op))), r);
  const palette = [...solution, ...extra.slice(0, (lv <= 3 ? 4 : 5) - solution.length)].sort(byValue);
  const max = lineFor('big', [start, ...stopsOf(start, solution)]);
  // A real chain: the target can't be reached with fewer pieces.
  if (shortest(start, target, palette, steps, max)?.length !== steps) return null;
  return { kind: 'chain', skill: 'multiplication', start, target, preset: [], palette, slots: steps, max, hidden: false, autoLaunch: false, solution, level: lv };
}

function sequenceBig(r: R, lv: number): Ride {
  const variant = lv <= 2 ? 'step' : lv === 3 ? pick(['step', 'double'] as const, r) : pick(['step', 'double', 'triple'] as const, r);
  let start: number;
  let right: Op;
  let palette: Op[];
  if (variant === 'double') {
    start = between(1, 6, r);
    right = mul(2);
    palette = [mul(2), add(start * 2), add(start)];
  } else if (variant === 'triple') {
    start = 1;
    right = mul(3);
    palette = [mul(3), mul(2), add(6)];
  } else {
    const k = between(3, lv <= 2 ? 6 : 9, r);
    start = between(1, Math.min(9, 40 - 3 * k), r);
    right = add(k);
    palette = [add(k - 1), add(k), add(k + 1)];
  }
  const preset = [right, right];
  const end = valueAfter(start, preset);
  const target = applyOp(end, right);
  palette = shuffle(palette, r).sort(byValue);
  return {
    kind: 'sequence',
    skill: 'sequencing',
    start,
    target,
    preset,
    palette,
    slots: 1,
    max: lineFor('big', [target, ...palette.map((op) => applyOp(end, op))]),
    hidden: true,
    autoLaunch: false,
    solution: [right],
    level: lv,
  };
}

function build(band: Band, lv: number, index: number, r: R): Ride | null {
  const kind = KINDS[band][index % KINDS[band].length];
  switch (kind) {
    case 'hops':
      return hops(r, lv, index);
    case 'compare':
      return compare(r, lv, index);
    case 'sum':
      return sum(r, lv);
    case 'minus':
      return minus(r, lv);
    case 'sequence':
      return band === 'big' ? sequenceBig(r, lv) : sequenceMiddle(r, lv);
    case 'missing':
      return missing(r, lv);
    case 'times':
      return times(r, lv);
    case 'chain':
      return chain(r, lv, index === 1 ? 2 : index === 3 ? (lv >= 3 ? 3 : 2) : lv >= 2 ? 3 : 2);
  }
}

export const rideKey = (ride: Ride) => `${ride.kind}:${ride.start}:${ride.target}`;

/**
 * The ride number `index` (0..4) of a game, decided locally and
 * deterministically (same seed → same ride), adapted to the age band and the
 * skill level. `avoid` lists rides already played in this game (no repeats).
 */
export function planRide(seed: number, band: Band, level: number, index: number, avoid: readonly string[] = []): Ride {
  const lv = clampLevel(level);
  let fallback: Ride | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const r = rng((Math.floor(seed) * 31 + index * 7919 + lv * 104729 + attempt * 15485863) >>> 0);
    const ride = build(band, lv, index, r);
    if (!ride) continue;
    fallback ??= ride;
    if (!avoid.includes(rideKey(ride))) return ride;
  }
  // Practically never: a gentle counting ride.
  return fallback ?? hops(rng(seed), 1, 1);
}

/** The five rides of a game at a fixed level (tests, previews). */
export function planGame(seed: number, band: Band, level: number): Ride[] {
  const out: Ride[] = [];
  for (let i = 0; i < RIDES_PER_GAME; i++) out.push(planRide(seed, band, level, i, out.map(rideKey)));
  return out;
}

/** The skill used to pick the starting level of a game, per band. */
export const LEAD_SKILL: Record<Band, CoasterSkill> = { little: 'counting', middle: 'addition', big: 'multiplication' };

/* ───────────────────────── Words ───────────────────────── */

const seqShown = (ride: Ride) => stopsOf(ride.start, ride.preset);

/** The instruction, shown and read aloud. */
export function instruction(ride: Ride, locale: string): string {
  const fr = locale === 'fr';
  const { start: s, target: t } = ride;
  switch (ride.kind) {
    case 'hops':
      if (ride.palette.length === 1) return fr ? `Avance de 1 en 1 jusqu’à la gare ${t} !` : `Move 1 by 1 up to station ${t}!`;
      if (s > 0) return fr ? `Pars de ${s} et emmène Ziggy à la gare ${t} !` : `Start at ${s} and take Ziggy to station ${t}!`;
      return fr ? `Emmène Ziggy à la gare ${t} avec des bonds de rail !` : `Take Ziggy to station ${t} with rail hops!`;
    case 'compare': {
      const [a, b] = ride.palette.map((op) => op.n);
      if (ride.compare === 'less') return fr ? `Petit tour tranquille : choisis le plus petit nombre, ${a} ou ${b} ?` : `A gentle little ride: pick the smaller number, ${a} or ${b}?`;
      return fr ? `Quel wagon ira le plus loin ? Choisis le plus grand nombre : ${a} ou ${b} ?` : `Which ride goes furthest? Pick the bigger number: ${a} or ${b}?`;
    }
    case 'sum':
      return fr ? `Pars de ${s} et arrête-toi pile à la gare ${t} !` : `Start at ${s} and stop right at station ${t}!`;
    case 'minus':
      return fr ? `Marche arrière ! Pars de ${s} et recule jusqu’à la gare ${t}.` : `Reverse gear! Start at ${s} and roll back to station ${t}.`;
    case 'sequence': {
      const v = seqShown(ride);
      return fr ? `Continue la suite : ${v.join(', ')}… Quel rail vient ensuite ?` : `Continue the pattern: ${v.join(', ')}… Which rail comes next?`;
    }
    case 'missing':
      return fr ? `Il manque un rail ! ${s} ${opLabel(ride.preset[0])} ? = ${t}. Lequel ?` : `A rail is missing! ${s} ${opLabel(ride.preset[0])} ? = ${t}. Which one?`;
    case 'times':
      if (ride.slots === 1) return fr ? `Un rail magique pour aller de ${s} à la gare ${t} : lequel ?` : `One magic rail to go from ${s} to station ${t}: which one?`;
      return fr ? `Deux rails magiques pour aller de ${s} à la gare ${t} !` : `Two magic rails to go from ${s} to station ${t}!`;
    case 'chain':
      return fr ? `Enchaîne ${ride.slots} rails pour aller de ${s} à la gare ${t} !` : `Chain ${ride.slots} rails to go from ${s} to station ${t}!`;
  }
}

/** What is read aloud when a ride starts (the instruction, said the easy way). */
export function spokenLines(ride: Ride, locale: string): string[] {
  const fr = locale === 'fr';
  if (ride.kind === 'missing') {
    const p = opSpoken(ride.preset[0], locale);
    return [fr ? `Il manque un rail ! On part de ${ride.start}, on fait ${p}, et on doit arriver à ${ride.target}. Quel rail manque ?` : `A rail is missing! We start at ${ride.start}, go ${p}, and must reach ${ride.target}. Which rail is missing?`];
  }
  if (ride.kind === 'sequence') {
    const v = seqShown(ride);
    return [fr ? `Continue la suite : ${v.join(', ')}. Quel rail vient ensuite ?` : `Continue the pattern: ${v.join(', ')}. Which rail comes next?`];
  }
  if (ride.kind === 'hops') {
    const last = fr ? 'Puis appuie sur « C’est parti » !' : 'Then press “Let’s go”!';
    return [instruction(ride, locale), last];
  }
  return [instruction(ride, locale)];
}

/** The hint after the cart stopped at the wrong station (never a failure). */
export function missText(ride: Ride, path: readonly Op[], misses: number, locale: string): string {
  const fr = locale === 'fr';
  const { reached: r, gap } = checkPath(ride, path);
  const t = ride.target;
  let text: string;
  switch (ride.kind) {
    case 'compare': {
      const other = ride.palette.map((op) => op.n).find((n) => n !== r) ?? t;
      const more = ride.compare !== 'less';
      text = fr ? `${r} est plus ${more ? 'petit' : 'grand'} que ${other}. Essaie l’autre wagon !` : `${r} is ${more ? 'smaller' : 'bigger'} than ${other}. Try the other ride!`;
      return text;
    }
    case 'sequence': {
      const step = opLabel(ride.preset[0]);
      text = fr ? `Regarde les bonds : ${step}, ${step}… Le prochain est pareil !` : `Look at the hops: ${step}, ${step}… The next one is the same!`;
      return text;
    }
    case 'hops':
      text =
        gap > 0
          ? fr
            ? `Encore ${gap} ! Ajoute ${gap === 1 ? 'un bond' : 'des bonds'}.`
            : `${gap} more! Add ${gap === 1 ? 'a hop' : 'some hops'}.`
          : fr
            ? `Oups, ${-gap} de trop ! Enlève un bond avec « Annuler ».`
            : `Oops, ${-gap} too far! Remove a hop with “Undo”.`;
      break;
    case 'times':
    case 'chain':
      text = fr
        ? `Le wagon s’arrête à ${r}. La gare ${t} est ${gap > 0 ? 'plus loin' : 'avant'} : change un rail !`
        : `The cart stops at ${r}. Station ${t} is ${gap > 0 ? 'further on' : 'back a bit'}: change a rail!`;
      break;
    default:
      text =
        gap > 0
          ? fr
            ? `Le wagon s’arrête à ${r}. Encore ${gap} pour arriver à ${t} !`
            : `The cart stops at ${r}. ${gap} more to reach ${t}!`
          : fr
            ? `Le wagon s’arrête à ${r} : ${-gap} de trop ! Change un rail.`
            : `The cart stops at ${r}: ${-gap} too far! Change a rail.`;
  }
  if (misses >= 2) {
    const h = nextHint(ride, path);
    if (h?.kind === 'piece') text += fr ? ` Essaie le rail ${opLabel(h.op)} !` : ` Try the ${opLabel(h.op)} rail!`;
    else if (h?.kind === 'undo') text += fr ? ' Commence par « Annuler ».' : ' Start with “Undo”.';
  }
  return text;
}

/** Short label of the gap shown over the track: "+2", "−3". */
export function gapLabel(gap: number): string {
  return gap > 0 ? `+${gap}` : gap < 0 ? `−${-gap}` : '';
}

export const EMPTY_GO: L = { fr: 'Choisis d’abord un rail en bas !', en: 'Pick a rail at the bottom first!' };
export const FULL_PATH: L = { fr: 'Plus de place pour un rail : appuie sur « C’est parti » ou « Annuler ».', en: 'No room for another rail: press “Let’s go” or “Undo”.' };

export const PRAISE: L[] = [
  { fr: 'Pile à la gare ! Plouf !', en: 'Right on the station! Splash!' },
  { fr: 'Quel looping ! Bravo !', en: 'What a loop! Well done!' },
  { fr: 'Splash ! Tu es un as du grand huit !', en: 'Splash! You’re a roller coaster ace!' },
  { fr: 'Youpi ! En plein dans le bassin !', en: 'Yay! Straight into the pool!' },
  { fr: 'Génial ! Ziggy a adoré !', en: 'Brilliant! Ziggy loved it!' },
];

export function praiseFor(i: number, locale: string): string {
  const p = PRAISE[Math.abs(Math.floor(i)) % PRAISE.length];
  return locale === 'fr' ? p.fr : p.en;
}

/** Dots for little ones who don't read numbers yet (up to 10). */
export function dots(n: number): number {
  return Math.max(0, Math.min(10, Math.floor(n)));
}

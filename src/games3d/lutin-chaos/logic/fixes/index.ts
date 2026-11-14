/**
 * Fix mechanic registry. `makePuzzle` builds a puzzle, `checkAnswer` turns a
 * try into praise or help: level 1 = a nudge, level 2 = guided help, level 3+
 * = "let's do it together" with the answer revealed. The elf takes the blame.
 * There is no failure state.
 */
import type { Rng } from '../rand';
import { ELF_BLAME, PRAISE, UI } from '../texts';
import type { L } from '../types';
import { clockFix, type ClockPuzzle } from './clock';
import { countBack, type CountBackPuzzle } from './count-back';
import type { FixCtx, FixDef, Params } from './define';
import { nameItFix, type NameItPuzzle } from './name-it';
import { orderFix, type OrderPuzzle } from './order';
import { pairFix, type PairPuzzle } from './pair';
import { pathFix, type PathPuzzle } from './path';
import { patternFix, type PatternPuzzle } from './pattern';
import { placeFix, type PlacePuzzle } from './place';
import { rotateFix, type RotatePuzzle } from './rotate';
import { sortFix, type SortPuzzle } from './sort';

export type { FixCtx, BasePuzzle, RawCheck } from './define';
export type { CountBackPuzzle, SortPuzzle, PairPuzzle, OrderPuzzle, PatternPuzzle, PlacePuzzle, PathPuzzle, RotatePuzzle, NameItPuzzle, ClockPuzzle };

export type Puzzle = CountBackPuzzle | SortPuzzle | PairPuzzle | OrderPuzzle | PatternPuzzle | PlacePuzzle | PathPuzzle | RotatePuzzle | NameItPuzzle | ClockPuzzle;
export type FixId = Puzzle['fix'];

/** Type-erased plug-in (answers come from the UI as unknown). */
export interface AnyFix {
  id: FixId;
  label: L;
  icon: string;
  params: FixDef<Puzzle, unknown>['params'];
  goal: FixDef<Puzzle, unknown>['goal'];
  make(ctx: FixCtx): Puzzle;
  solve(p: Puzzle): unknown;
  isAnswer(a: unknown): boolean;
  rawCheck(p: Puzzle, a: unknown): ReturnType<FixDef<Puzzle, unknown>['check']>;
  wrong(p: Puzzle, rng: Rng): unknown;
}

function erase<P extends Puzzle, A>(d: FixDef<P, A>): AnyFix {
  return {
    id: d.id as FixId,
    label: d.label,
    icon: d.icon,
    params: d.params,
    goal: d.goal,
    make: (ctx) => d.make(ctx),
    solve: (p) => d.solve(p as P),
    isAnswer: (a) => d.isAnswer(a),
    rawCheck: (p, a) => (d.isAnswer(a) ? d.check(p as P, a) : { ok: false, hints: [], focus: [] }),
    wrong: (p, rng) => d.wrong(p as P, rng),
  };
}

export const FIXES: Record<FixId, AnyFix> = {
  'count-back': erase(countBack),
  sort: erase(sortFix),
  pair: erase(pairFix),
  order: erase(orderFix),
  pattern: erase(patternFix),
  place: erase(placeFix),
  path: erase(pathFix),
  rotate: erase(rotateFix),
  'name-it': erase(nameItFix),
  clock: erase(clockFix),
};
export const FIX_IDS = Object.keys(FIXES) as FixId[];
export const isFixId = (v: unknown): v is FixId => typeof v === 'string' && v in FIXES;

export function makePuzzle(fix: FixId, ctx: FixCtx): Puzzle {
  return FIXES[fix].make(ctx);
}

export type FixCheck =
  | { solved: true; praise: L }
  | {
      solved: false;
      /** 1 = nudge, 2 = guided, 3 = together (answer revealed). */
      level: 1 | 2 | 3;
      hint: L;
      /** The elf takes the blame for the mix-up. */
      blame: L;
      /** Ids the runtime highlights (items, cells, hands…). */
      focus: string[];
      /** Level 3: the answer, so Ziggy can show it step by step. */
      reveal?: unknown;
    };

/** Check a try. `tries` = how many tries so far, this one included (1, 2, 3…). */
export function checkAnswer(p: Puzzle, answer: unknown, tries: number): FixCheck {
  const def = FIXES[p.fix];
  const r = def.rawCheck(p, answer);
  const n = Math.max(1, Math.floor(tries));
  if (r.ok) return { solved: true, praise: PRAISE[(n - 1) % PRAISE.length] };
  const level = (n >= 3 ? 3 : n) as 1 | 2 | 3;
  const hint = level === 3 ? UI.showMe : (r.hints[level - 1] ?? r.hints[0] ?? UI.showMe);
  return {
    solved: false,
    level,
    hint,
    blame: ELF_BLAME[(n - 1) % ELF_BLAME.length],
    focus: r.focus,
    ...(level === 3 ? { reveal: def.solve(p) } : {}),
  };
}

/** Params problems for a fix (used by the room validator). */
export function validateFixParams(fix: string, params: Params): string[] {
  if (!isFixId(fix)) return [`unknown fix mechanic "${fix}"`];
  const spec = FIXES[fix].params;
  const out: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    const s = spec[k];
    if (!s) {
      out.push(`fix "${fix}" has no param "${k}"`);
      continue;
    }
    const okType =
      s.type === 'string' ? typeof v === 'string' : s.type === 'number' ? typeof v === 'number' : s.type === 'string[]' ? Array.isArray(v) && v.every((x) => typeof x === 'string') : !!v && typeof v === 'object';
    if (!okType) out.push(`fix "${fix}" param "${k}" must be ${s.type}`);
    else if (s.values && !s.values.includes(v as string)) out.push(`fix "${fix}" param "${k}" must be one of ${s.values.join(', ')}`);
  }
  return out;
}

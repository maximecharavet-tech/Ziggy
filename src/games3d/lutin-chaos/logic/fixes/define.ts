/**
 * Fix mechanic plug-in contract (architecture §7: `defineFix`). A fix makes a
 * 10–20 s puzzle for a band from the prank, knows its own solution, and checks
 * an answer by returning help — never a failure.
 */
import type { PrankRecord } from '../pranks';
import type { Params } from '../pranks/define';
import type { Rng } from '../rand';
import type { Band, ChaosGoal, L, LearningSkill, PropState } from '../types';

export type { Params };

export interface FixCtx {
  band: Band;
  rng: Rng;
  params: Params;
  /** The prank being fixed (counts, items and rotations come from it when present). */
  prank?: PrankRecord | null;
  /** The room's props before the prank (to read kinds / counts / colours). */
  props?: Record<string, PropState>;
  /** Slot id → its spoken name ("dans le tiroir" / "in the drawer"). */
  slotLabel?: (slotId: string) => L | undefined;
  /** Word ids present in the room (name-it picks from these first). */
  roomWords?: readonly string[];
}

export interface BasePuzzle {
  fix: string;
  band: Band;
  /** Spoken (and shown for 7+) instruction. */
  prompt: L;
  /** Estimated play time; content validation keeps it in 10–20 s. */
  seconds: number;
  goal: ChaosGoal;
  skill: LearningSkill;
}

/** What a plug-in's raw check says; the registry turns it into hints by level. */
export type RawCheck = { ok: true } | { ok: false; hints: L[]; focus: string[] };

export interface FixDef<P extends BasePuzzle, A> {
  id: P['fix'];
  label: L;
  icon: string;
  /** Allowed `params` keys with their type, and allowed values when closed. */
  params: Record<string, { type: 'string' | 'number' | 'string[]' | 'L'; values?: readonly string[] }>;
  /** Learning goal this fix trains by default (A9). */
  goal: ChaosGoal;
  make(ctx: FixCtx): P;
  solve(p: P): A;
  isAnswer(a: unknown): a is A;
  check(p: P, a: A): RawCheck;
  /** A plausible not-yet-right answer (tests, and the "show me" demo). */
  wrong(p: P, rng: Rng): A;
}

export const defineFix = <P extends BasePuzzle, A>(d: FixDef<P, A>): FixDef<P, A> => d;

/** Estimated seconds: base + per item, rounded. */
export const est = (base: number, perItem: number, items: number) => Math.round(base + perItem * items);

/** `k` distinct numbers including `answer`, within [min, max], shuffled. */
export function numberChoices(rng: Rng, answer: number, k: number, min: number, max: number, spread = 3): number[] {
  const set = new Set<number>([answer]);
  let guard = 0;
  while (set.size < k && guard++ < 200) {
    const d = 1 + Math.floor(rng() * spread);
    const v = answer + (rng() < 0.5 ? -d : d);
    if (v >= min && v <= max) set.add(v);
  }
  for (let v = min; set.size < k && v <= max; v++) set.add(v);
  const arr = [...set];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const isStr = (a: unknown): a is string => typeof a === 'string';
export const isNum = (a: unknown): a is number => typeof a === 'number' && Number.isFinite(a);
export const isStrArr = (a: unknown): a is string[] => Array.isArray(a) && a.every(isStr);

/** Word id for the prank's items: params.item, else the first touched prop's kind. */
export function itemOf(ctx: FixCtx, fallback: string): string {
  const p = ctx.params.item;
  if (typeof p === 'string') return p;
  const first = ctx.prank?.changes[0]?.prop;
  const kind = first ? ctx.props?.[first]?.kind : undefined;
  return kind ?? fallback;
}

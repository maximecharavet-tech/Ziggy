/**
 * Prank type plug-in contract (architecture §7: `definePrank`). A prank type
 * turns a room state into a list of `Change`s; the record of those changes is
 * what lets the fix (and the finale) undo it exactly.
 */
import type { Rng } from '../rand';
import type { Change, L, RoomState } from '../types';

export type Params = Record<string, unknown>;

export interface PrankCheckCtx {
  /** The room the prank is applied to (the reference room for pool pranks). */
  state: RoomState;
  slots: readonly string[];
}

export interface PrankDef {
  id: string;
  label: L;
  icon: string;
  /** Problems with these params in this room (empty = fine). */
  validate(params: Params, ctx: PrankCheckCtx): string[];
  /** The changes this prank makes to `state` (pure; random choices use `rng`). */
  changes(state: RoomState, params: Params, rng: Rng): Change[];
  /** Prop ids this prank touches (hotspots to spot it). */
  props(params: Params): string[];
  /** Fix mechanics that read naturally after this prank (data may pick another). */
  fixes: readonly string[];
}

export const definePrank = (d: PrankDef): PrankDef => d;

// ---- tiny param readers (data comes from JSON) ----
export const str = (p: Params, k: string): string | undefined => (typeof p[k] === 'string' ? (p[k] as string) : undefined);
export const num = (p: Params, k: string): number | undefined => (typeof p[k] === 'number' && Number.isFinite(p[k]) ? (p[k] as number) : undefined);
export function strs(p: Params, k: string): string[] {
  const v = p[k];
  if (typeof v === 'string') return [v];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Common check: the listed props exist (at least one). */
export function checkProps(ids: string[], ctx: PrankCheckCtx, key = 'props'): string[] {
  if (ids.length === 0) return [`"${key}" needs at least one prop id`];
  const out: string[] = [];
  for (const id of ids) if (!ctx.state.props[id]) out.push(`unknown prop "${id}"`);
  if (new Set(ids).size !== ids.length) out.push(`"${key}" lists a prop twice`);
  return out;
}

export function checkSlot(slot: string | undefined, ctx: PrankCheckCtx, key: string): string[] {
  if (!slot) return [`"${key}" slot id is missing`];
  return ctx.slots.includes(slot) ? [] : [`unknown slot "${slot}"`];
}

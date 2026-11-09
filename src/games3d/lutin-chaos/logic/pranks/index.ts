/** Prank type registry + apply / undo. Add a type = one file here + a test. */
import { applyChanges, revertChanges } from '../room-state';
import type { Rng } from '../rand';
import type { Change, ElfId, RoomState } from '../types';
import { BASIC_PRANKS } from './basic';
import { chainReaction, chainStepChanges } from './chain-reaction';
import type { Params, PrankDef } from './define';

export type { Params, PrankDef, PrankCheckCtx } from './define';
export type { ChainStep } from './chain-reaction';
export { stepsOf } from './chain-reaction';

export const PRANK_TYPES: Record<string, PrankDef> = { ...BASIC_PRANKS, [chainReaction.id]: chainReaction };
export const PRANK_TYPE_IDS = Object.keys(PRANK_TYPES);

/** What a prank did, and who did it: enough to show, clue and undo it. */
export interface PrankRecord {
  /** Room prank id (or finale id). */
  id: string;
  type: string;
  culprit: ElfId | null;
  changes: Change[];
  /** chain-reaction only: the changes of each step, in play order. */
  steps?: { id: string; changes: Change[] }[];
}

export function applyPrank(
  state: RoomState,
  p: { id: string; type: string; params: Params; culprit?: ElfId | null },
  rng: Rng,
): { state: RoomState; record: PrankRecord } {
  const def = PRANK_TYPES[p.type];
  if (!def) throw new Error(`unknown prank type "${p.type}"`);
  if (p.type === chainReaction.id) {
    const per = chainStepChanges(state, p.params, rng);
    const ids = (p.params.steps as { id: string }[]).map((s) => s.id);
    const steps = per.map((changes, i) => ({ id: ids[i], changes }));
    const changes = per.flat();
    return { state: applyChanges(state, changes), record: { id: p.id, type: p.type, culprit: p.culprit ?? null, changes, steps } };
  }
  const changes = def.changes(state, p.params, rng);
  return { state: applyChanges(state, changes), record: { id: p.id, type: p.type, culprit: p.culprit ?? null, changes } };
}

/** Undo a whole prank (its changes in reverse order). */
export const undoPrank = (state: RoomState, record: PrankRecord): RoomState => revertChanges(state, record.changes);

/** Undo one step of a chain reaction. */
export function undoStep(state: RoomState, record: PrankRecord, stepId: string): RoomState {
  const step = record.steps?.find((s) => s.id === stepId);
  if (!step) throw new Error(`no step "${stepId}" in "${record.id}"`);
  return revertChanges(state, step.changes);
}

/**
 * The room finale: the elves "accidentally" start a chain reaction; the child
 * rewinds it by tapping the steps in REVERSE order (sequencing, cause and
 * effect). Big kids first predict one "what moves next?". A tap on the wrong
 * step only makes the right one glow: no failure.
 */
import { applyPrank, undoStep, type PrankRecord } from './pranks';
import { int, shuffle, type Rng } from './rand';
import type { RoomFinaleStep } from './room-def';
import type { Band, L, RoomState } from './types';

/** Steps to undo per band (design doc A2). */
export const FINALE_STEPS: Record<Band, { min: number; max: number }> = {
  little: { min: 2, max: 2 },
  middle: { min: 3, max: 4 },
  big: { min: 5, max: 6 },
};

export interface FinaleRun {
  /** Steps in play order. */
  steps: { id: string; label: L }[];
  record: PrankRecord;
  phase: 'predict' | 'rewind' | 'done';
  /** big: index of the step the child predicts (the steps before it play first). */
  predictAt: number | null;
  predictOptions: string[];
  predicted: boolean | null;
  /** Undone step ids, in the order the child undid them. */
  undone: string[];
  wrongTaps: number;
}

export function startFinale(state: RoomState, defs: readonly RoomFinaleStep[], order: readonly string[], band: Band, rng: Rng): { state: RoomState; run: FinaleRun } {
  const steps = order.map((id) => {
    const d = defs.find((s) => s.id === id);
    if (!d) throw new Error(`unknown finale step "${id}"`);
    return d;
  });
  const { state: next, record } = applyPrank(state, { id: 'finale', type: 'chain-reaction', params: { steps: steps.map(({ id, type, params }) => ({ id, type, params })) } }, rng);
  let predictAt: number | null = null;
  let predictOptions: string[] = [];
  if (band === 'big' && steps.length >= 3) {
    const at = int(rng, 1, steps.length - 1);
    predictAt = at;
    const right = steps[at].id;
    const others = steps.filter((_, i) => i !== at && i !== at - 1).map((s) => s.id);
    predictOptions = shuffle(rng, [right, ...shuffle(rng, others).slice(0, 2)]);
  }
  return {
    state: next,
    run: {
      steps: steps.map((s) => ({ id: s.id, label: s.label })),
      record,
      phase: predictAt === null ? 'rewind' : 'predict',
      predictAt,
      predictOptions,
      predicted: null,
      undone: [],
      wrongTaps: 0,
    },
  };
}

/** The step the child should tap next (the last one not yet undone). */
export function expectedStep(run: FinaleRun): string | null {
  const left = run.steps.length - run.undone.length;
  return left > 0 ? run.steps[left - 1].id : null;
}

/** Big kids' prediction: any answer moves on (right = cheer, else "let's watch!"). */
export function predictFinale(run: FinaleRun, stepId: string): { run: FinaleRun; correct: boolean } {
  if (run.phase !== 'predict' || run.predictAt === null) return { run, correct: false };
  const correct = run.steps[run.predictAt].id === stepId;
  return { run: { ...run, phase: 'rewind', predicted: correct }, correct };
}

export type FinaleTap = { ok: true; step: string; done: boolean } | { ok: false; glow: string };

export function tapFinale(state: RoomState, run: FinaleRun, stepId: string): { state: RoomState; run: FinaleRun; result: FinaleTap } {
  const want = expectedStep(run);
  if (run.phase !== 'rewind' || want === null) return { state, run, result: { ok: false, glow: want ?? '' } };
  if (stepId !== want) return { state, run: { ...run, wrongTaps: run.wrongTaps + 1 }, result: { ok: false, glow: want } };
  const next = undoStep(state, run.record, stepId);
  const undone = [...run.undone, stepId];
  const done = undone.length === run.steps.length;
  return { state: next, run: { ...run, undone, phase: done ? 'done' : 'rewind' }, result: { ok: true, step: stepId, done } };
}

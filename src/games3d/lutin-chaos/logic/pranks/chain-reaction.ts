/**
 * chain-reaction: a Rube-Goldberg cascade of single-step pranks (the room
 * finale). Params: `steps` [{ id, type, params }]. Changes are recorded per
 * step so the child can rewind them in reverse order.
 */
import { applyChanges } from '../room-state';
import type { Rng } from '../rand';
import type { Change, RoomState } from '../types';
import { BASIC_PRANKS } from './basic';
import { definePrank, type Params } from './define';

export interface ChainStep {
  id: string;
  type: string;
  params: Params;
}

export function stepsOf(p: Params): ChainStep[] {
  const v = p.steps;
  if (!Array.isArray(v)) return [];
  return v.filter(
    (s): s is ChainStep =>
      !!s && typeof s === 'object' && typeof (s as ChainStep).id === 'string' && typeof (s as ChainStep).type === 'string' && typeof (s as ChainStep).params === 'object',
  );
}

/** Run each step on the running state; returns the changes of every step. */
export function chainStepChanges(state: RoomState, p: Params, rng: Rng): Change[][] {
  const out: Change[][] = [];
  let s = state;
  for (const step of stepsOf(p)) {
    const c = BASIC_PRANKS[step.type].changes(s, step.params, rng);
    s = applyChanges(s, c);
    out.push(c);
  }
  return out;
}

export const chainReaction = definePrank({
  id: 'chain-reaction',
  label: { fr: 'Réaction en chaîne', en: 'Chain reaction' },
  icon: '🎳',
  fixes: ['order'],
  props: (p) => [...new Set(stepsOf(p).flatMap((s) => BASIC_PRANKS[s.type]?.props(s.params) ?? []))],
  validate(p, ctx) {
    const steps = stepsOf(p);
    if (steps.length < 2 || (Array.isArray(p.steps) && steps.length !== p.steps.length)) return ['"steps" must list at least 2 steps { id, type, params }'];
    if (new Set(steps.map((s) => s.id)).size !== steps.length) return ['step ids must be unique'];
    const out: string[] = [];
    let s = ctx.state;
    for (const step of steps) {
      const def = BASIC_PRANKS[step.type];
      if (!def) {
        out.push(`step "${step.id}": unknown or nested prank type "${step.type}"`);
        break;
      }
      const errs = def.validate(step.params, { ...ctx, state: s });
      if (errs.length) {
        out.push(...errs.map((e) => `step "${step.id}": ${e}`));
        break;
      }
      s = applyChanges(s, def.changes(s, step.params, () => 0.5));
    }
    return out;
  },
  changes: (state, p, rng) => chainStepChanges(state, p, rng).flat(),
});

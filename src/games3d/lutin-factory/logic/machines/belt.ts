/** Conveyor belt: carries an item one tile per tick, in from the back or the sides. */
import { defineMachine, notFromFront } from './types';
import { obj } from './dial';

export const belt = defineMachine<Record<string, never>, null>({
  id: 'belt',
  icon: '➡️',
  crew: null,
  minBand: 'little',
  dial: { defaults: {}, parse: (raw) => (obj(raw, []) ? {} : null) },
  accepts: notFromFront,
  init: () => null,
});

/**
 * Sleigh sack / check gate (Ziggy): every item that enters is delivered.
 * `bay` names the sleigh bay (orders can ask for a bay, e.g. "C2").
 */
import { defineMachine, fromAnySide } from './types';
import { obj } from './dial';

export interface SackDial {
  [k: string]: unknown;
  bay?: string;
}

export const sack = defineMachine<SackDial, null>({
  id: 'sack',
  icon: '🛷',
  crew: 'ziggy',
  minBand: 'little',
  dial: {
    defaults: {},
    parse(raw) {
      const o = obj(raw, ['bay']);
      if (!o) return null;
      if (o.bay === undefined) return {};
      return typeof o.bay === 'string' && /^[A-Za-z0-9-]{1,12}$/.test(o.bay) ? { bay: o.bay } : null;
    },
  },
  accepts: fromAnySide,
  init: () => null,
  onEnter: () => null,
  sink: true,
});

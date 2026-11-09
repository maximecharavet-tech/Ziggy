/**
 * Robot arm (Pépin + Grelotte's cards, 10+): runs a row of instruction cards,
 * one card per tick, then starts the row again (a tiny LightBot-like language).
 *
 * Cards (JSON): "pick" (take the item waiting at the arm), "shape:<shape>",
 * "paint:<paint>", "sticker:<sticker>", "stack" (put the held item on the
 * build plate), "ship" (send the plate out as a tower, or the held item),
 * and { "repeat": N, "do": [cards…] } (no repeat inside a repeat).
 *
 * A card that has nothing to do is skipped kindly (the arm shrugs); "pick"
 * waits for an item and "ship" waits for its output tile to be free.
 */
import type { Item, Paint, Shape, Sticker } from '../types';
import { defineMachine, notFromFront } from './types';
import { commonColor, int, obj, paint, paintItem, shape, sticker } from './dial';

export type Card =
  | { op: 'pick' }
  | { op: 'stack' }
  | { op: 'ship' }
  | { op: 'shape'; shape: Shape }
  | { op: 'paint'; color: Paint }
  | { op: 'sticker'; sticker: Sticker };

export type ProgramEntry = string | { repeat: number; do: string[] };

export interface ArmDial {
  [k: string]: unknown;
  program: ProgramEntry[];
}

export const ARM_MAX_CARDS = 16;
export const ARM_MAX_STEPS = 120;

export function parseCard(s: unknown): Card | null {
  if (typeof s !== 'string') return null;
  const [op, arg, extra] = s.split(':');
  if (extra !== undefined) return null;
  if (arg === undefined) {
    if (op === 'pick' || op === 'stack' || op === 'ship') return { op };
    return null;
  }
  if (op === 'shape') {
    const v = shape(arg);
    return v ? { op, shape: v } : null;
  }
  if (op === 'paint') {
    const v = paint(arg);
    return v ? { op, color: v } : null;
  }
  if (op === 'sticker') {
    const v = sticker(arg);
    return v ? { op, sticker: v } : null;
  }
  return null;
}

/** Expand repeats into the flat list of cards the arm actually runs. */
export function flattenProgram(program: ProgramEntry[]): Card[] {
  const out: Card[] = [];
  for (const e of program) {
    if (typeof e === 'string') {
      const c = parseCard(e);
      if (c) out.push(c);
    } else {
      for (let i = 0; i < e.repeat; i++) for (const s of e.do) {
        const c = parseCard(s);
        if (c) out.push(c);
      }
    }
  }
  return out;
}

function parseProgram(raw: unknown): ProgramEntry[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: ProgramEntry[] = [];
  let cards = 0;
  for (const e of raw) {
    if (typeof e === 'string') {
      if (!parseCard(e)) return null;
      out.push(e);
      cards++;
      continue;
    }
    const o = obj(e, ['repeat', 'do']);
    const times = o ? int(o.repeat, 2, 20) : null;
    if (!o || times === null || !Array.isArray(o.do) || o.do.length === 0) return null;
    if (!o.do.every((s) => parseCard(s) !== null)) return null;
    out.push({ repeat: times, do: [...(o.do as string[])] });
    cards += 1 + o.do.length;
  }
  if (cards > ARM_MAX_CARDS || flattenProgram(out).length > ARM_MAX_STEPS) return null;
  return out;
}

export interface ArmState {
  pc: number;
  inbox: Item | null;
  hand: Item | null;
  plate: Item[];
  out: Item | null;
  /** Last card run (for the runtime: the arm's animation). */
  last: string | null;
}

export const arm = defineMachine<ArmDial, ArmState>({
  id: 'arm',
  icon: '🦾',
  crew: 'pepin',
  minBand: 'big',
  dial: {
    defaults: { program: ['pick', 'ship'] },
    parse(raw) {
      const o = obj(raw, ['program']);
      const program = o ? parseProgram(o.program) : null;
      return program ? { program } : null;
    },
  },
  accepts: notFromFront,
  init: () => ({ pc: 0, inbox: null, hand: null, plate: [], out: null, last: null }),
  canAccept: (st) => st.inbox === null,
  onEnter(st, item) {
    st.inbox = item;
    return null;
  },
  tick(st, d, ctx) {
    const flat = flattenProgram(d.program);
    if (flat.length === 0) return false;
    const card = flat[st.pc % flat.length];
    let advance = true;
    let progress = false;
    switch (card.op) {
      case 'pick':
        if (st.hand) break;
        if (!st.inbox) {
          advance = false;
          break;
        }
        st.hand = st.inbox;
        st.inbox = null;
        progress = true;
        break;
      case 'shape':
        if (st.hand && !st.hand.toy) {
          st.hand.shape = card.shape;
          progress = true;
        }
        break;
      case 'paint':
        if (st.hand) {
          paintItem(st.hand, card.color);
          progress = true;
        }
        break;
      case 'sticker':
        if (st.hand) {
          st.hand.sticker = card.sticker;
          progress = true;
        }
        break;
      case 'stack':
        if (st.hand) {
          st.plate.push(st.hand);
          st.hand = null;
          progress = true;
        }
        break;
      case 'ship':
        if (st.out) {
          advance = false;
          break;
        }
        if (st.plate.length > 0) {
          const parts = st.plate;
          const tower = ctx.newItem({ material: parts[0].material, toy: 'tower', n: parts.length, parts });
          const c = commonColor(parts);
          if (c) tower.color = c;
          st.out = tower;
          st.plate = [];
          progress = true;
        } else if (st.hand) {
          st.out = st.hand;
          st.hand = null;
          progress = true;
        }
        break;
    }
    if (progress) st.last = card.op;
    if (advance) st.pc = (st.pc + 1) % flat.length;
    return progress;
  },
  emit(st) {
    if (!st.out) return null;
    const item = st.out;
    st.out = null;
    return { item };
  },
  busy: (st) => !!(st.inbox || st.hand || st.out || st.plate.length),
});

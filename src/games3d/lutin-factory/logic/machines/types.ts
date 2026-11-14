/**
 * The machine plug-in contract (`defineMachine`). A machine is data + a few
 * small pure hooks; the simulator (simulator.ts) owns movement, collisions
 * and timing, so a new machine never touches the core loop.
 *
 * Timing contract (one tick = one tile):
 *   1. items move one tile (collisions resolved by simulator priority rules);
 *   2. an item that just entered a machine's tile goes through `onEnter`
 *      (processed, routed, absorbed or delivered) and leaves next tick;
 *   3. every machine gets `tick` (internal work: the robot arm's cards);
 *   4. machines whose tile is now empty may `emit` a new item (chute, loop
 *      copies, arm output).
 * Machine state must be plain JSON (it is hashed for determinism tests).
 */
import type { Band, Cell, Dial, Dir, ElfId, Item, Rel } from '../types';

export interface MachineCtx {
  readonly tick: number;
  readonly at: Cell;
  readonly dir: Dir;
  /** A new item with the next deterministic id. */
  newItem(base: Omit<Item, 'id'>): Item;
  /** A deep copy with a new id (parts keep their own ids). */
  clone(item: Item): Item;
}

/** `null` = the machine kept the item (absorbed into a buffer, or delivered). */
export type EnterResult = { item: Item; exit?: Rel } | null;

export interface DialSpec<D extends Dial> {
  /** Dial used when a machine is placed without one. */
  defaults: D;
  /** Strict parse: a clean dial with only known keys, or null if invalid. */
  parse(raw: unknown): D | null;
}

export interface MachineDef<D extends Dial = Dial, S = unknown> {
  id: string;
  icon: string;
  /** Elf on duty (design doc B4), Ziggy at the check sack. */
  crew: ElfId | 'ziggy' | null;
  /** From this band on the machine is offered in the tray for free placement. */
  minBand: Band;
  dial: DialSpec<D>;
  /** May an item enter through this side (relative to the machine's facing)? */
  accepts(rel: Rel): boolean;
  init(dial: D): S;
  /** Extra condition to take an item (e.g. the loop is still copying). */
  canAccept?(state: S, item: Item, dial: D): boolean;
  /** Default: pass the item on, out of the front. */
  onEnter?(state: S, item: Item, dial: D, ctx: MachineCtx): EnterResult;
  /** Internal work each tick; return true if something visibly progressed. */
  tick?(state: S, dial: D, ctx: MachineCtx): boolean;
  /** Called when the machine's tile is empty: may put a new item there. */
  emit?(state: S, dial: D, ctx: MachineCtx): { item: Item; exit?: Rel } | null;
  /** Still has work to do (for "is the line finished?"). */
  busy?(state: S, dial: D): boolean;
  /** Items entering are delivered (the check sack). */
  sink?: boolean;
}

export type AnyMachine = MachineDef<Dial, unknown>;

/** Erase the dial/state generics so plug-ins can live in one registry. */
export function defineMachine<D extends Dial, S>(def: MachineDef<D, S>): AnyMachine {
  return def as unknown as AnyMachine;
}

/* ---------- side rules ---------- */

/** Belts and most machines: in from the back or the sides, out of the front. */
export const notFromFront = (rel: Rel): boolean => rel !== 'front';
export const fromAnySide = (): boolean => true;
export const fromNoSide = (): boolean => false;

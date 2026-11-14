/**
 * The deterministic tick simulator of the workshop.
 *
 *   const sim = new FactorySim(layout);
 *   sim.step();              // one tick (the "step" button)
 *   sim.run(10);             // ten ticks (GO: the runtime calls step() every TICK_SECONDS / speed)
 *   sim.runUntilSettled();   // until nothing changes any more (tests, hints, instant check)
 *   sim.reset();             // back to tick 0 with the same layout
 *
 * One tick = every item moves at most one tile. Rules (all deterministic, no
 * randomness at all in the simulation):
 *   - each tile holds at most one item; a machine decides where an item exits
 *     when it enters (front by default, sorter: left/right, counter: right…);
 *   - an item can enter a tile from the back or the sides (never through the
 *     front of a belt/machine; a sack takes items from every side);
 *   - when several items want the same tile, the one coming from the tile's
 *     back goes first, then its left, then its right (straight beats merging);
 *   - an item moves into a tile whose item moves away in the same tick, and a
 *     full loop of belts turns as a whole;
 *   - an item that cannot move simply waits (nothing is ever lost or thrown
 *     away); a line that cannot move any more is "settled".
 */
import type { Cell, Delivery, Dial, Dir, Item, Layout, Piece, Rel } from './types';
import type { AnyMachine, MachineCtx } from './machines/types';
import { getMachine } from './machines/registry';
import { flattenProgram, type ArmDial } from './machines/arm';
import { dirToRel, inGrid, isBlocked, key, opposite, relToDir, step as stepCell } from './grid';

/** Tick length in seconds at each speed (the runtime's clock; the logic only counts ticks). */
export const TICK_SECONDS = { 1: 0.5, 2: 0.25 } as const;
export type Speed = keyof typeof TICK_SECONDS;

export const MAX_TICKS = 5000;

export interface SimItem {
  item: Item;
  at: Cell;
  /** Absolute direction it will leave in. */
  exit: Dir;
}

export type SimEvent =
  | { type: 'emit'; id: number; at: Cell; machine: string }
  | { type: 'move'; id: number; from: Cell; to: Cell }
  | { type: 'wait'; id: number; at: Cell }
  | { type: 'process'; id: number; at: Cell; machine: string }
  | { type: 'absorb'; id: number; at: Cell; machine: string }
  | { type: 'build'; id: number; at: Cell; machine: string; toy: string }
  | { type: 'deliver'; id: number; at: Cell; bay?: string }
  | { type: 'work'; at: Cell; machine: string; card?: string };

export interface TickReport {
  tick: number;
  events: SimEvent[];
  progressed: boolean;
}

interface Slot {
  piece: Piece;
  def: AnyMachine;
  dial: Dial;
  state: unknown;
}

const PRIORITY: Record<Rel, number> = { back: 0, left: 1, right: 2, front: 3 };

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** FNV-1a 32-bit (state hashes for determinism / replays). */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export class FactorySim {
  readonly layout: Layout;
  private slots = new Map<string, Slot>();
  private order: string[] = [];
  private onTile = new Map<string, SimItem>();
  private _deliveries: Delivery[] = [];
  private nextId = 1;
  private _tick = 0;
  private quiet = 0;
  private readonly quietLimit: number;

  constructor(layout: Layout) {
    this.layout = clone(layout);
    let longest = 0;
    for (const p of this.layout.pieces) {
      if (p.machine !== 'arm') continue;
      const d = getMachine('arm')?.dial.parse(p.dial ?? {}) as ArmDial | null;
      if (d) longest = Math.max(longest, flattenProgram(d.program).length);
    }
    this.quietLimit = longest + 1;
    this.reset();
  }

  /** Back to tick 0: same layout, fresh machines, empty belts. */
  reset(): void {
    this.slots.clear();
    this.onTile.clear();
    this._deliveries = [];
    this.nextId = 1;
    this._tick = 0;
    this.quiet = 0;
    const pieces = [...this.layout.pieces].sort((a, b) => a.at[1] - b.at[1] || a.at[0] - b.at[0]);
    for (const piece of pieces) {
      const def = getMachine(piece.machine);
      if (!def || !inGrid(this.layout, piece.at) || isBlocked(this.layout, piece.at)) continue;
      const k = key(piece.at);
      if (this.slots.has(k)) continue;
      const dial = def.dial.parse(piece.dial ?? {}) ?? def.dial.defaults;
      this.slots.set(k, { piece, def, dial, state: def.init(dial) });
    }
    this.order = [...this.slots.keys()];
  }

  get tick(): number {
    return this._tick;
  }

  /** Nothing has changed for long enough: running more ticks changes nothing. */
  get settled(): boolean {
    return this._tick > 0 && this.quiet >= this.quietLimit;
  }

  /** Settled with empty belts and idle machines: the run is over. */
  get finished(): boolean {
    return this.settled && this.onTile.size === 0 && !this.order.some((k) => this.isBusy(k));
  }

  items(): SimItem[] {
    return [...this.onTile.values()].map((s) => clone(s));
  }

  deliveries(): Delivery[] {
    return clone(this._deliveries);
  }

  /** A machine's runtime state (read-only copy: assembler basket, arm hand…). */
  machineState(at: Cell): unknown {
    const s = this.slots.get(key(at));
    return s ? clone(s.state) : undefined;
  }

  /** Cells of machines that still hold work (parts waiting in a basket, a chute not empty…). */
  busyMachines(): { at: Cell; machine: string }[] {
    return this.order.filter((k) => this.isBusy(k)).map((k) => {
      const s = this.slots.get(k) as Slot;
      return { at: [s.piece.at[0], s.piece.at[1]] as const, machine: s.def.id };
    });
  }

  private isBusy(k: string): boolean {
    const s = this.slots.get(k) as Slot;
    return s.def.busy ? s.def.busy(s.state, s.dial) : false;
  }

  private ctx(slot: Slot): MachineCtx {
    return {
      tick: this._tick,
      at: slot.piece.at,
      dir: slot.piece.dir,
      newItem: (base) => ({ id: this.nextId++, ...clone(base) }),
      clone: (item) => ({ ...clone(item), id: this.nextId++ }),
    };
  }

  /** Can `si` move this tick, and where to? */
  private target(si: SimItem): string | null {
    const to = stepCell(si.at, si.exit);
    const slot = this.slots.get(key(to));
    if (!slot) return null;
    const side = dirToRel(slot.piece.dir, opposite(si.exit));
    if (!slot.def.accepts(side)) return null;
    if (slot.def.canAccept && !slot.def.canAccept(slot.state, si.item, slot.dial)) return null;
    return key(to);
  }

  /** One tick. */
  step(): TickReport {
    this._tick++;
    const events: SimEvent[] = [];
    let progressed = false;

    // 1. Who wants to go where; one winner per target tile.
    const wants = new Map<string, string>(); // from → to
    const best = new Map<string, { from: string; prio: number }>();
    for (const [from, si] of this.onTile) {
      const to = this.target(si);
      if (!to) continue;
      const slot = this.slots.get(to) as Slot;
      const prio = PRIORITY[dirToRel(slot.piece.dir, opposite(si.exit))];
      const cur = best.get(to);
      if (!cur || prio < cur.prio) best.set(to, { from, prio });
    }
    for (const [to, w] of best) wants.set(w.from, to);

    // 2. A winner moves if its target is free or is itself moving (cycles turn as a whole).
    const verdict = new Map<string, boolean>();
    const visiting = new Set<string>();
    const canMove = (from: string): boolean => {
      const v = verdict.get(from);
      if (v !== undefined) return v;
      if (visiting.has(from)) return true;
      const to = wants.get(from);
      if (!to) return false;
      visiting.add(from);
      const ok = !this.onTile.has(to) || canMove(to);
      visiting.delete(from);
      verdict.set(from, ok);
      return ok;
    };

    // 3. Apply all moves at once.
    const next = new Map<string, SimItem>();
    const arrived: { to: string; si: SimItem; from: Cell }[] = [];
    for (const [from, si] of this.onTile) {
      if (wants.has(from) && canMove(from)) {
        const to = wants.get(from) as string;
        arrived.push({ to, si, from: si.at });
      } else {
        next.set(from, si);
        events.push({ type: 'wait', id: si.item.id, at: si.at });
      }
    }
    for (const { to, si, from } of arrived) {
      const slot = this.slots.get(to) as Slot;
      const at = slot.piece.at;
      events.push({ type: 'move', id: si.item.id, from, to: at });
      progressed = true;
      const res = slot.def.onEnter ? slot.def.onEnter(slot.state, si.item, slot.dial, this.ctx(slot)) : { item: si.item };
      if (slot.def.sink) {
        const bay = (slot.dial as { bay?: string }).bay;
        this._deliveries.push({ tick: this._tick, at: [at[0], at[1]], ...(bay ? { bay } : {}), item: clone(si.item) });
        events.push({ type: 'deliver', id: si.item.id, at, ...(bay ? { bay } : {}) });
        continue;
      }
      if (!res) {
        events.push({ type: 'absorb', id: si.item.id, at, machine: slot.def.id });
        continue;
      }
      if (res.item.id !== si.item.id && res.item.toy) {
        events.push({ type: 'build', id: res.item.id, at, machine: slot.def.id, toy: res.item.toy });
      } else {
        events.push({ type: 'process', id: res.item.id, at, machine: slot.def.id });
      }
      next.set(to, { item: res.item, at: [at[0], at[1]], exit: relToDir(slot.piece.dir, res.exit ?? 'front') });
    }
    this.onTile = next;

    // 4. Internal work (robot arm cards).
    for (const k of this.order) {
      const slot = this.slots.get(k) as Slot;
      if (slot.def.tick && slot.def.tick(slot.state, slot.dial, this.ctx(slot))) {
        progressed = true;
        const card = (slot.state as { last?: string | null }).last ?? undefined;
        events.push({ type: 'work', at: slot.piece.at, machine: slot.def.id, ...(card ? { card } : {}) });
      }
    }

    // 5. Machines with a free tile may put out a new item.
    for (const k of this.order) {
      const slot = this.slots.get(k) as Slot;
      if (!slot.def.emit || this.onTile.has(k)) continue;
      const out = slot.def.emit(slot.state, slot.dial, this.ctx(slot));
      if (!out) continue;
      progressed = true;
      const at = slot.piece.at;
      this.onTile.set(k, { item: out.item, at: [at[0], at[1]], exit: relToDir(slot.piece.dir, out.exit ?? 'front') });
      events.push({ type: 'emit', id: out.item.id, at, machine: slot.def.id });
    }

    this.quiet = progressed ? 0 : this.quiet + 1;
    return { tick: this._tick, events, progressed };
  }

  /** `n` ticks (stops early once settled). */
  run(n: number): TickReport[] {
    const out: TickReport[] = [];
    for (let i = 0; i < n && !this.settled; i++) out.push(this.step());
    return out;
  }

  /** Run until nothing changes any more (or `maxTicks`). */
  runUntilSettled(maxTicks = MAX_TICKS): { ticks: number; settled: boolean; finished: boolean } {
    let i = 0;
    while (!this.settled && i < maxTicks) {
      this.step();
      i++;
    }
    return { ticks: this._tick, settled: this.settled, finished: this.finished };
  }

  /** Compact, JSON state (save a paused run, replays, determinism tests). */
  snapshot(): { tick: number; items: SimItem[]; machines: { at: Cell; state: unknown }[]; deliveries: Delivery[] } {
    const items = this.items().sort((a, b) => a.at[1] - b.at[1] || a.at[0] - b.at[0]);
    const machines = this.order.map((k) => {
      const s = this.slots.get(k) as Slot;
      return { at: s.piece.at, state: clone(s.state) };
    });
    return { tick: this._tick, items, machines, deliveries: this.deliveries() };
  }

  hash(): string {
    return fnv1a(JSON.stringify(this.snapshot()));
  }
}

/** Convenience: run a layout to the end and return what reached the sacks. */
export function simulate(layout: Layout, maxTicks = MAX_TICKS): { deliveries: Delivery[]; sim: FactorySim } {
  const sim = new FactorySim(layout);
  sim.runUntilSettled(maxTicks);
  return { deliveries: sim.deliveries(), sim };
}

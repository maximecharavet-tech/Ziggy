/**
 * Lutin Factory runtime controller: everything the workshop scene DECIDES
 * between taps and ticks, with no three.js and no DOM (unit-tested in Node).
 * The scene only draws this state and turns taps into these calls; the React
 * player only shows the HUD snapshot it gets from the scene.
 *
 * - one letter (level × band) or the free workshop (sandbox);
 * - tap-tap placement (tool from the tray, then a tile), the little ones'
 *   glowing slots, dials, rotate / remove, unlimited undo / redo;
 * - the simulator run (GO / stop / step / reset), the check gate after every
 *   delivery and at the end, the surprise shelf and the Grand Catalogue;
 * - gentle hints on request (`suggestNextStep`), "show me" (`applyHint`).
 *
 * Child-safety by construction: there is no failure state, a toy that
 * differs is a surprise for the shelf, and nothing is ever lost.
 */
import {
  LEVELS,
  FactorySim,
  applyHint,
  autoBeltDir,
  canRedo,
  canUndo,
  check,
  createHistory,
  getMachine,
  isDialLocked,
  lookOf,
  phrase,
  pieceAt,
  place,
  push,
  redo,
  remove,
  rotate,
  sameCell,
  setDial,
  startLayout,
  suggestNextStep,
  surpriseName,
  undo,
  type Band,
  type BandLevel,
  type Cell,
  type CheckResult,
  type Delivery,
  type Dial,
  type EditRefusal,
  type FactoryLevel,
  type Hint,
  type History,
  type Item,
  type L,
  type Layout,
  type Piece,
  type SimEvent,
  type SimItem,
  type Slot,
} from './logic';
import type { LearningSkill } from '@/lib/learning/skills';
import { CATALOGUE_MAX, SHELF_MAX, type FactorySave } from './save';

export const HALLS = ['wood-shop', 'paint-room', 'assembly-line', 'logic-room', 'dispatch', 'christmas-eve'] as const;
export type HallId = (typeof HALLS)[number];

/** Machines the free workshop always offers. */
export const SANDBOX_BASE = ['belt', 'chute', 'shaper', 'painter', 'sack'];
export const SANDBOX_GRID = { w: 7, h: 5 };

/** A hall opens when every level of the hall before it has a finished letter (any band). */
export function hallOpen(hall: string, save: Pick<FactorySave, 'done'>): boolean {
  const i = HALLS.indexOf(hall as HallId);
  if (i <= 0) return true;
  const prev = LEVELS.filter((l) => l.hall === HALLS[i - 1]);
  return prev.every((l) => (save.done[l.id] ?? []).length > 0);
}

/** World Memory skill of a letter (one per letter, so XP is not counted twice). */
export function skillFor(level: FactoryLevel, band: Band): LearningSkill {
  const s = level.skills;
  if (band === 'big') {
    for (const k of ['multiplication', 'logic'] as const) if (s.includes(k)) return k;
  }
  if (band === 'little' && s.includes('colors') && level.number <= 6) return 'colors';
  return s[0] ?? 'logic';
}

/** Key of a toy's look for the Catalogue (ids and part order ignored). */
export function lookKey(item: Omit<Item, 'id'> | Item): string {
  const l = lookOf({ id: 0, ...item } as Item);
  return JSON.stringify([l.toy, l.shape ?? null, l.material ?? null, l.color ?? null, l.sticker ?? null, l.wrap ?? null, l.n ?? null, l.partColors ?? null]);
}

/** A delivery as the runtime reacts to it. */
export interface DeliveryNote {
  index: number;
  delivery: Delivery;
  /** Matches the letter (jingle) or goes to the surprise shelf (laugh). */
  matched: boolean;
  bonus: boolean;
  name: L;
}

export interface TickInfo {
  tick: number;
  events: SimEvent[];
  /** Items on the belts before and after this tick (by item id). */
  before: Map<number, SimItem>;
  after: Map<number, SimItem>;
  deliveries: DeliveryNote[];
  settled: boolean;
}

export type TapResult =
  | { kind: 'placed'; at: Cell; machine: string }
  | { kind: 'selected'; at: Cell }
  | { kind: 'deselected' }
  | { kind: 'slot'; at: Cell }
  | { kind: 'refused'; why: EditRefusal | 'running'; at: Cell }
  | { kind: 'none' };

export interface RunEnd {
  result: CheckResult;
  /** First time this letter (level × band) is finished. */
  firstTime: boolean;
  complete: boolean;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const stripId = (it: Item): Omit<Item, 'id'> => {
  const { id: _id, ...rest } = clone(it);
  void _id;
  if (rest.parts) rest.parts = rest.parts.map((p) => stripId(p as Item) as Item);
  return rest;
};

export class FactoryController {
  mode: 'idle' | 'level' | 'sandbox' = 'idle';
  level: FactoryLevel | null = null;
  band: Band = 'middle';
  history: History<Layout> = createHistory<Layout>({ w: 5, h: 3, pieces: [] });
  tool: string | null = null;
  selected: Cell | null = null;
  /** The glowing slot whose choices are open. */
  slotOpen: Slot | null = null;
  sim: FactorySim | null = null;
  /** GO pressed at least once on this letter. */
  hasRun = false;
  runs = 0;
  hintsUsed = 0;
  hint: Hint | null = null;
  lastCheck: CheckResult | null = null;
  complete = false;
  startedAt = 0;
  private notedDeliveries = 0;

  constructor(
    public save: FactorySave,
    private now: () => number = () => Date.now()
  ) {}

  /* ---------- opening ---------- */

  get layout(): Layout {
    return this.history.present;
  }

  get bandLevel(): BandLevel | null {
    return this.level ? this.level.bands[this.band] : null;
  }

  get saveKey(): string | null {
    return this.level ? `${this.level.id}:${this.band}` : null;
  }

  openLevel(level: FactoryLevel, band: Band): void {
    this.mode = 'level';
    this.level = level;
    this.band = band;
    const b = level.bands[band];
    const fresh = startLayout(b);
    const saved = this.save.layouts[`${level.id}:${band}`];
    // A saved layout is only reused when it still fits the level (locked pieces unchanged).
    const usable = saved && saved.w === fresh.w && saved.h === fresh.h && fresh.pieces.filter((p) => p.locked).every((p) => saved.pieces.some((q) => sameCell(q.at, p.at) && q.machine === p.machine));
    this.reset(usable ? this.relock(saved, fresh) : fresh);
    this.meet([...b.tray, ...b.prebuilt.map((p) => p.machine), ...(b.slots ?? []).flatMap((s) => s.choices.map((c) => c.machine))]);
  }

  openSandbox(): void {
    this.mode = 'sandbox';
    this.level = null;
    const saved = this.save.sandbox;
    this.reset(saved ? clone(saved) : this.sandboxStart());
  }

  sandboxStart(): Layout {
    const { w, h } = SANDBOX_GRID;
    return {
      w,
      h,
      blocked: [],
      pieces: [
        { machine: 'chute', at: [0, 2], dir: 'E', dial: { material: 'wood', count: 3 } },
        { machine: 'sack', at: [w - 1, 2], dir: 'E', dial: {} },
      ],
    };
  }

  /** Load a layout (sandbox share code). */
  loadLayout(l: Layout): void {
    this.commit(clone(l));
  }

  close(): void {
    this.mode = 'idle';
    this.level = null;
    this.sim = null;
    this.tool = null;
    this.selected = null;
    this.slotOpen = null;
  }

  private relock(saved: Layout, fresh: Layout): Layout {
    // Locks are not stored by the child's edits: take them from the level again.
    const pieces = saved.pieces.map((p) => {
      const f = fresh.pieces.find((q) => sameCell(q.at, p.at) && q.machine === p.machine);
      if (!f) return { ...p, locked: undefined, dialLocked: undefined };
      const out: Piece = { ...p, dir: f.dir };
      if (f.locked) out.locked = true;
      if (f.dialLocked !== undefined) out.dialLocked = f.dialLocked;
      if (isDialLocked(f)) out.dial = f.dial;
      return out;
    });
    return { ...fresh, pieces: pieces.map((p) => JSON.parse(JSON.stringify(p)) as Piece) };
  }

  private reset(l: Layout): void {
    this.history = createHistory(l);
    this.tool = null;
    this.selected = null;
    this.slotOpen = null;
    this.sim = null;
    this.hasRun = false;
    this.runs = 0;
    this.hintsUsed = 0;
    this.hint = null;
    this.lastCheck = null;
    this.complete = false;
    this.notedDeliveries = 0;
    this.startedAt = this.now();
  }

  private meet(ids: string[]): void {
    for (const id of ids) if (!this.save.met.includes(id)) this.save.met.push(id);
  }

  /* ---------- what the tray offers ---------- */

  tray(): string[] {
    if (this.mode === 'sandbox') {
      const ids = new Set([...SANDBOX_BASE, ...this.save.met]);
      const order = ['belt', 'chute', 'shaper', 'painter', 'mixer', 'assembler', 'stamper', 'wrapper', 'sorter', 'counter', 'loop', 'arm', 'sack'];
      return order.filter((m) => ids.has(m));
    }
    return this.bandLevel?.tray ?? [];
  }

  slots(): Slot[] {
    return this.mode === 'level' ? (this.bandLevel?.slots ?? []) : [];
  }

  slotAt(at: Cell): Slot | undefined {
    return this.slots().find((s) => sameCell(s.at, at));
  }

  /* ---------- editing ---------- */

  selectTool(id: string | null): void {
    this.tool = id && this.tray().includes(id) ? id : null;
    this.selected = null;
    this.slotOpen = null;
  }

  /** A tap on a tile (hotspot or raycast). */
  tapCell(at: Cell, running: boolean): TapResult {
    const l = this.layout;
    const piece = pieceAt(l, at);
    const slot = this.slotAt(at);
    if (slot && (!piece || !piece.locked)) {
      this.selected = piece ? at : null;
      this.slotOpen = slot;
      this.tool = null;
      return { kind: 'slot', at };
    }
    if (piece) {
      if (this.selected && sameCell(this.selected, at) && !this.tool) {
        this.selected = null;
        return { kind: 'deselected' };
      }
      this.selected = at;
      this.slotOpen = null;
      this.tool = null;
      return { kind: 'selected', at };
    }
    if (this.tool) {
      if (running) return { kind: 'refused', why: 'running', at };
      const machine = this.tool;
      const def = getMachine(machine);
      const dir = autoBeltDir(l, at);
      const r = place(l, { machine, at, dir, dial: def?.dial.defaults });
      if (!r.ok) return { kind: 'refused', why: r.why, at };
      this.commit(r.layout);
      // Belts: keep the tool for quick paths. Machines: open their dial.
      if (machine !== 'belt') {
        this.selected = at;
        this.tool = null;
      }
      return { kind: 'placed', at, machine };
    }
    if (this.selected || this.slotOpen) {
      this.selected = null;
      this.slotOpen = null;
      return { kind: 'deselected' };
    }
    if ((l.blocked ?? []).some((b) => sameCell(b, at))) return { kind: 'refused', why: 'blocked', at };
    return { kind: 'none' };
  }

  /** Little ones: pick one of the glowing slot's choices (replaces the machine there). */
  chooseSlot(index: number): TapResult {
    const s = this.slotOpen;
    if (!s) return { kind: 'none' };
    const c = s.choices[index];
    if (!c) return { kind: 'none' };
    let l = this.layout;
    const there = pieceAt(l, s.at);
    if (there) {
      if (there.locked) return { kind: 'refused', why: 'locked', at: s.at };
      const r = remove(l, s.at);
      if (r.ok) l = r.layout;
    }
    const r = place(l, { machine: c.machine, at: s.at, dir: s.dir, dial: c.dial });
    if (!r.ok) return { kind: 'refused', why: r.why, at: s.at };
    this.commit(r.layout);
    this.selected = s.at;
    return { kind: 'placed', at: s.at, machine: c.machine };
  }

  /** Index of the slot choice now standing in the open slot (-1: empty / other). */
  slotChoiceIndex(s: Slot): number {
    const p = pieceAt(this.layout, s.at);
    if (!p) return -1;
    return s.choices.findIndex((c) => c.machine === p.machine && JSON.stringify(getMachine(c.machine)?.dial.parse(c.dial ?? {})) === JSON.stringify(p.dial ?? {}));
  }

  rotateSelected(): EditRefusal | null {
    if (!this.selected) return 'empty';
    const r = rotate(this.layout, this.selected);
    if (!r.ok) return r.why;
    this.commit(r.layout);
    return null;
  }

  removeSelected(): EditRefusal | null {
    if (!this.selected) return 'empty';
    const r = remove(this.layout, this.selected);
    if (!r.ok) return r.why;
    this.commit(r.layout);
    this.selected = null;
    return null;
  }

  setSelectedDial(dial: Dial): EditRefusal | null {
    if (!this.selected) return 'empty';
    const r = setDial(this.layout, this.selected, dial);
    if (!r.ok) return r.why;
    this.commit(r.layout);
    return null;
  }

  undo(): boolean {
    if (!canUndo(this.history)) return false;
    this.history = undo(this.history);
    this.afterEdit();
    return true;
  }

  redo(): boolean {
    if (!canRedo(this.history)) return false;
    this.history = redo(this.history);
    this.afterEdit();
    return true;
  }

  get canUndo(): boolean {
    return canUndo(this.history);
  }

  get canRedo(): boolean {
    return canRedo(this.history);
  }

  private commit(next: Layout): void {
    this.history = push(this.history, next);
    this.afterEdit();
  }

  private afterEdit(): void {
    // A new line: the old run is gone (the belts are cleared, nothing is lost: it is all in the layout).
    this.sim = null;
    this.notedDeliveries = 0;
    this.hint = null;
    if (this.selected && !pieceAt(this.layout, this.selected)) this.selected = null;
    this.persistLayout();
  }

  persistLayout(): void {
    const key = this.saveKey;
    const l = clone(this.layout);
    if (this.mode === 'level' && key) this.save.layouts[key] = l;
    if (this.mode === 'sandbox') this.save.sandbox = l;
  }

  /* ---------- running ---------- */

  /** Make sure a run exists (GO / step). Starts over when the last run had settled. */
  ensureRun(): FactorySim {
    if (!this.sim || this.sim.settled) {
      this.sim = new FactorySim(this.layout);
      this.notedDeliveries = 0;
      this.runs++;
      this.hasRun = true;
    }
    return this.sim;
  }

  /** Back to tick 0 (the belts are emptied, the layout stays). */
  resetRun(): void {
    this.sim = null;
    this.notedDeliveries = 0;
  }

  /** One simulator tick, with what the scene needs to animate it. */
  tick(): TickInfo {
    const sim = this.ensureRun();
    const before = new Map<number, SimItem>();
    for (const s of sim.items()) before.set(s.item.id, s);
    const rep = sim.step();
    const after = new Map<number, SimItem>();
    for (const s of sim.items()) after.set(s.item.id, s);
    const deliveries = this.noteDeliveries(sim);
    return { tick: rep.tick, events: rep.events, before, after, deliveries, settled: sim.settled };
  }

  private noteDeliveries(sim: FactorySim): DeliveryNote[] {
    const all = sim.deliveries();
    if (all.length <= this.notedDeliveries) return [];
    const b = this.bandLevel;
    const res = b ? check(b.orders, all, { ran: true }) : null;
    const out: DeliveryNote[] = [];
    for (let i = this.notedDeliveries; i < all.length; i++) {
      const d = all[i];
      const m = res?.matched.find((x) => x.delivery === i);
      const s = res?.shelf.find((x) => x.delivery === i);
      const name = m ? m.name : s ? s.name : surpriseName(d.item);
      out.push({ index: i, delivery: d, matched: Boolean(m), bonus: Boolean(s?.bonus), name });
      this.collect(d.item, Boolean(m), name);
    }
    this.notedDeliveries = all.length;
    if (res) this.lastCheck = res;
    return out;
  }

  /** Every toy goes into the Grand Catalogue; surprises (and free creations) onto the shelf. */
  private collect(item: Item, wished: boolean, name: L): void {
    const key = lookKey(item);
    const cat = this.save.catalogue;
    const e = cat.find((c) => c.key === key);
    if (e) {
      e.count++;
      e.wished = e.wished || wished;
    } else {
      const look = lookOf(item);
      const nice = wished ? phrase(look, { article: 'none' }) : name;
      cat.push({ key, item: stripId(item), name: { fr: cap(nice.fr), en: cap(nice.en) }, count: 1, wished });
      if (cat.length > CATALOGUE_MAX) cat.splice(0, cat.length - CATALOGUE_MAX);
    }
    if (!wished) {
      this.save.shelf.push(stripId(item));
      if (this.save.shelf.length > SHELF_MAX) this.save.shelf.splice(0, this.save.shelf.length - SHELF_MAX);
    }
  }

  /** The run has settled: the check gate's verdict (never a failure). */
  endRun(): RunEnd | null {
    const b = this.bandLevel;
    if (!this.sim || !b || !this.level) return null;
    const result = check(b.orders, this.sim.deliveries(), { ran: true });
    this.lastCheck = result;
    let firstTime = false;
    if (result.complete && !this.complete) {
      this.complete = true;
      const done = this.save.done[this.level.id] ?? [];
      if (!done.includes(this.band)) {
        this.save.done[this.level.id] = [...done, this.band];
        firstTime = true;
      }
    }
    return { result, firstTime, complete: result.complete };
  }

  /** What the letter progress looks like now (from the last check, else nothing made). */
  progress(): { made: number; wanted: number; done: boolean }[] {
    const b = this.bandLevel;
    if (!b) return [];
    const p = this.lastCheck?.progress;
    return b.orders.map((o, i) => ({ made: p?.[i]?.made ?? 0, wanted: o.count, done: p?.[i]?.done ?? false }));
  }

  /* ---------- hints ---------- */

  askHint(): Hint | null {
    const b = this.bandLevel;
    if (!b) return null;
    this.hint = suggestNextStep(b, this.layout, { hasRun: this.hasRun });
    this.hintsUsed++;
    return this.hint;
  }

  /** "Show me": do what the hint says (one undoable step). */
  showHint(): boolean {
    const b = this.bandLevel;
    const h = this.hint;
    if (!b || !h) return false;
    const next = applyHint(b, this.layout, h);
    if (!next) return false;
    this.commit(next);
    if (h.at) this.selected = pieceAt(this.layout, h.at) ? h.at : null;
    this.slotOpen = null;
    return true;
  }

  /** World Memory stats for a finished letter (never shown to the child). */
  resultStats(): { correct: number; mistakes: number; total: number } {
    const n = this.bandLevel?.orders.length ?? 1;
    const extra = Math.min(3, Math.max(0, this.runs - 1) + Math.min(1, this.hintsUsed));
    return { correct: n, mistakes: extra, total: n + extra };
  }
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

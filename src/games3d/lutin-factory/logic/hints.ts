/**
 * Gentle hints: given the child's current layout, suggest ONE next helpful
 * step (shown only after the child asks, or as the glowing slot for little
 * ones; never automatic for big kids, design doc B8). No search, no CLI: it
 * runs the line once, reads what happened, then compares with the level's
 * reference solution.
 *
 * Order of reasoning:
 *   1. the letter is fulfilled → "all set";
 *   2. little ones: an empty glowing slot → "look at the glowing tile";
 *   3. something is stuck (a path that stops, a machine facing away);
 *   4. an assembler waiting for parts;
 *   5. the one difference the check gate found (colour, count…) → the
 *      reference machine of that kind: place it / set its dial / turn it;
 *   6. any other reference difference, then an extra machine to take away.
 */
import type { Cell, Dial, Dir, L, Layout, Piece } from './types';
import { cellLabel, dirToRel, inGrid, isBlocked, opposite, pieceAt, sameCell, step } from './grid';
import { getMachine } from './machines/registry';
import { flattenProgram, type ProgramEntry } from './machines/arm';
import { FactorySim } from './simulator';
import { check, type DiffKey } from './check';
import { getToy, recipe, fitsPart } from './toys';
import type { BandLevel } from './levels';
import { capitalize } from './names';
import { CARD_TEXT, COLOR_NAMES, DIR_NAMES, HINT_TEXT, MACHINE_TEXT, MATERIAL_NAMES, PATTERN_NAMES, SHAPE_NAMES, STICKER_NAMES, fillL } from './texts';
import type { Color, Item, Pattern, Shape, Sticker } from './types';

export type HintKind = 'done' | 'slot' | 'stuck' | 'turn' | 'basket' | 'place' | 'dial' | 'remove' | 'run';

export interface Hint {
  kind: HintKind;
  text: L;
  /** The tile to glow. */
  at?: Cell;
  machine?: string;
  dir?: Dir;
  dial?: Dial;
  focus?: DiffKey;
}

/** Machines that can change each kind of difference. */
const FOCUS_MACHINES: Record<DiffKey, string[]> = {
  color: ['painter', 'mixer', 'arm'],
  toy: ['shaper', 'assembler', 'arm'],
  n: ['chute', 'loop', 'assembler', 'arm'],
  sticker: ['stamper', 'counter'],
  wrap: ['wrapper', 'sorter'],
  material: ['chute'],
  partColors: ['arm'],
  bay: ['sorter', 'belt'],
  order: ['painter', 'shaper', 'wrapper', 'counter'],
};

/* ---------- describing dials (read aloud) ---------- */

const ordinal = (n: number): string => {
  const t = n % 100;
  const suffix = t >= 11 && t <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
};
const join = (xs: L[], sep = ', '): L => ({ fr: xs.map((x) => x.fr).join(sep), en: xs.map((x) => x.en).join(sep) });
const colorL = (c: Color): L => ({ fr: COLOR_NAMES[c].fr.m, en: COLOR_NAMES[c].en });
const shapeL = (s: Shape): L => ({ fr: SHAPE_NAMES[s].fr, en: SHAPE_NAMES[s].en });
const patternL = (p: Pattern): L => PATTERN_NAMES[p].name;
const stickerL = (s: Sticker): L => STICKER_NAMES[s];

/** A machine's dial in words ("rouge, bleu", "×5", "un train à 3 wagons"…). */
export function dialText(machine: string, dial: Dial): L {
  const d = dial as Record<string, unknown>;
  switch (machine) {
    case 'chute': {
      const m = MATERIAL_NAMES[(d.material as keyof typeof MATERIAL_NAMES) ?? 'wood'];
      return { fr: `${d.count} (${m.fr})`, en: `${d.count} (${m.en})` };
    }
    case 'shaper':
      return join(((d.shapes as Shape[]) ?? [d.shape as Shape]).map(shapeL));
    case 'painter':
      return join(((d.colors as Color[]) ?? [d.color as Color]).map(colorL));
    case 'mixer':
      return d.b ? join([colorL(d.a as Color), colorL(d.b as Color)], ' + ') : { fr: `+ ${colorL(d.a as Color).fr}`, en: `+ ${colorL(d.a as Color).en}` };
    case 'assembler': {
      const t = getToy(d.toy as string);
      if (!t) return { fr: String(d.toy), en: String(d.toy) };
      if (!t.n) return t.name;
      const n = Number(d.n);
      const i = n > 1 ? 1 : 0;
      return { fr: `${t.name.fr} ${t.n.join.fr} ${n} ${t.n.unit.fr[i]}`, en: `${t.name.en} ${t.n.join.en} ${n} ${t.n.unit.en[i]}` };
    }
    case 'counter':
      return d.mode === 'first'
        ? { fr: `les ${d.n} premiers tout droit`, en: `first ${d.n} straight on` }
        : { fr: `1 sur ${d.n} à droite`, en: d.n === 1 ? 'every one to the right' : `every ${ordinal(Number(d.n))} one to the right` };
    case 'sorter': {
      const parts: L[] = [];
      if (d.color) parts.push(colorL(d.color as Color));
      if (d.shape) parts.push(shapeL(d.shape as Shape));
      if (d.toy) parts.push(getToy(d.toy as string)?.name ?? { fr: String(d.toy), en: String(d.toy) });
      if (d.sticker) parts.push(stickerL(d.sticker as Sticker));
      if (d.wrap) parts.push(patternL(d.wrap as Pattern));
      if (d.material) parts.push(MATERIAL_NAMES[d.material as keyof typeof MATERIAL_NAMES]);
      const p = join(parts, ' + ');
      return { fr: `si ${p} → gauche`, en: `if ${p} → left` };
    }
    case 'loop':
      return { fr: `×${d.times}`, en: `×${d.times}` };
    case 'stamper':
      return stickerL(d.sticker as Sticker);
    case 'wrapper':
      return join(((d.patterns as Pattern[]) ?? [d.pattern as Pattern]).map(patternL));
    case 'arm': {
      const cards = flattenProgram(d.program as ProgramEntry[]);
      const names = (d.program as ProgramEntry[]).map((e): L =>
        typeof e === 'string'
          ? (CARD_TEXT[e.split(':')[0]] ?? { fr: e, en: e })
          : { fr: `${CARD_TEXT.repeat.fr} ×${e.repeat}`, en: `${CARD_TEXT.repeat.en} ×${e.repeat}` },
      );
      return { fr: `${join(names).fr} (${cards.length})`, en: `${join(names).en} (${cards.length})` };
    }
    case 'sack':
      return d.bay ? { fr: String(d.bay), en: String(d.bay) } : { fr: '', en: '' };
    default:
      return { fr: '', en: '' };
  }
}

const sameDial = (machine: string, a: Dial | undefined, b: Dial | undefined): boolean => {
  const def = getMachine(machine);
  if (!def) return JSON.stringify(a) === JSON.stringify(b);
  return JSON.stringify(def.dial.parse(a ?? {}) ?? def.dial.defaults) === JSON.stringify(def.dial.parse(b ?? {}) ?? def.dial.defaults);
};

const mText = (machine: string) => MACHINE_TEXT[machine] ?? { name: { fr: machine, en: machine }, def: { fr: machine, en: machine }, indef: { fr: machine, en: machine } };

function vars(machine: string, at: Cell, extra: { fr?: Record<string, string>; en?: Record<string, string> } = {}) {
  const t = mText(machine);
  const cell = cellLabel(at);
  return {
    fr: { machine: t.indef.fr, Machine: capitalize(t.def.fr), cell, ...(extra.fr ?? {}) },
    en: { machine: t.indef.en, Machine: capitalize(t.def.en), cell, ...(extra.en ?? {}) },
  };
}

/* ---------- reference comparison ---------- */

function referenceTarget(b: BandLevel): Piece[] {
  // The reference pieces as they stand on the grid (prebuilt dial changes included).
  return b.reference.map((p) => ({ ...p, at: [p.at[0], p.at[1]] as const }));
}

function compareWithReference(b: BandLevel, layout: Layout, prefer: string[]): Hint | null {
  const ref = referenceTarget(b);
  const ordered = [...ref.filter((p) => prefer.includes(p.machine)), ...ref.filter((p) => !prefer.includes(p.machine))];
  for (const r of ordered) {
    const cur = pieceAt(layout, r.at);
    if (!cur) return { kind: 'place', at: r.at, machine: r.machine, dir: r.dir, dial: r.dial, text: fillL(HINT_TEXT.place, vars(r.machine, r.at)) };
    if (cur.machine !== r.machine) {
      if (cur.locked) continue;
      return { kind: 'remove', at: cur.at, machine: cur.machine, text: fillL(HINT_TEXT.remove, vars(cur.machine, cur.at)) };
    }
    if (cur.dir !== r.dir && !cur.locked && cur.machine !== 'sack') {
      const dir = DIR_NAMES[r.dir];
      return { kind: 'turn', at: r.at, machine: r.machine, dir: r.dir, text: fillL(HINT_TEXT.turn, vars(r.machine, r.at, { fr: { dir: dir.fr }, en: { dir: dir.en } })) };
    }
    if (!sameDial(r.machine, cur.dial, r.dial)) {
      const v = dialText(r.machine, getMachine(r.machine)?.dial.parse(r.dial ?? {}) ?? {});
      return { kind: 'dial', at: r.at, machine: r.machine, dial: r.dial, text: fillL(HINT_TEXT.dial, vars(r.machine, r.at, { fr: { value: v.fr }, en: { value: v.en } })) };
    }
  }
  // Extra machines the reference does not use (only unlocked ones the child placed).
  for (const p of layout.pieces) {
    if (p.locked || ref.some((r) => sameCell(r.at, p.at)) || b.prebuilt.some((q) => sameCell(q.at, p.at))) continue;
    return { kind: 'remove', at: p.at, machine: p.machine, text: fillL(HINT_TEXT.remove, vars(p.machine, p.at)) };
  }
  return null;
}

/* ---------- the helper ---------- */

export interface HintOptions {
  /** Has the child pressed GO on this layout? If not, a "press GO" hint may come first. */
  hasRun?: boolean;
}

export function suggestNextStep(b: BandLevel, layout: Layout, opts: HintOptions = {}): Hint {
  const sim = new FactorySim(layout);
  sim.runUntilSettled();
  const result = check(b.orders, sim.deliveries(), { ran: true });
  if (result.complete) return { kind: 'done', text: HINT_TEXT.done };

  // Little ones: the glowing slot.
  for (const s of b.slots ?? []) {
    if (!pieceAt(layout, s.at)) return { kind: 'slot', at: s.at, dir: s.dir, text: HINT_TEXT.slot };
  }

  // Something stuck on the belts.
  const turnHint = (at: Cell, machine: string, d: Dir): Hint => ({
    kind: 'turn',
    at,
    machine,
    dir: d,
    text: fillL(HINT_TEXT.turn, vars(machine, at, { fr: { dir: DIR_NAMES[d].fr }, en: { dir: DIR_NAMES[d].en } })),
  });
  for (const si of sim.items()) {
    const holder = pieceAt(layout, si.at);
    const refHolder = b.reference.find((p) => sameCell(p.at, si.at));
    // The machine holding the item looks the other way than in the known solution: turn it.
    if (holder && !holder.locked && refHolder && refHolder.machine === holder.machine && refHolder.dir !== holder.dir) return turnHint(holder.at, holder.machine, refHolder.dir);
    const to = step(si.at, si.exit);
    if (!inGrid(layout, to) || isBlocked(layout, to)) {
      if (holder && !holder.locked) return turnHint(holder.at, holder.machine, refHolder?.dir ?? opposite(holder.dir));
      continue;
    }
    const there = pieceAt(layout, to);
    const refThere = b.reference.find((p) => sameCell(p.at, to));
    if (!there) {
      if (refThere) return { kind: 'place', at: to, machine: refThere.machine, dir: refThere.dir, dial: refThere.dial, text: fillL(HINT_TEXT.place, vars(refThere.machine, to)) };
      return { kind: 'stuck', at: to, machine: 'belt', dir: si.exit, text: fillL(HINT_TEXT.stuck, { fr: { cell: cellLabel(si.at), dir: DIR_NAMES[si.exit].fr }, en: { cell: cellLabel(si.at), dir: DIR_NAMES[si.exit].en } }) };
    }
    const def = getMachine(there.machine);
    if (def && !def.accepts(dirToRel(there.dir, opposite(si.exit))) && !there.locked) return turnHint(to, there.machine, refThere?.dir ?? si.exit);
  }

  // An assembler still waiting for parts.
  for (const m of sim.busyMachines()) {
    if (m.machine !== 'assembler') continue;
    const piece = pieceAt(layout, m.at);
    const toy = piece ? getToy(String((piece.dial as { toy?: string } | undefined)?.toy)) : undefined;
    if (!piece || !toy) continue;
    const basket = (sim.machineState(m.at) as { basket: Item[] }).basket;
    const missing: L[] = [];
    for (const part of recipe(toy, (piece.dial as { n?: number } | undefined)?.n)) {
      const have = basket.filter((it) => fitsPart(it, part)).length;
      const left = Math.max(0, part.count - have);
      if (left > 0 && part.shape) {
        const s = SHAPE_NAMES[part.shape];
        missing.push({ fr: `${left} ${left > 1 ? s.frPlural : s.fr}`, en: `${left} ${left > 1 ? s.enPlural : s.en}` });
      }
    }
    if (missing.length) {
      const parts = join(missing, ' + ');
      const waiting = fillL(HINT_TEXT.basket, { fr: { cell: cellLabel(m.at), parts: parts.fr }, en: { cell: cellLabel(m.at), parts: parts.en } });
      // Point at the cause too (usually a chute count or the assembler's own dial).
      const cause = compareWithReference(b, layout, FOCUS_MACHINES.n);
      if (cause) return { ...cause, focus: 'n', text: { fr: `${waiting.fr} ${cause.text.fr}`, en: `${waiting.en} ${cause.text.en}` } };
      return { kind: 'basket', at: m.at, machine: 'assembler', text: waiting };
    }
  }

  // The difference the check gate pointed at, then the rest of the reference.
  const prefer = result.focus ? FOCUS_MACHINES[result.focus] : [];
  const diff = compareWithReference(b, layout, prefer);
  if (diff) return { ...diff, ...(result.focus ? { focus: result.focus } : {}) };

  if (!opts.hasRun) return { kind: 'run', text: HINT_TEXT.run };
  return { kind: 'run', text: result.reason, ...(result.focus ? { focus: result.focus } : {}) };
}

/**
 * Follow the hints from a layout until the letter is fulfilled (tests: every
 * level's starting layout reaches its goal by hints alone, so a stuck child
 * always has a way forward). Returns the layouts visited.
 */
export function followHints(b: BandLevel, start: Layout, maxSteps = 60): { layout: Layout; steps: Hint[]; done: boolean } {
  let layout: Layout = { ...start, pieces: start.pieces.map((p) => ({ ...p })) };
  const steps: Hint[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const h = suggestNextStep(b, layout, { hasRun: true });
    steps.push(h);
    if (h.kind === 'done') return { layout, steps, done: true };
    const next = applyHint(b, layout, h);
    if (!next) return { layout, steps, done: false };
    layout = next;
  }
  return { layout, steps, done: false };
}

/** What a child following the hint would do (used by tests and the "show me" button). */
export function applyHint(b: BandLevel, layout: Layout, h: Hint): Layout | null {
  const pieces = layout.pieces.map((p) => ({ ...p }));
  const at = h.at;
  if (!at) return null;
  const i = pieces.findIndex((p) => sameCell(p.at, at));
  switch (h.kind) {
    case 'slot': {
      const s = (b.slots ?? []).find((x) => sameCell(x.at, at));
      const ref = b.reference.find((p) => sameCell(p.at, at));
      if (!s) return null;
      const c = s.choices.find((x) => ref && x.machine === ref.machine && sameDial(x.machine, x.dial, ref.dial)) ?? s.choices[0];
      pieces.push({ machine: c.machine, at, dir: s.dir, dial: c.dial });
      break;
    }
    case 'place':
    case 'stuck':
      if (i >= 0) return null;
      pieces.push({ machine: h.machine ?? 'belt', at, dir: h.dir ?? 'E', ...(h.dial ? { dial: h.dial } : {}) });
      break;
    case 'turn':
      if (i < 0 || !h.dir) return null;
      pieces[i] = { ...pieces[i], dir: h.dir };
      break;
    case 'dial':
      if (i < 0) return null;
      pieces[i] = { ...pieces[i], dial: h.dial };
      break;
    case 'remove':
      if (i < 0) return null;
      pieces.splice(i, 1);
      break;
    default:
      return null;
  }
  return { ...layout, pieces };
}

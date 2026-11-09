/**
 * Level loader + validator (docs/GAME_ARCHITECTURE.md §3.12).
 *
 * One JSON file per level in src/data/games/lutin-factory/levels/, with three
 * band variants (little / middle / big). The validator is strict:
 *   - known keys only, and NO timer / lives / score / fail field can exist;
 *   - every text is { fr, en }; machines, dials, toys, writers exist;
 *   - numbers stay within the band caps (≤ 5 / ≤ 20 / free);
 *   - the reference solution, run through the simulator, fulfils the letter
 *     (and the starting layout does not, so there is something to do);
 *   - for little ones' glowing slots, the other choices make a different toy;
 *   - across levels: difficulty never goes down inside a band, and every
 *     machine is introduced before a level asks the child to use it.
 */
import type { LearningSkill } from '@/lib/learning/skills';
import { LEARNING_SKILLS } from '@/lib/learning/skills';
import linesJson from '@/data/games/lutin-factory/lines.json';
import l01 from '@/data/games/lutin-factory/levels/l01.json';
import l02 from '@/data/games/lutin-factory/levels/l02.json';
import l03 from '@/data/games/lutin-factory/levels/l03.json';
import l04 from '@/data/games/lutin-factory/levels/l04.json';
import l05 from '@/data/games/lutin-factory/levels/l05.json';
import l06 from '@/data/games/lutin-factory/levels/l06.json';
import l07 from '@/data/games/lutin-factory/levels/l07.json';
import l08 from '@/data/games/lutin-factory/levels/l08.json';
import l09 from '@/data/games/lutin-factory/levels/l09.json';
import l10 from '@/data/games/lutin-factory/levels/l10.json';
import l11 from '@/data/games/lutin-factory/levels/l11.json';
import l12 from '@/data/games/lutin-factory/levels/l12.json';
import l13 from '@/data/games/lutin-factory/levels/l13.json';
import l14 from '@/data/games/lutin-factory/levels/l14.json';
import l15 from '@/data/games/lutin-factory/levels/l15.json';
import { BANDS, COLORS, DIRS, MATERIALS, PATTERNS, STICKERS } from './types';
import type { Band, Cell, Dial, Dir, L, Layout, Order, OrderProps, OrderSpec, Piece } from './types';
import { getMachine } from './machines/registry';
import { getToy, isToyId } from './toys';
import { cellLabel, inGrid, isBlocked, isDialLocked, key, sameCell } from './grid';
import { simulate } from './simulator';
import { check } from './check';
import { HALL_NAMES } from './texts';

/* ---------- types ---------- */

export interface Letter {
  /** A fictional village child (lines.json `writers`), never a real child. */
  from: string;
  text: L;
  /** Pre-baked voice line id. */
  voice: string;
}

export interface SlotChoice {
  machine: string;
  dial?: Dial;
}

/** Little ones: a glowing tile with 2–3 machines to choose from. */
export interface Slot {
  at: Cell;
  dir: Dir;
  choices: SlotChoice[];
}

/** Optional big-kid challenge, shown as Jingle's idea bulb, never required. */
export interface Idea {
  kind: 'max-machines' | 'one-go';
  value?: number;
}

export interface BandLevel {
  /** 1–10, never decreasing from one level to the next inside a band. */
  difficulty: number;
  grid: { w: number; h: number; blocked?: Cell[] };
  /** Machines offered for free placement. */
  tray: string[];
  prebuilt: Piece[];
  slots?: Slot[];
  letters: Letter[];
  orders: (Order & { letter?: number })[];
  /** A known solution: pieces added to `prebuilt` (or new dials for unlocked prebuilt dials). */
  reference: Piece[];
  ideas?: Idea[];
}

export interface FactoryLevel {
  schema: 'ziggy.level/1';
  game: 'lutin-factory';
  id: string;
  version: string;
  number: number;
  hall: string;
  title: L;
  /** The "new idea" of the level (design doc B6), said by Ziggy. */
  newIdea: L;
  season: string;
  assets: string[];
  skills: LearningSkill[];
  /** Machines the child meets for the first time here. */
  introduces: string[];
  bands: Record<Band, BandLevel>;
}

export interface LevelIssue {
  level: string;
  band?: Band;
  message: string;
}

/* ---------- caps & rules ---------- */

export const BAND_CAP: Record<Band, number> = { little: 5, middle: 20, big: 100 };
const BAND_RANK: Record<Band, number> = { little: 0, middle: 1, big: 2 };

/** Child-safety by construction: keys that must never exist anywhere in level data. */
export const BANNED_KEY = /(^time$|timer|timelimit|time_limit|seconds|lives|^life$|score|fail|deadline|countdown|penalt|streak|hurry|^lose$|^lost$)/i;

const LEVEL_KEYS = ['schema', 'game', 'id', 'version', 'number', 'hall', 'title', 'newIdea', 'season', 'assets', 'skills', 'introduces', 'bands'];
const BAND_KEYS = ['difficulty', 'grid', 'tray', 'prebuilt', 'slots', 'letters', 'orders', 'reference', 'ideas'];
const PIECE_KEYS = ['machine', 'at', 'dir', 'dial', 'locked', 'dialLocked'];
const ORDER_KEYS = ['toy', 'props', 'sequence', 'count', 'bay', 'exact', 'letter'];
const PROP_KEYS = ['color', 'material', 'sticker', 'wrap', 'n', 'partColors'];

const SEASONS = ['winter', 'spring', 'summer', 'autumn'];

const WRITERS = new Set((linesJson as { writers: { id: string }[] }).writers.map((w) => w.id));

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isL = (v: unknown): v is L => isObj(v) && typeof v.fr === 'string' && typeof v.en === 'string' && v.fr.trim() !== '' && v.en.trim() !== '';
const isCell = (v: unknown): v is Cell => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n));

/** Every key (recursively) of a JSON value. */
function allKeys(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) for (const x of v) allKeys(x, out);
  else if (isObj(v))
    for (const [k, x] of Object.entries(v)) {
      out.push(k);
      allKeys(x, out);
    }
  return out;
}

/* ---------- layouts ---------- */

function cleanPiece(p: Piece): Piece {
  const def = getMachine(p.machine);
  const dial = def ? (def.dial.parse(p.dial ?? {}) ?? def.dial.defaults) : (p.dial ?? {});
  const out: Piece = { machine: p.machine, at: [p.at[0], p.at[1]], dir: p.dir, dial };
  if (p.locked) out.locked = true;
  if (p.dialLocked !== undefined) out.dialLocked = p.dialLocked;
  return out;
}

/** What the child sees when the level opens. */
export function startLayout(b: BandLevel): Layout {
  return { w: b.grid.w, h: b.grid.h, blocked: (b.grid.blocked ?? []).map((c) => [c[0], c[1]] as const), pieces: b.prebuilt.map(cleanPiece) };
}

/**
 * `placements` applied on top of the starting layout: a placement on a
 * prebuilt tile replaces that machine's dial (if the dial is open), any
 * other placement adds a machine.
 */
export function applyPlacements(b: BandLevel, placements: Piece[]): Layout {
  const l = startLayout(b);
  for (const p of placements) {
    const i = l.pieces.findIndex((q) => sameCell(q.at, p.at));
    if (i >= 0) l.pieces[i] = { ...l.pieces[i], dial: cleanPiece({ ...l.pieces[i], dial: p.dial }).dial };
    else l.pieces.push(cleanPiece(p));
  }
  return l;
}

export const referenceLayout = (b: BandLevel): Layout => applyPlacements(b, b.reference);

/** Run a layout for a band and check it against the letter. */
export function runAndCheck(b: BandLevel, layout: Layout) {
  const { deliveries, sim } = simulate(layout);
  return { result: check(b.orders, deliveries), sim, deliveries };
}

/* ---------- single level validation ---------- */

function checkPiece(p: unknown, b: BandLevel, where: string, err: (m: string) => void): p is Piece {
  if (!isObj(p)) {
    err(`${where}: not an object`);
    return false;
  }
  for (const k of Object.keys(p)) if (!PIECE_KEYS.includes(k)) err(`${where}: unknown key "${k}"`);
  const def = typeof p.machine === 'string' ? getMachine(p.machine) : undefined;
  if (!def) err(`${where}: unknown machine "${String(p.machine)}"`);
  if (!isCell(p.at) || !inGrid(b.grid, p.at)) err(`${where}: "at" must be a cell inside the grid`);
  else if (isBlocked({ ...b.grid, pieces: [] }, p.at)) err(`${where}: on a blocked tile`);
  if (!(DIRS as readonly unknown[]).includes(p.dir)) err(`${where}: bad dir`);
  if (def && p.dial !== undefined && !def.dial.parse(p.dial)) err(`${where}: invalid dial ${JSON.stringify(p.dial)} for ${def.id}`);
  if (p.locked !== undefined && typeof p.locked !== 'boolean') err(`${where}: locked must be boolean`);
  if (p.dialLocked !== undefined && typeof p.dialLocked !== 'boolean') err(`${where}: dialLocked must be boolean`);
  return !!def && isCell(p.at);
}

function checkProps(props: unknown, toyId: string, where: string, err: (m: string) => void, cap: number) {
  if (props === undefined) return;
  if (!isObj(props)) return err(`${where}: props must be an object`);
  for (const k of Object.keys(props)) if (!PROP_KEYS.includes(k)) err(`${where}: unknown prop "${k}"`);
  const p = props as OrderProps;
  if (p.color !== undefined && !(COLORS as readonly string[]).includes(p.color)) err(`${where}: bad colour`);
  if (p.material !== undefined && !(MATERIALS as readonly string[]).includes(p.material)) err(`${where}: bad material`);
  if (p.sticker !== undefined && p.sticker !== 'none' && !(STICKERS as readonly string[]).includes(p.sticker)) err(`${where}: bad sticker`);
  if (p.wrap !== undefined && p.wrap !== 'none' && !(PATTERNS as readonly string[]).includes(p.wrap)) err(`${where}: bad wrap`);
  if (p.partColors !== undefined && (!Array.isArray(p.partColors) || !p.partColors.every((c) => (COLORS as readonly string[]).includes(c))))
    err(`${where}: bad partColors`);
  if (p.n !== undefined) {
    const t = getToy(toyId);
    if (!t?.n || !Number.isInteger(p.n) || p.n < t.n.min || p.n > t.n.max) err(`${where}: n=${p.n} is not valid for ${toyId}`);
    else if (p.n > cap) err(`${where}: n=${p.n} is above the band cap ${cap}`);
  }
}

function checkSpec(s: unknown, where: string, err: (m: string) => void, cap: number) {
  if (!isObj(s)) return err(`${where}: not an object`);
  for (const k of Object.keys(s)) if (k !== 'toy' && k !== 'props') err(`${where}: unknown key "${k}"`);
  const toy = s.toy;
  if (toy !== 'surprise' && !isToyId(toy)) err(`${where}: unknown toy "${String(toy)}"`);
  checkProps(s.props, String(toy), where, err, cap);
}

/** Numbers a band must keep under its cap (chute counts, dial numbers). */
function dialNumbers(p: Piece): number[] {
  const d = (p.dial ?? {}) as Record<string, unknown>;
  const out: number[] = [];
  if (p.machine === 'chute' && typeof d.count === 'number') out.push(d.count);
  if (p.machine === 'assembler' && typeof d.n === 'number') out.push(d.n);
  if (p.machine === 'loop' && typeof d.times === 'number') out.push(d.times);
  if (p.machine === 'counter' && typeof d.n === 'number') out.push(d.n);
  return out;
}

function validateBand(lv: FactoryLevel, band: Band, raw: unknown, out: LevelIssue[]) {
  const err = (message: string) => out.push({ level: String(lv.id), band, message });
  if (!isObj(raw)) return err('band block missing');
  for (const k of Object.keys(raw)) if (!BAND_KEYS.includes(k)) err(`unknown key "${k}"`);
  const b = raw as unknown as BandLevel;
  const cap = BAND_CAP[band];

  if (!Number.isInteger(b.difficulty) || b.difficulty < 1 || b.difficulty > 10) err('difficulty must be 1–10');
  if (!isObj(b.grid) || !Number.isInteger(b.grid.w) || !Number.isInteger(b.grid.h) || b.grid.w < 3 || b.grid.h < 3 || b.grid.w > 12 || b.grid.h > 8)
    return err('grid must be between 3×3 and 12×8');
  for (const k of Object.keys(b.grid)) if (!['w', 'h', 'blocked'].includes(k)) err(`grid: unknown key "${k}"`);
  if (b.grid.blocked !== undefined && (!Array.isArray(b.grid.blocked) || !b.grid.blocked.every((c) => isCell(c) && inGrid(b.grid, c))))
    err('grid.blocked must be cells inside the grid');

  // Tray
  if (!Array.isArray(b.tray)) return err('tray must be an array');
  for (const m of b.tray) {
    const def = getMachine(m);
    if (!def) err(`tray: unknown machine "${m}"`);
    else if (BAND_RANK[def.minBand] > BAND_RANK[band]) err(`tray: "${m}" is for the ${def.minBand} band and up`);
  }

  // Prebuilt
  if (!Array.isArray(b.prebuilt) || !Array.isArray(b.reference)) return err('prebuilt and reference must be arrays');
  const seen = new Set<string>();
  b.prebuilt.forEach((p, i) => {
    if (!checkPiece(p, b, `prebuilt[${i}]`, err)) return;
    if (seen.has(key(p.at))) err(`prebuilt[${i}]: two machines on ${key(p.at)}`);
    seen.add(key(p.at));
    for (const n of dialNumbers(cleanPiece(p))) if (n > cap) err(`prebuilt[${i}]: ${n} is above the band cap ${cap}`);
    const bay = (p.dial as { bay?: unknown } | undefined)?.bay;
    if (p.machine === 'sack' && typeof bay === 'string' && /^[A-Z][0-9]+$/.test(bay) && bay !== cellLabel(p.at))
      err(`prebuilt[${i}]: sack bay "${bay}" must match its coordinates ${cellLabel(p.at)}`);
  });

  // Slots
  const slots = b.slots ?? [];
  if (b.slots !== undefined && !Array.isArray(b.slots)) err('slots must be an array');
  slots.forEach((s, i) => {
    if (!isObj(s) || !isCell(s.at) || !inGrid(b.grid, s.at)) return err(`slots[${i}]: bad cell`);
    for (const k of Object.keys(s)) if (!['at', 'dir', 'choices'].includes(k)) err(`slots[${i}]: unknown key "${k}"`);
    if (seen.has(key(s.at))) err(`slots[${i}]: tile ${key(s.at)} already has a prebuilt machine`);
    if (!(DIRS as readonly unknown[]).includes(s.dir)) err(`slots[${i}]: bad dir`);
    if (!Array.isArray(s.choices) || s.choices.length < 2 || s.choices.length > 3) err(`slots[${i}]: 2–3 choices`);
    else
      s.choices.forEach((c, j) => {
        const def = getMachine(c.machine);
        if (!def) err(`slots[${i}].choices[${j}]: unknown machine`);
        else if (c.dial !== undefined && !def.dial.parse(c.dial)) err(`slots[${i}].choices[${j}]: invalid dial`);
        for (const k of Object.keys(c)) if (k !== 'machine' && k !== 'dial') err(`slots[${i}].choices[${j}]: unknown key "${k}"`);
      });
  });

  // Letters
  if (!Array.isArray(b.letters) || b.letters.length === 0) err('at least one letter');
  else
    b.letters.forEach((l, i) => {
      if (!isObj(l)) return err(`letters[${i}]: not an object`);
      for (const k of Object.keys(l)) if (!['from', 'text', 'voice'].includes(k)) err(`letters[${i}]: unknown key "${k}"`);
      if (!WRITERS.has(l.from)) err(`letters[${i}]: unknown writer "${l.from}"`);
      if (!isL(l.text)) err(`letters[${i}]: text needs fr and en`);
      if (typeof l.voice !== 'string' || !/^factory\.[a-z0-9.-]+$/.test(l.voice)) err(`letters[${i}]: bad voice id`);
    });

  // Orders
  if (!Array.isArray(b.orders) || b.orders.length === 0) return err('at least one order');
  let total = 0;
  b.orders.forEach((o, i) => {
    const where = `orders[${i}]`;
    if (!isObj(o)) return err(`${where}: not an object`);
    for (const k of Object.keys(o)) if (!ORDER_KEYS.includes(k)) err(`${where}: unknown key "${k}"`);
    if ((o.toy === undefined) === (o.sequence === undefined)) err(`${where}: give either toy or sequence`);
    if (o.toy !== undefined) checkSpec({ toy: o.toy, ...(o.props ? { props: o.props } : {}) }, where, err, cap);
    if (o.sequence !== undefined) {
      if (o.props !== undefined) err(`${where}: props go inside the sequence`);
      if (!Array.isArray(o.sequence) || o.sequence.length < 2) err(`${where}: a sequence has 2+ steps`);
      else o.sequence.forEach((s: OrderSpec, j: number) => checkSpec(s, `${where}.sequence[${j}]`, err, cap));
    }
    if (!Number.isInteger(o.count) || o.count < 1 || o.count > cap) err(`${where}: count must be 1–${cap}`);
    total += Number(o.count) || 0;
    if (o.bay !== undefined && !b.prebuilt.some((p) => p.machine === 'sack' && (p.dial as { bay?: string } | undefined)?.bay === o.bay))
      err(`${where}: no sack has bay "${o.bay}"`);
    if (o.exact !== undefined && typeof o.exact !== 'boolean') err(`${where}: exact must be boolean`);
    if (o.letter !== undefined && (!Number.isInteger(o.letter) || o.letter < 0 || o.letter >= (b.letters?.length ?? 0))) err(`${where}: bad letter index`);
  });
  if (total > cap) err(`orders ask for ${total} toys, above the band cap ${cap}`);

  // Reference: placeable with what the child has
  const slotAt = (c: Cell) => slots.find((s) => sameCell(s.at, c));
  const refSeen = new Set<string>();
  b.reference.forEach((p, i) => {
    const where = `reference[${i}]`;
    if (!checkPiece(p, b, where, err)) return;
    if (refSeen.has(key(p.at))) err(`${where}: two reference pieces on ${key(p.at)}`);
    refSeen.add(key(p.at));
    for (const n of dialNumbers(cleanPiece(p))) if (n > cap) err(`${where}: ${n} is above the band cap ${cap}`);
    const pre = b.prebuilt.find((q) => sameCell(q.at, p.at));
    const slot = slotAt(p.at);
    if (pre) {
      if (pre.machine !== p.machine) err(`${where}: replaces a prebuilt ${pre.machine} with a ${p.machine}`);
      else if (isDialLocked(pre)) err(`${where}: changes a locked dial`);
    } else if (slot) {
      const ok = slot.choices.some((c) => c.machine === p.machine && JSON.stringify(cleanPiece({ ...p, dial: c.dial }).dial) === JSON.stringify(cleanPiece(p).dial));
      if (!ok) err(`${where}: is not one of the slot's choices`);
      if (p.dir !== slot.dir) err(`${where}: must face the slot's direction`);
    } else if (!b.tray.includes(p.machine)) {
      err(`${where}: "${p.machine}" is not in the tray`);
    }
  });
  for (const s of slots) if (!b.reference.some((p) => sameCell(p.at, s.at))) err(`slot ${key(s.at)} has no reference choice`);

  if (out.some((x) => x.level === lv.id && x.band === band)) return; // don't simulate a broken block

  // Simulation: the reference fulfils the letter, the start does not.
  const ref = runAndCheck(b, referenceLayout(b));
  if (!ref.result.complete) err(`reference does not fulfil the letter: ${ref.result.reason.en}`);
  if (!ref.sim.finished) err('reference leaves items waiting or machines busy');
  const start = runAndCheck(b, startLayout(b));
  if (start.result.complete) err('the starting layout already fulfils the letter');
  // Little ones' choices: every other choice makes something different.
  for (const s of slots) {
    for (const c of s.choices) {
      const refPiece = b.reference.find((p) => sameCell(p.at, s.at));
      if (refPiece && refPiece.machine === c.machine && JSON.stringify(cleanPiece({ ...refPiece, dial: c.dial }).dial) === JSON.stringify(cleanPiece(refPiece).dial)) continue;
      const alt = b.reference.map((p) => (sameCell(p.at, s.at) ? { machine: c.machine, at: s.at, dir: s.dir, dial: c.dial } : p));
      if (runAndCheck(b, applyPlacements(b, alt)).result.complete) err(`slot ${key(s.at)}: choice ${JSON.stringify(c)} also fulfils the letter`);
    }
  }
}

export function validateLevel(raw: unknown, opts: { assetExists?: (id: string) => boolean } = {}): LevelIssue[] {
  const out: LevelIssue[] = [];
  const id = isObj(raw) && typeof raw.id === 'string' ? raw.id : '?';
  const err = (message: string) => out.push({ level: id, message });
  if (!isObj(raw)) return [{ level: id, message: 'not an object' }];
  for (const k of allKeys(raw)) if (BANNED_KEY.test(k)) err(`banned key "${k}" (no timers, lives, scores or failure in our games)`);
  for (const k of Object.keys(raw)) if (!LEVEL_KEYS.includes(k)) err(`unknown key "${k}"`);
  const lv = raw as unknown as FactoryLevel;
  if (lv.schema !== 'ziggy.level/1') err('schema must be "ziggy.level/1"');
  if (lv.game !== 'lutin-factory') err('game must be "lutin-factory"');
  if (!/^factory\.l\d{2}$/.test(id)) err('id must look like factory.l01');
  if (typeof lv.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(lv.version)) err('version must be semver');
  if (!Number.isInteger(lv.number) || lv.number < 1) err('number must be a positive integer');
  if (!HALL_NAMES[lv.hall]) err(`unknown hall "${lv.hall}"`);
  if (!isL(lv.title)) err('title needs fr and en');
  if (!isL(lv.newIdea)) err('newIdea needs fr and en');
  if (!SEASONS.includes(lv.season)) err('unknown season');
  if (!Array.isArray(lv.assets) || !lv.assets.every((a) => typeof a === 'string')) err('assets must be a list of asset ids');
  else if (opts.assetExists) for (const a of lv.assets) if (!opts.assetExists(a)) err(`unknown asset "${a}"`);
  if (!Array.isArray(lv.skills) || lv.skills.length === 0 || !lv.skills.every((s) => (LEARNING_SKILLS as readonly string[]).includes(s)))
    err('skills must be LearningSkill ids');
  if (!Array.isArray(lv.introduces) || !lv.introduces.every((m) => !!getMachine(m))) err('introduces must list machine ids');
  if (!isObj(lv.bands)) return [...out, { level: id, message: 'bands missing' }];
  for (const k of Object.keys(lv.bands)) if (!(BANDS as readonly string[]).includes(k)) err(`unknown band "${k}"`);
  for (const band of BANDS) validateBand(lv, band, lv.bands[band], out);
  return out;
}

/* ---------- the whole set ---------- */

/** Machines a band asks the child to use (tray, slot choices, reference placements and dial changes). */
export function machinesUsed(b: BandLevel): Set<string> {
  const s = new Set<string>(b.tray);
  for (const sl of b.slots ?? []) for (const c of sl.choices) s.add(c.machine);
  for (const p of b.reference) s.add(p.machine);
  for (const p of b.prebuilt) if (!isDialLocked(p)) s.add(p.machine);
  return s;
}

export function validateLevelSet(levels: readonly FactoryLevel[]): LevelIssue[] {
  const out: LevelIssue[] = [];
  const ids = new Set<string>();
  const sorted = [...levels].sort((a, b) => a.number - b.number);
  sorted.forEach((lv, i) => {
    if (ids.has(lv.id)) out.push({ level: lv.id, message: 'duplicate id' });
    ids.add(lv.id);
    if (lv.number !== i + 1) out.push({ level: lv.id, message: `levels must be numbered 1..N without gaps (found ${lv.number} at ${i + 1})` });
  });
  const introduced = new Set<string>();
  const lastDifficulty: Record<Band, number> = { little: 0, middle: 0, big: 0 };
  for (const lv of sorted) {
    for (const m of lv.introduces) {
      if (introduced.has(m)) out.push({ level: lv.id, message: `"${m}" was already introduced` });
      introduced.add(m);
    }
    for (const band of BANDS) {
      const b = lv.bands[band];
      if (!b) continue;
      for (const m of machinesUsed(b)) if (!introduced.has(m)) out.push({ level: lv.id, band, message: `uses "${m}" before it is introduced` });
      if (b.difficulty < lastDifficulty[band]) out.push({ level: lv.id, band, message: `difficulty goes down (${lastDifficulty[band]} → ${b.difficulty})` });
      lastDifficulty[band] = b.difficulty;
    }
  }
  return out;
}

/* ---------- loader ---------- */

const RAW_LEVELS: unknown[] = [l01, l02, l03, l04, l05, l06, l07, l08, l09, l10, l11, l12, l13, l14, l15];

/** All levels, in order (cast after validation; tests run the validator on every file). */
export const LEVELS: readonly FactoryLevel[] = RAW_LEVELS.map((l) => l as FactoryLevel).sort((a, b) => a.number - b.number);

export const getLevel = (id: string): FactoryLevel | undefined => LEVELS.find((l) => l.id === id);
export const levelBand = (lv: FactoryLevel, band: Band): BandLevel => lv.bands[band];

/** Levels of a hall (halls open in order, levels inside a hall in any order). */
export function hallLevels(hall: string): FactoryLevel[] {
  return LEVELS.filter((l) => l.hall === hall);
}

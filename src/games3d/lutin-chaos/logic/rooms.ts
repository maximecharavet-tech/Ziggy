/**
 * Room loader + validator. Content lives in `src/data/games/lutin-chaos/rooms/*.json`.
 *
 * `validateRoom(raw)` checks, for every room and band:
 * - the envelope (schema, ids, FR + EN texts, LearningSkills) and that NO
 *   timer / lives / score / fail field exists anywhere (child safety by construction);
 * - props, slots and hiding places are consistent; prank types and fix
 *   mechanics exist with valid params; pranks of a pool touch different props;
 * - every prank is fixable: applying then undoing it gives back the tidy room;
 * - across many seeds: clues point to exactly the culprit, every elf gets a
 *   prank, every fix puzzle is solvable, takes 10–20 s and stays within the
 *   band's number caps, and a perfect play reaches the photo with the room tidy;
 * - the finale has the band's number of steps and rewinds to the tidy room;
 * - learning goals: the A9 main goals of the room are declared and trained.
 * `validateRooms(all)` adds the progression checks across the 15 rooms.
 */
import r01 from '@/data/games/lutin-chaos/rooms/01-hall.json';
import r02 from '@/data/games/lutin-chaos/rooms/02-kitchen.json';
import r03 from '@/data/games/lutin-chaos/rooms/03-living-room.json';
import r04 from '@/data/games/lutin-chaos/rooms/04-bathroom.json';
import r05 from '@/data/games/lutin-chaos/rooms/05-bedroom.json';
import r06 from '@/data/games/lutin-chaos/rooms/06-playroom.json';
import r07 from '@/data/games/lutin-chaos/rooms/07-library.json';
import r08 from '@/data/games/lutin-chaos/rooms/08-music-room.json';
import r09 from '@/data/games/lutin-chaos/rooms/09-snowy-garden.json';
import r10 from '@/data/games/lutin-chaos/rooms/10-workshop.json';
import r11 from '@/data/games/lutin-chaos/rooms/11-dining-room.json';
import r12 from '@/data/games/lutin-chaos/rooms/12-attic.json';
import r13 from '@/data/games/lutin-chaos/rooms/13-cellar.json';
import r14 from '@/data/games/lutin-chaos/rooms/14-roof.json';
import r15 from '@/data/games/lutin-chaos/rooms/15-christmas-eve.json';
import { PRANKS as PLANNER_PRANKS } from '@/data/lutins/pranks';
import { LEARNING_SKILLS } from '@/lib/learning/skills';
import { cluesValid } from './clues';
import { checkAnswer, FIX_IDS, FIXES, isFixId, validateFixParams, type Puzzle } from './fixes';
import { FINALE_STEPS } from './finale';
import { A9_MAIN, INHERENT_GOALS } from './goals';
import { applyPrank, PRANK_TYPES, undoPrank } from './pranks';
import { makeRng } from './rand';
import { perfectRun, replay } from './replay';
import { referenceState, type RoomDef } from './room-def';
import { sameRoom } from './room-state';
import { startRoom } from './session';
import { BANDS, CHAOS_GOALS, ELF_IDS, isElf, type Band, type ChaosGoal, type L } from './types';
import { isColor, wordById } from './vocab';

export const RAW_ROOMS: unknown[] = [r01, r02, r03, r04, r05, r06, r07, r08, r09, r10, r11, r12, r13, r14, r15];

/** The 15 rooms, in house order. Validated by `rooms.test.ts` (and `validateRoom` at dev load if wanted). */
export const ROOMS: RoomDef[] = RAW_ROOMS as RoomDef[];
export const ROOM_IDS = ROOMS.map((r) => r.id);
export const roomById = (id: string) => ROOMS.find((r) => r.id === id) ?? null;
export const roomByNumber = (n: number) => ROOMS.find((r) => r.number === n) ?? null;

/** Rooms featuring tonight's prank type from the parents' planner (only the id is used). */
export const roomsForNightPrank = (prankId: string) => ROOMS.filter((r) => r.pranks.some((p) => p.themes?.includes(prankId))).map((r) => r.id);

export interface RoomIssue {
  room: string;
  message: string;
}

/** Child-safety by construction: these keys may not appear anywhere in a room. */
export const FORBIDDEN_KEYS = ['timeLimit', 'timer', 'time_limit', 'countdown', 'deadline', 'lives', 'life', 'score', 'fail', 'failure', 'gameOver', 'game_over', 'penalty', 'lose', 'loss'];

/** Band number caps (design doc A2). */
export const BAND_CAPS: Record<Band, number> = { little: 5, middle: 20, big: 100 };
export const PICK_COUNT: Record<Band, { min: number; max: number }> = { little: { min: 3, max: 3 }, middle: { min: 4, max: 5 }, big: { min: 5, max: 6 } };

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROOM_ID_RE = /^chaos\.[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ASSET_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

const isL = (v: unknown): v is L => !!v && typeof v === 'object' && typeof (v as L).fr === 'string' && typeof (v as L).en === 'string' && !!(v as L).fr.trim() && !!(v as L).en.trim();
const isVec3 = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && Number.isFinite(x));

function forbiddenKeys(v: unknown, path: string, out: string[]) {
  if (Array.isArray(v)) v.forEach((x, i) => forbiddenKeys(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) {
      if (FORBIDDEN_KEYS.some((f) => f.toLowerCase() === k.toLowerCase())) out.push(`forbidden field "${k}" at ${path}`);
      forbiddenKeys(x, `${path}.${k}`, out);
    }
}

/** Numbers a puzzle shows stay within the band cap. */
export function puzzleWithinCaps(p: Puzzle): boolean {
  const cap = BAND_CAPS[p.band];
  if (p.fix === 'count-back') {
    if (p.band === 'big') return true;
    return Object.values(p.numbers).every((n) => n <= cap) && p.solution <= cap;
  }
  if (p.fix === 'order' && (p.by === 'number' || p.by === 'skip')) return p.items.every((i) => i.value <= cap);
  if (p.fix === 'pattern' && p.rule === 'plus') return p.band === 'big';
  return true;
}

/** Stand-alone checks of one room. `seeds` = how many seeded plays per band to simulate. */
export function validateRoom(raw: unknown, opts: { seeds?: number } = {}): RoomIssue[] {
  const seeds = opts.seeds ?? 12;
  const r = raw as RoomDef;
  const room = typeof r?.id === 'string' ? r.id : '?';
  const errs: string[] = [];
  const out = () => errs.map((message) => ({ room, message }));

  if (!r || typeof r !== 'object') return [{ room, message: 'not an object' }];
  forbiddenKeys(r, room, errs);
  if (r.schema !== 'ziggy.level/1') errs.push('schema must be "ziggy.level/1"');
  if (r.game !== 'lutin-chaos') errs.push('game must be "lutin-chaos"');
  if (!ROOM_ID_RE.test(room)) errs.push(`bad room id "${room}"`);
  if (!Number.isInteger(r.number) || r.number < 1 || r.number > 15) errs.push('number must be 1–15');
  if (!SEMVER_RE.test(r.version ?? '')) errs.push('version must be semver');
  if (!isL(r.title) || !isL(r.intro)) errs.push('title and intro need fr + en');
  if (typeof r.season !== 'string' || typeof r.layout !== 'string') errs.push('season and layout are required');
  if (!Array.isArray(r.assets) || r.assets.some((a) => !ASSET_RE.test(a))) errs.push('assets must be asset registry ids');
  if (!Array.isArray(r.goals) || r.goals.some((g) => !(CHAOS_GOALS as readonly string[]).includes(g))) errs.push('goals must be A9 goals');
  if (!Array.isArray(r.skills) || r.skills.length === 0 || r.skills.some((s) => !(LEARNING_SKILLS as readonly string[]).includes(s))) errs.push('skills must be LearningSkills');
  if (!Array.isArray(r.slots) || !Array.isArray(r.props) || !Array.isArray(r.hidingSpots) || !Array.isArray(r.pranks) || !r.finale || !r.bands) {
    errs.push('slots, props, hidingSpots, pranks, finale and bands are required');
    return out();
  }

  // ---- slots, props, hiding places
  const uniq = (ids: string[], what: string) => {
    if (new Set(ids).size !== ids.length) errs.push(`duplicate ${what} id`);
    for (const id of ids) if (!ID_RE.test(id)) errs.push(`bad ${what} id "${id}"`);
  };
  uniq(r.slots.map((s) => s.id), 'slot');
  uniq(r.props.map((p) => p.id), 'prop');
  uniq(r.hidingSpots.map((h) => h.id), 'hiding spot');
  uniq(r.pranks.map((p) => p.id), 'prank');
  const slotIds = r.slots.map((s) => s.id);
  for (const s of r.slots) if (!isL(s.label) || !isL(s.in) || !isVec3(s.at)) errs.push(`slot "${s.id}" needs label, in and at`);
  for (const h of r.hidingSpots) if (!isL(h.label) || !isVec3(h.at)) errs.push(`hiding spot "${h.id}" needs label and at`);
  for (const p of r.props) {
    if (!wordById(p.kind)) errs.push(`prop "${p.id}": unknown kind "${p.kind}"`);
    if (!slotIds.includes(p.slot)) errs.push(`prop "${p.id}": unknown slot "${p.slot}"`);
    if (!isColor(p.color)) errs.push(`prop "${p.id}": unknown colour "${p.color}"`);
    if (![0, 1, 2, 3].includes(p.rot)) errs.push(`prop "${p.id}": rot must be 0–3`);
    if (!Number.isInteger(p.count) || p.count < 1 || p.count > 20) errs.push(`prop "${p.id}": count must be 1–20`);
    if (typeof p.hidden !== 'boolean') errs.push(`prop "${p.id}": hidden must be a boolean`);
  }
  if (errs.length) return out();

  // ---- pranks: type, params, fix, texts, fixable alone
  const ref = referenceState(r);
  const planner = new Set(PLANNER_PRANKS.map((p) => p.id));
  for (const p of r.pranks) {
    const def = PRANK_TYPES[p.type];
    if (!def || p.type === 'chain-reaction') {
      errs.push(`prank "${p.id}": unknown or finale-only type "${p.type}"`);
      continue;
    }
    const perr = def.validate(p.params, { state: ref, slots: slotIds });
    if (perr.length) errs.push(...perr.map((e) => `prank "${p.id}": ${e}`));
    if (p.culprit !== 'random' && !isElf(p.culprit)) errs.push(`prank "${p.id}": culprit must be an elf or "random"`);
    if (!isL(p.spot) || !isL(p.fixed)) errs.push(`prank "${p.id}": spot and fixed lines need fr + en`);
    for (const t of p.themes ?? []) if (!planner.has(t)) errs.push(`prank "${p.id}": theme "${t}" is not a /lutins planner prank`);
    if (!isFixId(p.fix?.mechanic)) errs.push(`prank "${p.id}": unknown fix mechanic "${p.fix?.mechanic}"`);
    else {
      errs.push(...validateFixParams(p.fix.mechanic, p.fix.params ?? {}).map((e) => `prank "${p.id}": ${e}`));
      for (const b of Object.values(p.fix.bands ?? {})) errs.push(...validateFixParams(p.fix.mechanic, b ?? {}).map((e) => `prank "${p.id}": ${e}`));
      for (const k of ['item', 'anchor'])
        if (typeof p.fix.params?.[k] === 'string' && !wordById(p.fix.params[k] as string)) errs.push(`prank "${p.id}": fix ${k} "${p.fix.params[k]}" is not a word`);
      if (typeof p.fix.params?.target === 'string' && !slotIds.includes(p.fix.params.target as string)) errs.push(`prank "${p.id}": fix target is not a slot`);
    }
    if (!perr.length) {
      const { state, record } = applyPrank(ref, { id: p.id, type: p.type, params: p.params }, makeRng(1));
      if (record.changes.length === 0 || sameRoom(state, ref)) errs.push(`prank "${p.id}" changes nothing`);
      if (!sameRoom(undoPrank(state, record), ref)) errs.push(`prank "${p.id}" is not undone exactly`);
    }
  }

  // ---- finale steps
  const stepIds = r.finale.steps.map((s) => s.id);
  if (!isL(r.finale.name)) errs.push('finale name needs fr + en');
  if (new Set(stepIds).size !== stepIds.length) errs.push('duplicate finale step id');
  for (const s of r.finale.steps) if (!isL(s.label)) errs.push(`finale step "${s.id}" needs a label`);

  // ---- bands
  for (const band of BANDS) {
    const b = r.bands[band];
    if (!b) {
      errs.push(`band "${band}" is missing`);
      continue;
    }
    const pc = PICK_COUNT[band];
    if (b.pickCount < pc.min || b.pickCount > pc.max) errs.push(`${band}: pickCount ${b.pickCount} outside ${pc.min}–${pc.max}`);
    if (b.pool.length < b.pickCount) errs.push(`${band}: pool smaller than pickCount`);
    if (b.pool.length <= b.pickCount && b.pool.length < 4) errs.push(`${band}: pool too small for replay variety`);
    for (const id of b.pool) if (!r.pranks.some((p) => p.id === id)) errs.push(`${band}: unknown prank "${id}" in pool`);
    for (const id of b.hidingSpots) if (!r.hidingSpots.some((h) => h.id === id)) errs.push(`${band}: unknown hiding spot "${id}"`);
    if (b.hidingSpots.length < 3) errs.push(`${band}: needs 3+ hiding places`);
    // pool pranks must touch different props (any subset, any order, undone independently)
    const seen = new Map<string, string>();
    for (const id of b.pool) {
      const p = r.pranks.find((x) => x.id === id);
      if (!p || !PRANK_TYPES[p.type]) continue;
      for (const prop of PRANK_TYPES[p.type].props(p.params)) {
        if (seen.has(prop)) errs.push(`${band}: pranks "${seen.get(prop)}" and "${id}" both touch "${prop}"`);
        seen.set(prop, id);
      }
    }
    const fs = FINALE_STEPS[band];
    if (b.finale.length < fs.min || b.finale.length > fs.max) errs.push(`${band}: finale has ${b.finale.length} steps, expected ${fs.min}–${fs.max}`);
    for (const id of b.finale) if (!stepIds.includes(id)) errs.push(`${band}: unknown finale step "${id}"`);
    if (new Set(b.finale).size !== b.finale.length) errs.push(`${band}: finale repeats a step`);
    if (!errs.length) {
      const steps = b.finale.map((id) => r.finale.steps.find((s) => s.id === id)!);
      const chain = PRANK_TYPES['chain-reaction'];
      const cerr = chain.validate({ steps }, { state: ref, slots: slotIds });
      if (cerr.length) errs.push(...cerr.map((e) => `${band} finale: ${e}`));
    }
  }
  if (errs.length) return out();

  // ---- simulation across seeds: clues, coverage, puzzles, perfect play
  const trained = new Set<ChaosGoal>(INHERENT_GOALS);
  for (const band of BANDS) {
    for (let seed = 0; seed < seeds; seed++) {
      let s;
      try {
        s = startRoom(r, band, seed);
      } catch (e) {
        errs.push(`${band} seed ${seed}: ${(e as Error).message}`);
        continue;
      }
      if (s.pranks.length >= 3 && !ELF_IDS.every((e) => s.pranks.some((p) => p.culprit === e))) errs.push(`${band} seed ${seed}: not every elf has a prank`);
      for (const p of s.pranks) {
        if (!cluesValid(p.clues, p.culprit, band)) errs.push(`${band} seed ${seed} prank "${p.id}": clues don't point to exactly ${p.culprit}`);
        const pz = p.puzzle;
        trained.add(pz.goal);
        if (!checkAnswer(pz, FIXES[pz.fix].solve(pz), 1).solved) errs.push(`${band} seed ${seed} prank "${p.id}": ${pz.fix} puzzle is not solvable`);
        if (checkAnswer(pz, FIXES[pz.fix].wrong(pz, makeRng(seed)), 1).solved) errs.push(`${band} seed ${seed} prank "${p.id}": ${pz.fix} accepts a wrong answer`);
        if (pz.seconds < 10 || pz.seconds > 20) errs.push(`${band} seed ${seed} prank "${p.id}": ${pz.fix} puzzle takes ${pz.seconds} s (10–20 expected)`);
        if (!puzzleWithinCaps(pz)) errs.push(`${band} seed ${seed} prank "${p.id}": ${pz.fix} puzzle goes over the band cap`);
        if (!isL(pz.prompt)) errs.push(`${band} seed ${seed} prank "${p.id}": empty prompt`);
      }
      if (seed < 3) {
        const end = replay(r, band, seed, perfectRun(r, band, seed)).session;
        if (end.phase !== 'done') errs.push(`${band} seed ${seed}: a perfect play does not reach the photo (phase ${end.phase})`);
        if (!sameRoom(end.state, ref)) errs.push(`${band} seed ${seed}: the room is not tidy at the end`);
      }
    }
  }

  // ---- learning goals (A9)
  for (const g of A9_MAIN[r.number] ?? []) {
    if (!r.goals.includes(g)) errs.push(`A9 goal "${g}" is not declared`);
    if (!trained.has(g)) errs.push(`A9 goal "${g}" is not trained by any fix`);
  }
  for (const g of r.goals) if (!trained.has(g)) errs.push(`declared goal "${g}" is not trained by any fix`);
  return out();
}

/** All rooms + progression across the house. */
export function validateRooms(raws: unknown[] = RAW_ROOMS, opts: { seeds?: number } = {}): RoomIssue[] {
  const issues = raws.flatMap((x) => validateRoom(x, opts));
  const rooms = raws as RoomDef[];
  const add = (message: string) => issues.push({ room: '*', message });
  const numbers = rooms.map((x) => x.number).sort((a, b) => a - b);
  if (numbers.join() !== Array.from({ length: 15 }, (_, i) => i + 1).join()) add('rooms must be numbered 1–15 once each');
  if (new Set(rooms.map((x) => x.id)).size !== rooms.length) add('duplicate room id');
  for (const x of rooms) {
    const b = x.bands;
    if (!b?.little || !b.middle || !b.big) continue;
    if (!(b.little.pickCount <= b.middle.pickCount && b.middle.pickCount <= b.big.pickCount)) add(`${x.id}: pickCount must grow little ≤ middle ≤ big`);
    if (!(b.little.finale.length < b.middle.finale.length && b.middle.finale.length < b.big.finale.length)) add(`${x.id}: finale length must grow with the band`);
  }
  const used = (f: (x: RoomDef) => string[]) => new Set(rooms.flatMap(f));
  const fixes = used((x) => x.pranks.map((p) => p.fix.mechanic));
  for (const f of FIX_IDS) if (!fixes.has(f)) add(`fix mechanic "${f}" is used by no room`);
  const types = used((x) => x.pranks.map((p) => p.type));
  for (const t of Object.keys(PRANK_TYPES)) if (t !== 'chain-reaction' && !types.has(t)) add(`prank type "${t}" is used by no room`);
  const goals = used((x) => x.goals);
  for (const g of CHAOS_GOALS) if (!goals.has(g)) add(`goal "${g}" is in no room`);
  const finale = rooms.find((x) => x.number === 15);
  if (finale && new Set(finale.pranks.map((p) => p.fix.mechanic)).size < 6) add('room 15 should review 6+ fix mechanics');
  // the clock (time) is a late, big-kid skill: not before the roof (A6)
  for (const x of rooms) if (x.number < 14 && x.pranks.some((p) => p.fix.mechanic === 'clock')) add(`${x.id}: clock puzzles start at room 14`);
  return issues;
}

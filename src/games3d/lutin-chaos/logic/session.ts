/**
 * One room, as a pure reducer: `startRoom` → `reduce(session, action)` →
 * `{ session, events }`. The runtime draws `session.state` and plays the
 * events (lines, animations, puzzles). Sessions are plain JSON; randomness is
 * derived from `seed` + `step`, so a seed + the action list replays exactly.
 *
 * Flow per prank (the child picks any prank, in any order):
 *   hidden → (tap a changed prop) spotted → [name the elf: middle/big] →
 *   (tap the right hiding place, or tickle the peeking elf) caught →
 *   (answer the fix puzzle, hints until solved) fixed.
 * When every prank is fixed: finale (rewind the chain reaction) → photo → done.
 * Nothing in here can fail: wrong taps give funny reactions and hints.
 */
import { tapSpot, tickle } from './catch';
import { makeClues, type Clue } from './clues';
import { checkAnswer, isFixId, makePuzzle, type FixCheck, type Puzzle } from './fixes';
import { expectedStep, predictFinale, startFinale, tapFinale, type FinaleRun } from './finale';
import { pickLine, type Line } from './lines';
import { applyPrank, undoPrank, type PrankRecord } from './pranks';
import { makeRng, mixSeed, pick, shuffle, type Rng } from './rand';
import { referenceState, roomWordsOf, slotLabelOf, type RoomDef, type RoomPrank } from './room-def';
import { diffRoom, touched } from './room-state';
import { ELF_IDS, type Band, type Change, type ChaosGoal, type ElfId, type L, type LearningSkill, type RoomState } from './types';

export type PrankPhase = 'hidden' | 'spotted' | 'found' | 'caught' | 'fixed';

export interface PrankRun {
  id: string;
  culprit: ElfId;
  clues: Clue[];
  hideSpot: string;
  record: PrankRecord;
  /** Prop ids that reveal this prank when tapped. */
  hotspots: string[];
  puzzle: Puzzle;
  phase: PrankPhase;
  /** The elf is visible: a tickle catches it. */
  peeking: boolean;
  misses: number;
  lastSpot: string | null;
  wrongNames: number;
  tries: number;
  /** Matches tonight's prank from the parents' planner (`/lutins`). */
  fromTonight: boolean;
}

export interface RoomSession {
  v: 1;
  roomId: string;
  band: Band;
  seed: number;
  /** Action counter: each action draws from rng(seed, step). */
  step: number;
  ref: RoomState;
  state: RoomState;
  pranks: PrankRun[];
  phase: 'pranks' | 'finale' | 'photo' | 'done';
  finale: FinaleRun | null;
  stats: { tries: number; hints: number; wrongTaps: number };
}

export type ChaosAction =
  | { type: 'tap-prop'; prop: string }
  | { type: 'name-elf'; prank: string; elf: ElfId }
  | { type: 'tap-spot'; prank: string; spot: string }
  | { type: 'tickle'; prank: string }
  | { type: 'answer'; prank: string; answer: unknown }
  | { type: 'magnifier' }
  | { type: 'finale-predict'; step: string }
  | { type: 'finale-tap'; step: string }
  | { type: 'photo' };

export type ChaosEvent =
  | { type: 'say'; line: Line }
  | { type: 'text'; text: L }
  | { type: 'spotted'; prank: string; props: string[] }
  | { type: 'clues'; prank: string; clues: Clue[] }
  | { type: 'eliminate'; prank: string; elf: ElfId; reason: L | null }
  | { type: 'peek'; prank: string; elf: ElfId; spot: string }
  | { type: 'miss'; prank: string; spot: string; heat: 'warmer' | 'colder'; wiggle: { spot: string; strength: number } }
  | { type: 'caught'; prank: string; elf: ElfId; anim: string | null }
  | { type: 'puzzle'; prank: string; puzzle: Puzzle }
  | { type: 'hint'; prank: string; check: Extract<FixCheck, { solved: false }> }
  | { type: 'healed'; prank: string; changes: Change[] }
  | { type: 'magnifier'; props: string[] }
  | { type: 'room-fixed' }
  | { type: 'finale-start'; steps: { id: string; label: L }[]; predictAt: number | null; options: string[] }
  | { type: 'finale-predicted'; step: string; correct: boolean }
  | { type: 'finale-undone'; step: string }
  | { type: 'finale-glow'; step: string }
  | { type: 'photo' }
  | { type: 'room-done'; result: RoomResult };

/** What the room trained, for `finishExtraGame('lutin-chaos', skill, stats, ms)`. */
export interface RoomResult {
  roomId: string;
  band: Band;
  skill: LearningSkill;
  skills: LearningSkill[];
  goals: ChaosGoal[];
  pranksFixed: number;
  tries: number;
  hints: number;
}

export interface StartOptions {
  /** Tonight's prank id from the parents' planner (only the id, read on the device). */
  nightPrankId?: string | null;
}

const rngAt = (seed: number, step: number, salt: string): Rng => makeRng(mixSeed(seed, step, salt));

/**
 * Draw the band's pranks (tonight's theme first), give every elf at least one
 * prank when there are 3+, then play them on the reference room.
 */
function choosePranks(room: RoomDef, band: Band, rng: Rng, night: string | null): { prank: RoomPrank; culprit: ElfId; fromTonight: boolean }[] {
  const b = room.bands[band];
  const pool = b.pool.map((id) => room.pranks.find((p) => p.id === id)!);
  for (let attempt = 0; attempt < 30; attempt++) {
    const themed = night ? pool.filter((p) => p.themes?.includes(night)) : [];
    const first = themed.length ? [pick(rng, themed)] : [];
    const rest = shuffle(rng, pool.filter((p) => !first.includes(p)));
    const picked = [...first, ...rest].slice(0, b.pickCount);
    const fixed = picked.map((p) => (p.culprit === 'random' ? null : p.culprit));
    const missing = shuffle(rng, ELF_IDS.filter((e) => !fixed.includes(e)));
    const culprits = fixed.map((c) => c ?? missing.shift() ?? pick(rng, ELF_IDS));
    if (picked.length < 3 || ELF_IDS.every((e) => culprits.includes(e))) {
      return picked.map((prank, i) => ({ prank, culprit: culprits[i], fromTonight: !!night && !!prank.themes?.includes(night) }));
    }
  }
  throw new Error(`room ${room.id} band ${band}: cannot give every elf a prank`);
}

export function startRoom(room: RoomDef, band: Band, seed: number, opts: StartOptions = {}): RoomSession {
  const rng = rngAt(seed, 0, 'start');
  const ref = referenceState(room);
  const b = room.bands[band];
  const chosen = choosePranks(room, band, rng, opts.nightPrankId ?? null);
  let state = ref;
  const spots = shuffle(rng, b.hidingSpots);
  const slotLabel = slotLabelOf(room);
  const roomWords = roomWordsOf(room);
  const pranks: PrankRun[] = chosen.map(({ prank, culprit, fromTonight }, i) => {
    const applied = applyPrank(state, { id: prank.id, type: prank.type, params: prank.params, culprit }, rng);
    state = applied.state;
    if (!isFixId(prank.fix.mechanic)) throw new Error(`unknown fix ${prank.fix.mechanic}`);
    const puzzle = makePuzzle(prank.fix.mechanic, {
      band,
      rng,
      params: { ...prank.fix.params, ...(prank.fix.bands?.[band] ?? {}) },
      prank: applied.record,
      props: ref.props,
      slotLabel,
      roomWords,
    });
    return {
      id: prank.id,
      culprit,
      clues: makeClues(culprit, band, rng, prank.clueKinds ?? []),
      hideSpot: spots[i % spots.length],
      record: applied.record,
      hotspots: touched(applied.record.changes),
      puzzle,
      phase: 'hidden',
      peeking: false,
      misses: 0,
      lastSpot: null,
      wrongNames: 0,
      tries: 0,
      fromTonight,
    };
  });
  return { v: 1, roomId: room.id, band, seed, step: 0, ref, state, pranks, phase: 'pranks', finale: null, stats: { tries: 0, hints: 0, wrongTaps: 0 } };
}

const ziggy = (rng: Rng, moment: Parameters<typeof pickLine>[1], vars: { elf?: ElfId } = {}): ChaosEvent => ({ type: 'say', line: pickLine(rng, moment, 'ziggy', vars) });
const elfSays = (rng: Rng, moment: Parameters<typeof pickLine>[1], elf: ElfId): ChaosEvent => ({ type: 'say', line: pickLine(rng, moment, elf) });

function withPrank(s: RoomSession, id: string, f: (p: PrankRun) => PrankRun): RoomSession {
  return { ...s, pranks: s.pranks.map((p) => (p.id === id ? f(p) : p)) };
}

function catchElf(s: RoomSession, p: PrankRun, rng: Rng, events: ChaosEvent[]): RoomSession {
  const c = tickle(p.culprit, rng);
  events.push({ type: 'caught', prank: p.id, elf: p.culprit, anim: c.reaction.anim ?? null }, { type: 'say', line: c.reaction }, { type: 'say', line: c.ziggy }, ziggy(rng, 'fix-start'), { type: 'puzzle', prank: p.id, puzzle: p.puzzle });
  return withPrank(s, p.id, (x) => ({ ...x, phase: 'caught', peeking: false }));
}

export function reduce(session: RoomSession, action: ChaosAction, room: RoomDef): { session: RoomSession; events: ChaosEvent[] } {
  const step = session.step + 1;
  const rng = rngAt(session.seed, step, action.type);
  let s: RoomSession = { ...session, step };
  const events: ChaosEvent[] = [];
  const prankOf = (id: string) => s.pranks.find((p) => p.id === id);
  const def = (id: string) => room.pranks.find((p) => p.id === id)!;

  switch (action.type) {
    case 'tap-prop': {
      if (s.phase !== 'pranks') break;
      const p = s.pranks.find((x) => x.hotspots.includes(action.prop) && x.phase !== 'fixed');
      if (!p) {
        events.push(ziggy(rng, 'normal'));
        break;
      }
      if (p.phase !== 'hidden') {
        events.push({ type: 'text', text: def(p.id).spot });
        break;
      }
      events.push({ type: 'spotted', prank: p.id, props: p.hotspots }, ziggy(rng, 'spot'), { type: 'text', text: def(p.id).spot }, elfSays(rng, 'spot', p.culprit));
      if (p.fromTonight) events.push(ziggy(rng, 'tonight'));
      if (s.band === 'little') {
        events.push({ type: 'peek', prank: p.id, elf: p.culprit, spot: p.hideSpot }, elfSays(rng, 'peek', p.culprit));
        s = withPrank(s, p.id, (x) => ({ ...x, phase: 'found', peeking: true }));
      } else {
        events.push({ type: 'clues', prank: p.id, clues: p.clues }, ziggy(rng, 'clue'));
        s = withPrank(s, p.id, (x) => ({ ...x, phase: 'spotted' }));
      }
      break;
    }
    case 'name-elf': {
      const p = prankOf(action.prank);
      if (!p || p.phase !== 'spotted') break;
      if (action.elf === p.culprit) {
        events.push(ziggy(rng, 'accuse-ok', { elf: p.culprit }), { type: 'peek', prank: p.id, elf: p.culprit, spot: p.hideSpot }, elfSays(rng, 'peek', p.culprit));
        s = withPrank(s, p.id, (x) => ({ ...x, phase: 'found', peeking: true }));
      } else {
        const reason = p.clues.find((c) => !c.fits.includes(action.elf))?.reason ?? null;
        const wrongNames = p.wrongNames + 1;
        events.push(elfSays(rng, 'not-me', action.elf), { type: 'eliminate', prank: p.id, elf: action.elf, reason });
        // after two other names only the culprit is left: it peeks out by itself
        const peek = wrongNames >= 2;
        if (peek) events.push({ type: 'peek', prank: p.id, elf: p.culprit, spot: p.hideSpot }, elfSays(rng, 'peek', p.culprit));
        s = withPrank(s, p.id, (x) => ({ ...x, wrongNames, ...(peek ? { phase: 'found' as const, peeking: true } : {}) }));
        s = { ...s, stats: { ...s.stats, wrongTaps: s.stats.wrongTaps + 1 } };
      }
      break;
    }
    case 'tap-spot': {
      const p = prankOf(action.prank);
      if (!p || (p.phase !== 'spotted' && p.phase !== 'found')) break;
      const r = tapSpot({ tapped: action.spot, hideSpot: p.hideSpot, spots: room.hidingSpots, misses: p.misses, previous: p.lastSpot, band: s.band, rng });
      if (r.found) {
        s = catchElf(s, p, rng, events);
        break;
      }
      events.push({ type: 'miss', prank: p.id, spot: r.spot, heat: r.heat, wiggle: r.wiggle }, { type: 'say', line: r.gag });
      if (r.peek && !p.peeking) events.push({ type: 'peek', prank: p.id, elf: p.culprit, spot: p.hideSpot }, elfSays(rng, 'peek', p.culprit));
      s = withPrank(s, p.id, (x) => ({ ...x, misses: x.misses + 1, lastSpot: action.spot, peeking: x.peeking || r.peek }));
      s = { ...s, stats: { ...s.stats, wrongTaps: s.stats.wrongTaps + 1 } };
      break;
    }
    case 'tickle': {
      // a tickle on the elf ALWAYS catches it (offered once it is visible)
      const p = prankOf(action.prank);
      if (!p || (p.phase !== 'spotted' && p.phase !== 'found')) break;
      s = catchElf(s, p, rng, events);
      break;
    }
    case 'answer': {
      const p = prankOf(action.prank);
      if (!p || p.phase !== 'caught') break;
      const tries = p.tries + 1;
      const check = checkAnswer(p.puzzle, action.answer, tries);
      s = { ...s, stats: { ...s.stats, tries: s.stats.tries + 1, hints: s.stats.hints + (check.solved ? 0 : 1) } };
      if (!check.solved) {
        events.push({ type: 'hint', prank: p.id, check }, elfSays(rng, 'fix-oops', p.culprit));
        s = withPrank(s, p.id, (x) => ({ ...x, tries }));
        break;
      }
      s = { ...s, state: undoPrank(s.state, p.record) };
      s = withPrank(s, p.id, (x) => ({ ...x, tries, phase: 'fixed' }));
      events.push({ type: 'text', text: check.praise }, { type: 'healed', prank: p.id, changes: p.record.changes }, { type: 'text', text: def(p.id).fixed }, ziggy(rng, 'fix-done'));
      if (s.pranks.every((x) => x.phase === 'fixed')) {
        events.push({ type: 'room-fixed' }, ziggy(rng, 'room-fixed'));
        const f = startFinale(s.state, room.finale.steps, room.bands[s.band].finale, s.band, rng);
        const starter = pick(rng, ELF_IDS);
        s = { ...s, state: f.state, finale: f.run, phase: 'finale' };
        events.push(elfSays(rng, 'finale-start', starter), { type: 'finale-start', steps: f.run.steps, predictAt: f.run.predictAt, options: f.run.predictOptions });
      }
      break;
    }
    case 'magnifier': {
      // Ziggy's magnifier shows what differs from the tidy room (not a penalty, just help)
      const props = [...new Set(diffRoom(s.ref, s.state).map((c) => c.prop))];
      s = { ...s, stats: { ...s.stats, hints: s.stats.hints + 1 } };
      events.push({ type: 'magnifier', props });
      break;
    }
    case 'finale-predict': {
      if (s.phase !== 'finale' || !s.finale) break;
      const r = predictFinale(s.finale, action.step);
      s = { ...s, finale: r.run };
      events.push({ type: 'finale-predicted', step: action.step, correct: r.correct }, ziggy(rng, r.correct ? 'finale-step' : 'finale-predict'));
      break;
    }
    case 'finale-tap': {
      if (s.phase !== 'finale' || !s.finale) break;
      const r = tapFinale(s.state, s.finale, action.step);
      s = { ...s, state: r.state, finale: r.run };
      if (!r.result.ok) {
        if (r.result.glow) events.push({ type: 'finale-glow', step: r.result.glow }, ziggy(rng, 'finale-hint'));
        s = { ...s, stats: { ...s.stats, wrongTaps: s.stats.wrongTaps + 1 } };
        break;
      }
      events.push({ type: 'finale-undone', step: r.result.step });
      if (r.result.done) {
        events.push(ziggy(rng, 'finale-done'));
        s = { ...s, phase: 'photo' };
      } else events.push(ziggy(rng, 'finale-step'));
      break;
    }
    case 'photo': {
      if (s.phase !== 'photo') break;
      s = { ...s, phase: 'done' };
      events.push({ type: 'photo' }, ziggy(rng, 'photo'), ...ELF_IDS.map((e) => elfSays(rng, 'photo', e)), { type: 'room-done', result: roomResult(s, room) }, ziggy(rng, 'goodbye'));
      break;
    }
  }
  return { session: s, events };
}

export function roomResult(s: RoomSession, room: RoomDef): RoomResult {
  const fixSkills = s.pranks.map((p) => p.puzzle.skill);
  const skills = [...new Set([...room.skills, ...fixSkills])];
  return {
    roomId: s.roomId,
    band: s.band,
    skill: room.skills[0],
    skills,
    goals: [...new Set([...room.goals.filter((g) => g === 'observation' || g === 'logic'), ...s.pranks.map((p) => p.puzzle.goal)])],
    pranksFixed: s.pranks.filter((p) => p.phase === 'fixed').length,
    tries: s.stats.tries,
    hints: s.stats.hints,
  };
}

/** What to save after every prank (design: stopping anytime loses nothing). */
export interface RoomSnapshot {
  roomId: string;
  band: Band;
  seed: number;
  night: string | null;
  fixed: string[];
}

export const snapshot = (s: RoomSession, night: string | null = null): RoomSnapshot => ({ roomId: s.roomId, band: s.band, seed: s.seed, night, fixed: s.pranks.filter((p) => p.phase === 'fixed').map((p) => p.id) });

/** Rebuild a session from a snapshot: same pranks (same seed), fixed ones already tidied. */
export function resumeRoom(room: RoomDef, snap: RoomSnapshot): RoomSession {
  let s = startRoom(room, snap.band, snap.seed, { nightPrankId: snap.night });
  for (const id of snap.fixed) {
    const p = s.pranks.find((x) => x.id === id);
    if (!p || p.phase === 'fixed') continue;
    s = { ...withPrank(s, id, (x) => ({ ...x, phase: 'fixed' })), state: undoPrank(s.state, p.record) };
  }
  if (s.pranks.every((p) => p.phase === 'fixed')) {
    const f = startFinale(s.state, room.finale.steps, room.bands[s.band].finale, s.band, rngAt(s.seed, 0, 'finale'));
    s = { ...s, state: f.state, finale: f.run, phase: 'finale' };
  }
  return s;
}

/** The step a rewinding child should tap next (runtime glow after a pause, TV focus). */
export const nextFinaleStep = (s: RoomSession) => (s.finale ? expectedStep(s.finale) : null);

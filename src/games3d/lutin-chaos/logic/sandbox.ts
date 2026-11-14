/**
 * Sandbox « La Maison des Farces » (role flip): the child hides the elves and
 * sets up pranks in a finished room; Ziggy searches, steered by the child's
 * "warmer / colder" hints or a tap on a spot. Pure creativity: no goal, no
 * evaluation, Ziggy always finds everyone in the end (he never searches a
 * spot twice). A pure state machine: setup → seeking → celebrate → setup…
 */
import { applyPrank, PRANK_TYPES, type Params } from './pranks';
import { makeRng, mixSeed, pick, type Rng } from './rand';
import { referenceState, type RoomDef } from './room-def';
import { pickLine, type Line } from './lines';
import { ELF_IDS, isElf, type ElfId, type RoomState } from './types';

export interface SandboxPrank {
  id: string;
  type: string;
  params: Params;
}

export interface SandboxState {
  v: 1;
  roomId: string;
  seed: number;
  step: number;
  phase: 'setup' | 'seeking' | 'celebrate';
  /** Where the child hid each elf (spot ids). */
  elves: Partial<Record<ElfId, string>>;
  pranks: SandboxPrank[];
  /** The room with the child's pranks applied (what the runtime draws). */
  state: RoomState;
  searched: string[];
  found: ElfId[];
  ziggyAt: string | null;
  lastHint: 'warmer' | 'colder' | null;
}

export type SandboxAction =
  | { type: 'place-elf'; elf: ElfId; spot: string }
  | { type: 'remove-elf'; elf: ElfId }
  | { type: 'add-prank'; prankType: string; params: Params }
  | { type: 'remove-prank'; id: string }
  | { type: 'go' }
  | { type: 'ziggy-look' }
  | { type: 'hint'; hint: 'warmer' | 'colder' }
  | { type: 'point'; spot: string }
  | { type: 'again' }
  | { type: 'clear' };

export type SandboxEvent =
  | { type: 'say'; line: Line }
  | { type: 'placed'; elf: ElfId; spot: string }
  | { type: 'prank'; id: string; ok: boolean }
  | { type: 'ziggy-moves'; spot: string }
  | { type: 'found'; elf: ElfId; spot: string }
  | { type: 'all-found' };

export function startSandbox(room: RoomDef, seed: number): SandboxState {
  return { v: 1, roomId: room.id, seed, step: 0, phase: 'setup', elves: {}, pranks: [], state: referenceState(room), searched: [], found: [], ziggyAt: null, lastHint: null };
}

/** Rebuild the drawn room from the pranks; pranks that no longer apply are dropped. */
function rebuild(room: RoomDef, pranks: SandboxPrank[], rng: Rng): { state: RoomState; pranks: SandboxPrank[] } {
  let state = referenceState(room);
  const kept: SandboxPrank[] = [];
  for (const p of pranks) {
    const def = PRANK_TYPES[p.type];
    if (!def || p.type === 'chain-reaction' || def.validate(p.params, { state, slots: room.slots.map((s) => s.id) }).length) continue;
    state = applyPrank(state, { id: p.id, type: p.type, params: p.params }, rng).state;
    kept.push(p);
  }
  return { state, pranks: kept };
}

const dist = (room: RoomDef, a: string, b: string) => {
  const pa = room.hidingSpots.find((s) => s.id === a)?.at ?? [0, 0, 0];
  const pb = room.hidingSpots.find((s) => s.id === b)?.at ?? [0, 0, 0];
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
};

/** Where Ziggy looks next: steered by the last hint, never twice in the same spot. */
export function nextLook(room: RoomDef, s: SandboxState, rng: Rng): string | null {
  const left = room.hidingSpots.map((h) => h.id).filter((id) => !s.searched.includes(id));
  if (left.length === 0) return null;
  if (s.ziggyAt && s.lastHint) {
    const sorted = [...left].sort((a, b) => dist(room, s.ziggyAt!, a) - dist(room, s.ziggyAt!, b) || a.localeCompare(b));
    return s.lastHint === 'warmer' ? sorted[0] : sorted[sorted.length - 1];
  }
  return pick(rng, left);
}

function look(room: RoomDef, s: SandboxState, spot: string, rng: Rng, events: SandboxEvent[]): SandboxState {
  events.push({ type: 'ziggy-moves', spot });
  const here = ELF_IDS.filter((e) => s.elves[e] === spot && !s.found.includes(e));
  let next: SandboxState = { ...s, ziggyAt: spot, lastHint: null, searched: s.searched.includes(spot) ? s.searched : [...s.searched, spot] };
  if (here.length === 0) {
    events.push({ type: 'say', line: pickLine(rng, 'sandbox-search') });
  } else {
    for (const e of here) events.push({ type: 'found', elf: e, spot }, { type: 'say', line: pickLine(rng, 'sandbox-found', 'ziggy', { elf: e }) }, { type: 'say', line: pickLine(rng, 'caught', e) });
    next = { ...next, found: [...next.found, ...here] };
  }
  const hidden = ELF_IDS.filter((e) => next.elves[e]);
  if (hidden.every((e) => next.found.includes(e))) {
    events.push({ type: 'all-found' }, { type: 'say', line: pickLine(rng, 'sandbox-done') });
    next = { ...next, phase: 'celebrate' };
  }
  return next;
}

export function reduceSandbox(state: SandboxState, action: SandboxAction, room: RoomDef): { state: SandboxState; events: SandboxEvent[] } {
  const step = state.step + 1;
  const rng = makeRng(mixSeed(state.seed, step, 'sandbox'));
  let s: SandboxState = { ...state, step };
  const events: SandboxEvent[] = [];
  const spotOk = (id: string) => room.hidingSpots.some((h) => h.id === id);

  switch (action.type) {
    case 'place-elf':
      if (s.phase !== 'setup' || !isElf(action.elf) || !spotOk(action.spot)) break;
      s = { ...s, elves: { ...s.elves, [action.elf]: action.spot } };
      events.push({ type: 'placed', elf: action.elf, spot: action.spot });
      break;
    case 'remove-elf': {
      if (s.phase !== 'setup') break;
      const elves = { ...s.elves };
      delete elves[action.elf];
      s = { ...s, elves };
      break;
    }
    case 'add-prank': {
      if (s.phase !== 'setup') break;
      const id = `p${step}`;
      const r = rebuild(room, [...s.pranks, { id, type: action.prankType, params: action.params }], rng);
      const ok = r.pranks.some((p) => p.id === id);
      s = { ...s, state: r.state, pranks: r.pranks };
      events.push({ type: 'prank', id, ok });
      if (ok) events.push({ type: 'say', line: pickLine(rng, 'sandbox-prank') });
      break;
    }
    case 'remove-prank': {
      if (s.phase !== 'setup') break;
      const r = rebuild(room, s.pranks.filter((p) => p.id !== action.id), rng);
      s = { ...s, state: r.state, pranks: r.pranks };
      break;
    }
    case 'go':
      if (s.phase !== 'setup' || ELF_IDS.every((e) => !s.elves[e])) break;
      s = { ...s, phase: 'seeking', searched: [], found: [], ziggyAt: null, lastHint: null };
      events.push({ type: 'say', line: pickLine(rng, 'sandbox-start') });
      if (s.pranks.length) events.push({ type: 'say', line: pickLine(rng, 'sandbox-prank') });
      break;
    case 'ziggy-look': {
      if (s.phase !== 'seeking') break;
      const spot = nextLook(room, s, rng);
      if (spot) s = look(room, s, spot, rng, events);
      break;
    }
    case 'hint':
      if (s.phase !== 'seeking') break;
      s = { ...s, lastHint: action.hint };
      events.push({ type: 'say', line: pickLine(rng, action.hint === 'warmer' ? 'sandbox-warmer' : 'sandbox-colder') });
      break;
    case 'point':
      if (s.phase !== 'seeking' || !spotOk(action.spot)) break;
      s = look(room, s, action.spot, rng, events);
      break;
    case 'again':
      if (s.phase === 'setup') break;
      s = { ...s, phase: 'setup', searched: [], found: [], ziggyAt: null, lastHint: null };
      break;
    case 'clear':
      s = { ...startSandbox(room, s.seed), step };
      break;
  }
  return { state: s, events };
}

/** What the device saves for a sandbox creation. */
export interface SandboxLayout {
  roomId: string;
  elves: Partial<Record<ElfId, string>>;
  pranks: SandboxPrank[];
}

export const sandboxLayout = (s: SandboxState): SandboxLayout => ({ roomId: s.roomId, elves: { ...s.elves }, pranks: s.pranks.map((p) => ({ ...p })) });

/** Load a saved layout (unknown spots / pranks are quietly dropped). */
export function loadLayout(room: RoomDef, layout: SandboxLayout, seed: number): SandboxState {
  const base = startSandbox(room, seed);
  const elves: Partial<Record<ElfId, string>> = {};
  for (const e of ELF_IDS) {
    const spot = layout.elves?.[e];
    if (spot && room.hidingSpots.some((h) => h.id === spot)) elves[e] = spot;
  }
  const r = rebuild(room, Array.isArray(layout.pranks) ? layout.pranks : [], makeRng(seed));
  return { ...base, elves, state: r.state, pranks: r.pranks };
}

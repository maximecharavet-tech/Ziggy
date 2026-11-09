/**
 * Replay variation and deterministic replays.
 * - `playSeed(roomId, plays)`: a new seed for every replay of a room, so the
 *   pranks, culprits, clues, hiding places and puzzles are reshuffled.
 * - `replay(room, band, seed, actions)`: the same seed + the same actions
 *   always end in the same session (golden replays, bug reports).
 */
import { FIXES, type Puzzle } from './fixes';
import { mixSeed } from './rand';
import type { RoomDef } from './room-def';
import { reduce, startRoom, type ChaosAction, type ChaosEvent, type RoomSession, type StartOptions } from './session';
import type { Band } from './types';

/** Seed of the `plays`-th play of a room (0 = first). `salt` = a per-device random number. */
export const playSeed = (roomId: string, plays: number, salt = 0): number => mixSeed('lutin-chaos', roomId, plays, salt);

export function replay(room: RoomDef, band: Band, seed: number, actions: readonly ChaosAction[], opts: StartOptions = {}): { session: RoomSession; events: ChaosEvent[] } {
  let session = startRoom(room, band, seed, opts);
  const events: ChaosEvent[] = [];
  for (const a of actions) {
    const r = reduce(session, a, room);
    session = r.session;
    events.push(...r.events);
  }
  return { session, events };
}

/** Short stable hash of a session (compare replays). */
export function sessionHash(s: RoomSession): string {
  const json = JSON.stringify(s);
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) h = Math.imul(h ^ json.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
}

/**
 * The actions of a child who gets everything right first time (tests,
 * attract-mode demo). Built from the session, never from hidden knowledge the
 * runtime would not have.
 */
export function perfectRun(room: RoomDef, band: Band, seed: number, opts: StartOptions = {}): ChaosAction[] {
  const s = startRoom(room, band, seed, opts);
  const actions: ChaosAction[] = [];
  for (const p of s.pranks) {
    actions.push({ type: 'tap-prop', prop: p.hotspots[0] });
    if (band !== 'little') actions.push({ type: 'name-elf', prank: p.id, elf: p.culprit });
    actions.push({ type: 'tap-spot', prank: p.id, spot: p.hideSpot });
    actions.push({ type: 'answer', prank: p.id, answer: solveOf(p.puzzle) });
  }
  // finale: predict (big) then rewind in reverse order
  const after = replay(room, band, seed, actions, opts).session;
  if (after.finale) {
    if (after.finale.predictAt !== null) actions.push({ type: 'finale-predict', step: after.finale.steps[after.finale.predictAt].id });
    for (const st of [...after.finale.steps].reverse()) actions.push({ type: 'finale-tap', step: st.id });
  }
  actions.push({ type: 'photo' });
  return actions;
}

const solveOf = (p: Puzzle) => FIXES[p.fix].solve(p);

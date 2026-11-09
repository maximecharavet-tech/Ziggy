/**
 * Room data types (one JSON per room in `src/data/games/lutin-chaos/rooms/`,
 * envelope of `docs/GAME_ARCHITECTURE.md` §3.12). One layout, three band
 * blocks. By construction there is no timer, lives, score or fail field.
 */
import type { ClueKind } from './clues';
import type { Params } from './pranks';
import type { Band, ChaosGoal, ElfId, L, LearningSkill, PropState, RoomState, Rot } from './types';

export interface RoomSlot {
  id: string;
  /** "le tiroir" / "the drawer" */
  label: L;
  /** "dans le tiroir" / "in the drawer" (spoken in prompts). */
  in: L;
  at: [number, number, number];
}

export interface RoomProp {
  id: string;
  kind: string;
  slot: string;
  color: string;
  rot: Rot;
  count: number;
  hidden: boolean;
}

export interface RoomHidingSpot {
  id: string;
  label: L;
  at: [number, number, number];
}

export interface RoomPrank {
  id: string;
  type: string;
  params: Params;
  culprit: ElfId | 'random';
  /** `/lutins` planner prank ids this matches (`src/data/lutins/pranks.ts`). */
  themes?: string[];
  /** Clue kinds tried first (a hide prank leaves footprints…). */
  clueKinds?: ClueKind[];
  fix: { mechanic: string; params: Params; bands?: Partial<Record<Band, Params>> };
  /** Ziggy when the child spots it. */
  spot: L;
  /** Ziggy when it is fixed. */
  fixed: L;
}

export interface RoomFinaleStep {
  id: string;
  type: string;
  params: Params;
  label: L;
}

export interface RoomBand {
  /** How many pranks are drawn from the pool (seeded remix). */
  pickCount: number;
  pool: string[];
  hidingSpots: string[];
  /** Finale step ids, in play order. */
  finale: string[];
}

export interface RoomDef {
  schema: 'ziggy.level/1';
  game: 'lutin-chaos';
  id: string;
  number: number;
  version: string;
  title: L;
  season: string;
  layout: string;
  assets: string[];
  goals: ChaosGoal[];
  skills: LearningSkill[];
  intro: L;
  slots: RoomSlot[];
  props: RoomProp[];
  hidingSpots: RoomHidingSpot[];
  pranks: RoomPrank[];
  finale: { name: L; steps: RoomFinaleStep[] };
  bands: Record<Band, RoomBand>;
}

/** The room as it should be (every prop in place). */
export function referenceState(room: Pick<RoomDef, 'props'>): RoomState {
  const props: Record<string, PropState> = {};
  for (const p of room.props) props[p.id] = { id: p.id, kind: p.kind, slot: p.slot, color: p.color, rot: p.rot, count: p.count, hidden: p.hidden };
  return { props };
}

export const slotLabelOf = (room: Pick<RoomDef, 'slots'>) => (id: string) => room.slots.find((s) => s.id === id)?.in;
export const roomWordsOf = (room: Pick<RoomDef, 'props'>) => [...new Set(room.props.map((p) => p.kind))];

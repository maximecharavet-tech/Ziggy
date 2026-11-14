/**
 * Lutin Chaos (« Le Grand Chahut des Lutins »): shared pure types.
 * No three.js, no React: the runtime only draws what these describe.
 */
import type { L } from '@/lib/i18n-text';
import type { LearningSkill } from '@/lib/learning/skills';

export type { L, LearningSkill };

export const BANDS = ['little', 'middle', 'big'] as const;
/** World Memory age band: 4–6, 7–9, 10–12. */
export type Band = (typeof BANDS)[number];

export const ELF_IDS = ['pepin', 'grelotte', 'noisette'] as const;
export type ElfId = (typeof ELF_IDS)[number];

export const isBand = (v: unknown): v is Band => (BANDS as readonly unknown[]).includes(v);
export const isElf = (v: unknown): v is ElfId => (ELF_IDS as readonly unknown[]).includes(v);

/** A9 learning goal rows (design doc), each mapped to a World Memory skill. */
export const CHAOS_GOALS = [
  'observation',
  'counting',
  'patterns',
  'logic',
  'spatial',
  'sorting',
  'vocabulary',
  'time',
  'fractions',
] as const;
export type ChaosGoal = (typeof CHAOS_GOALS)[number];

/** Quarter turns clockwise: 0 = the right way up, 2 = upside down. */
export type Rot = 0 | 1 | 2 | 3;

/** One object of the room as it is now. */
export interface PropState {
  id: string;
  /** Vocabulary id (`sock`, `book`…): picture, name and mesh preset. */
  kind: string;
  /** Slot id where it sits (or hides). */
  slot: string;
  /** Colour id from `COLORS` (always drawn with its pattern/icon too). */
  color: string;
  rot: Rot;
  /** How many of it (a stack of plates, a pile of socks). */
  count: number;
  /** Tucked out of sight (the `hide` prank). */
  hidden: boolean;
}

/** The room: every prop by id. Treated as immutable. */
export interface RoomState {
  props: Record<string, PropState>;
}

export type PropField = 'slot' | 'color' | 'rot' | 'count' | 'hidden';

/** One field of one prop that a prank changed (enough to undo it exactly). */
export interface Change {
  prop: string;
  field: PropField;
  from: string | number | boolean;
  to: string | number | boolean;
}

/** Ziggy's body cues and the face module's expressions: happy ones only. */
export const ZIGGY_CUES = ['cheer', 'giggle', 'think', 'nod', 'jump', 'dance', 'wave', 'high-five'] as const;
export type ZiggyCue = (typeof ZIGGY_CUES)[number];
export const FACES = ['neutral', 'smile', 'laugh', 'surprise', 'listen', 'wink'] as const;
export type Face = (typeof FACES)[number];

/**
 * Lutin Factory (« L'Atelier des Lutins »): core types of the pure logic.
 * NO three.js, NO DOM, NO React. Everything here is plain JSON-able data so a
 * layout, a level or a whole simulation state can be saved, hashed or shared.
 *
 * Coordinates: `x` grows to the right (east), `y` grows downwards (south).
 */
import type { L } from '@/lib/i18n-text';

export type { L };

/* ---------- vocabulary ---------- */

export const DIRS = ['N', 'E', 'S', 'W'] as const;
export type Dir = (typeof DIRS)[number];
/** A side relative to a machine's facing direction. */
export type Rel = 'front' | 'left' | 'right' | 'back';

export const MATERIALS = ['wood', 'felt', 'metal', 'yarn'] as const;
export type Material = (typeof MATERIALS)[number];

export const SHAPES = ['cube', 'ball', 'cylinder', 'cone', 'star', 'wheel'] as const;
export type Shape = (typeof SHAPES)[number];

/** The six painter colours (each with an icon) + brown, which only the mixer makes. */
export const PAINTS = ['red', 'yellow', 'blue', 'green', 'purple', 'orange'] as const;
export const COLORS = [...PAINTS, 'brown'] as const;
export type Paint = (typeof PAINTS)[number];
export type Color = (typeof COLORS)[number];

export const PATTERNS = ['stripes', 'dots', 'stars', 'snowflakes', 'hearts'] as const;
export type Pattern = (typeof PATTERNS)[number];

export const STICKERS = ['star', 'heart', 'moon', 'snowflake'] as const;
export type Sticker = (typeof STICKERS)[number];

export const BANDS = ['little', 'middle', 'big'] as const;
/** Age band from World Memory: little 4–6, middle 7–9, big 10–12. */
export type Band = (typeof BANDS)[number];

export type ElfId = 'pepin' | 'grelotte' | 'noisette';

export type Cell = readonly [number, number];

/* ---------- items riding the belts ---------- */

export interface Item {
  /** Unique within one simulation run, in creation order (deterministic). */
  id: number;
  material: Material;
  shape?: Shape;
  color?: Color;
  sticker?: Sticker;
  wrap?: Pattern;
  /** Set by the assembler / robot arm: the toy this item now is. */
  toy?: string;
  /** Variable part count of the toy (train wagons, tower blocks). */
  n?: number;
  /** The parts an assembled toy is made of (bottom → top for a tower). */
  parts?: Item[];
}

/** What an item template (chute "gift" mode) may preset. */
export interface ItemSpec {
  material?: Material;
  shape?: Shape;
  color?: Color;
  sticker?: Sticker;
}

/* ---------- layout ---------- */

/** Machine settings. Each machine plug-in validates its own dial. */
export type Dial = Record<string, unknown>;

export interface Piece {
  machine: string;
  at: Cell;
  dir: Dir;
  dial?: Dial;
  /** Cannot be moved, rotated or removed by the child. */
  locked?: boolean;
  /** The dial cannot be changed (defaults to `locked`). */
  dialLocked?: boolean;
}

export interface Layout {
  w: number;
  h: number;
  blocked?: Cell[];
  pieces: Piece[];
}

/* ---------- orders (the letter) ---------- */

/** `'none'` means "must not have one". */
export interface OrderProps {
  color?: Color;
  material?: Material;
  sticker?: Sticker | 'none';
  wrap?: Pattern | 'none';
  n?: number;
  /** Colours of the parts in order, repeated (tower: red, blue, red, blue…). */
  partColors?: Color[];
}

export interface OrderSpec {
  /** A toy id from toys.json, or `'surprise'` = any toy at all. */
  toy: string;
  props?: OrderProps;
}

export interface Order {
  /** One toy kind… */
  toy?: string;
  props?: OrderProps;
  /** …or a pattern: the k-th toy of this order must match sequence[k % len]. */
  sequence?: OrderSpec[];
  count: number;
  /** Sack (sleigh bay) it must arrive in; any sack when absent. */
  bay?: string;
  /** Counting levels: extra matching toys keep the letter open (they still go to the shelf). */
  exact?: boolean;
}

/* ---------- simulation output ---------- */

export interface Delivery {
  tick: number;
  at: Cell;
  bay?: string;
  item: Item;
}

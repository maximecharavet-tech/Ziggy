import type { L } from '@/lib/i18n-text';

/** The themes of the coloring book. */
export type ThemeId = 'noel' | 'animaux' | 'espace' | 'fees' | 'vehicules' | 'zen';

/**
 * A closed shape of a coloring page that a tap fills. Regions are painted in
 * order, so a later region covers an earlier one (an eye on a face).
 * `c` is the colour of the model ("colorie comme le modèle"): a palette id.
 */
export type Region = { id: string; d: string; c: string; deco?: Detail[] };

/** A decorative line (or a small inked dot) that is not filled by a tap. */
export type Detail = { d: string; fill?: 'ink' | 'white'; w?: number };

export type ColoringPage = {
  id: string;
  theme: ThemeId;
  title: L;
  /** One emoji that stands for the page (for children who cannot read). */
  emoji: string;
  /** "0 0 600 600" */
  viewBox: string;
  /** 1 = big zones for little ones, 3 = many small zones (mandala). */
  level: 1 | 2 | 3;
  regions: Region[];
  /** Drawn on top of every region. */
  details: Detail[];
};

export type Tool = 'fill' | 'brush' | 'rainbow' | 'glitter' | 'eraser' | 'sticker';
export type StrokeTool = 'brush' | 'rainbow' | 'glitter' | 'eraser';

/**
 * A freehand stroke in page coordinates. `pts` is flat: x, y, width, x, y, width…
 * (the width comes from the drawing speed, so it is stored, not recomputed).
 */
export type Stroke = { id: string; tool: StrokeTool; color: string; size: number; pts: number[] };

/** An emoji sticker stamped on the page (size in page units, rotation in degrees). */
export type Sticker = { id: string; e: string; x: number; y: number; s: number; r: number };

/** Everything the child has done on a page: one undo step is one of these. */
export type Drawing = { fills: Record<string, string>; strokes: Stroke[]; stickers: Sticker[] };

export const emptyDrawing = (): Drawing => ({ fills: {}, strokes: [], stickers: [] });

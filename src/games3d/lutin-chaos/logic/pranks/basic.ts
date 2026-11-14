/** The single-step prank types (everything but chain-reaction, which is built from them). */
import type { PrankDef } from './define';
import { flip } from './flip';
import { hide } from './hide';
import { moveInto } from './move-into';
import { multiply } from './multiply';
import { recolour } from './recolour';
import { swap } from './swap';

export const BASIC_PRANKS: Record<string, PrankDef> = {
  [moveInto.id]: moveInto,
  [swap.id]: swap,
  [recolour.id]: recolour,
  [flip.id]: flip,
  [multiply.id]: multiply,
  [hide.id]: hide,
};

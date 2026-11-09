/** Test helpers (not shipped): tiny layout builders. */
import type { Dial, Dir, Layout, Piece } from './types';

export const P = (machine: string, x: number, y: number, dir: Dir = 'E', dial?: Dial): Piece => ({ machine, at: [x, y], dir, ...(dial ? { dial } : {}) });

/** A straight east-going line on row 1: chute, the given machines (belts in between are yours), sack at the end. */
export function line(chuteDial: Dial, middle: (Piece | string)[], h = 3): Layout {
  const pieces: Piece[] = [P('chute', 0, 1, 'E', chuteDial)];
  middle.forEach((m, i) => pieces.push(typeof m === 'string' ? P(m, i + 1, 1, 'E') : { ...m, at: [i + 1, 1] }));
  pieces.push(P('sack', middle.length + 1, 1));
  return { w: middle.length + 2, h, pieces };
}

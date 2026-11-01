import { circle, ellipse, flower, quad, type P } from '../shapes';
import type { PageBuilder } from './build';

/** Shared little drawings used by several pages. */

/** Shiny inked eye: pupil + two highlights (details). */
export function inkEye(b: PageBuilder, cx: number, cy: number, r: number) {
  b.d(ellipse(cx, cy, r, r * 1.15), 'ink');
  b.d(circle(cx - r * 0.35, cy - r * 0.4, r * 0.32), 'white', 1);
  b.d(circle(cx + r * 0.3, cy + r * 0.35, r * 0.14), 'white', 1);
}

/** Big cartoon eye: white, coloured iris (regions), pupil and shine (details). */
export function bigEye(b: PageBuilder, id: string, cx: number, cy: number, rx: number, ry: number, iris: string, look: P = [0.1, 0.15]) {
  b.r(`${id}-white`, ellipse(cx, cy, rx, ry), 'white');
  const ix = cx + rx * look[0];
  const iy = cy + ry * look[1];
  const ir = Math.min(rx, ry) * 0.66;
  b.r(`${id}-iris`, circle(ix, iy, ir), iris);
  b.deco(circle(ix + ir * 0.05, iy + ir * 0.08, ir * 0.5), 'ink');
  b.deco(circle(ix - ir * 0.32, iy - ir * 0.3, ir * 0.24), 'white', 1);
  b.deco(circle(ix + ir * 0.3, iy + ir * 0.36, ir * 0.11), 'white', 1);
}

export const smile = (cx: number, cy: number, w: number, depth: number) => quad([cx - w / 2, cy], [cx, cy + depth], [cx + w / 2, cy]);

/** A small flower on the ground: scalloped head + centre (regions) and a stem (detail). */
export function groundFlower(b: PageBuilder, cx: number, cy: number, r: number, color: string, petals = 5, stem = 0) {
  if (stem > 0) b.d(quad([cx, cy + r], [cx - 4, cy + r + stem / 2], [cx + 2, cy + r + stem]), undefined, 4);
  b.r('flower#', flower(cx, cy, r, petals), color);
  b.r('flower-heart#', circle(cx, cy, r * 0.38), 'yellow');
}

/** Little grass tufts (details). */
export function tufts(b: PageBuilder, spots: P[], s = 10) {
  let d = '';
  for (const [x, y] of spots) d += `M${x - s} ${y}Q${x - s * 0.6} ${y - s * 0.9} ${x - s * 0.2} ${y - s * 1.3}M${x} ${y}Q${x} ${y - s} ${x + s * 0.15} ${y - s * 1.6}M${x + s} ${y}Q${x + s * 0.6} ${y - s * 0.9} ${x + s * 0.3} ${y - s * 1.2}`;
  b.d(d, undefined, 3.5);
}

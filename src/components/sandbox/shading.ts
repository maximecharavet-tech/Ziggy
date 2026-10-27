/**
 * A cheap finishing pass over the sandbox pixels (one look at each cell, no
 * allocation): grains get a lit top-left edge and a shaded underside, so piles
 * and walls look moulded; a few grains on the surface of sand, snow and ice
 * twinkle; and solid things cast a one-grain shadow down-right onto the sky
 * behind them (written straight into the same buffer: no extra drawing), so
 * floating walls and piles gain depth.
 */
import { EMPTY, ICE, SAND, SEED, SNOW, STONE, type Sandbox } from '@/games2d/sandbox/sim';

const SHADOW = ((70 << 24) | (70 << 16) | (18 << 8) | 28) >>> 0;

/** Brighten (d > 0) or darken a packed little-endian RGBA pixel. */
function adjust(p: number, d: number): number {
  let r = (p & 255) + d;
  let g = ((p >>> 8) & 255) + d;
  let b = ((p >>> 16) & 255) + d * 0.85;
  r = r < 0 ? 0 : r > 255 ? 255 : r;
  g = g < 0 ? 0 : g > 255 ? 255 : g;
  b = b < 0 ? 0 : b > 255 ? 255 : b;
  return ((p & 0xff000000) | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0)) >>> 0;
}

const solid = (e: number) => e === SAND || e === STONE || e === SNOW || e === SEED || e === ICE;

/** `px` is w × h; `t` in ms; `twinkle` false keeps every grain still (reduced motion). */
export function enrich(sim: Sandbox, px: Uint32Array, t: number, twinkle: boolean): void {
  const { w, h, type } = sim;
  const slot = Math.floor(t / 260);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      const e = type[i];
      if (!solid(e)) {
        // Sky right under or beside a solid grain: a soft shadow.
        if (e === EMPTY && px[i] === 0 && y > 0 && (solid(type[i - w]) || (x > 0 && solid(type[i - w - 1])))) px[i] = SHADOW;
        continue;
      }
      const up = y > 0 ? type[i - w] : EMPTY;
      const down = y < h - 1 ? type[i + w] : STONE;
      const left = x > 0 ? type[i - 1] : STONE;
      const right = x < w - 1 ? type[i + 1] : STONE;
      let d = 0;
      if (left === EMPTY) d += 14;
      if (right === EMPTY) d -= 16;
      if (down === EMPTY) d -= 22;
      if (up === EMPTY) {
        d += 8;
        if (twinkle && e !== STONE && e !== SEED) {
          // A tiny hash of the cell and the time slot: about one surface grain in a hundred shines.
          let k = (i * 374761393 + slot * 668265263) >>> 0;
          k = Math.imul(k ^ (k >>> 13), 1274126177) >>> 0;
          if ((k & 1023) < 12) d = 95;
        }
      }
      if (d) px[i] = adjust(px[i], d);
    }
  }
}

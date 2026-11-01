/**
 * Draws a Sandbox into pixel buffers (no DOM: the caller blits them).
 *
 * - `renderPixels`: one RGBA pixel per cell, empty cells transparent so the
 *   sky gradient behind shows through. Colours vary a little per grain, water
 *   shimmers and gets deeper, ice glints, the sun lamp flickers, and tall
 *   plants sway gently in the breeze.
 * - `renderGlow`: a quarter-resolution light map (sun lamps, the hearts of
 *   flowers) that the caller draws blurred on top for a soft glow.
 */
import { BUBBLE, CENTER, CLOUD, FLOWER, HEAT, ICE, LEAF, PLANT, SAND, SEED, SNOW, STEAM, STONE, TIP, WATER, type Sandbox } from './sim';

/** Packs a colour for a little-endian Uint32 view of ImageData (every browser in practice). */
const rgba = (r: number, g: number, b: number, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as const;

type RGB = readonly [number, number, number];
const pal = (...hs: string[]): RGB[] => hs.map(hex);

export const PALETTE = {
  sand: pal('#f2c97c', '#ecc06c', '#f5d18c', '#e8b866', '#f0c676'),
  water: pal('#3f9cf0', '#4aa7f5', '#3590e6'),
  stone: pal('#8f8ba8', '#7f7b99', '#9e9ab6', '#76728f'),
  seed: pal('#9a6440', '#86553a', '#ad7349'),
  stem: pal('#3fa34d', '#4bb158', '#379445'),
  leaf: pal('#7dd56a', '#8fe07a', '#6cc65d'),
  tip: pal('#b5ef7c'),
  ice: pal('#c9f0ff', '#b4e6fb', '#dff7ff'),
  heat: pal('#ffb340', '#ffc857', '#ffa23a'),
  steam: pal('#f4f8ff', '#e9f1ff'),
  snow: pal('#ffffff', '#f3f8ff', '#e9f1fb'),
  cloud: pal('#ffffff', '#f2f5fc', '#e8edf8'),
  bubble: pal('#e6f8ff'),
  petals: pal('#ff7eb6', '#ffd447', '#b48cff', '#ff8f6b', '#6fc3ff'),
  center: pal('#ffe680', '#ff9f43', '#fff3b0', '#ffd166', '#fff6c2'),
} as const;

/** 256-entry sine table: cheap shimmer and sway. Values in [-1, 1]. */
const SIN = new Float32Array(256);
for (let i = 0; i < 256; i++) SIN[i] = Math.sin((i / 256) * Math.PI * 2);

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

function pick(p: readonly RGB[], shade: number): RGB {
  return p[shade % p.length];
}

/**
 * Fills `out` (w × h pixels) with the world at time `t` (milliseconds).
 * `sway` = false keeps every plant still (reduced motion).
 */
export function renderPixels(sim: Sandbox, out: Uint32Array, t: number, sway = true): void {
  const { w, h, type, shade, a, b, c } = sim;
  const ft = t * 0.06; // shimmer phase, in sine-table steps
  const swayPhase = (t * 0.045) & 255;
  const depth = new Uint8Array(w);
  const buried = new Uint8Array(w);
  out.fill(0);
  const plants: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const e = type[i];
      const s = shade[i];
      if (e !== WATER) depth[x] = 0;
      // How deep under the surface a grain is: the top shines, the deep is shaded.
      if (e === SAND || e === SNOW || e === STONE || e === SEED) buried[x] = Math.min(60, buried[x] + 1);
      else buried[x] = 0;
      const lit = buried[x] === 1 ? 22 : 10 - Math.min(26, buried[x] * 0.9);
      switch (e) {
        case 0:
          break;
        case SAND: {
          const [r, g, bl] = pick(PALETTE.sand, s);
          out[i] = rgba(clamp(r + lit), clamp(g + lit), clamp(bl + lit * 0.8));
          break;
        }
        case WATER: {
          depth[x] = Math.min(40, depth[x] + 1);
          const [r, g, bl] = pick(PALETTE.water, s);
          const shimmer = SIN[(ft + x * 9 + y * 5 + s) & 255] * 14;
          const deep = depth[x] * 2.2;
          const surface = depth[x] === 1 ? 40 : 0;
          out[i] = rgba(clamp(r + shimmer - deep + surface), clamp(g + shimmer - deep * 0.8 + surface), clamp(bl + shimmer * 0.6 - deep * 0.3 + surface * 0.5), 228);
          break;
        }
        case STONE: {
          const [r, g, bl] = pick(PALETTE.stone, s);
          out[i] = rgba(clamp(r + lit * 0.7), clamp(g + lit * 0.7), clamp(bl + lit * 0.7));
          break;
        }
        case SEED: {
          const [r, g, bl] = pick(PALETTE.seed, s);
          out[i] = rgba(r, g, bl);
          break;
        }
        case PLANT:
        case FLOWER:
          if (sway && c[i] >= 5) plants.push(i);
          else out[i] = plantColor(e, a[i], b[i], s, x, y, ft);
          break;
        case ICE: {
          const [r, g, bl] = pick(PALETTE.ice, s);
          const glint = SIN[(ft * 0.5 + s * 7 + x * 3) & 255] > 0.97 ? 40 : 0;
          out[i] = rgba(clamp(r + glint), clamp(g + glint), clamp(bl + glint), 240);
          break;
        }
        case HEAT: {
          const [, g, bl] = pick(PALETTE.heat, s);
          const f = SIN[(ft * 3 + s * 13 + x * 21 + y * 17) & 255] * 22;
          out[i] = rgba(255, clamp(g + f), clamp(bl + f * 0.6));
          break;
        }
        case STEAM: {
          const [r, g, bl] = pick(PALETTE.steam, s);
          const fade = Math.max(60, 150 - a[i] * 0.6);
          out[i] = rgba(r, g, bl, fade | 0);
          break;
        }
        case SNOW: {
          const [r, g, bl] = pick(PALETTE.snow, s);
          const cool = Math.min(0, lit) * 0.8;
          out[i] = rgba(clamp(r + cool * 1.3), clamp(g + cool), clamp(bl + cool * 0.4));
          break;
        }
        case CLOUD: {
          const [r, g, bl] = pick(PALETTE.cloud, s);
          const soft = SIN[(ft * 0.3 + x * 4 + y * 11 + s) & 255] * 8;
          const alpha = a[i] > 0 ? 235 : 150;
          out[i] = rgba(clamp(r + soft), clamp(g + soft), clamp(bl + soft), alpha);
          break;
        }
        case BUBBLE: {
          const [r, g, bl] = pick(PALETTE.bubble, s);
          out[i] = rgba(r, g, bl, 215);
          break;
        }
      }
    }
  }
  // Tall plants and their flowers sway: the higher above the root, the wider.
  for (const i of plants) {
    const x = i % w;
    const y = (i / w) | 0;
    const amp = Math.min(2, c[i] / 11);
    const off = Math.round(SIN[(swayPhase + x * 3) & 255] * amp);
    const nx = x + off;
    if (nx < 0 || nx >= w) continue;
    const j = y * w + nx;
    if (out[j] >>> 24 === 255 && type[j] !== PLANT && type[j] !== FLOWER) continue; // never paint over solid things
    out[j] = plantColor(type[i], a[i], b[i], shade[i], x, y, ft);
  }
}

function plantColor(e: number, a: number, b: number, s: number, x: number, y: number, ft: number): number {
  if (e === FLOWER) {
    const [r, g, bl] = b === CENTER ? PALETTE.center[a % 5] : PALETTE.petals[a % 5];
    const v = (s & 15) - 7;
    return rgba(clamp(r + v), clamp(g + v), clamp(bl + v));
  }
  const [r, g, bl] = b & TIP ? PALETTE.tip[0] : b & LEAF ? pick(PALETTE.leaf, s) : pick(PALETTE.stem, s);
  const breeze = SIN[(ft * 0.4 + x * 5 + y * 9) & 255] * 10;
  return rgba(clamp(r + breeze * 0.4), clamp(g + breeze), clamp(bl + breeze * 0.3));
}

/** Size of the glow map for a sandbox. */
export const glowSize = (sim: Sandbox) => ({ gw: Math.ceil(sim.w / 4), gh: Math.ceil(sim.h / 4) });

/** Fills `out` (glowSize pixels) with the light emitted by sun lamps, flowers and bubbles. */
export function renderGlow(sim: Sandbox, out: Uint32Array, t: number): void {
  const { w, h, type, b } = sim;
  const { gw, gh } = glowSize(sim);
  const R = new Float32Array(gw * gh);
  const G = new Float32Array(gw * gh);
  const B = new Float32Array(gw * gh);
  const pulse = 0.85 + 0.15 * SIN[(t * 0.05) & 255];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const e = type[y * w + x];
      if (e !== HEAT && e !== FLOWER) continue;
      const g = (y >> 2) * gw + (x >> 2);
      if (e === HEAT) {
        R[g] += 26 * pulse;
        G[g] += 15 * pulse;
        B[g] += 3 * pulse;
      } else if (b[y * w + x] === CENTER) {
        // A faint warm heart in each flower.
        R[g] += 10;
        G[g] += 7;
        B[g] += 1;
      }
    }
  }
  for (let g = 0; g < gw * gh; g++) {
    const m = Math.max(R[g], G[g], B[g]);
    if (m <= 0) {
      out[g] = 0;
      continue;
    }
    const k = m > 255 ? 255 / m : 1;
    out[g] = rgba(clamp(R[g] * k), clamp(G[g] * k), clamp(B[g] * k), clamp(m * 1.4));
  }
}

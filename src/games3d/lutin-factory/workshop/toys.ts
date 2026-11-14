import * as THREE from 'three';
import type { Color, Item } from '../logic';
import { MATERIAL_HEX, PAINT_HEX, PAINT_PATTERN, WRAP_HEX, WRAP_PATTERN, FELT } from './palette';
import type { Prim } from './prims';

/**
 * How a toy looks, assembled from instanced primitives: an item (raw lump,
 * a shape, or a toy built by the assembler / robot arm) → a list of parts
 * (primitive, local matrix, colour, pattern). Toys face +X (their direction
 * of travel); the origin is on the belt, at the centre of the toy.
 * Results are cached by look (an item keeps its look across many frames).
 */

export interface ToyPart {
  prim: Prim;
  m: THREE.Matrix4;
  color: number;
  pat: number;
}

export interface ToyLook {
  parts: ToyPart[];
  /** Height of the top (stickers, the elves' gaze, the pop). */
  top: number;
}

const hex = (c: string) => new THREE.Color(c).getHex();
const E = new THREE.Euler();
const Q = new THREE.Quaternion();
const P = new THREE.Vector3();
const S = new THREE.Vector3();

function mat(x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0): THREE.Matrix4 {
  E.set(rx, ry, rz);
  Q.setFromEuler(E);
  return new THREE.Matrix4().compose(P.set(x, y, z), Q, S.set(sx, sy, sz));
}

type Paintable = Pick<Item, 'color' | 'material'>;

function colorOf(it: Paintable | undefined, fallback: Paintable): { color: number; pat: number } {
  const c: Color | undefined = it?.color ?? fallback.color;
  if (c) return { color: hex(PAINT_HEX[c]), pat: PAINT_PATTERN[c] };
  return { color: hex(MATERIAL_HEX[it?.material ?? fallback.material]), pat: 0 };
}

const DARK = hex(FELT.ink);
const GOLD = hex(FELT.gold);
const WHITE = hex('#fffaf0');
const RED = hex(FELT.red);
const TRUNK = hex(FELT.woodDark);

function shapeParts(it: Item, out: ToyPart[], base: Paintable): number {
  const { color, pat } = colorOf(it, base);
  switch (it.shape) {
    case 'ball':
      out.push({ prim: 'ball', m: mat(0, 0.22, 0, 0.44, 0.44, 0.44), color, pat });
      return 0.44;
    case 'cube':
      out.push({ prim: 'cube', m: mat(0, 0.2, 0, 0.4, 0.4, 0.4), color, pat });
      return 0.4;
    case 'cylinder':
      out.push({ prim: 'cylinder', m: mat(0, 0.21, 0, 0.38, 0.42, 0.38), color, pat });
      return 0.42;
    case 'cone':
      out.push({ prim: 'cone', m: mat(0, 0.23, 0, 0.42, 0.46, 0.42), color, pat });
      return 0.46;
    case 'star':
      out.push({ prim: 'star', m: mat(0, 0.25, 0, 0.5, 0.5, 0.5, 0, Math.PI / 2, 0), color, pat });
      return 0.5;
    case 'wheel':
      out.push({ prim: 'wheel', m: mat(0, 0.22, 0, 0.44, 0.44, 0.44), color, pat });
      return 0.44;
    default: {
      const prim: Prim = it.material === 'felt' ? 'feltpad' : it.material === 'metal' ? 'tin' : it.material === 'yarn' ? 'yarnball' : 'log';
      const s = prim === 'log' ? [0.42, 0.42, 0.42] : prim === 'feltpad' ? [0.4, 0.4, 0.4] : prim === 'tin' ? [0.3, 0.34, 0.3] : [0.36, 0.36, 0.36];
      const y = prim === 'feltpad' ? 0.09 : s[1] / 2;
      out.push({ prim, m: mat(0, y, 0, s[0], s[1], s[2]), color, pat });
      return s[1];
    }
  }
}

function toyParts(it: Item, out: ToyPart[]): number {
  const base: Paintable = { color: it.color, material: it.material };
  const parts = it.parts ?? [];
  const pc = (i: number) => colorOf(parts[i], base);
  switch (it.toy) {
    case 'boat': {
      const hull = pc(0);
      const sail = pc(1);
      out.push({ prim: 'cube', m: mat(0, 0.1, 0, 0.58, 0.2, 0.34), ...hull });
      out.push({ prim: 'cylinder', m: mat(0.02, 0.36, 0, 0.04, 0.44, 0.04), color: TRUNK, pat: 0 });
      out.push({ prim: 'cone', m: mat(0.1, 0.38, 0, 0.32, 0.38, 0.08, 0, 0, 0), ...sail });
      return 0.6;
    }
    case 'rocket': {
      const body = pc(0);
      const nose = pc(1);
      out.push({ prim: 'cylinder', m: mat(0, 0.26, 0, 0.24, 0.4, 0.24), ...body });
      out.push({ prim: 'cone', m: mat(0, 0.56, 0, 0.24, 0.22, 0.24), ...nose });
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        out.push({ prim: 'cube', m: mat(Math.cos(a) * 0.13, 0.1, Math.sin(a) * 0.13, 0.05, 0.16, 0.12, 0, -a, 0), color: RED, pat: 0 });
      }
      out.push({ prim: 'dot', m: mat(0.12, 0.32, 0, 0.08, 0.08, 0.08), color: hex(FELT.sky), pat: 0 });
      return 0.68;
    }
    case 'train': {
      const n = Math.max(1, it.n ?? Math.max(1, parts.length - 1));
      const wag = 0.22;
      const len = 0.34 + n * wag;
      const k = Math.min(1, 1.5 / len);
      const x0 = (len * k) / 2;
      const eng = pc(0);
      // Engine (front, +X), cab, chimney.
      out.push({ prim: 'cylinder', m: mat(x0 - 0.12 * k, 0.17, 0, 0.18 * k, 0.24 * k, 0.18 * k, 0, 0, Math.PI / 2), ...eng });
      out.push({ prim: 'cube', m: mat(x0 - 0.3 * k, 0.2, 0, 0.14 * k, 0.24, 0.2), ...eng });
      out.push({ prim: 'cylinder', m: mat(x0 - 0.06 * k, 0.33, 0, 0.06, 0.1, 0.06), color: DARK, pat: 0 });
      for (let i = 0; i < n; i++) {
        const w = colorOf(parts[1 + i], base);
        const x = x0 - (0.34 + wag * i + wag / 2) * k;
        out.push({ prim: 'cube', m: mat(x, 0.17, 0, 0.18 * k, 0.17, 0.2), ...w });
      }
      for (let i = 0; i <= n; i++) {
        const x = x0 - (0.2 + wag * i) * k;
        out.push({ prim: 'wheel', m: mat(x, 0.07, 0.11, 0.12, 0.12, 0.12), color: DARK, pat: 0 });
        out.push({ prim: 'wheel', m: mat(x, 0.07, -0.11, 0.12, 0.12, 0.12), color: DARK, pat: 0 });
      }
      return 0.38;
    }
    case 'car': {
      const body = pc(0);
      out.push({ prim: 'cube', m: mat(0, 0.15, 0, 0.5, 0.16, 0.3), ...body });
      out.push({ prim: 'cube', m: mat(-0.04, 0.28, 0, 0.26, 0.14, 0.26), color: hex(FELT.sky), pat: 0 });
      for (let i = 0; i < 4; i++) {
        const w = colorOf(parts[1 + i], { material: 'wood' });
        out.push({ prim: 'wheel', m: mat(i < 2 ? 0.16 : -0.16, 0.08, i % 2 ? 0.16 : -0.16, 0.16, 0.16, 0.16), color: w.pat ? w.color : DARK, pat: w.pat });
      }
      return 0.36;
    }
    case 'tower': {
      const n = Math.max(2, it.n ?? parts.length);
      const k = Math.min(1, 1.0 / (n * 0.26));
      for (let i = 0; i < n; i++) {
        const c = colorOf(parts[i], base);
        out.push({ prim: 'cube', m: mat(0, (0.13 + i * 0.26) * k, 0, 0.3, 0.25 * k, 0.3, 0, (i % 2) * 0.25, 0), ...c });
      }
      return n * 0.26 * k;
    }
    case 'teddy': {
      const body = pc(0);
      const head = pc(1);
      out.push({ prim: 'ball', m: mat(0, 0.17, 0, 0.36, 0.34, 0.32), ...body });
      out.push({ prim: 'ball', m: mat(0, 0.44, 0, 0.28, 0.26, 0.26), ...head });
      out.push({ prim: 'ball', m: mat(0, 0.56, 0.11, 0.1, 0.1, 0.08), ...head });
      out.push({ prim: 'ball', m: mat(0, 0.56, -0.11, 0.1, 0.1, 0.08), ...head });
      out.push({ prim: 'dot', m: mat(0.13, 0.43, 0, 0.08, 0.06, 0.08), color: hex(FELT.cream), pat: 0 });
      out.push({ prim: 'dot', m: mat(0.11, 0.48, 0.06, 0.035, 0.035, 0.035), color: DARK, pat: 0 });
      out.push({ prim: 'dot', m: mat(0.11, 0.48, -0.06, 0.035, 0.035, 0.035), color: DARK, pat: 0 });
      return 0.6;
    }
    case 'robot': {
      const body = pc(0);
      const head = pc(1);
      out.push({ prim: 'cube', m: mat(0, 0.17, 0, 0.3, 0.3, 0.26), ...body });
      out.push({ prim: 'ball', m: mat(0, 0.44, 0, 0.26, 0.24, 0.26), ...head });
      out.push({ prim: 'cylinder', m: mat(0, 0.6, 0, 0.02, 0.1, 0.02), color: DARK, pat: 0 });
      out.push({ prim: 'dot', m: mat(0, 0.66, 0, 0.06, 0.06, 0.06), color: RED, pat: 0 });
      out.push({ prim: 'dot', m: mat(0.12, 0.46, 0.06, 0.05, 0.05, 0.05), color: DARK, pat: 0 });
      out.push({ prim: 'dot', m: mat(0.12, 0.46, -0.06, 0.05, 0.05, 0.05), color: DARK, pat: 0 });
      out.push({ prim: 'dot', m: mat(0.15, 0.2, 0, 0.07, 0.07, 0.07), color: GOLD, pat: 0 });
      return 0.66;
    }
    case 'snow-globe': {
      const globe = pc(0);
      const b = pc(1);
      out.push({ prim: 'cylinder', m: mat(0, 0.06, 0, 0.34, 0.12, 0.34), ...b });
      out.push({ prim: 'ball', m: mat(0, 0.3, 0, 0.36, 0.36, 0.36), color: globe.pat ? globe.color : hex('#cfe8ff'), pat: globe.pat });
      out.push({ prim: 'stkSnow', m: mat(0.12, 0.34, 0, 0.14, 0.14, 0.14, 0, 0, Math.PI / 2), color: WHITE, pat: 0 });
      return 0.48;
    }
    case 'kite': {
      const sail = pc(0);
      out.push({ prim: 'star', m: mat(0, 0.38, 0, 0.46, 0.46, 0.46, 0, Math.PI / 2, -0.3), ...sail });
      out.push({ prim: 'cylinder', m: mat(-0.05, 0.16, 0, 0.02, 0.32, 0.02), color: TRUNK, pat: 0 });
      for (let i = 0; i < 3; i++) out.push({ prim: 'cube', m: mat(-0.12 - i * 0.1, 0.12 - i * 0.03, 0, 0.06, 0.04, 0.06, 0, 0, 0.8), color: hex(MATERIAL_HEX.yarn), pat: 0 });
      return 0.6;
    }
    case 'dollhouse': {
      const a = pc(0);
      const b = pc(1);
      const roof = pc(2);
      out.push({ prim: 'cube', m: mat(0, 0.13, 0, 0.42, 0.26, 0.36), ...a });
      out.push({ prim: 'cube', m: mat(0, 0.36, 0, 0.42, 0.2, 0.36), ...b });
      out.push({ prim: 'cone', m: mat(0, 0.58, 0, 0.36, 0.24, 0.36, 0, Math.PI / 4, 0), ...roof });
      out.push({ prim: 'cube', m: mat(0.2, 0.09, 0, 0.04, 0.16, 0.1), color: DARK, pat: 0 });
      return 0.7;
    }
    case 'top': {
      const { color, pat } = colorOf(it, base);
      out.push({ prim: 'cone', m: mat(0, 0.2, 0, 0.44, 0.34, 0.44, Math.PI, 0, 0), color, pat });
      out.push({ prim: 'cylinder', m: mat(0, 0.42, 0, 0.12, 0.1, 0.12), color, pat });
      out.push({ prim: 'cylinder', m: mat(0, 0.5, 0, 0.04, 0.1, 0.04), color: DARK, pat: 0 });
      return 0.55;
    }
    case 'drum': {
      const { color, pat } = colorOf(it, base);
      out.push({ prim: 'cylinder', m: mat(0, 0.18, 0, 0.42, 0.3, 0.42), color, pat });
      out.push({ prim: 'cylinder', m: mat(0, 0.34, 0, 0.44, 0.04, 0.44), color: WHITE, pat: 0 });
      out.push({ prim: 'cylinder', m: mat(0, 0.04, 0, 0.44, 0.04, 0.44), color: GOLD, pat: 0 });
      out.push({ prim: 'cylinder', m: mat(0.08, 0.42, 0.08, 0.025, 0.2, 0.025, 0.4, 0, 0.5), color: TRUNK, pat: 0 });
      return 0.38;
    }
    default:
      return shapeParts(it, out, base);
  }
}

const cache = new Map<string, ToyLook>();

function keyOf(it: Item): string {
  return JSON.stringify(it, (k, v) => (k === 'id' ? undefined : v));
}

/** The look of an item (cached). */
export function toyLook(it: Item): ToyLook {
  const k = keyOf(it);
  const hit = cache.get(k);
  if (hit) return hit;
  const parts: ToyPart[] = [];
  let top: number;
  if (it.wrap) {
    // Wrapped: a gift box in patterned paper, a ribbon and a bow (the toy hides inside).
    const big = it.toy === 'train' || it.toy === 'dollhouse' || it.toy === 'tower';
    const w = big ? 0.56 : 0.44;
    const h = it.toy === 'tower' || it.toy === 'dollhouse' ? 0.5 : 0.38;
    parts.push({ prim: 'gift', m: mat(0, h / 2, 0, w, h, w), color: hex(WRAP_HEX[it.wrap]), pat: WRAP_PATTERN[it.wrap] });
    parts.push({ prim: 'ribbon', m: mat(0, h / 2, 0, w, h, w), color: GOLD, pat: 0 });
    parts.push({ prim: 'bow', m: mat(0, h + 0.05, 0, 0.36, 0.36, 0.36), color: GOLD, pat: 0 });
    top = h + 0.1;
  } else if (it.toy || it.parts) {
    top = toyParts(it, parts);
  } else top = shapeParts(it, parts, it);
  if (it.sticker) {
    const prim: Prim = it.sticker === 'heart' ? 'stkHeart' : it.sticker === 'moon' ? 'stkMoon' : it.sticker === 'snowflake' ? 'stkSnow' : 'stkStar';
    const col = it.sticker === 'heart' ? hex(FELT.pink) : it.sticker === 'moon' ? hex('#ffe58a') : it.sticker === 'snowflake' ? hex('#e8f6ff') : GOLD;
    parts.push({ prim, m: mat(0, top + 0.03, 0, 0.2, 0.2, 0.2, 0, -Math.PI / 2, 0), color: col, pat: 0 });
    top += 0.05;
  }
  const look = { parts, top };
  if (cache.size > 600) cache.clear();
  cache.set(k, look);
  return look;
}


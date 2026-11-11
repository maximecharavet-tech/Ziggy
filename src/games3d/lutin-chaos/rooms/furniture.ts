import * as THREE from 'three';
import { Shape, starShape, type Hex, type V3 } from './kit';

/**
 * Prefab furniture for the dollhouse rooms. A prefab draws into three
 * shapes (wood, felt, glow) in its own local frame (origin on the floor,
 * facing +z) and returns the anchors where the room's props sit.
 * The room builder places it (position + turn) and merges every static
 * piece per material: a whole room's furniture costs three draw calls.
 */

export interface Pieces {
  wood: Shape;
  felt: Shape;
  glow: Shape;
}

/** Where props sit on a piece (local frame). */
export interface Anchor {
  at: V3;
  /** Row direction (local) and usable length. */
  dir?: V3;
  len?: number;
  /** Props hang down from here (coats, stockings). */
  hang?: boolean;
  /** Fraction of a prop's height sunk into a container. */
  sink?: number;
  /** Props arranged around a cone (Christmas tree). */
  tree?: { r: number; h: number };
}

export type Prefab = (p: Pieces, n: number, c: PrefabColors) => Anchor[];

export interface PrefabColors {
  wood: Hex;
  woodDark: Hex;
  felt: Hex;
  accent: Hex;
}

const row = (at: V3, len: number, n: number, dir: V3 = [1, 0, 0]): Anchor[] => {
  if (n <= 1) return [{ at, dir, len }];
  const out: Anchor[] = [];
  const step = len / n;
  for (let i = 0; i < n; i++) {
    const k = (i - (n - 1) / 2) * step;
    out.push({ at: [at[0] + dir[0] * k, at[1] + dir[1] * k, at[2] + dir[2] * k], dir, len: step * 0.95 });
  }
  return out;
};

// ---------------------------------------------------------------------------
// Furniture (static)

export const PREFABS: Record<string, Prefab> = {
  /** No furniture: the slot belongs to a hiding place drawn elsewhere (umbrella stand). */
  spot: (p, n) => row([0, 0.62, 0], 0.4, n).map((a) => ({ ...a, sink: 0.45 })),
  /** No furniture: props simply lie on the floor there (under the sofa). */
  ground: (p, n) => row([0, 0.01, 0], 1.2, n),
  table: (p, n, c) => {
    p.wood.box(2.0, 0.1, 1.1, c.wood, { at: [0, 0.95, 0], r: 0.03 });
    for (const x of [-0.88, 0.88]) for (const z of [-0.45, 0.45]) p.wood.box(0.09, 0.92, 0.09, c.woodDark, { at: [x, 0.46, z] });
    p.felt.box(1.6, 0.012, 0.7, c.felt, { at: [0, 1.006, 0] });
    return row([0, 1.0, 0.05], 1.7, n);
  },
  desk: (p, n, c) => {
    p.wood.box(1.7, 0.1, 0.9, c.wood, { at: [0, 0.95, 0], r: 0.03 });
    p.wood.box(0.6, 0.85, 0.85, c.woodDark, { at: [0.5, 0.45, 0], r: 0.03 });
    p.wood.box(0.08, 0.9, 0.08, c.woodDark, { at: [-0.78, 0.45, 0.36] });
    p.wood.box(0.08, 0.9, 0.08, c.woodDark, { at: [-0.78, 0.45, -0.36] });
    p.wood.sphere(0.04, c.accent, { at: [0.5, 0.65, 0.44] });
    return row([0, 1.0, 0.05], 1.5, n);
  },
  counter: (p, n, c) => {
    p.wood.box(2.8, 1.0, 0.9, c.felt, { at: [0, 0.5, 0], r: 0.04 });
    p.wood.box(2.9, 0.08, 0.98, c.wood, { at: [0, 1.04, 0], r: 0.02 });
    for (let i = 0; i < 3; i++) {
      p.wood.box(0.84, 0.72, 0.02, c.accent, { at: [-0.93 + i * 0.93, 0.48, 0.46], r: 0.01 });
      p.wood.sphere(0.035, '#e8b33a', { at: [-0.93 + i * 0.93 + 0.3, 0.7, 0.48] });
    }
    return row([0, 1.08, 0.08], 2.6, n);
  },
  shelf: (p, n, c) => {
    p.wood.box(2.0, 0.08, 0.42, c.wood, { at: [0, 0, 0], r: 0.02 });
    p.wood.box(0.06, 0.3, 0.3, c.woodDark, { at: [-0.8, -0.16, -0.05] });
    p.wood.box(0.06, 0.3, 0.3, c.woodDark, { at: [0.8, -0.16, -0.05] });
    return row([0, 0.04, 0.04], 1.85, n);
  },
  bookcase: (p, n, c) => {
    p.wood.box(2.0, 2.4, 0.5, c.woodDark, { at: [0, 1.2, -0.05], r: 0.03 });
    p.felt.box(1.84, 2.24, 0.02, c.felt, { at: [0, 1.2, -0.28] });
    for (const y of [0.1, 0.9, 1.7]) p.wood.box(1.86, 0.06, 0.46, c.wood, { at: [0, y, 0] });
    if (n <= 1) return [{ at: [0, 1.73, 0.05], dir: [1, 0, 0], len: 1.8 }];
    const out: Anchor[] = [];
    for (let i = 0; i < n; i++) out.push({ at: [0, i % 3 === 0 ? 1.73 : i % 3 === 1 ? 0.93 : 0.13, 0.05], dir: [1, 0, 0], len: 1.8 });
    return out;
  },
  hooks: (p, n, c) => {
    p.wood.box(Math.max(1.4, n * 0.9), 0.14, 0.06, c.wood, { at: [0, 0, 0], r: 0.02 });
    const out = row([0, -0.08, 0.14], Math.max(1.2, n * 0.9), n);
    const hookCols = ['#3f7fe0', '#ffcc33', '#3a9d4f', '#e2453c', '#7950f2'];
    out.forEach((a, i) => {
      p.felt.sphere(0.06, hookCols[i % hookCols.length], { at: [a.at[0], 0, 0.08] });
      p.wood.cyl(0.02, 0.02, 0.14, '#6b4226', { at: [a.at[0], 0, 0.1], rot: [Math.PI / 2, 0, 0] });
      a.hang = true;
      a.at = [a.at[0], -0.02, 0.16];
    });
    return out;
  },
  floor: (p, n, c) => {
    p.felt.cyl(0.85, 0.85, 0.02, c.accent, { at: [0, 0.01, 0], seg: 24, scale: [1.3, 1, 0.8] });
    return row([0, 0.02, 0], 1.8, n);
  },
  mat: (p, n, c) => {
    p.felt.box(1.6, 0.03, 0.8, c.accent, { at: [0, 0.015, 0], r: 0.012 });
    p.felt.box(1.4, 0.035, 0.6, c.felt, { at: [0, 0.018, 0], r: 0.01 });
    return row([0, 0.035, 0], 1.3, n);
  },
  basket: (p, n, c) => {
    p.felt.cyl(0.42, 0.34, 0.5, c.wood, { at: [0, 0.25, 0], seg: 16 });
    p.felt.torus(0.42, 0.04, c.woodDark, { at: [0, 0.5, 0], rot: [Math.PI / 2, 0, 0] });
    return [{ at: [0, 0.46, 0], dir: [1, 0, 0], len: 0.8, sink: 0.3 }];
  },
  crate: (p, n, c) => {
    p.wood.box(1.0, 0.6, 0.7, c.wood, { at: [0, 0.3, 0] });
    for (const y of [0.15, 0.45]) p.wood.box(1.02, 0.08, 0.72, c.woodDark, { at: [0, y, 0] });
    return row([0, 0.6, 0], 0.9, n);
  },
  stand: (p, n, c) => {
    p.wood.cyl(0.22, 0.26, 0.6, c.accent, { at: [0, 0.3, 0], seg: 14 });
    p.wood.torus(0.22, 0.03, c.woodDark, { at: [0, 0.6, 0], rot: [Math.PI / 2, 0, 0] });
    return [{ at: [0, 0.28, 0], dir: [1, 0, 0], len: 0.35, sink: 0 }];
  },
  stool: (p, n, c) => {
    p.wood.cyl(0.32, 0.32, 0.1, c.wood, { at: [0, 0.7, 0] });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      p.wood.cyl(0.035, 0.035, 0.7, c.woodDark, { at: [Math.cos(a) * 0.22, 0.35, Math.sin(a) * 0.22] });
    }
    return row([0, 0.75, 0], 0.5, n);
  },
  cabinet: (p, n, c) => {
    p.wood.box(1.5, 2.3, 0.7, c.felt, { at: [0, 1.15, 0], r: 0.05 });
    p.wood.box(1.36, 0.06, 0.6, c.wood, { at: [0, 1.2, 0.08] });
    p.felt.box(1.32, 2.1, 0.02, c.accent, { at: [0, 1.15, -0.32] });
    p.wood.box(0.66, 2.1, 0.05, c.felt, { at: [-1.0, 1.15, 0.5], rot: [0, -1.1, 0] });
    p.wood.sphere(0.05, '#e8b33a', { at: [-1.22, 1.2, 0.78] });
    return n > 1 ? [{ at: [0, 1.24, 0.08], dir: [1, 0, 0], len: 1.2 }, { at: [0, 0.12, 0.08], dir: [1, 0, 0], len: 1.2 }] : [{ at: [0, 1.24, 0.08], dir: [1, 0, 0], len: 1.2 }];
  },
  fridge: (p, n) => {
    // an open fridge (the elves left the door open): back, sides, top, bottom, shelves
    const W = '#f4f1ea';
    p.wood.box(1.3, 2.6, 0.08, W, { at: [0, 1.3, -0.41] });
    p.wood.box(0.08, 2.6, 0.9, W, { at: [-0.61, 1.3, 0] });
    p.wood.box(0.08, 2.6, 0.9, W, { at: [0.61, 1.3, 0] });
    p.wood.box(1.3, 0.12, 0.9, W, { at: [0, 2.54, 0], r: 0.04 });
    p.wood.box(1.3, 0.2, 0.9, W, { at: [0, 0.1, 0] });
    p.felt.box(1.14, 2.3, 0.02, '#dfeaf2', { at: [0, 1.3, -0.36] });
    for (const y of [0.9, 1.7]) p.wood.box(1.12, 0.04, 0.72, '#cfe2ee', { at: [0, y, 0.02] });
    p.wood.box(0.1, 2.5, 1.2, W, { at: [0.95, 1.3, 0.95], rot: [0, -0.35, 0], r: 0.04 });
    p.wood.box(0.06, 0.6, 0.06, '#c9cfd8', { at: [0.82, 1.5, 1.42] });
    p.glow.sphere(0.07, '#fff6c8', { at: [0, 2.35, -0.2] });
    return ([{ at: [0, 1.72, 0.05], dir: [1, 0, 0], len: 1.05 }, { at: [0, 0.92, 0.05], dir: [1, 0, 0], len: 1.05 }] as Anchor[]).slice(0, Math.max(1, n));
  },
  stove: (p) => {
    p.wood.box(1.2, 1.0, 0.9, '#e2453c', { at: [0, 0.5, 0], r: 0.06 });
    p.wood.box(1.2, 0.05, 0.9, '#3b2a22', { at: [0, 1.02, 0] });
    p.wood.box(0.8, 0.5, 0.02, '#3b2a22', { at: [0, 0.45, 0.46], r: 0.02 });
    p.glow.box(0.6, 0.2, 0.01, '#ffb35c', { at: [0, 0.45, 0.47] });
    for (const x of [-0.3, 0.3]) p.wood.torus(0.14, 0.02, '#c9cfd8', { at: [x, 1.05, 0], rot: [Math.PI / 2, 0, 0] });
    return [];
  },
  sofa: (p, n, c) => {
    p.felt.box(2.6, 0.5, 1.1, c.felt, { at: [0, 0.45, 0], r: 0.14 });
    p.felt.box(2.6, 0.9, 0.35, c.felt, { at: [0, 0.85, -0.42], r: 0.15 });
    p.felt.box(0.35, 0.75, 1.1, c.felt, { at: [-1.28, 0.6, 0], r: 0.14 });
    p.felt.box(0.35, 0.75, 1.1, c.felt, { at: [1.28, 0.6, 0], r: 0.14 });
    for (const x of [-1.1, 1.1]) p.wood.cyl(0.06, 0.05, 0.2, c.woodDark, { at: [x, 0.1, 0.4] });
    return row([0, 0.72, 0.05], 2.1, n);
  },
  bench: (p, n, c) => {
    p.wood.box(2.0, 0.12, 0.6, c.wood, { at: [0, 0.62, 0], r: 0.03 });
    p.felt.box(1.9, 0.08, 0.5, c.felt, { at: [0, 0.7, 0], r: 0.03 });
    for (const x of [-0.85, 0.85]) p.wood.box(0.12, 0.6, 0.5, c.woodDark, { at: [x, 0.3, 0] });
    return row([0, 0.74, 0], 1.8, n);
  },
  bed: (p, n, c) => {
    p.wood.box(2.0, 0.5, 2.8, c.wood, { at: [0, 0.25, 0], r: 0.05 });
    p.felt.box(1.9, 0.3, 2.6, '#f6f1e7', { at: [0, 0.62, 0], r: 0.1 });
    p.felt.box(1.96, 0.18, 1.6, c.felt, { at: [0, 0.8, 0.5], r: 0.08 });
    p.wood.box(2.1, 1.3, 0.14, c.woodDark, { at: [0, 0.65, -1.4], r: 0.05 });
    return row([0, 0.88, -0.6], 1.6, n);
  },
  chair: (p, n, c) => {
    p.wood.box(0.8, 0.1, 0.8, c.wood, { at: [0, 0.6, 0], r: 0.03 });
    p.wood.box(0.8, 0.9, 0.1, c.wood, { at: [0, 1.05, -0.35], r: 0.03 });
    p.felt.box(0.7, 0.08, 0.7, c.felt, { at: [0, 0.69, 0], r: 0.03 });
    for (const x of [-0.34, 0.34]) for (const z of [-0.34, 0.34]) p.wood.box(0.07, 0.6, 0.07, c.woodDark, { at: [x, 0.3, z] });
    return row([0, 0.74, 0.02], 0.65, n);
  },
  window: (p, n, c) => {
    p.glow.box(1.5, 1.3, 0.02, '#cfd9ff', { at: [0, 2.35, 0.0] });
    p.wood.box(1.7, 0.1, 0.12, c.wood, { at: [0, 3.05, 0.05] });
    p.wood.box(1.7, 0.1, 0.12, c.wood, { at: [0, 1.65, 0.05] });
    p.wood.box(0.1, 1.5, 0.12, c.wood, { at: [-0.8, 2.35, 0.05] });
    p.wood.box(0.1, 1.5, 0.12, c.wood, { at: [0.8, 2.35, 0.05] });
    p.wood.box(0.06, 1.3, 0.08, c.wood, { at: [0, 2.35, 0.04] });
    p.wood.box(1.9, 0.08, 0.4, c.wood, { at: [0, 1.58, 0.18] });
    return row([0, 1.62, 0.22], 1.7, n);
  },
  lamp: (p, n, c) => {
    p.wood.cyl(0.22, 0.26, 0.06, c.woodDark, { at: [0, 0.03, 0] });
    p.wood.cyl(0.035, 0.035, 1.7, c.woodDark, { at: [0, 0.88, 0] });
    p.felt.cyl(0.24, 0.4, 0.42, c.accent, { at: [0, 1.85, 0], open: true, seg: 16 });
    p.glow.sphere(0.1, '#fff2b0', { at: [0, 1.72, 0] });
    return [{ at: [0, 2.06, 0], dir: [1, 0, 0], len: 0.5 }];
  },
  tree: (p) => {
    p.wood.cyl(0.1, 0.12, 0.4, '#6b4226', { at: [0, 0.2, 0] });
    p.felt.cyl(0.32, 0.36, 0.3, '#e2453c', { at: [0, 0.15, 0] });
    for (let i = 0; i < 4; i++) p.felt.cone(1.15 - i * 0.24, 1.0, '#2f7d4a', { at: [0, 0.75 + i * 0.6, 0], seg: 12 });
    return [{ at: [0, 0.6, 0], tree: { r: 1.05, h: 2.0 }, dir: [1, 0, 0], len: 1 }];
  },
  treetop: () => [{ at: [0, 3.15, 0], dir: [1, 0, 0], len: 0.4 }],
  mantel: (p, n, c) => {
    p.wood.box(2.4, 1.6, 0.6, '#c96f4a', { at: [0, 0.8, 0], r: 0.03 });
    p.wood.box(1.2, 0.9, 0.62, '#3b2a22', { at: [0, 0.45, 0.01] });
    p.glow.box(0.9, 0.35, 0.02, '#ff9a3c', { at: [0, 0.28, 0.33] });
    p.glow.cone(0.18, 0.36, '#ffd25e', { at: [-0.18, 0.4, 0.2], seg: 6 });
    p.glow.cone(0.14, 0.3, '#ff9a3c', { at: [0.16, 0.36, 0.2], seg: 6 });
    p.wood.box(2.7, 0.12, 0.8, c.wood, { at: [0, 1.66, 0.05], r: 0.02 });
    return row([0, 1.72, 0.12], 2.3, n);
  },
  track: (p, n) => {
    p.wood.torus(0.9, 0.05, '#8a5a2a', { at: [0, 0.03, 0], rot: [Math.PI / 2, 0, 0], seg: 28, scale: [1.3, 1, 1] });
    p.wood.torus(0.72, 0.05, '#8a5a2a', { at: [0, 0.03, 0], rot: [Math.PI / 2, 0, 0], seg: 28, scale: [1.38, 1, 1] });
    return row([0, 0.05, 0.8], 1.2, n);
  },
  stairs: (p, n, c) => {
    for (let i = 0; i < 6; i++) p.wood.box(1.4, 0.36 * (i + 1), 0.5, i % 2 ? c.wood : c.woodDark, { at: [0, 0.18 * (i + 1), 1.25 - i * 0.5] });
    p.felt.box(0.5, 0.012, 3.0, c.accent, { at: [0, 0.01, 0] });
    return row([0, 0.72, 0.25], 1.0, n);
  },
  sink: (p, n, c) => {
    p.wood.box(2.0, 1.0, 0.8, c.felt, { at: [0, 0.5, 0], r: 0.05 });
    p.wood.box(2.1, 0.08, 0.9, '#f4f1ea', { at: [0, 1.04, 0], r: 0.02 });
    p.wood.cyl(0.3, 0.24, 0.12, '#f4f1ea', { at: [0, 1.05, 0], seg: 18 });
    p.wood.cyl(0.03, 0.03, 0.3, '#c9cfd8', { at: [0, 1.25, -0.3] });
    p.felt.box(1.0, 1.1, 0.04, '#cfe2ee', { at: [0, 2.2, -0.36], r: 0.04 });
    return row([0, 1.08, 0.1], 1.8, n);
  },
  bath: (p, n) => {
    p.wood.box(2.6, 0.8, 1.2, '#f4f1ea', { at: [0, 0.45, 0], r: 0.25 });
    p.felt.box(2.3, 0.05, 0.9, '#9fd3f2', { at: [0, 0.72, 0], r: 0.02 });
    for (const x of [-1.1, 1.1]) for (const z of [-0.45, 0.45]) p.wood.sphere(0.08, '#e8b33a', { at: [x, 0.06, z] });
    return row([0, 0.86, 0.5], 2.2, n);
  },
  piano: (p, n) => {
    p.wood.box(2.2, 1.2, 0.8, '#2b2230', { at: [0, 0.75, 0], r: 0.04 });
    p.wood.box(2.0, 0.06, 0.32, '#f6f1e7', { at: [0, 0.98, 0.5] });
    for (let i = 0; i < 12; i++) p.wood.box(0.05, 0.05, 0.18, '#2b2230', { at: [-0.86 + i * 0.16, 1.02, 0.44] });
    for (const x of [-0.95, 0.95]) p.wood.box(0.1, 0.4, 0.1, '#2b2230', { at: [x, 0.2, 0.3] });
    return (
      [
        { at: [0, 1.36, 0], dir: [1, 0, 0], len: 1.9 },
        { at: [0, 1.05, -0.1], dir: [1, 0, 0], len: 1.4, sink: 0.4 },
      ] as Anchor[]
    ).slice(0, Math.max(1, n));
  },
  xylo: (p, n) => {
    p.wood.box(1.9, 0.1, 0.7, '#8a5a2a', { at: [0, 0.82, 0], r: 0.02 });
    for (const x of [-0.85, 0.85]) p.wood.box(0.08, 0.82, 0.6, '#6b4226', { at: [x, 0.41, 0] });
    return row([0, 0.87, 0], 1.6, n);
  },
  board: (p, n, c) => {
    p.wood.box(Math.max(1.6, n * 0.75), 1.2, 0.06, c.woodDark, { at: [0, 0, 0], r: 0.03 });
    p.felt.box(Math.max(1.5, n * 0.75) - 0.12, 1.08, 0.02, c.felt, { at: [0, 0, 0.035] });
    return row([0, -0.2, 0.08], Math.max(1.4, n * 0.72), n);
  },
  sign: (p, n, c) => {
    p.wood.box(Math.max(1.6, n * 0.6), 0.7, 0.08, c.wood, { at: [0, 0, 0], r: 0.04 });
    p.wood.box(0.06, 0.8, 0.06, '#6b4226', { at: [-0.4, 0.6, -0.02], rot: [0, 0, 0.5] });
    p.wood.box(0.06, 0.8, 0.06, '#6b4226', { at: [0.4, 0.6, -0.02], rot: [0, 0, -0.5] });
    return row([0, -0.2, 0.08], Math.max(1.4, n * 0.55), n);
  },
  snow: (p, n) => {
    p.felt.sphere(0.9, '#f6f8ff', { at: [0, -0.35, 0], scale: [1.3, 0.6, 1] });
    return row([0, 0.2, 0.2], 1.3, n);
  },
  fence: (p, n, c) => {
    for (let i = 0; i < 6; i++) p.wood.box(0.16, 1.0, 0.08, c.wood, { at: [-1.0 + i * 0.4, 0.5, 0] });
    p.wood.box(2.4, 0.1, 0.08, c.woodDark, { at: [0, 0.75, 0.05] });
    p.wood.box(2.4, 0.1, 0.08, c.woodDark, { at: [0, 0.35, 0.05] });
    return row([0, 0.82, 0.12], 2.0, n);
  },
  chimney: (p, n) => {
    p.wood.box(1.2, 2.2, 1.0, '#b5523a', { at: [0, 1.1, 0] });
    p.wood.box(1.4, 0.18, 1.2, '#8a3a28', { at: [0, 2.25, 0] });
    p.felt.sphere(0.5, '#f6f8ff', { at: [0, 2.35, 0], scale: [1.4, 0.35, 1.2] });
    return (
      [
        { at: [0, 2.45, 0.1], dir: [1, 0, 0], len: 1.0 },
        { at: [0, 1.0, 0.6], dir: [1, 0, 0], len: 1.0 },
      ] as Anchor[]
    ).slice(0, Math.max(1, n));
  },
  seesaw: (p, n, c) => {
    p.wood.cone(0.25, 0.4, c.woodDark, { at: [0, 0.2, 0], seg: 4 });
    p.wood.box(2.2, 0.08, 0.35, c.wood, { at: [0, 0.42, 0], rot: [0, 0, 0.12] });
    return row([0, 0.5, 0], 1.8, n);
  },
  rack: (p, n, c) => {
    p.wood.box(1.4, 0.06, 0.5, c.wood, { at: [0, 0.45, 0] });
    p.wood.box(1.4, 0.06, 0.5, c.wood, { at: [0, 0.05, 0] });
    for (const x of [-0.68, 0.68]) p.wood.box(0.06, 0.5, 0.5, c.woodDark, { at: [x, 0.25, 0] });
    return row([0, 0.48, 0], 1.2, n);
  },
  pot: (p, n, c) => {
    p.felt.cyl(0.16, 0.12, 0.28, c.accent, { at: [0, 0.14, 0] });
    return [{ at: [0, 0.16, 0], dir: [1, 0, 0], len: 0.2, sink: 0.45 }];
  },
  bowl: (p, n, c) => {
    p.felt.sphere(0.32, c.accent, { at: [0, 0.18, 0], scale: [1, 0.5, 1] });
    p.felt.cyl(0.3, 0.3, 0.02, '#f6f1e7', { at: [0, 0.26, 0] });
    return [{ at: [0, 0.2, 0], dir: [1, 0, 0], len: 0.5, sink: 0.2 }];
  },
  jar: (p, n, c) => {
    p.felt.cyl(0.24, 0.24, 0.42, '#e8f3ff', { at: [0, 0.21, 0] });
    p.felt.cyl(0.26, 0.26, 0.08, c.accent, { at: [0, 0.46, 0] });
    return [{ at: [0, 0.48, 0], dir: [1, 0, 0], len: 0.5 }];
  },
  bigpot: (p) => {
    p.felt.cyl(0.42, 0.32, 0.65, '#c96f4a', { at: [0, 0.32, 0], seg: 16 });
    p.felt.cyl(0.4, 0.4, 0.03, '#6b4226', { at: [0, 0.63, 0] });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      p.felt.sphere(0.22, '#3a9d4f', { at: [Math.cos(a) * 0.16, 1.05 + (i % 2) * 0.12, Math.sin(a) * 0.16], scale: [0.8, 1.3, 0.8] });
    }
    p.felt.cyl(0.03, 0.03, 0.5, '#3a7d3a', { at: [0, 0.85, 0] });
    return [{ at: [0, 0.64, 0.05], dir: [1, 0, 0], len: 0.5, sink: 0.3 }];
  },
  giftpile: (p, n) => {
    p.felt.box(0.5, 0.35, 0.5, '#e2453c', { at: [-0.5, 0.17, -0.2], r: 0.03 });
    p.felt.box(0.4, 0.28, 0.4, '#3a9d4f', { at: [0.55, 0.14, -0.25], r: 0.03 });
    return row([0, 0.02, 0.15], 1.4, n);
  },
  pegboard: (p, n) => {
    p.wood.box(Math.max(2.0, n * 0.9), 1.6, 0.06, '#d8b98a', { at: [0, 0, 0] });
    const out = row([0, 0, 0.08], Math.max(1.8, n * 0.85), n);
    for (const a of out) p.felt.box(0.42, 0.62, 0.012, '#4a3a30', { at: [a.at[0], 0.15, 0.035], r: 0.02 });
    for (const a of out) a.at = [a.at[0], -0.15, 0.1];
    return out;
  },
  cups: (p, n, c) => {
    const out = row([0, 1.08, 0], 0.9, n);
    for (const a of out) p.felt.cyl(0.1, 0.08, 0.22, '#f6f1e7', { at: [a.at[0], 1.15, 0] });
    p.wood.box(1.2, 0.08, 0.5, c.wood, { at: [0, 1.0, 0] });
    p.wood.box(0.1, 1.0, 0.4, c.woodDark, { at: [0, 0.5, 0] });
    for (const a of out) a.sink = 0.3;
    return out;
  },
};

/** Keyword → prefab for the generic rooms (first match wins). */
const KEYWORDS: [RegExp, string][] = [
  [/fridge/, 'fridge'],
  [/tree-top|treetop/, 'treetop'],
  [/^tree$/, 'tree'],
  [/^(cup-left|cup-right)$/, 'cups'],
  [/xylophone/, 'xylo'],
  [/piano/, 'piano'],
  [/^sign-/, 'sign'],
  [/outline|shadow-|harness|^stack-/, 'board'],
  [/hook|rail|line$|stocking-line/, 'hooks'],
  [/bookshelf|shelf-top|shelf-mid|shelf-low|^shelf-[ab]$/, 'bookcase'],
  [/shelf/, 'shelf'],
  [/window/, 'window'],
  [/mantel/, 'mantel'],
  [/track/, 'track'],
  [/stairs/, 'stairs'],
  [/sink/, 'sink'],
  [/^bath$|tub/, 'bath'],
  [/bed$|^bed/, 'bed'],
  [/sofa|seat|bench/, 'bench'],
  [/chair/, 'chair'],
  [/desk|workbench/, 'desk'],
  [/counter|sideboard/, 'counter'],
  [/table|place-settings|centre|settings/, 'table'],
  [/wardrobe|cupboard|cabinet|chest|trunk|toolbox|drawer|toy-box/, 'cabinet'],
  [/basket|bin|in-glasses|apple-crate|bolt-jar/, 'basket'],
  [/crate|box|sorter|tower|parking|wheel-rack|corner|puzzle-board|marble-run|old-shelf/, 'crate'],
  [/stand|holder/, 'stand'],
  [/lamp/, 'lamp'],
  [/pot$|brush-pot|utensil/, 'pot'],
  [/jar/, 'jar'],
  [/bowl|fruit/, 'bowl'],
  [/snow|sled-hill|snowman-spot|ledge|gutter/, 'snow'],
  [/fence|gate|bird-table|path/, 'fence'],
  [/chimney|weathervane|sleigh/, 'chimney'],
  [/seesaw/, 'seesaw'],
  [/gift/, 'giftpile'],
  [/rack|door/, 'rack'],
  [/mat$|^mat|rug/, 'mat'],
  [/floor|under|horse-spot|pulley|music-stand/, 'floor'],
];

export function prefabFor(slotId: string): string {
  for (const [re, id] of KEYWORDS) if (re.test(slotId)) return id;
  return 'stool';
}

/** Prefabs that hang on a wall (placed high on the back wall row). */
export const WALL_PREFABS = new Set(['shelf', 'hooks', 'board', 'sign', 'pegboard', 'window']);
/** Prefabs that lie on the floor (front of the room). */
export const FLOOR_PREFABS = new Set(['floor', 'mat', 'track', 'snow', 'giftpile', 'basket', 'pot', 'bowl', 'jar', 'stand', 'seesaw']);

// ---------------------------------------------------------------------------
// Hiding places (each its own small mesh: they wiggle, open, puff)

export type HideKind = 'stand' | 'curtain' | 'box' | 'boot' | 'heap' | 'lampshade' | 'cup' | 'sack' | 'drum' | 'barrel' | 'coats' | 'tree' | 'stocking' | 'nook';

export function hideKindFor(id: string): HideKind {
  if (/curtain|sheet|tablecloth|duvet/.test(id)) return 'curtain';
  if (/coat/.test(id)) return 'coats';
  if (/boot|slipper|stocking/.test(id)) return /stocking/.test(id) ? 'stocking' : 'boot';
  if (/lamp/.test(id)) return 'lampshade';
  if (/cup|vase|tureen|watering|can$|paint-tin/.test(id)) return 'cup';
  if (/drum|cello/.test(id)) return 'drum';
  if (/barrel|trunk|tin/.test(id)) return 'barrel';
  if (/sack|bag|laundry/.test(id)) return 'sack';
  if (/tree/.test(id)) return 'tree';
  if (/under|nook|rafters|skylight|chimney-pot|ladder|door/.test(id)) return 'nook';
  if (/cushion|pile|towel|apron|bubble|dress|sawdust|drift|music-sheets|magazine|big-book|armchair|globe|snow/.test(id)) return 'heap';
  return 'box';
}

const HIDE_COLORS = ['#e2453c', '#3f7fe0', '#ffcc33', '#7950f2', '#3a9d4f', '#f08c00'];

/** Build one hiding place (local frame, origin on the floor). Returns its height. */
export function buildHide(kind: HideKind, s: Shape, seed: number): { h: number; w: number } {
  const col = HIDE_COLORS[seed % HIDE_COLORS.length];
  const col2 = HIDE_COLORS[(seed + 2) % HIDE_COLORS.length];
  switch (kind) {
    case 'stand':
      s.cyl(0.26, 0.3, 0.7, col, { at: [0, 0.35, 0], seg: 14 });
      s.torus(0.26, 0.04, '#e8b33a', { at: [0, 0.7, 0], rot: [Math.PI / 2, 0, 0] });
      s.torus(0.29, 0.03, '#e8b33a', { at: [0, 0.2, 0], rot: [Math.PI / 2, 0, 0] });
      return { h: 0.72, w: 0.7 };
    case 'curtain':
      for (let i = 0; i < 4; i++) s.cyl(0.16, 0.2, 2.4, col, { at: [-0.36 + i * 0.24, 1.2, 0], seg: 10 });
      s.box(1.2, 0.1, 0.12, '#8a5a2a', { at: [0, 2.45, 0] });
      s.torus(0.14, 0.035, '#e8b33a', { at: [0, 1.1, 0.16], rot: [0, 0, 0], scale: [3, 1, 1] });
      return { h: 2.4, w: 1.1 };
    case 'coats':
      s.box(0.7, 1.1, 0.35, col, { at: [0, 1.75, 0], r: 0.14 });
      s.box(0.6, 1.0, 0.34, col2, { at: [0.25, 1.7, 0.1], r: 0.14 });
      s.cyl(0.04, 0.04, 2.4, '#8a5a2a', { at: [-0.5, 1.2, -0.1] });
      return { h: 2.4, w: 1.0 };
    case 'boot':
      s.cyl(0.32, 0.34, 0.9, col, { at: [0, 0.6, 0], seg: 14 });
      s.box(0.8, 0.36, 0.6, col, { at: [0.2, 0.18, 0], r: 0.16 });
      s.torus(0.32, 0.07, '#fff8ee', { at: [0, 1.05, 0], rot: [Math.PI / 2, 0, 0] });
      return { h: 1.1, w: 0.9 };
    case 'stocking':
      s.capsule(0.28, 0.7, col, { at: [0, 0.9, 0] });
      s.capsule(0.27, 0.4, col, { at: [0.25, 0.4, 0], rot: [0, 0, Math.PI / 2] });
      s.cyl(0.32, 0.32, 0.28, '#fff8ee', { at: [0, 1.45, 0] });
      return { h: 1.6, w: 0.9 };
    case 'lampshade':
      s.cyl(0.05, 0.05, 1.3, '#6b4226', { at: [0, 0.65, 0] });
      s.cyl(0.25, 0.3, 0.05, '#6b4226', { at: [0, 0.03, 0] });
      s.cyl(0.32, 0.55, 0.6, col, { at: [0, 1.55, 0], seg: 16 });
      return { h: 1.85, w: 1.1 };
    case 'cup':
      s.cyl(0.42, 0.32, 0.6, '#f6f1e7', { at: [0, 0.3, 0], seg: 18 });
      s.torus(0.18, 0.06, '#f6f1e7', { at: [0.46, 0.32, 0] });
      s.cyl(0.4, 0.4, 0.04, col, { at: [0, 0.45, 0], seg: 18 });
      s.cyl(0.6, 0.55, 0.04, '#f6f1e7', { at: [0, 0.02, 0], seg: 18 });
      return { h: 0.62, w: 1.0 };
    case 'drum':
      s.cyl(0.55, 0.55, 0.75, col, { at: [0, 0.38, 0], seg: 18 });
      s.cyl(0.57, 0.57, 0.08, '#f6f1e7', { at: [0, 0.76, 0], seg: 18 });
      s.cyl(0.57, 0.57, 0.08, '#f6f1e7', { at: [0, 0.04, 0], seg: 18 });
      return { h: 0.8, w: 1.1 };
    case 'barrel':
      s.cyl(0.5, 0.42, 1.0, '#a0612b', { at: [0, 0.5, 0], seg: 14 });
      for (const y of [0.2, 0.8]) s.torus(0.47, 0.03, '#5a3a24', { at: [0, y, 0], rot: [Math.PI / 2, 0, 0] });
      return { h: 1.0, w: 1.0 };
    case 'sack':
      s.sphere(0.5, '#e9d8b4', { at: [0, 0.45, 0], scale: [1, 1.0, 0.9] });
      s.cone(0.25, 0.4, '#e9d8b4', { at: [0, 1.0, 0], rot: [Math.PI, 0, 0] });
      s.torus(0.12, 0.04, col, { at: [0, 0.92, 0], rot: [Math.PI / 2, 0, 0] });
      return { h: 1.15, w: 1.0 };
    case 'tree':
      for (let i = 0; i < 3; i++) s.cone(0.7 - i * 0.16, 0.8, '#2f6b4a', { at: [0, 0.6 + i * 0.5, 0], seg: 10 });
      s.extrude(starShape(0.15), 0.05, '#ffcc33', { at: [0, 1.95, 0] });
      return { h: 2.1, w: 1.4 };
    case 'nook':
      s.box(1.2, 1.1, 0.4, '#5a3a24', { at: [0, 0.55, -0.15], r: 0.05 });
      s.cyl(0.1, 0.12, 0.9, col, { at: [-0.25, 0.5, 0.1], seg: 8 });
      s.cyl(0.1, 0.12, 0.9, col, { at: [0.0, 0.5, 0.1], seg: 8 });
      s.cyl(0.1, 0.12, 0.9, col, { at: [0.25, 0.5, 0.1], seg: 8 });
      return { h: 1.1, w: 1.2 };
    case 'heap':
      s.box(0.9, 0.35, 0.7, col, { at: [0, 0.18, 0], r: 0.15 });
      s.box(0.75, 0.3, 0.6, col2, { at: [0.05, 0.48, 0.02], rot: [0, 0.3, 0.08], r: 0.13 });
      s.box(0.6, 0.26, 0.5, HIDE_COLORS[(seed + 4) % 6], { at: [-0.04, 0.75, 0], rot: [0, -0.2, -0.06], r: 0.11 });
      return { h: 0.9, w: 0.95 };
    case 'box':
    default:
      s.box(0.95, 0.75, 0.8, col, { at: [0, 0.375, 0], r: 0.04 });
      s.box(1.0, 0.1, 0.85, col2, { at: [-0.05, 0.8, 0], rot: [0, 0, 0.18], r: 0.03 });
      s.box(0.97, 0.2, 0.06, '#ffcc33', { at: [0, 0.4, 0.4] });
      return { h: 0.9, w: 1.0 };
  }
}

/** Little miss gags that pop out of a wrong hiding place. */
export function buildGag(gag: string, s: Shape): void {
  if (gag === 'cuckoo') {
    s.sphere(0.12, '#ffcc33', { at: [0, 0.12, 0] }).sphere(0.08, '#ffcc33', { at: [0.08, 0.24, 0] }).cone(0.03, 0.08, '#f08c00', { at: [0.17, 0.24, 0], rot: [0, 0, -Math.PI / 2] }).sphere(0.015, '#3b2a22', { at: [0.12, 0.27, 0.05] });
  } else if (gag === 'cat-yawn') {
    s.sphere(0.16, '#f2a65a', { at: [0, 0.14, 0], scale: [1.2, 0.9, 1] })
      .sphere(0.12, '#f2a65a', { at: [0.12, 0.3, 0] })
      .cone(0.04, 0.08, '#f2a65a', { at: [0.06, 0.42, 0] })
      .cone(0.04, 0.08, '#f2a65a', { at: [0.18, 0.42, 0] })
      .sphere(0.04, '#5e1f2b', { at: [0.18, 0.27, 0.08], scale: [1, 1.3, 0.5] });
  } else if (gag === 'sock-puppet') {
    s.capsule(0.09, 0.28, '#3f7fe0', { at: [0, 0.2, 0] }).sphere(0.03, '#ffffff', { at: [-0.03, 0.36, 0.08] }).sphere(0.03, '#ffffff', { at: [0.04, 0.36, 0.08] }).sphere(0.012, '#3b2a22', { at: [-0.03, 0.36, 0.105] }).sphere(0.012, '#3b2a22', { at: [0.04, 0.36, 0.105] });
  } else {
    s.cyl(0.12, 0.22, 0.2, '#ffcc33', { at: [0, 0.2, 0], seg: 12, open: true }).sphere(0.05, '#fff2b0', { at: [0, 0.14, 0] });
  }
}

/** A little felt puff (catch / heal confetti) geometry. */
export function confettiGeometry(): THREE.BufferGeometry {
  const s = new Shape();
  s.extrude(starShape(0.06), 0.02, '#ffffff', { main: true });
  return s.build();
}

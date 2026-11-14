import * as THREE from 'three';
import { Shape, heartShape, starShape, type Hex } from './kit';

/**
 * Code-built props for every vocabulary word the rooms use (`logic/vocab.ts`).
 * Each kind is ONE geometry (vertex colours, main parts tinted by the prop's
 * colour + pattern), origin at the bottom centre, facing +z, sized for the
 * dollhouse (Ziggy ≈ 1.6, Pépin ≈ 0.8 units tall). Geometries are cached per
 * kind; every prop instance clones it (its own colours).
 */

export interface PropKind {
  /** Height of one item (stacking, hotspot box). */
  h: number;
  /** Footprint width (spreading copies, hotspot box). */
  w: number;
  /** Copies (count > 1) stack up instead of spreading out. */
  stack?: boolean;
  /** Hangs from its slot (coats, stockings): origin at the top. */
  hang?: boolean;
  build(s: Shape): void;
}

const WHITE = '#f6f1e7';
const DARK = '#3b2a22';
const GOLD = '#e8b33a';
const WOOD = '#b07a45';
const SILVER = '#c9cfd8';
const M = { main: true } as const;
const at = (x: number, y: number, z = 0) => ({ at: [x, y, z] as [number, number, number] });

const KINDS: Record<string, PropKind> = {
  // ---- clothes
  sock: {
    h: 0.36,
    w: 0.26,
    build: (s) =>
      s
        .capsule(0.07, 0.2, WHITE, { at: [0, 0.27, 0] })
        .capsule(0.072, 0.18, WHITE, { ...M, at: [0, 0.2, 0] })
        .capsule(0.07, 0.12, WHITE, { ...M, at: [0.07, 0.07, 0], rot: [0, 0, Math.PI / 2] })
        .sphere(0.075, WHITE, { at: [0.15, 0.07, 0] }),
  },
  boot: {
    h: 0.46,
    w: 0.34,
    build: (s) =>
      s
        .cyl(0.11, 0.12, 0.32, WHITE, { ...M, at: [0, 0.27, 0] })
        .box(0.3, 0.13, 0.2, WHITE, { ...M, at: [0.06, 0.08, 0], r: 0.05 })
        .box(0.32, 0.04, 0.22, DARK, { at: [0.06, 0.02, 0], r: 0.015 })
        .torus(0.115, 0.03, '#fff8ee', { at: [0, 0.43, 0], rot: [Math.PI / 2, 0, 0] }),
  },
  coat: {
    h: 0.95,
    w: 0.62,
    hang: true,
    build: (s) =>
      s
        .box(0.5, 0.72, 0.16, WHITE, { ...M, at: [0, -0.48, 0], r: 0.07 })
        .box(0.16, 0.6, 0.14, WHITE, { ...M, at: [-0.3, -0.42, 0], rot: [0, 0, 0.18], r: 0.06 })
        .box(0.16, 0.6, 0.14, WHITE, { ...M, at: [0.3, -0.42, 0], rot: [0, 0, -0.18], r: 0.06 })
        .sphere(0.13, WHITE, { ...M, at: [0, -0.12, -0.02], scale: [1.1, 0.7, 0.8] })
        .sphere(0.025, GOLD, at(0, -0.36, 0.085))
        .sphere(0.025, GOLD, at(0, -0.5, 0.085))
        .sphere(0.025, GOLD, at(0, -0.64, 0.085))
        .torus(0.05, 0.012, DARK, { at: [0, -0.04, 0], rot: [0, 0, 0] }),
  },
  glove: {
    h: 0.3,
    w: 0.22,
    build: (s) => {
      s.box(0.18, 0.18, 0.07, WHITE, { ...M, at: [0, 0.12, 0], r: 0.035 });
      for (let i = 0; i < 4; i++) s.capsule(0.022, 0.07, WHITE, { ...M, at: [-0.06 + i * 0.04, 0.24, 0] });
      s.capsule(0.024, 0.06, WHITE, { ...M, at: [0.11, 0.14, 0], rot: [0, 0, -0.8] }).box(0.19, 0.05, 0.08, '#fff8ee', { at: [0, 0.03, 0], r: 0.02 });
    },
  },
  mitten: {
    h: 0.3,
    w: 0.22,
    build: (s) =>
      s
        .sphere(0.1, WHITE, { ...M, at: [0, 0.16, 0], scale: [1, 1.3, 0.55] })
        .sphere(0.045, WHITE, { ...M, at: [0.1, 0.12, 0], scale: [1, 1.4, 0.8] })
        .cyl(0.085, 0.085, 0.07, '#fff8ee', { at: [0, 0.035, 0] }),
  },
  bonnet: {
    h: 0.34,
    w: 0.32,
    build: (s) =>
      s
        .sphere(0.15, WHITE, { ...M, at: [0, 0.06, 0], scale: [1, 1.15, 1] })
        .cyl(0.155, 0.155, 0.07, '#fff8ee', { at: [0, 0.04, 0] })
        .sphere(0.06, '#fff8ee', at(0, 0.27, 0)),
  },
  pyjamas: {
    h: 0.5,
    w: 0.5,
    build: (s) =>
      s
        .box(0.36, 0.42, 0.08, WHITE, { ...M, at: [0, 0.21, 0], r: 0.05 })
        .box(0.12, 0.3, 0.07, WHITE, { ...M, at: [-0.22, 0.27, 0], rot: [0, 0, 0.5], r: 0.04 })
        .box(0.12, 0.3, 0.07, WHITE, { ...M, at: [0.22, 0.27, 0], rot: [0, 0, -0.5], r: 0.04 })
        .sphere(0.02, WHITE, at(0, 0.3, 0.045))
        .sphere(0.02, WHITE, at(0, 0.18, 0.045)),
  },
  slipper: {
    h: 0.16,
    w: 0.34,
    build: (s) =>
      s
        .box(0.32, 0.1, 0.17, WHITE, { ...M, at: [0, 0.07, 0], r: 0.05 })
        .box(0.33, 0.035, 0.18, '#f3e3c8', { at: [0, 0.018, 0], r: 0.015 })
        .sphere(0.05, '#fff8ee', at(0.12, 0.13, 0)),
  },
  // ---- kitchen
  spoon: { h: 0.38, w: 0.12, build: (s) => s.cyl(0.015, 0.015, 0.28, WHITE, { ...M, at: [0, 0.14, 0] }).sphere(0.05, WHITE, { ...M, at: [0, 0.32, 0], scale: [1, 1.4, 0.4] }) },
  fork: {
    h: 0.38,
    w: 0.12,
    build: (s) => {
      s.cyl(0.015, 0.015, 0.26, WHITE, { ...M, at: [0, 0.13, 0] }).box(0.08, 0.04, 0.02, WHITE, { ...M, at: [0, 0.27, 0] });
      for (let i = 0; i < 3; i++) s.box(0.014, 0.09, 0.014, WHITE, { ...M, at: [-0.03 + i * 0.03, 0.33, 0] });
    },
  },
  whisk: {
    h: 0.42,
    w: 0.16,
    build: (s) => {
      s.cyl(0.03, 0.03, 0.16, WOOD, { at: [0, 0.08, 0] });
      for (let i = 0; i < 4; i++) s.torus(0.06, 0.007, WHITE, { ...M, at: [0, 0.27, 0], rot: [0, (i / 4) * Math.PI, 0], scale: [1, 1.9, 1] });
    },
  },
  cup: {
    h: 0.22,
    w: 0.26,
    build: (s) =>
      s
        .cyl(0.09, 0.075, 0.18, WHITE, { ...M, at: [0, 0.09, 0] })
        .torus(0.045, 0.014, WHITE, { ...M, at: [0.1, 0.1, 0], rot: [0, 0, 0] })
        .cyl(0.08, 0.08, 0.01, '#6b3d22', { at: [0, 0.175, 0] }),
  },
  plate: { h: 0.06, w: 0.46, stack: true, build: (s) => s.cyl(0.22, 0.15, 0.04, WHITE, { ...M, at: [0, 0.02, 0], seg: 20 }).torus(0.18, 0.012, '#d9cdb8', { at: [0, 0.04, 0], rot: [Math.PI / 2, 0, 0] }) },
  glass: { h: 0.26, w: 0.16, build: (s) => s.cyl(0.07, 0.06, 0.2, WHITE, { ...M, at: [0, 0.14, 0] }).cyl(0.012, 0.012, 0.05, WHITE, { at: [0, 0.025, 0] }).cyl(0.05, 0.05, 0.01, WHITE, { at: [0, 0.005, 0] }) },
  napkin: { h: 0.12, w: 0.3, stack: true, build: (s) => s.cone(0.16, 0.12, WHITE, { ...M, at: [0, 0.06, 0], seg: 4, rot: [0, Math.PI / 4, 0] }) },
  kettle: {
    h: 0.42,
    w: 0.4,
    build: (s) =>
      s
        .sphere(0.17, WHITE, { ...M, at: [0, 0.17, 0], scale: [1, 0.9, 1] })
        .cyl(0.03, 0.04, 0.16, WHITE, { ...M, at: [0.19, 0.2, 0], rot: [0, 0, -0.9] })
        .torus(0.1, 0.02, DARK, { at: [0, 0.32, 0], arc: Math.PI, rot: [0, 0, 0] })
        .sphere(0.03, DARK, at(0, 0.33, 0)),
  },
  'rolling-pin': {
    h: 0.12,
    w: 0.6,
    build: (s) =>
      s
        .cyl(0.06, 0.06, 0.36, WHITE, { ...M, at: [0, 0.06, 0], rot: [0, 0, Math.PI / 2] })
        .cyl(0.025, 0.025, 0.14, WOOD, { at: [-0.24, 0.06, 0], rot: [0, 0, Math.PI / 2] })
        .cyl(0.025, 0.025, 0.14, WOOD, { at: [0.24, 0.06, 0], rot: [0, 0, Math.PI / 2] }),
  },
  pot: {
    h: 0.28,
    w: 0.5,
    build: (s) =>
      s
        .cyl(0.16, 0.15, 0.2, WHITE, { ...M, at: [0, 0.1, 0] })
        .cyl(0.17, 0.17, 0.02, WHITE, { ...M, at: [0, 0.21, 0] })
        .sphere(0.03, DARK, at(0, 0.24, 0))
        .box(0.16, 0.03, 0.04, DARK, { at: [0.24, 0.16, 0] }),
  },
  jar: {
    h: 0.32,
    w: 0.22,
    build: (s) =>
      s
        .cyl(0.1, 0.1, 0.24, WHITE, { ...M, at: [0, 0.12, 0] })
        .cyl(0.08, 0.08, 0.05, '#e04a3a', { at: [0, 0.265, 0] })
        .box(0.12, 0.08, 0.01, '#fff8ee', { at: [0, 0.13, 0.1] }),
  },
  // ---- food
  cookie: { h: 0.06, w: 0.2, stack: true, build: (s) => s.cyl(0.09, 0.09, 0.04, WHITE, { ...M, at: [0, 0.02, 0], seg: 16 }).sphere(0.015, DARK, at(0.03, 0.045, 0.02)).sphere(0.015, DARK, at(-0.03, 0.045, -0.01)).sphere(0.015, DARK, at(0.0, 0.045, -0.04)) },
  apple: { h: 0.24, w: 0.22, build: (s) => s.sphere(0.1, WHITE, { ...M, at: [0, 0.1, 0], scale: [1, 0.92, 1] }).cyl(0.008, 0.008, 0.06, '#6b4226', { at: [0, 0.21, 0] }).sphere(0.03, '#3a9d4f', { at: [0.03, 0.21, 0], scale: [1.4, 0.5, 0.8] }) },
  banana: { h: 0.16, w: 0.32, build: (s) => s.torus(0.13, 0.04, WHITE, { ...M, at: [0, 0.17, 0], arc: Math.PI * 0.75, rot: [0, 0, Math.PI * 1.12] }).sphere(0.02, '#6b4226', at(-0.13, 0.12, 0)) },
  carrot: { h: 0.12, w: 0.34, build: (s) => s.cone(0.05, 0.28, WHITE, { ...M, at: [0.02, 0.05, 0], rot: [0, 0, -Math.PI / 2] }).cone(0.035, 0.08, '#3a9d4f', { at: [-0.16, 0.05, 0], rot: [0, 0, Math.PI / 2] }) },
  cake: {
    h: 0.34,
    w: 0.5,
    build: (s) =>
      s
        .cyl(0.22, 0.22, 0.2, WHITE, { ...M, at: [0, 0.1, 0], seg: 20 })
        .cyl(0.225, 0.225, 0.05, '#fff8ee', { at: [0, 0.2, 0], seg: 20 })
        .sphere(0.04, '#e2453c', at(0, 0.26, 0))
        .cyl(0.012, 0.012, 0.08, '#ffd23f', { at: [0.1, 0.27, 0] }),
  },
  // ---- toys
  ball: { h: 0.3, w: 0.3, build: (s) => s.sphere(0.15, WHITE, { ...M, at: [0, 0.15, 0], seg: 14 }).torus(0.152, 0.012, '#fff8ee', { at: [0, 0.15, 0], rot: [0, 0, 0] }).torus(0.152, 0.012, '#fff8ee', { at: [0, 0.15, 0], rot: [Math.PI / 2, 0, 0] }) },
  teddy: {
    h: 0.5,
    w: 0.36,
    build: (s) =>
      s
        .sphere(0.14, WHITE, { ...M, at: [0, 0.15, 0], scale: [1, 1.1, 0.9] })
        .sphere(0.11, WHITE, { ...M, at: [0, 0.36, 0] })
        .sphere(0.045, WHITE, { ...M, at: [-0.08, 0.45, 0] })
        .sphere(0.045, WHITE, { ...M, at: [0.08, 0.45, 0] })
        .sphere(0.045, '#f3e3c8', { at: [0, 0.34, 0.09], scale: [1.2, 0.9, 0.8] })
        .sphere(0.014, DARK, at(-0.04, 0.39, 0.095))
        .sphere(0.014, DARK, at(0.04, 0.39, 0.095))
        .sphere(0.05, WHITE, { ...M, at: [-0.14, 0.2, 0.02] })
        .sphere(0.05, WHITE, { ...M, at: [0.14, 0.2, 0.02] })
        .sphere(0.055, WHITE, { ...M, at: [-0.08, 0.04, 0.07] })
        .sphere(0.055, WHITE, { ...M, at: [0.08, 0.04, 0.07] }),
  },
  block: { h: 0.24, w: 0.24, stack: true, build: (s) => s.box(0.22, 0.22, 0.22, WHITE, { ...M, at: [0, 0.11, 0], r: 0.025 }).box(0.12, 0.12, 0.01, '#fff8ee', { at: [0, 0.11, 0.111] }) },
  puzzle: {
    h: 0.06,
    w: 0.3,
    build: (s) =>
      s
        .box(0.24, 0.05, 0.24, WHITE, { ...M, at: [0, 0.025, 0] })
        .cyl(0.045, 0.045, 0.05, WHITE, { ...M, at: [0.13, 0.025, 0] })
        .cyl(0.045, 0.045, 0.05, WHITE, { ...M, at: [0, 0.025, -0.13] }),
  },
  car: {
    h: 0.2,
    w: 0.36,
    build: (s) =>
      s
        .box(0.34, 0.1, 0.18, WHITE, { ...M, at: [0, 0.09, 0], r: 0.03 })
        .box(0.18, 0.08, 0.16, WHITE, { ...M, at: [-0.02, 0.17, 0], r: 0.03 })
        .box(0.12, 0.06, 0.165, '#bfe3ff', { at: [-0.02, 0.17, 0], r: 0.02 })
        .cyl(0.045, 0.045, 0.2, DARK, { at: [-0.1, 0.045, 0], rot: [Math.PI / 2, 0, 0] })
        .cyl(0.045, 0.045, 0.2, DARK, { at: [0.1, 0.045, 0], rot: [Math.PI / 2, 0, 0] }),
  },
  train: {
    h: 0.3,
    w: 0.42,
    build: (s) =>
      s
        .box(0.24, 0.14, 0.18, WHITE, { ...M, at: [0.06, 0.12, 0], r: 0.03 })
        .cyl(0.08, 0.08, 0.2, WHITE, { ...M, at: [-0.08, 0.13, 0], rot: [0, 0, Math.PI / 2] })
        .cyl(0.03, 0.04, 0.1, DARK, { at: [-0.12, 0.25, 0] })
        .box(0.12, 0.1, 0.19, '#fff8ee', { at: [0.1, 0.24, 0], r: 0.02 })
        .cyl(0.05, 0.05, 0.2, DARK, { at: [-0.1, 0.05, 0], rot: [Math.PI / 2, 0, 0] })
        .cyl(0.05, 0.05, 0.2, DARK, { at: [0.12, 0.05, 0], rot: [Math.PI / 2, 0, 0] }),
  },
  marble: { h: 0.12, w: 0.12, build: (s) => s.sphere(0.06, WHITE, { ...M, at: [0, 0.06, 0], seg: 10 }) },
  duck: {
    h: 0.28,
    w: 0.3,
    build: (s) =>
      s
        .sphere(0.12, WHITE, { ...M, at: [0, 0.1, 0], scale: [1.25, 0.85, 1] })
        .sphere(0.075, WHITE, { ...M, at: [0.08, 0.21, 0] })
        .cone(0.035, 0.07, '#f08c00', { at: [0.17, 0.2, 0], rot: [0, 0, -Math.PI / 2] })
        .sphere(0.013, DARK, at(0.12, 0.24, 0.05))
        .sphere(0.013, DARK, at(0.12, 0.24, -0.05)),
  },
  robot: {
    h: 0.46,
    w: 0.3,
    build: (s) =>
      s
        .box(0.22, 0.22, 0.16, WHITE, { ...M, at: [0, 0.18, 0], r: 0.03 })
        .box(0.18, 0.13, 0.15, WHITE, { ...M, at: [0, 0.36, 0], r: 0.03 })
        .sphere(0.022, '#3fbfff', at(-0.045, 0.37, 0.078))
        .sphere(0.022, '#3fbfff', at(0.045, 0.37, 0.078))
        .cyl(0.008, 0.008, 0.06, SILVER, { at: [0, 0.45, 0] })
        .sphere(0.02, '#e2453c', at(0, 0.48, 0))
        .box(0.06, 0.07, 0.06, SILVER, { at: [-0.07, 0.035, 0] })
        .box(0.06, 0.07, 0.06, SILVER, { at: [0.07, 0.035, 0] }),
  },
  kite: { h: 0.5, w: 0.36, build: (s) => s.cone(0.2, 0.42, WHITE, { ...M, at: [0, 0.27, 0], seg: 4, scale: [1, 1, 0.12] }).cyl(0.006, 0.006, 0.3, '#fff8ee', { at: [0.05, 0.02, 0], rot: [0, 0, 0.4] }) },
  'rocking-horse': {
    h: 0.6,
    w: 0.62,
    build: (s) =>
      s
        .torus(0.3, 0.025, WOOD, { at: [0, 0.32, 0.08], arc: Math.PI, rot: [0, 0, Math.PI] })
        .torus(0.3, 0.025, WOOD, { at: [0, 0.32, -0.08], arc: Math.PI, rot: [0, 0, Math.PI] })
        .capsule(0.09, 0.26, WHITE, { ...M, at: [0, 0.34, 0], rot: [0, 0, Math.PI / 2] })
        .capsule(0.06, 0.16, WHITE, { ...M, at: [0.2, 0.48, 0], rot: [0, 0, -0.5] })
        .box(0.14, 0.08, 0.08, WHITE, { ...M, at: [0.28, 0.56, 0], r: 0.03 })
        .box(0.03, 0.12, 0.1, DARK, { at: [0.16, 0.54, 0], rot: [0, 0, -0.5] }),
  },
  sled: {
    h: 0.2,
    w: 0.6,
    build: (s) =>
      s
        .box(0.52, 0.04, 0.24, WHITE, { ...M, at: [0, 0.14, 0], r: 0.015 })
        .box(0.56, 0.025, 0.025, SILVER, { at: [0, 0.03, 0.1] })
        .box(0.56, 0.025, 0.025, SILVER, { at: [0, 0.03, -0.1] })
        .torus(0.06, 0.012, SILVER, { at: [0.28, 0.09, 0.1], arc: Math.PI, rot: [0, 0, -Math.PI / 2] })
        .torus(0.06, 0.012, SILVER, { at: [0.28, 0.09, -0.1], arc: Math.PI, rot: [0, 0, -Math.PI / 2] })
        .box(0.03, 0.1, 0.02, SILVER, { at: [-0.15, 0.08, 0.1] })
        .box(0.03, 0.1, 0.02, SILVER, { at: [0.15, 0.08, 0.1] })
        .box(0.03, 0.1, 0.02, SILVER, { at: [-0.15, 0.08, -0.1] })
        .box(0.03, 0.1, 0.02, SILVER, { at: [0.15, 0.08, -0.1] }),
  },
  // ---- music
  drum: {
    h: 0.3,
    w: 0.36,
    build: (s) =>
      s
        .cyl(0.16, 0.16, 0.24, WHITE, { ...M, at: [0, 0.12, 0], seg: 18 })
        .cyl(0.165, 0.165, 0.03, '#fff8ee', { at: [0, 0.245, 0], seg: 18 })
        .cyl(0.165, 0.165, 0.03, '#fff8ee', { at: [0, 0.015, 0], seg: 18 })
        .cyl(0.01, 0.01, 0.22, WOOD, { at: [0.08, 0.32, 0], rot: [0, 0, 0.9] }),
  },
  bell: {
    h: 0.24,
    w: 0.22,
    build: (s) =>
      s
        .cyl(0.04, 0.1, 0.16, WHITE, { ...M, at: [0, 0.1, 0] })
        .sphere(0.04, WHITE, { ...M, at: [0, 0.18, 0] })
        .torus(0.03, 0.01, WHITE, { ...M, at: [0, 0.22, 0] })
        .sphere(0.028, '#a07020', at(0, 0.02, 0))
        .torus(0.06, 0.016, '#e2453c', { at: [0, 0.19, 0.03], rot: [0.4, 0, 0] }),
  },
  trumpet: {
    h: 0.16,
    w: 0.46,
    build: (s) =>
      s
        .cyl(0.025, 0.025, 0.3, WHITE, { ...M, at: [0, 0.08, 0], rot: [0, 0, Math.PI / 2] })
        .cone(0.08, 0.12, WHITE, { ...M, at: [0.2, 0.08, 0], rot: [0, 0, Math.PI / 2] })
        .box(0.08, 0.06, 0.04, WHITE, { ...M, at: [-0.04, 0.13, 0] })
        .cyl(0.02, 0.02, 0.04, WHITE, { ...M, at: [-0.17, 0.08, 0], rot: [0, 0, Math.PI / 2] }),
  },
  'xylophone-bar': { h: 0.06, w: 0.12, build: (s) => s.box(0.1, 0.04, 0.4, WHITE, { ...M, at: [0, 0.03, 0], r: 0.012 }).sphere(0.012, SILVER, at(0, 0.055, 0.15)).sphere(0.012, SILVER, at(0, 0.055, -0.15)) },
  maraca: { h: 0.36, w: 0.16, build: (s) => s.sphere(0.08, WHITE, { ...M, at: [0, 0.26, 0], scale: [1, 1.15, 1] }).cyl(0.018, 0.024, 0.18, WOOD, { at: [0, 0.09, 0] }) },
  guitar: {
    h: 0.7,
    w: 0.34,
    build: (s) =>
      s
        .sphere(0.15, WHITE, { ...M, at: [0, 0.15, 0], scale: [1, 1, 0.35] })
        .sphere(0.11, WHITE, { ...M, at: [0, 0.32, 0], scale: [1, 1, 0.35] })
        .cyl(0.04, 0.04, 0.012, DARK, { at: [0, 0.22, 0.055], rot: [Math.PI / 2, 0, 0] })
        .box(0.05, 0.3, 0.03, WOOD, { at: [0, 0.54, 0] })
        .box(0.08, 0.08, 0.03, WOOD, { at: [0, 0.72, 0] }),
  },
  // ---- tools
  hammer: { h: 0.4, w: 0.22, build: (s) => s.cyl(0.02, 0.02, 0.32, WOOD, { at: [0, 0.16, 0] }).box(0.2, 0.07, 0.07, WHITE, { ...M, at: [0, 0.34, 0], r: 0.015 }) },
  wrench: { h: 0.4, w: 0.16, build: (s) => s.box(0.05, 0.28, 0.025, WHITE, { ...M, at: [0, 0.16, 0] }).torus(0.05, 0.022, WHITE, { ...M, at: [0, 0.34, 0], arc: Math.PI * 1.5, rot: [0, 0, Math.PI * 0.75] }).torus(0.04, 0.02, WHITE, { ...M, at: [0, 0.03, 0] }) },
  screwdriver: { h: 0.42, w: 0.1, build: (s) => s.cyl(0.035, 0.035, 0.16, WHITE, { ...M, at: [0, 0.08, 0], seg: 8 }).cyl(0.012, 0.012, 0.22, SILVER, { at: [0, 0.27, 0] }) },
  bolt: { h: 0.12, w: 0.12, stack: true, build: (s) => s.cyl(0.05, 0.05, 0.04, WHITE, { ...M, at: [0, 0.1, 0], seg: 6 }).cyl(0.022, 0.022, 0.1, SILVER, { at: [0, 0.04, 0] }) },
  wheel: { h: 0.36, w: 0.36, build: (s) => s.torus(0.13, 0.05, DARK, { at: [0, 0.18, 0] }).cyl(0.1, 0.1, 0.06, WHITE, { ...M, at: [0, 0.18, 0], rot: [Math.PI / 2, 0, 0] }) },
  brush: { h: 0.42, w: 0.1, build: (s) => s.cyl(0.015, 0.02, 0.3, WOOD, { at: [0, 0.15, 0] }).cyl(0.025, 0.025, 0.04, SILVER, { at: [0, 0.31, 0] }).cone(0.03, 0.08, WHITE, { ...M, at: [0, 0.36, 0], rot: [Math.PI, 0, 0] }) },
  // ---- bath
  toothbrush: { h: 0.4, w: 0.08, build: (s) => s.box(0.03, 0.32, 0.02, WHITE, { ...M, at: [0, 0.16, 0], r: 0.008 }).box(0.035, 0.06, 0.035, '#f6f1e7', { at: [0, 0.35, 0.02] }) },
  soap: { h: 0.1, w: 0.22, build: (s) => s.box(0.2, 0.08, 0.13, WHITE, { ...M, at: [0, 0.04, 0], r: 0.035 }) },
  towel: { h: 0.4, w: 0.36, stack: true, build: (s) => s.box(0.34, 0.08, 0.26, WHITE, { ...M, at: [0, 0.04, 0], r: 0.035 }).box(0.345, 0.02, 0.265, '#fff8ee', { at: [0, 0.04, 0] }) },
  sponge: { h: 0.12, w: 0.2, build: (s) => s.box(0.18, 0.1, 0.12, WHITE, { ...M, at: [0, 0.05, 0], r: 0.025 }).sphere(0.012, '#ffffff', at(0.03, 0.1, 0.03)) },
  comb: {
    h: 0.08,
    w: 0.3,
    build: (s) => {
      s.box(0.28, 0.035, 0.02, WHITE, { ...M, at: [0, 0.1, 0], r: 0.01 });
      for (let i = 0; i < 9; i++) s.box(0.012, 0.06, 0.015, WHITE, { ...M, at: [-0.12 + i * 0.03, 0.055, 0] });
    },
  },
  // ---- deco
  bauble: { h: 0.2, w: 0.18, build: (s) => s.sphere(0.08, WHITE, { ...M, at: [0, 0.08, 0], seg: 14 }).cyl(0.025, 0.025, 0.03, GOLD, { at: [0, 0.17, 0] }).torus(0.015, 0.005, GOLD, { at: [0, 0.195, 0] }) },
  star: { h: 0.36, w: 0.36, build: (s) => s.extrude(starShape(0.17), 0.06, WHITE, { ...M, at: [0, 0.17, 0], bevel: 0.01 }) },
  garland: { h: 0.1, w: 0.6, build: (s) => s.torus(0.3, 0.035, WHITE, { ...M, at: [0, 0.3, 0], arc: Math.PI, rot: [0, 0, Math.PI] }) },
  candle: { h: 0.34, w: 0.12, build: (s) => s.cyl(0.04, 0.045, 0.24, WHITE, { ...M, at: [0, 0.12, 0] }).cone(0.025, 0.06, '#ffd23f', { at: [0, 0.29, 0] }).cyl(0.07, 0.07, 0.02, GOLD, { at: [0, 0.01, 0] }) },
  gift: {
    h: 0.32,
    w: 0.32,
    stack: true,
    build: (s) =>
      s
        .box(0.28, 0.24, 0.28, WHITE, { ...M, at: [0, 0.12, 0], r: 0.02 })
        .box(0.29, 0.245, 0.05, GOLD, { at: [0, 0.12, 0] })
        .box(0.05, 0.245, 0.29, GOLD, { at: [0, 0.12, 0] })
        .torus(0.045, 0.016, GOLD, { at: [-0.04, 0.27, 0], rot: [0, 0, 0.6] })
        .torus(0.045, 0.016, GOLD, { at: [0.04, 0.27, 0], rot: [0, 0, -0.6] }),
  },
  stocking: {
    h: 0.5,
    w: 0.32,
    hang: true,
    build: (s) =>
      s
        .capsule(0.09, 0.26, WHITE, { ...M, at: [0, -0.27, 0] })
        .capsule(0.09, 0.12, WHITE, { ...M, at: [0.08, -0.42, 0], rot: [0, 0, Math.PI / 2] })
        .cyl(0.1, 0.1, 0.09, '#fff8ee', { at: [0, -0.05, 0] }),
  },
  sign: { h: 0.42, w: 0.42, build: (s) => s.box(0.38, 0.3, 0.04, WHITE, { ...M, at: [0, 0.27, 0], r: 0.02 }).box(0.04, 0.14, 0.04, WOOD, { at: [0, 0.06, 0] }).extrude(heartShape(0.06), 0.02, '#fff8ee', { at: [0, 0.27, 0.025] }) },
  frame: { h: 0.4, w: 0.36, build: (s) => s.box(0.34, 0.4, 0.04, WHITE, { ...M, at: [0, 0.2, 0], r: 0.015 }).box(0.25, 0.3, 0.01, '#fff3d6', { at: [0, 0.2, 0.022] }).cone(0.07, 0.12, '#3a9d4f', { at: [0, 0.17, 0.03], seg: 3 }).sphere(0.03, '#ffd23f', at(0.07, 0.28, 0.03)) },
  // ---- house
  book: { h: 0.4, w: 0.12, stack: true, build: (s) => s.box(0.1, 0.38, 0.28, WHITE, { ...M, at: [0, 0.19, 0], r: 0.01 }).box(0.09, 0.36, 0.01, '#fff8ee', { at: [0.005, 0.19, 0.142] }).box(0.102, 0.03, 0.282, GOLD, { at: [0, 0.31, 0] }) },
  umbrella: {
    h: 0.86,
    w: 0.3,
    build: (s) =>
      s
        .cone(0.13, 0.55, WHITE, { ...M, at: [0, 0.5, 0], seg: 8 })
        .cyl(0.012, 0.012, 0.86, DARK, { at: [0, 0.43, 0] })
        .torus(0.05, 0.014, DARK, { at: [-0.05, 0.02, 0], arc: Math.PI, rot: [0, 0, Math.PI] }),
  },
  lamp: { h: 0.56, w: 0.34, build: (s) => s.cyl(0.08, 0.11, 0.04, WOOD, { at: [0, 0.02, 0] }).cyl(0.02, 0.02, 0.3, WOOD, { at: [0, 0.18, 0] }).cyl(0.08, 0.16, 0.2, WHITE, { ...M, at: [0, 0.42, 0], open: true, seg: 16 }).sphere(0.05, '#fff2b0', at(0, 0.36, 0)) },
  pillow: { h: 0.16, w: 0.5, stack: true, build: (s) => s.box(0.46, 0.14, 0.32, WHITE, { ...M, at: [0, 0.07, 0], r: 0.06 }) },
  cushion: { h: 0.32, w: 0.38, stack: true, build: (s) => s.box(0.34, 0.3, 0.12, WHITE, { ...M, at: [0, 0.15, 0], r: 0.055 }).sphere(0.025, '#fff8ee', at(0, 0.15, 0.06)) },
  box: { h: 0.36, w: 0.4, stack: true, build: (s) => s.box(0.38, 0.32, 0.32, WHITE, { ...M, at: [0, 0.16, 0], r: 0.02 }).box(0.385, 0.03, 0.06, '#d8c39a', { at: [0, 0.315, 0] }) },
  clock: {
    h: 0.5,
    w: 0.42,
    build: (s) =>
      s
        .cyl(0.2, 0.2, 0.06, WHITE, { ...M, at: [0, 0.25, 0], rot: [Math.PI / 2, 0, 0], seg: 20 })
        .cyl(0.17, 0.17, 0.02, '#fff8ee', { at: [0, 0.25, 0.03], rot: [Math.PI / 2, 0, 0], seg: 20 })
        .box(0.02, 0.12, 0.01, DARK, { at: [0, 0.3, 0.045] })
        .box(0.08, 0.02, 0.01, DARK, { at: [0.04, 0.25, 0.045] })
        .sphere(0.015, DARK, at(0, 0.25, 0.05)),
  },
  key: { h: 0.12, w: 0.28, build: (s) => s.torus(0.05, 0.02, WHITE, { ...M, at: [-0.08, 0.06, 0] }).box(0.16, 0.025, 0.025, WHITE, { ...M, at: [0.04, 0.06, 0] }).box(0.025, 0.05, 0.025, WHITE, { ...M, at: [0.1, 0.04, 0] }) },
  flowerpot: {
    h: 0.46,
    w: 0.32,
    build: (s) =>
      s
        .cyl(0.13, 0.1, 0.2, WHITE, { ...M, at: [0, 0.1, 0] })
        .cyl(0.12, 0.12, 0.02, '#6b4226', { at: [0, 0.2, 0] })
        .cyl(0.01, 0.01, 0.2, '#3a9d4f', { at: [0, 0.3, 0] })
        .sphere(0.06, '#ff7ab8', at(0, 0.41, 0)),
  },
  map: { h: 0.3, w: 0.3, build: (s) => s.box(0.28, 0.02, 0.24, '#f3e3c8', { at: [0, 0.01, 0] }).cyl(0.02, 0.02, 0.26, WHITE, { ...M, at: [-0.14, 0.02, 0], rot: [Math.PI / 2, 0, 0] }).cyl(0.02, 0.02, 0.26, WHITE, { ...M, at: [0.14, 0.02, 0], rot: [Math.PI / 2, 0, 0] }).box(0.04, 0.01, 0.04, '#e2453c', { at: [0.05, 0.025, 0.04], rot: [0, 0.78, 0] }) },
  basket: {
    h: 0.3,
    w: 0.44,
    build: (s) =>
      s
        .cyl(0.2, 0.16, 0.22, WHITE, { ...M, at: [0, 0.11, 0], seg: 14 })
        .torus(0.2, 0.02, '#8a5a2a', { at: [0, 0.22, 0], rot: [Math.PI / 2, 0, 0] })
        .torus(0.16, 0.014, '#8a5a2a', { at: [0, 0.22, 0], arc: Math.PI }),
  },
  // ---- nature
  snowball: { h: 0.24, w: 0.24, stack: true, build: (s) => s.sphere(0.12, WHITE, { ...M, at: [0, 0.12, 0], seg: 10 }) },
  snowman: {
    h: 0.9,
    w: 0.5,
    build: (s) =>
      s
        .sphere(0.24, WHITE, { ...M, at: [0, 0.22, 0] })
        .sphere(0.17, WHITE, { ...M, at: [0, 0.54, 0] })
        .sphere(0.12, WHITE, { ...M, at: [0, 0.77, 0] })
        .sphere(0.016, DARK, at(-0.04, 0.8, 0.11))
        .sphere(0.016, DARK, at(0.04, 0.8, 0.11))
        .cone(0.022, 0.1, '#f08c00', { at: [0, 0.76, 0.15], rot: [Math.PI / 2, 0, 0] })
        .torus(0.13, 0.03, '#e2453c', { at: [0, 0.66, 0], rot: [Math.PI / 2, 0, 0] })
        .sphere(0.02, DARK, at(0, 0.56, 0.17))
        .sphere(0.02, DARK, at(0, 0.48, 0.16)),
  },
  pinecone: {
    h: 0.2,
    w: 0.14,
    build: (s) => {
      for (let i = 0; i < 4; i++) s.cone(0.06 - i * 0.012, 0.06, WHITE, { ...M, at: [0, 0.03 + i * 0.045, 0], rot: [Math.PI, 0, 0], seg: 7 });
    },
  },
  leaf: { h: 0.06, w: 0.2, build: (s) => s.sphere(0.09, WHITE, { ...M, at: [0, 0.02, 0], scale: [1, 0.2, 0.55] }) },
  flower: { h: 0.3, w: 0.16, build: (s) => s.cyl(0.008, 0.008, 0.22, '#3a9d4f', { at: [0, 0.11, 0] }).sphere(0.07, WHITE, { ...M, at: [0, 0.25, 0], scale: [1, 0.5, 1] }).sphere(0.03, '#ffd23f', at(0, 0.27, 0)) },
};

const FALLBACK: PropKind = { h: 0.3, w: 0.3, build: (s) => s.box(0.28, 0.28, 0.28, WHITE, { ...M, at: [0, 0.14, 0], r: 0.06 }) };

/** Props are drawn bigger than life so little ones read them at a glance. */
export const PROP_SCALE = 1.6;
const scaled = new Map<string, PropKind>();

export function propKind(kind: string): PropKind {
  let k = scaled.get(kind);
  if (!k) {
    const b = KINDS[kind] ?? FALLBACK;
    k = { ...b, h: b.h * PROP_SCALE, w: b.w * PROP_SCALE };
    scaled.set(kind, k);
  }
  return k;
}
export const PROP_KINDS = Object.keys(KINDS);

const geoCache = new Map<string, THREE.BufferGeometry>();

/** The cached geometry of a kind (clone it before tinting). */
export function propGeometry(kind: string): THREE.BufferGeometry {
  let g = geoCache.get(kind);
  if (!g) {
    const s = new Shape();
    propKind(kind).build(s);
    g = s.build();
    g.scale(PROP_SCALE, PROP_SCALE, PROP_SCALE);
    g.computeBoundingSphere();
    geoCache.set(kind, g);
  }
  return g;
}

export function disposePropGeometries(): void {
  for (const g of geoCache.values()) g.dispose();
  geoCache.clear();
}

/** sRGB hex of a vocabulary colour id. */
export const COLOR_HEX: Record<string, Hex> = {
  red: '#e2453c',
  yellow: '#ffcc33',
  blue: '#3f7fe0',
  green: '#3a9d4f',
  purple: '#7950f2',
  orange: '#f08c00',
  white: '#f2f6ff',
  brown: '#a0612b',
  shadow: '#4a4058',
};

import type { RoomDef } from '../logic';
import { FLOOR_PREFABS, WALL_PREFABS, prefabFor, type HideKind, type Pieces, type PrefabColors } from './furniture';
import * as THREE from 'three';
import { heartShape, starShape, type Hex, type V3, type WallTheme } from './kit';

/**
 * Where everything goes in each room. The dollhouse room is 10 × 7 units
 * (x −5…5, z −3.5…3.5, open at the front, walls 4.2 high). Rooms 1–3 are
 * placed by hand with their own decor; the other twelve are laid out from
 * their slot names with prefab furniture (`prefabFor`), so every room in
 * `src/data/games/lutin-chaos/rooms` is playable.
 */

export const ROOM_W = 10;
export const ROOM_D = 7;
export const WALL_H = 4.2;

export interface StationPlan {
  prefab: string;
  /** Slot ids served by this piece, in anchor order. */
  slots: string[];
  at: V3;
  rotY: number;
  colors?: Partial<PrefabColors>;
  /** Shift / shorten the props row of a single-slot piece. */
  row?: { dx?: number; len?: number };
}

export interface HidePlan {
  id: string;
  kind?: HideKind;
  at: V3;
  rotY?: number;
}

export interface RoomTheme {
  wall: WallTheme;
  floor: Hex;
  colors: PrefabColors;
  outdoor?: boolean;
  /** Warm lamp light colour. */
  light: Hex;
}

export interface RoomLayout {
  theme: RoomTheme;
  stations: StationPlan[];
  hides: HidePlan[];
  /** Extra static decor (wood / felt / glow pieces in room coordinates). */
  decor?: (p: Pieces) => void;
  /** Where Ziggy stands, and where caught elves come to laugh. */
  ziggy: V3;
  stage: V3;
}

const C = (wood: Hex, woodDark: Hex, felt: Hex, accent: Hex): PrefabColors => ({ wood, woodDark, felt, accent });

export const THEMES: Record<string, RoomTheme> = {
  'chaos.hall': { wall: { base: '#3f7d5c', stripe: '#46876a', motif: 'stripes', accent: '#e9c46a' }, floor: '#c49b77', colors: C('#b9824e', '#7d5232', '#e2453c', '#c9a227'), light: '#ffd9a0' },
  'chaos.kitchen': { wall: { base: '#fbe7a8', stripe: '#f2d27a', motif: 'tiles', accent: '#e2453c' }, floor: '#d2ac81', colors: C('#c48a52', '#8a5a2a', '#9fd3f2', '#f6c453'), light: '#fff0c8' },
  'chaos.living-room': { wall: { base: '#9a2f35', stripe: '#8f2a2e', motif: 'stars', accent: '#e9b85a' }, floor: '#b78c67', colors: C('#a8703f', '#6d4426', '#3f7fe0', '#ffcc33'), light: '#ffcf8a' },
  'chaos.bathroom': { wall: { base: '#bfe4f5', stripe: '#9fd3ee', motif: 'tiles', accent: '#ffffff' }, floor: '#dfd1b7', colors: C('#d8b98a', '#a0815a', '#7fc8e8', '#ff8fb1'), light: '#f2fbff' },
  'chaos.bedroom': { wall: { base: '#c8b6f2', stripe: '#bba6ee', motif: 'dots', accent: '#ffffff' }, floor: '#c49f7a', colors: C('#c08a55', '#80562f', '#ff9fc4', '#ffcc33'), light: '#ffe2b8' },
  'chaos.playroom': { wall: { base: '#ffd7a8', stripe: '#ffc98c', motif: 'flowers', accent: '#ff8a3d' }, floor: '#d1ac84', colors: C('#e0a458', '#a06a32', '#3fbf6a', '#3f7fe0'), light: '#fff0d0' },
  'chaos.library': { wall: { base: '#2f5d4a', stripe: '#346652', motif: 'stripes', accent: '#e9c46a' }, floor: '#ac8462', colors: C('#9c6236', '#5e3a1e', '#a83a3a', '#e9c46a'), light: '#ffd28a' },
  'chaos.music-room': { wall: { base: '#5b3f8f', stripe: '#654a9a', motif: 'stars', accent: '#ffd25e' }, floor: '#b7906f', colors: C('#a8703f', '#5e3a1e', '#e2453c', '#ffd25e'), light: '#ffd8a8' },
  'chaos.snowy-garden': { wall: { base: '#1d2a6b', stripe: '#6a7fd0', motif: 'snow', accent: '#ffffff' }, floor: '#eef3ff', colors: C('#a0612b', '#6b4226', '#e2453c', '#3f7fe0'), outdoor: true, light: '#dfe8ff' },
  'chaos.workshop': { wall: { base: '#c9965e', stripe: '#b98652', motif: 'planks', accent: '#8a5a2a' }, floor: '#a38468', colors: C('#b07a45', '#6b4226', '#3f7fe0', '#f08c00'), light: '#ffe0a8' },
  'chaos.dining-room': { wall: { base: '#f3d9c8', stripe: '#eecbb6', motif: 'flowers', accent: '#d9534f' }, floor: '#b78c67', colors: C('#9c6236', '#5e3a1e', '#f6f1e7', '#e2453c'), light: '#ffdcae' },
  'chaos.attic': { wall: { base: '#b98a5a', stripe: '#a87a4c', motif: 'planks', accent: '#6b4226' }, floor: '#9f7f62', colors: C('#a07040', '#6b4226', '#d8c39a', '#7950f2'), light: '#ffd28a' },
  'chaos.cellar': { wall: { base: '#7a5a48', stripe: '#9a6a52', motif: 'bricks', accent: '#8a5a44' }, floor: '#857365', colors: C('#a0703f', '#5e3a1e', '#c9a77a', '#e2453c'), light: '#ffc878' },
  'chaos.roof': { wall: { base: '#101a52', stripe: '#3a4fa0', motif: 'snow', accent: '#ffffff' }, floor: '#c2715d', colors: C('#a0612b', '#6b4226', '#e2453c', '#ffcc33'), outdoor: true, light: '#ffe6b0' },
  'chaos.christmas-eve': { wall: { base: '#2f6b4a', stripe: '#357552', motif: 'stars', accent: '#ffd25e' }, floor: '#b78c67', colors: C('#a8703f', '#6d4426', '#e2453c', '#ffd25e'), light: '#ffcf8a' },
};

// ---------------------------------------------------------------------------
// Hand-made rooms (1–3)

const HALL: Omit<RoomLayout, 'theme'> = {
  stations: [
    { prefab: 'mat', slots: ['boot-left', 'boot-right'], at: [-1.3, 0, -1.9], rotY: 0 },
    { prefab: 'hooks', slots: ['hook-a', 'hook-b', 'hook-c'], at: [1.5, 2.85, -3.35], rotY: 0 },
    { prefab: 'basket', slots: ['glove-basket'], at: [-3.4, 0, 1.0], rotY: 0 },
    { prefab: 'lamp', slots: ['lamp-top'], at: [-4.2, 0, -2.6], rotY: 0 },
    { prefab: 'shelf', slots: ['shelf'], at: [-4.75, 2.55, 0.0], rotY: Math.PI / 2 },
    { prefab: 'bench', slots: ['bench'], at: [-4.0, 0, -0.1], rotY: Math.PI / 2 },
    { prefab: 'floor', slots: ['floor'], at: [0.6, 0, 1.5], rotY: 0 },
    { prefab: 'stairs', slots: ['stairs'], at: [4.2, 0, -1.2], rotY: 0 },
    { prefab: 'desk', slots: ['key-bowl'], at: [1.3, 0, -2.9], rotY: 0, colors: { felt: '#e9c46a' } },
    { prefab: 'spot', slots: ['umbrella-stand'], at: [-0.1, 0, -2.85], rotY: 0 },
    { prefab: 'rack', slots: ['boot-rack'], at: [3.5, 0, 1.9], rotY: -Math.PI / 2 },
  ],
  hides: [
    { id: 'coat-rack', kind: 'coats', at: [2.95, 0, -3.0] },
    { id: 'boot-big', kind: 'boot', at: [-2.5, 0, -2.6], rotY: 0.4 },
    { id: 'umbrella-stand', kind: 'stand', at: [-0.1, 0, -2.85] },
    { id: 'curtain', kind: 'curtain', at: [-4.7, 0, -2.0], rotY: Math.PI / 2 },
    { id: 'under-stairs', kind: 'nook', at: [4.1, 0, 0.7], rotY: -Math.PI / 2 },
  ],
  decor: (p) => {
    // front door with a wreath and a little glowing window
    p.wood.box(1.5, 2.9, 0.12, '#b5523a', { at: [-1.3, 1.45, -3.42], r: 0.05 });
    p.wood.box(1.7, 0.12, 0.2, '#7d5232', { at: [-1.3, 2.95, -3.38] });
    p.glow.box(0.6, 0.5, 0.02, '#ffd9a0', { at: [-1.3, 2.3, -3.35] });
    p.wood.sphere(0.07, '#e8b33a', { at: [-0.75, 1.4, -3.33] });
    p.felt.torus(0.32, 0.1, '#2f7d4a', { at: [-1.3, 1.75, -3.3] });
    p.felt.sphere(0.07, '#e2453c', { at: [-1.3, 1.45, -3.25] });
    p.felt.sphere(0.05, '#e2453c', { at: [-1.5, 2.0, -3.25] });
    p.felt.sphere(0.05, '#e2453c', { at: [-1.05, 1.95, -3.25] });
    // mirror
    p.wood.box(0.9, 1.2, 0.08, '#c9a227', { at: [3.8, 2.4, -3.4], r: 0.08 });
    p.glow.box(0.7, 1.0, 0.02, '#d9ecff', { at: [3.8, 2.4, -3.35] });
  },
  ziggy: [0.2, 0, 2.85],
  stage: [1.4, 0, 2.85],
};

const KITCHEN: Omit<RoomLayout, 'theme'> = {
  stations: [
    { prefab: 'fridge', slots: ['fridge'], at: [3.9, 0, -2.7], rotY: 0 },
    { prefab: 'basket', slots: ['laundry-basket'], at: [3.6, 0, 1.9], rotY: 0, colors: { wood: '#d8c39a', woodDark: '#a08460' } },
    { prefab: 'counter', slots: ['counter'], at: [0.0, 0, -2.95], rotY: 0, row: { dx: 0.35, len: 1.9 } },
    { prefab: 'stove', slots: [], at: [2.15, 0, -2.95], rotY: 0 },
    { prefab: 'jar', slots: ['cookie-jar'], at: [3.9, 2.6, -2.75], rotY: 0, colors: { accent: '#e2453c' } },
    { prefab: 'pot', slots: ['utensil-pot'], at: [-1.1, 1.08, -3.05], rotY: 0, colors: { accent: '#3f7fe0' } },
    { prefab: 'table', slots: ['table', 'fruit-bowl'], at: [-0.4, 0, 0.7], rotY: 0, colors: { felt: '#ff9fb1' } },
    { prefab: 'bigpot', slots: ['flowerpot'], at: [-3.0, 0, 2.2], rotY: 0 },
    { prefab: 'cabinet', slots: ['cupboard'], at: [-4.25, 0, -0.9], rotY: Math.PI / 2, colors: { felt: '#9fd3f2', accent: '#f6f1e7' } },
    { prefab: 'shelf', slots: ['shelf'], at: [-3.1, 2.7, -3.35], rotY: 0 },
    { prefab: 'floor', slots: ['floor'], at: [2.3, 0, 1.3], rotY: 0 },
    { prefab: 'window', slots: ['window-sill'], at: [-0.95, 0, -3.42], rotY: 0 },
  ],
  hides: [
    { id: 'teacup', kind: 'cup', at: [1.3, 0, -1.4] },
    { id: 'curtain', kind: 'curtain', at: [-2.15, 0, -3.25] },
    { id: 'bread-bin', kind: 'box', at: [-4.3, 0, 1.6], rotY: Math.PI / 2 },
    { id: 'apron', kind: 'heap', at: [2.9, 0, -1.6] },
    { id: 'sack', kind: 'sack', at: [-3.35, 0, -2.6] },
  ],
  decor: (p) => {
    // hanging pans over the counter
    for (let i = 0; i < 3; i++) {
      p.wood.cyl(0.18 - i * 0.03, 0.18 - i * 0.03, 0.05, '#c96f4a', { at: [0.6 + i * 0.6, 3.15 - i * 0.05, -3.25], rot: [Math.PI / 2, 0, 0] });
      p.wood.box(0.04, 0.3, 0.03, '#6b4226', { at: [0.6 + i * 0.6, 3.45, -3.28] });
    }
    p.wood.box(2.2, 0.06, 0.06, '#6b4226', { at: [1.2, 3.62, -3.3] });
    // chairs around the table
    for (const x of [-1.3, 0.5]) {
      p.wood.box(0.6, 0.08, 0.6, '#c48a52', { at: [x, 0.6, 1.6], r: 0.02 });
      p.wood.box(0.6, 0.7, 0.07, '#c48a52', { at: [x, 0.95, 1.92], r: 0.02 });
      for (const dx of [-0.26, 0.26]) for (const dz of [-0.26, 0.26]) p.wood.box(0.06, 0.6, 0.06, '#8a5a2a', { at: [x + dx, 0.3, 1.6 + dz] });
    }
    // checked tea towel and a clock
    p.felt.box(0.5, 0.7, 0.02, '#e2453c', { at: [3.1, 1.6, -3.4] });
    p.wood.cyl(0.32, 0.32, 0.06, '#f6f1e7', { at: [-3.1, 3.55, -3.42], rot: [Math.PI / 2, 0, 0], seg: 20 });
    p.wood.box(0.03, 0.22, 0.02, '#3b2a22', { at: [-3.1, 3.63, -3.37] });
    p.wood.box(0.16, 0.03, 0.02, '#3b2a22', { at: [-3.03, 3.55, -3.37] });
  },
  ziggy: [0.9, 0, 2.85],
  stage: [-0.4, 0, 2.95],
};

const LIVING: Omit<RoomLayout, 'theme'> = {
  stations: [
    { prefab: 'tree', slots: ['tree'], at: [3.5, 0, -2.1], rotY: 0 },
    { prefab: 'treetop', slots: ['tree-top'], at: [3.5, 0, -2.1], rotY: 0 },
    { prefab: 'basket', slots: ['laundry-basket'], at: [-2.0, 0, 2.4], rotY: 0, colors: { wood: '#d8c39a', woodDark: '#a08460' } },
    { prefab: 'sofa', slots: ['sofa'], at: [-3.95, 0, 0.2], rotY: Math.PI / 2, colors: { felt: '#4a8f5c' } },
    { prefab: 'ground', slots: ['under-sofa'], at: [-2.95, 0, 1.15], rotY: Math.PI / 2 },
    { prefab: 'mat', slots: ['rug'], at: [0.0, 0, 0.9], rotY: 0, colors: { accent: '#e9c46a', felt: '#c0392b' } },
    { prefab: 'mantel', slots: ['mantel'], at: [-2.5, 0, -3.15], rotY: 0 },
    { prefab: 'track', slots: ['track'], at: [2.4, 0, 1.3], rotY: 0 },
    { prefab: 'giftpile', slots: ['gift-pile'], at: [2.6, 0, -0.75], rotY: 0 },
    { prefab: 'stool', slots: ['side-table'], at: [-3.6, 0, 2.3], rotY: 0 },
    { prefab: 'shelf', slots: ['shelf'], at: [1.25, 2.7, -3.35], rotY: 0 },
    { prefab: 'window', slots: ['window'], at: [-0.25, 0, -3.42], rotY: 0 },
  ],
  hides: [
    { id: 'tree-back', kind: 'heap', at: [4.4, 0, -3.0] },
    { id: 'stocking', kind: 'stocking', at: [-1.0, 0, -2.6], rotY: -0.3 },
    { id: 'cushion-pile', kind: 'heap', at: [-2.6, 0, -1.6] },
    { id: 'lampshade', kind: 'lampshade', at: [0.9, 0, -2.75] },
    { id: 'gift-box', kind: 'box', at: [4.2, 0, 0.6], rotY: -0.3 },
  ],
  decor: (p) => {
    // garland of lights over the window and the fireplace
    for (let i = 0; i < 14; i++) {
      const x = -4.0 + i * 0.5;
      const y = 3.75 - Math.sin((i / 13) * Math.PI) * 0.35;
      p.glow.sphere(0.06, ['#ff5c5c', '#ffd25e', '#5cc8ff', '#7dff9a'][i % 4], { at: [x, y, -3.3], seg: 6 });
    }
    // framed picture and an armchair cushion pile look
    p.wood.box(0.9, 0.7, 0.06, '#e8b33a', { at: [-2.5, 2.8, -3.4], r: 0.03 });
    p.felt.box(0.74, 0.54, 0.02, '#cfe8ff', { at: [-2.5, 2.8, -3.36] });
    p.felt.extrude(starShape(0.12), 0.02, '#ffcc33', { at: [-2.5, 2.85, -3.34] });
    // a little felt cat sleeping on the rug corner (the plush cat of the gags)
    p.felt.sphere(0.22, '#f2a65a', { at: [1.25, 0.15, 2.4], scale: [1.4, 0.7, 1] });
    p.felt.sphere(0.13, '#f2a65a', { at: [1.6, 0.22, 2.45] });
  },
  ziggy: [0.6, 0, 2.85],
  stage: [-0.7, 0, 2.95],
};

const HAND: Record<string, Omit<RoomLayout, 'theme'>> = {
  'chaos.hall': HALL,
  'chaos.kitchen': KITCHEN,
  'chaos.living-room': LIVING,
};

// ---------------------------------------------------------------------------
// Generic rooms (4–15): slots grouped into prefab pieces, placed along the walls

const GROUP_FIRST = new Set(['boot', 'hook', 'xylophone', 'cup', 'crate', 'shelf', 'piano', 'chimney', 'slipper', 'tower', 'stack', 'shadow', 'harness', 'sign', 'outline']);

function groupSlots(ids: string[]): { key: string; slots: string[] }[] {
  const groups: { key: string; slots: string[] }[] = [];
  for (const id of ids) {
    const first = id.split('-')[0];
    const key = GROUP_FIRST.has(first) && ids.filter((x) => x.split('-')[0] === first).length > 1 ? first : id;
    const g = groups.find((x) => x.key === key);
    if (g) g.slots.push(id);
    else groups.push({ key, slots: [id] });
  }
  // tops first (shelf-top, piano-top, chimney-top)
  for (const g of groups) g.slots.sort((a, b) => Number(b.endsWith('-top')) - Number(a.endsWith('-top')));
  return groups;
}

function prefabOfGroup(key: string, slots: string[]): string {
  if (key === 'slipper' || key === 'boot') return 'mat';
  if (key === 'stack' || key === 'tower' || key === 'crate') return 'crate';
  if (key === 'outline') return 'pegboard';
  if (key === 'shelf' && slots.length > 1) return 'bookcase';
  return prefabFor(slots[0]);
}

const BACK_X = [0, -2.9, 2.9];
const SIDE_Z = [-1.2, 1.0];
const WALL_X = [-3.2, -1.05, 1.05, 3.2, -4.3, 4.3];
const FLOOR_SPOTS: V3[] = [
  [-1.7, 0, 1.2],
  [1.7, 0, 1.2],
  [-2.9, 0, 2.4],
  [2.9, 0, 2.4],
  [0, 0, 0.6],
  [-0.2, 0, -1.0],
];
const HIDE_SPOTS: { at: V3; rotY: number }[] = [
  { at: [-4.3, 0, -3.0], rotY: 0.5 },
  { at: [4.3, 0, -3.0], rotY: -0.5 },
  { at: [-4.35, 0, 2.7], rotY: 0.8 },
  { at: [4.35, 0, 2.7], rotY: -0.8 },
  { at: [-1.5, 0, -1.3], rotY: 0 },
  { at: [1.5, 0, -1.3], rotY: 0 },
];

// ---------------------------------------------------------------------------
// Signature touches of the generic rooms (4–15): a few cheap pieces each, in
// the free bands of the walls (upper side walls toward the front, the back
// wall corners, the ceiling at the back), merged with the shell like every
// decor piece, so they cost triangles, never a draw call.

const SIDE = 4.93; // inner face of the side walls
const BACK = -3.4; // just off the back wall

/** A triangle pennant (bunting). */
function pennant(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, -h);
  s.closePath();
  return s;
}

/** Bunting along a wall: `from` → `to`, sagging a little. */
function bunting(p: Pieces, from: V3, to: V3, colors: Hex[], n = 9, rotY = 0) {
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const sag = Math.sin(t * Math.PI) * 0.22;
    const at: V3 = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t - sag, from[2] + (to[2] - from[2]) * t];
    p.felt.extrude(pennant(0.3, 0.36), 0.015, colors[i % colors.length], { at, rot: [0, rotY, 0] });
  }
  const len = Math.hypot(to[0] - from[0], to[2] - from[2]);
  p.wood.box(rotY ? 0.02 : len, 0.02, rotY ? len : 0.02, '#6b4226', { at: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - 0.08, (from[2] + to[2]) / 2] });
}

/** A felt wreath with a bow, flat on a wall facing `rotY`. */
function wreath(p: Pieces, at: V3, rotY: number, r = 0.34) {
  p.felt.torus(r, r * 0.3, '#2f7d4a', { at, rot: [0, rotY, 0], seg: 16 });
  const dx = Math.sin(rotY) * 0.06;
  const dz = Math.cos(rotY) * 0.06;
  for (const k of [0, 1.3, 2.6, 3.9, 5.2]) p.felt.sphere(0.05, '#e2453c', { at: [at[0] + Math.cos(rotY) * Math.cos(k) * r + dx, at[1] + Math.sin(k) * r, at[2] - Math.sin(rotY) * Math.cos(k) * r + dz], seg: 6 });
  p.felt.sphere(0.09, '#e2453c', { at: [at[0] + dx, at[1] - r, at[2] + dz], scale: [1.6, 0.8, 0.6], rot: [0, rotY, 0], seg: 8 });
}

/** A hanging lamp from the ceiling. */
function pendant(p: Pieces, at: V3, shade: Hex, light: Hex) {
  p.wood.cyl(0.015, 0.015, 4.2 - at[1], '#3b2a22', { at: [at[0], (4.2 + at[1]) / 2 + 0.15, at[2]], seg: 4 });
  p.wood.cone(0.32, 0.28, shade, { at: [at[0], at[1] + 0.14, at[2]], seg: 12 });
  p.glow.sphere(0.1, light, { at: [at[0], at[1], at[2]], seg: 8 });
}

const ROOM_TOUCHES: Record<string, (p: Pieces, t: RoomTheme) => void> = {
  'chaos.bathroom': (p) => {
    // soap bubbles drifting up the left wall, a towel rail with striped towels on the right
    const bubbles: [number, number, number][] = [[1.2, 2.9, 0.16], [0.7, 3.3, 0.11], [1.6, 3.5, 0.13], [2.1, 3.0, 0.09], [1.0, 3.8, 0.08], [2.4, 3.6, 0.12]];
    for (const [z, y, r] of bubbles) p.felt.sphere(r, '#e8f7ff', { at: [-SIDE + 0.25, y, z], seg: 10 });
    p.wood.cyl(0.03, 0.03, 1.6, '#c9a227', { at: [SIDE - 0.12, 2.65, 1.5], rot: [Math.PI / 2, 0, 0], seg: 8 });
    p.felt.box(0.05, 0.9, 0.6, '#ff8fb1', { at: [SIDE - 0.1, 2.25, 1.1], r: 0.02 });
    p.felt.box(0.05, 0.7, 0.55, '#7fc8e8', { at: [SIDE - 0.12, 2.35, 1.85], r: 0.02 });
    for (const [z, c] of [[1.1, '#ffffff'], [1.85, '#ffffff']] as const) p.felt.box(0.06, 0.08, 0.5, c, { at: [SIDE - 0.1, 2.0, z] });
  },
  'chaos.bedroom': (p) => {
    // a sleepy moon and twinkling stars on the left wall, a felt cloud on the right
    p.glow.sphere(0.34, '#fff2b0', { at: [-SIDE + 0.06, 3.3, 1.4], scale: [0.25, 1, 1], seg: 14 });
    p.felt.sphere(0.3, '#c8b6f2', { at: [-SIDE + 0.12, 3.38, 1.55], scale: [0.25, 1, 1], seg: 14 });
    for (const [z, y, r] of [[0.4, 3.7, 0.12], [2.3, 3.6, 0.1], [0.75, 3.15, 0.08], [2.6, 3.1, 0.13], [1.9, 3.9, 0.07]])
      p.glow.extrude(starShape(r), 0.02, '#ffd25e', { at: [-SIDE + 0.04, y, z], rot: [0, Math.PI / 2, 0] });
    for (const [dz, dy, r] of [[0, 0, 0.32], [0.35, -0.05, 0.26], [-0.35, -0.06, 0.24], [0.15, 0.18, 0.22]]) p.felt.sphere(r, '#ffffff', { at: [SIDE - 0.08, 3.3 + dy, 1.6 + dz], scale: [0.3, 1, 1], seg: 10 });
  },
  'chaos.playroom': (p, t) => {
    // bunting across the back, a kite with a bow tail on the right wall, balloons on the left
    bunting(p, [-4.6, 3.55, BACK + 0.06], [4.6, 3.55, BACK + 0.06], ['#e2453c', '#ffcc33', '#3f7fe0', '#3fbf6a', '#ff8a3d'], 13);
    const kite = new THREE.Shape();
    kite.moveTo(0, 0.45);
    kite.lineTo(0.3, 0);
    kite.lineTo(0, -0.6);
    kite.lineTo(-0.3, 0);
    kite.closePath();
    p.felt.extrude(kite, 0.02, t.colors.accent, { at: [SIDE - 0.05, 3.25, 1.4], rot: [0, -Math.PI / 2, 0] });
    for (let i = 0; i < 4; i++) p.felt.sphere(0.07, ['#e2453c', '#ffcc33', '#3fbf6a', '#ff8a3d'][i], { at: [SIDE - 0.06, 2.55 - i * 0.22, 1.4 + Math.sin(i * 1.4) * 0.15], scale: [0.5, 0.7, 1.4], seg: 6 });
    for (const [z, y, c] of [[1.0, 3.3, '#e2453c'], [1.45, 3.55, '#3f7fe0'], [1.9, 3.25, '#ffcc33']] as const) {
      p.felt.sphere(0.24, c, { at: [-SIDE + 0.35, y, z], scale: [1, 1.15, 1], seg: 12 });
      p.wood.cyl(0.008, 0.008, 1.0, '#ffffff', { at: [-SIDE + 0.35, y - 0.75, z], seg: 3 });
    }
  },
  'chaos.library': (p, t) => {
    // a rolling ladder on the left wall, two warm wall sconces, a banner of book spines up high
    for (const dz of [-0.28, 0.28]) p.wood.box(0.06, 3.4, 0.06, t.colors.woodDark, { at: [-SIDE + 0.35, 1.7, 1.6 + dz], rot: [0, 0, -0.12] });
    for (let i = 0; i < 8; i++) p.wood.box(0.05, 0.05, 0.56, t.colors.wood, { at: [-SIDE + 0.32 - i * 0.05 + 0.2, 0.3 + i * 0.42, 1.6] });
    p.wood.cyl(0.025, 0.025, 2.4, '#c9a227', { at: [-SIDE + 0.12, 3.5, 1.4], rot: [Math.PI / 2, 0, 0], seg: 6 });
    for (const z of [0.6, 2.2]) {
      p.wood.box(0.12, 0.08, 0.16, '#c9a227', { at: [SIDE - 0.06, 2.6, z] });
      p.glow.sphere(0.11, '#ffd28a', { at: [SIDE - 0.2, 2.78, z], seg: 8 });
      p.wood.cyl(0.07, 0.15, 0.18, '#a83a3a', { at: [SIDE - 0.2, 2.92, z], seg: 10 });
    }
    const spines: Hex[] = ['#a83a3a', '#e9c46a', '#2f5d8a', '#3f7d5c', '#7950f2', '#e2453c'];
    for (let i = 0; i < 18; i++) p.felt.box(0.12, 0.42 + (i % 3) * 0.06, 0.06, spines[i % spines.length], { at: [-4.4 + i * 0.13, 3.0, BACK + 0.05] });
  },
  'chaos.music-room': (p) => {
    // music notes dancing on both side walls, a guitar hanging on the right
    const notes: [number, number, number][] = [[0.5, 3.4, 1], [1.2, 3.0, -1], [1.9, 3.6, 1], [2.6, 3.1, -1]];
    for (const [side, mirror] of [[-1, 1], [1, -1]] as const)
      for (const [z, y] of notes) {
        const x = side * (SIDE - 0.05);
        const zz = mirror > 0 ? z : 3.1 - z;
        p.felt.sphere(0.1, '#ffd25e', { at: [x, y, zz], scale: [0.3, 0.75, 1.1], seg: 8 });
        p.felt.box(0.03, 0.42, 0.03, '#ffd25e', { at: [x, y + 0.22, zz + 0.09] });
        p.felt.box(0.03, 0.06, 0.16, '#ffd25e', { at: [x, y + 0.41, zz + 0.16], rot: [-0.4, 0, 0] });
      }
    p.wood.sphere(0.36, '#e08a3c', { at: [SIDE - 0.12, 2.1, 1.5], scale: [0.25, 1, 0.9], seg: 12 });
    p.wood.sphere(0.27, '#e08a3c', { at: [SIDE - 0.12, 2.55, 1.5], scale: [0.25, 1, 0.85], seg: 12 });
    p.wood.cyl(0.08, 0.08, 0.03, '#3b2a22', { at: [SIDE - 0.18, 2.3, 1.5], rot: [0, 0, Math.PI / 2], seg: 12 });
    p.wood.box(0.06, 0.95, 0.09, '#6b4226', { at: [SIDE - 0.12, 3.2, 1.5] });
  },
  'chaos.snowy-garden': (p) => {
    // a big glowing moon, a few stars, snowy bushes at the back
    p.glow.sphere(0.45, '#fff6d0', { at: [-3.6, 3.75, -3.3], seg: 16 });
    for (const [x, y, r] of [[-2.4, 4.0, 0.1], [-1.1, 3.6, 0.08], [1.6, 3.95, 0.11], [3.0, 3.55, 0.08], [0.3, 4.1, 0.07]])
      p.glow.extrude(starShape(r), 0.02, '#ffe9a0', { at: [x, y, -3.3] });
    for (const x of [-1.45, 1.45]) {
      p.felt.sphere(0.42, '#2f6b4a', { at: [x, 0.3, -3.1], scale: [1.3, 0.8, 0.8], seg: 10 });
      p.felt.sphere(0.36, '#ffffff', { at: [x, 0.55, -3.1], scale: [1.25, 0.45, 0.75], seg: 10 });
    }
  },
  'chaos.workshop': (p, t) => {
    // a lamp over the bench, felt gears on the left wall, a saw and a hammer outline on the right
    pendant(p, [0, 3.35, -2.4], t.colors.accent, '#ffe0a8');
    for (const [z, y, r, c] of [[0.8, 3.2, 0.34, '#f08c00'], [1.45, 2.75, 0.24, '#3f7fe0'], [1.75, 3.45, 0.18, '#e2453c']] as const) {
      p.felt.torus(r, r * 0.28, c, { at: [-SIDE + 0.05, y, z], rot: [0, Math.PI / 2, 0], seg: 10 });
      for (let k = 0; k < 8; k++) p.felt.box(0.04, 0.12, 0.12, c, { at: [-SIDE + 0.05, y + Math.sin((k / 8) * Math.PI * 2) * r * 1.25, z + Math.cos((k / 8) * Math.PI * 2) * r * 1.25] });
    }
    p.wood.box(0.04, 0.3, 1.0, '#c9ced6', { at: [SIDE - 0.05, 2.9, 1.2] });
    p.wood.box(0.06, 0.32, 0.22, t.colors.wood, { at: [SIDE - 0.06, 2.92, 0.62], r: 0.03 });
    p.wood.box(0.05, 0.75, 0.07, t.colors.wood, { at: [SIDE - 0.06, 2.75, 2.2] });
    p.wood.box(0.08, 0.16, 0.36, '#6b7280', { at: [SIDE - 0.07, 3.15, 2.2], r: 0.02 });
  },
  'chaos.dining-room': (p, t) => {
    // a candle chandelier at the back, a plate rack on the left wall, a fruit-bowl painting on the right
    p.wood.cyl(0.015, 0.015, 0.6, '#3b2a22', { at: [0, 3.9, -2.2], seg: 4 });
    p.wood.torus(0.5, 0.035, '#c9a227', { at: [0, 3.6, -2.2], rot: [Math.PI / 2, 0, 0], seg: 20 });
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      p.felt.cyl(0.04, 0.04, 0.2, '#f6f1e7', { at: [Math.cos(a) * 0.5, 3.72, -2.2 + Math.sin(a) * 0.5], seg: 6 });
      p.glow.sphere(0.045, '#ffd28a', { at: [Math.cos(a) * 0.5, 3.86, -2.2 + Math.sin(a) * 0.5], seg: 6 });
    }
    p.wood.box(0.12, 0.08, 2.0, t.colors.woodDark, { at: [-SIDE + 0.08, 2.75, 1.4] });
    for (let i = 0; i < 4; i++) {
      p.felt.cyl(0.24, 0.24, 0.03, '#ffffff', { at: [-SIDE + 0.08, 3.0, 0.65 + i * 0.5], rot: [0, 0, Math.PI / 2], seg: 16 });
      p.felt.cyl(0.15, 0.15, 0.035, t.colors.accent, { at: [-SIDE + 0.09, 3.0, 0.65 + i * 0.5], rot: [0, 0, Math.PI / 2], seg: 12 });
    }
    p.wood.box(0.05, 0.8, 1.0, '#c9a227', { at: [SIDE - 0.05, 3.0, 1.5], r: 0.03 });
    p.felt.box(0.03, 0.64, 0.84, '#fff4e0', { at: [SIDE - 0.07, 3.0, 1.5] });
    for (const [dz, dy, c] of [[-0.15, -0.05, '#e2453c'], [0.12, -0.02, '#ffcc33'], [0, 0.12, '#3fbf6a']] as const) p.felt.sphere(0.1, c, { at: [SIDE - 0.09, 3.0 + dy, 1.5 + dz], scale: [0.3, 1, 1], seg: 8 });
  },
  'chaos.attic': (p, t) => {
    // roof beams sloping at the back, a round window, a bare bulb, a trunk of old toys
    for (const s of [-1, 1]) p.wood.box(2.3, 0.2, 0.2, t.colors.woodDark, { at: [s * 4.0, 3.95, -3.25], rot: [0, 0, s * 0.3] });
    p.wood.box(10, 0.24, 0.24, t.colors.woodDark, { at: [0, 4.05, -3.2] });
    p.wood.torus(0.42, 0.07, t.colors.woodDark, { at: [0, 3.35, BACK + 0.02], seg: 18 });
    p.glow.cyl(0.4, 0.4, 0.02, '#cfe0ff', { at: [0, 3.35, BACK], rot: [Math.PI / 2, 0, 0], seg: 18 });
    p.wood.box(0.04, 0.8, 0.04, t.colors.woodDark, { at: [0, 3.35, BACK + 0.04] });
    p.wood.box(0.8, 0.04, 0.04, t.colors.woodDark, { at: [0, 3.35, BACK + 0.04] });
    p.wood.cyl(0.012, 0.012, 0.7, '#3b2a22', { at: [-1.6, 3.85, -1.6], seg: 4 });
    p.glow.sphere(0.09, '#ffe6a0', { at: [-1.6, 3.45, -1.6], seg: 8 });
    for (const z of [0.6, 1.4, 2.2]) p.felt.box(0.04, 0.22, 0.04, '#d8c39a', { at: [SIDE - 0.05, 3.7, z] });
    p.felt.box(0.03, 0.04, 1.8, '#d8c39a', { at: [SIDE - 0.05, 3.6, 1.4] });
  },
  'chaos.cellar': (p, t) => {
    // ceiling beams, a lantern on the right wall, a treasure map pinned on the left wall (the secret map!)
    for (const z of [-2.4, -0.8]) p.wood.box(10, 0.2, 0.24, t.colors.woodDark, { at: [0, 4.08, z] });
    for (const z of [0.7, 2.2]) {
      const x = SIDE - 0.2;
      p.wood.box(0.25, 0.06, 0.06, '#3b2a22', { at: [x + 0.08, 2.95, z] });
      p.wood.box(0.22, 0.3, 0.22, '#3b2a22', { at: [x, 2.72, z] });
      p.glow.box(0.16, 0.22, 0.23, '#ffc878', { at: [x, 2.72, z] });
      p.wood.cone(0.16, 0.12, '#3b2a22', { at: [x, 2.93, z], seg: 4, rot: [0, Math.PI / 4, 0] });
    }
    p.felt.box(0.03, 0.85, 1.15, '#ecd9a8', { at: [-SIDE + 0.04, 2.9, 1.5] });
    for (let i = 0; i < 5; i++) p.felt.box(0.035, 0.05, 0.12, '#8a5a44', { at: [-SIDE + 0.06, 2.65 + i * 0.1, 1.1 + i * 0.16] });
    p.felt.box(0.035, 0.05, 0.22, '#e2453c', { at: [-SIDE + 0.07, 3.15, 1.85], rot: [0.7, 0, 0] });
    p.felt.box(0.035, 0.05, 0.22, '#e2453c', { at: [-SIDE + 0.07, 3.15, 1.85], rot: [-0.7, 0, 0] });
    for (const [dy, dz] of [[0.36, -0.5], [0.36, 0.5], [-0.36, -0.5], [-0.36, 0.5]]) p.wood.sphere(0.035, '#c9a227', { at: [-SIDE + 0.07, 2.9 + dy, 1.5 + dz], seg: 6 });
  },
  'chaos.roof': (p) => {
    // a crescent moon and stars over the chimneys
    p.glow.sphere(0.42, '#fff6d0', { at: [3.7, 3.85, -3.3], seg: 16 });
    p.felt.sphere(0.36, '#101a52', { at: [3.86, 3.95, -3.2], seg: 14 });
    for (const [x, y, r] of [[-3.6, 3.9, 0.12], [-2.2, 3.5, 0.08], [-0.8, 4.05, 0.1], [1.0, 3.75, 0.07], [2.3, 4.1, 0.09]])
      p.glow.extrude(starShape(r), 0.02, '#ffe9a0', { at: [x, y, -3.3] });
  },
  'chaos.christmas-eve': (p) => {
    // wreaths on both side walls, candy canes, a gold star garland across the back
    wreath(p, [-SIDE + 0.06, 3.05, 1.3], Math.PI / 2);
    wreath(p, [SIDE - 0.06, 3.05, 1.3], -Math.PI / 2);
    for (let i = 0; i < 9; i++) p.glow.extrude(starShape(0.09), 0.02, '#ffd25e', { at: [-3.6 + i * 0.9, 3.45 - Math.sin((i / 8) * Math.PI) * 0.2, BACK + 0.05] });
    for (const [x, z] of [[-SIDE + 0.08, 2.4], [SIDE - 0.08, 2.4]] as const) {
      for (let k = 0; k < 6; k++) p.felt.cyl(0.05, 0.05, 0.14, k % 2 ? '#ffffff' : '#e2453c', { at: [x, 2.0 + k * 0.14, z], seg: 8 });
      p.felt.torus(0.12, 0.05, '#e2453c', { at: [x, 2.84, z - 0.12], rot: [0, Math.PI / 2, 0], arc: Math.PI, seg: 8 });
    }
  },
};

function genericLayout(room: RoomDef): Omit<RoomLayout, 'theme'> {
  const groups = groupSlots(room.slots.map((s) => s.id));
  const stations: StationPlan[] = [];
  let back = 0;
  let side = 0;
  let wall = 0;
  let floor = 0;
  for (const g of groups) {
    const prefab = prefabOfGroup(g.key, g.slots);
    if (WALL_PREFABS.has(prefab) && prefab !== 'window') {
      const i = wall++;
      const x = WALL_X[i % WALL_X.length];
      const onSide = Math.abs(x) > 4;
      stations.push({ prefab, slots: g.slots, at: onSide ? [Math.sign(x) * 4.85, 2.7, -1.4] : [x, prefab === 'board' || prefab === 'pegboard' || prefab === 'sign' ? 2.75 : 2.6, -3.35], rotY: onSide ? -Math.sign(x) * (Math.PI / 2) : 0 });
      continue;
    }
    if (prefab === 'window') {
      stations.push({ prefab, slots: g.slots, at: [WALL_X[wall++ % 4], 0, -3.42], rotY: 0 });
      continue;
    }
    if (FLOOR_PREFABS.has(prefab) && floor < FLOOR_SPOTS.length) {
      stations.push({ prefab, slots: g.slots, at: FLOOR_SPOTS[floor++], rotY: 0 });
      continue;
    }
    if (back < BACK_X.length) {
      stations.push({ prefab, slots: g.slots, at: [BACK_X[back++], 0, -2.75], rotY: 0 });
      continue;
    }
    if (side >= SIDE_Z.length * 2 && floor < FLOOR_SPOTS.length) {
      // both side walls are full: a free floor spot rather than on top of another piece
      stations.push({ prefab, slots: g.slots, at: FLOOR_SPOTS[floor++], rotY: 0 });
      continue;
    }
    const s = side++;
    const left = s % 2 === 0;
    const z = SIDE_Z[Math.floor(s / 2) % SIDE_Z.length];
    stations.push({ prefab, slots: g.slots, at: [left ? -4.1 : 4.1, 0, z], rotY: left ? Math.PI / 2 : -Math.PI / 2 });
  }
  const hides: HidePlan[] = room.hidingSpots.map((h, i) => ({ id: h.id, at: HIDE_SPOTS[i % HIDE_SPOTS.length].at, rotY: HIDE_SPOTS[i % HIDE_SPOTS.length].rotY }));
  const theme = THEMES[room.id];
  const touches = ROOM_TOUCHES[room.id];
  const decor = (p: Pieces) => {
    if (touches && theme) touches(p, theme);
    if (theme?.outdoor) {
      // fairy lights along a rope at the back and a lantern
      for (let i = 0; i < 16; i++) p.glow.sphere(0.07, ['#ff5c5c', '#ffd25e', '#5cc8ff', '#7dff9a'][i % 4], { at: [-4.5 + i * 0.6, 2.6 - Math.sin((i / 15) * Math.PI) * 0.4, -3.1], seg: 6 });
      return;
    }
    // a garland of lights under the cornice, two little frames, a round rug
    for (let i = 0; i < 16; i++) p.glow.sphere(0.06, ['#ff5c5c', '#ffd25e', '#5cc8ff', '#7dff9a'][i % 4], { at: [-4.5 + i * 0.6, 3.95 - Math.sin((i / 15) * Math.PI) * 0.25, -3.3], seg: 6 });
    for (const x of [-2.2, 2.2]) {
      p.wood.box(0.7, 0.55, 0.05, theme?.colors.accent ?? '#e8b33a', { at: [x, 3.35, -3.42], r: 0.02 });
      p.felt.box(0.56, 0.41, 0.02, x < 0 ? '#cfe8ff' : '#ffe1ec', { at: [x, 3.35, -3.38] });
    }
    p.felt.extrude(starShape(0.1), 0.02, '#ffcc33', { at: [-2.2, 3.36, -3.36] });
    p.felt.extrude(heartShape(0.09), 0.02, '#e2453c', { at: [2.2, 3.36, -3.36] });
    p.felt.cyl(1.25, 1.25, 0.015, theme?.colors.felt ?? '#e2453c', { at: [0.2, 0.008, 0.4], seg: 28, scale: [1.3, 1, 0.75] });
    p.felt.cyl(1.0, 1.0, 0.018, theme?.colors.accent ?? '#ffcc33', { at: [0.2, 0.01, 0.4], seg: 28, scale: [1.3, 1, 0.75] });
  };
  return { stations, hides, decor, ziggy: [-0.3, 0, 2.85], stage: [1.0, 0, 2.95] };
}

export function layoutFor(room: RoomDef): RoomLayout {
  const theme = THEMES[room.id] ?? THEMES['chaos.living-room'];
  const base = HAND[room.id] ?? genericLayout(room);
  // every slot must have a piece (data edits stay playable)
  const covered = new Set(base.stations.flatMap((s) => s.slots));
  const missing = room.slots.map((s) => s.id).filter((id) => !covered.has(id));
  const stations = [...base.stations];
  missing.forEach((id, i) => stations.push({ prefab: 'stool', slots: [id], at: [-3 + i * 1.2, 0, 3.0], rotY: 0 }));
  const hidesCovered = new Set(base.hides.map((h) => h.id));
  const hides = [...base.hides];
  room.hidingSpots.forEach((h, i) => {
    if (!hidesCovered.has(h.id)) hides.push({ id: h.id, at: HIDE_SPOTS[i % HIDE_SPOTS.length].at });
  });
  return { ...base, theme, stations, hides };
}

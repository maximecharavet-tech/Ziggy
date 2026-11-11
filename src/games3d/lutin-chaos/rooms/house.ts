import * as THREE from 'three';
import type { RoomDef } from '../logic';
import { Shape, kitMats, starShape, tintMain, type Hex } from './kit';
import { THEMES } from './layouts';
import { propGeometry } from './props';

/**
 * The house map: Ziggy's dollhouse seen from the front, cut open. Each of
 * the 15 rooms is a little lit box with a felt picture of what is inside;
 * open rooms glow, finished ones get the elves' pennant, the others wait
 * behind half-drawn felt curtains (never a single locked path: there are
 * always 2–3 rooms to choose from). The garden is beside the house, the
 * roof on top, the cellar below and the Christmas Eve party is the big tree.
 */

export interface HouseBox {
  center: THREE.Vector3;
  size: THREE.Vector3;
}

export interface HouseSet {
  root: THREE.Group;
  boxes: Map<string, HouseBox>;
  ziggy: THREE.Vector3;
  refresh(state: { open: string[]; done: string[] }): void;
  update(dt: number, t: number, reduce: boolean): void;
}

const BW = 2.6;
const BH = 2.3;
const BD = 2.0;
const STEP_X = 2.85;
const STEP_Y = 2.6;

/** Grid position of each room number: [column, row] (row 0 = ground floor). */
const GRID: Record<number, [number, number]> = {
  1: [-1.5, 0],
  2: [-0.5, 0],
  3: [0.5, 0],
  11: [1.5, 0],
  4: [-1.5, 1],
  5: [-0.5, 1],
  6: [0.5, 1],
  7: [1.5, 1],
  8: [-1, 2],
  10: [0, 2],
  12: [1, 2],
  13: [0, -1],
};

/** A felt picture of each room (a prop kind). */
const ICON: Record<number, string> = {
  1: 'boot',
  2: 'cup',
  3: 'star',
  4: 'duck',
  5: 'teddy',
  6: 'block',
  7: 'book',
  8: 'drum',
  9: 'snowman',
  10: 'hammer',
  11: 'cake',
  12: 'rocking-horse',
  13: 'box',
  14: 'sign',
  15: 'gift',
};

function placeFor(n: number): THREE.Vector3 {
  if (n === 9) return new THREE.Vector3(-7.9, 0, 0.6);
  if (n === 14) return new THREE.Vector3(0, STEP_Y * 3 + 0.9, 0);
  if (n === 15) return new THREE.Vector3(7.9, 0, 0.6);
  const [c, r] = GRID[n] ?? [0, 0];
  return new THREE.Vector3(c * STEP_X, r * STEP_Y, 0);
}

export function buildHouse(rooms: readonly RoomDef[], state: { open: string[]; done: string[] }, opts: { lowPower: boolean }): HouseSet {
  const mats = kitMats(opts.lowPower);
  const root = new THREE.Group();
  root.name = 'house';
  const boxes = new Map<string, HouseBox>();

  // --- static shell: ground, house frame, roof, garden, tree
  const wood = new Shape();
  const felt = new Shape();
  felt.box(30, 0.3, 14, '#eef3ff', { at: [0, -0.15 - 2.6, 1] });
  // the ground is cut away in front of the cellar (a snowy pit with steps)
  felt.box(13.4, 2.6, 0.3, '#dfe7ff', { at: [-8.3, -1.3, 3.6] });
  felt.box(13.4, 2.6, 0.3, '#dfe7ff', { at: [8.3, -1.3, 3.6] });
  felt.box(13.4, 0.3, 4.8, '#eef3ff', { at: [-8.3, -0.15, 1.2] });
  felt.box(13.4, 0.3, 4.8, '#eef3ff', { at: [8.3, -0.15, 1.2] });
  for (let i = 0; i < 4; i++) wood.box(3.2, 0.12, 0.5, '#a8703f', { at: [0, -0.4 - i * 0.55, 3.3 - i * 0.45] });
  const W = STEP_X * 4 + 0.3;
  wood.box(W, 0.25, BD + 0.4, '#8a5a2a', { at: [0, -0.12, 0] });
  for (let r = 1; r <= 2; r++) wood.box(W, 0.22, BD + 0.3, '#a8703f', { at: [0, r * STEP_Y - 0.15, 0] });
  wood.box(0.3, STEP_Y * 2.0, BD + 0.3, '#a8703f', { at: [-W / 2, STEP_Y - 0.15, 0] });
  wood.box(0.3, STEP_Y * 2.0, BD + 0.3, '#a8703f', { at: [W / 2, STEP_Y - 0.15, 0] });
  // attic floor and roof (two slopes)
  wood.box(STEP_X * 3 + 0.3, 0.22, BD + 0.3, '#a8703f', { at: [0, STEP_Y * 3 - 0.15, 0] });
  const roofLen = 7.6;
  wood.box(roofLen, 0.35, BD + 0.8, '#b5523a', { at: [-3.05, STEP_Y * 3.0 - 0.6, 0], rot: [0, 0, 0.62] });
  wood.box(roofLen, 0.35, BD + 0.8, '#b5523a', { at: [3.05, STEP_Y * 3.0 - 0.6, 0], rot: [0, 0, -0.62] });
  felt.box(roofLen, 0.18, BD + 0.9, '#f6f8ff', { at: [-3.0, STEP_Y * 3.0 - 0.38, 0], rot: [0, 0, 0.62] });
  felt.box(roofLen, 0.18, BD + 0.9, '#f6f8ff', { at: [3.0, STEP_Y * 3.0 - 0.38, 0], rot: [0, 0, -0.62] });
  // cellar walls
  wood.box(STEP_X + 0.4, 0.25, BD + 0.4, '#6b4a34', { at: [0, -STEP_Y - 0.12, 0] });
  // garden: snowy hill, fence
  felt.sphere(2.2, '#f6f8ff', { at: [-7.9, -1.4, 0.2], scale: [1.4, 0.75, 0.9] });
  for (let i = 0; i < 6; i++) wood.box(0.12, 0.7, 0.08, '#8a5a2a', { at: [-9.6 + i * 0.7, 0.35, -0.6] });
  wood.box(3.8, 0.08, 0.08, '#6b4226', { at: [-7.85, 0.5, -0.56] });
  // Christmas Eve: the big tree with a star
  wood.cyl(0.2, 0.25, 0.7, '#6b4226', { at: [7.9, 0.35, 0.6] });
  for (let i = 0; i < 4; i++) felt.cone(1.7 - i * 0.35, 1.6, '#2f7d4a', { at: [7.9, 1.3 + i * 0.95, 0.6], seg: 12 });
  felt.extrude(starShape(0.5), 0.15, '#ffcc33', { at: [7.9, 5.4, 0.6] });
  // pines around
  for (const [x, z, k] of [
    [-12, -2, 1.1],
    [12.5, -2.2, 1.2],
    [-11, 3.2, 0.8],
    [11.4, 3.4, 0.9],
  ] as const)
    for (let i = 0; i < 3; i++) felt.cone((1.2 - i * 0.3) * k, 1.3 * k, '#2f6b4a', { at: [x, (0.8 + i * 0.75) * k, z], seg: 9 });
  const shell = new THREE.Group();
  shell.add(new THREE.Mesh(wood.build(), mats.wood), new THREE.Mesh(felt.build(), mats.felt('plain')));
  root.add(shell);

  // the house chimney on the roof (room 14 lives up there)
  const roofExtra = new Shape();
  roofExtra.box(0.9, 1.6, 0.9, '#b5523a', { at: [2.2, STEP_Y * 3 + 1.2, 0] });
  roofExtra.sphere(0.5, '#f6f8ff', { at: [2.2, STEP_Y * 3 + 2.05, 0], scale: [1.3, 0.4, 1.3] });
  root.add(new THREE.Mesh(roofExtra.build(), mats.wood));

  // --- per-room layer (rebuilt on refresh)
  let layer: THREE.Group | null = null;
  const glowMats: THREE.MeshBasicMaterial[] = [];

  const build = (st: { open: string[]; done: string[] }) => {
    if (layer) {
      root.remove(layer);
      layer.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    }
    layer = new THREE.Group();
    const boxFelt = new Shape();
    const icons: THREE.BufferGeometry[] = [];
    const glow = new Shape();
    for (const room of rooms) {
      const n = room.number;
      const at = placeFor(n);
      const open = st.open.includes(room.id);
      const done = st.done.includes(room.id);
      const theme = THEMES[room.id];
      const wall: Hex = theme?.wall.base ?? '#c8b6f2';
      const floor: Hex = theme?.floor ?? '#b88a5e';
      const inBox = GRID[n] !== undefined;
      const center = at.clone().add(new THREE.Vector3(0, inBox ? BH / 2 : 1.2, inBox ? 0.2 : 0.4));
      if (inBox) {
        boxFelt.box(BW, BH, 0.08, wall, { at: [at.x, at.y + BH / 2, -BD / 2 + 0.05] });
        boxFelt.box(0.08, BH, BD, wall, { at: [at.x - BW / 2 + 0.04, at.y + BH / 2, 0] });
        boxFelt.box(0.08, BH, BD, wall, { at: [at.x + BW / 2 - 0.04, at.y + BH / 2, 0] });
        boxFelt.box(BW, 0.06, BD, floor, { at: [at.x, at.y + 0.03, 0] });
        if (!open && !done) {
          // half-drawn felt curtains: this room comes a little later
          for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) boxFelt.cyl(0.13, 0.17, BH - 0.2, '#c9a0dc', { at: [at.x + sx * (BW / 2 - 0.2 - i * 0.24), at.y + (BH - 0.2) / 2 + 0.05, BD / 2 - 0.1], seg: 8 });
          boxFelt.box(BW - 0.2, 0.18, 0.12, '#e9c46a', { at: [at.x, at.y + BH - 0.15, BD / 2 - 0.1] });
        } else glow.box(0.5, 0.06, 0.5, done ? '#ffe7a8' : '#fff4d6', { at: [at.x, at.y + BH - 0.12, 0] });
      }
      // the room's felt picture
      const g = propGeometry(ICON[n] ?? 'gift').clone();
      tintMain(g, n === 9 ? '#f6f8ff' : (theme?.colors.felt ?? '#e2453c'));
      const k = inBox ? 1.15 : 1.5;
      g.scale(k, k, k);
      g.translate(at.x, at.y + (inBox ? 0.1 : n === 14 ? 0.0 : 0.3), at.z + (inBox ? 0.1 : n === 15 ? 1.9 : 1.2));
      icons.push(g);
      if (done) {
        // the elves' pennant: finished room
        const fx = inBox ? at.x + BW / 2 - 0.35 : at.x + 0.9;
        const fy = inBox ? at.y + BH - 0.25 : at.y + 2.4;
        boxFelt.cyl(0.03, 0.03, 0.8, '#6b4226', { at: [fx, fy - 0.2, BD / 2 - 0.2] });
        boxFelt.cone(0.22, 0.5, '#3a9d4f', { at: [fx + 0.22, fy + 0.05, BD / 2 - 0.2], rot: [0, 0, -Math.PI / 2], seg: 3 });
        boxFelt.extrude(starShape(0.13), 0.04, '#ffcc33', { at: [inBox ? at.x - BW / 2 + 0.35 : at.x - 0.9, fy, BD / 2 - 0.15] });
      }
      if (open || done) boxes.set(room.id, { center, size: new THREE.Vector3(inBox ? BW * 0.9 : 2.6, inBox ? BH * 0.9 : 2.6, 1) });
      else boxes.delete(room.id);
    }
    if (!boxFelt.empty) layer.add(new THREE.Mesh(boxFelt.build(), mats.felt('plain')));
    if (icons.length) {
      const merged = mergeIcons(icons);
      layer.add(new THREE.Mesh(merged, mats.felt('plain')));
    }
    if (!glow.empty) {
      const gm = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
      glowMats.push(gm);
      layer.add(new THREE.Mesh(glow.build(), gm));
    }
    root.add(layer);
  };
  build(state);

  // lights: moonlight + warm house glow
  root.add(new THREE.HemisphereLight('#e6ecff', '#6a5a80', opts.lowPower ? 1.5 : 1.1));
  const key = new THREE.DirectionalLight('#ffe6c4', opts.lowPower ? 1.6 : 1.9);
  key.position.set(-6, 12, 10);
  root.add(key);

  return {
    root,
    boxes,
    ziggy: new THREE.Vector3(-4.6, 0, 3.2),
    refresh: build,
    update() {
      /* static diorama (the camera and Ziggy move) */
    },
  };
}

function mergeIcons(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'color', 'main'] as const) {
    const size = list[0].attributes[name].itemSize;
    let n = 0;
    for (const g of list) n += g.attributes[name].count;
    const arr = new Float32Array(n * size);
    let o = 0;
    for (const g of list) {
      arr.set(g.attributes[name].array as Float32Array, o);
      o += g.attributes[name].array.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  for (const g of list) g.dispose();
  out.computeBoundingSphere();
  return out;
}

import * as THREE from 'three';
import type { RoomDef } from '../logic';
import { PREFABS, buildHide, hideKindFor, type Anchor, type Pieces, type PrefabColors } from './furniture';
import { Shape, freeze, kitMats, type KitMats, type V3 } from './kit';
import { ROOM_D, ROOM_W, WALL_H, layoutFor, type RoomLayout } from './layouts';

/**
 * Builds a playable room: the dollhouse shell, the prefab furniture and the
 * decor merged per material (≈ 5 draw calls), one small mesh per hiding place
 * (they wiggle), and the world anchors of every slot. Props and characters
 * are added by the scene.
 */

export interface SlotPlace {
  id: string;
  at: THREE.Vector3;
  /** Row direction (world) and length. */
  dir: THREE.Vector3;
  len: number;
  hang: boolean;
  sink: number;
  tree: { r: number; h: number } | null;
  /** Facing of props there (world yaw). */
  yaw: number;
}

export interface HidePlace {
  id: string;
  /** The hiding place itself (wiggles, opens). */
  obj: THREE.Group;
  /** Base on the floor (world). */
  at: THREE.Vector3;
  /** Where an elf peeks out (world), and the side it leans to. */
  peek: THREE.Vector3;
  h: number;
  w: number;
}

export interface RoomSet {
  root: THREE.Group;
  layout: RoomLayout;
  slots: Map<string, SlotPlace>;
  hides: Map<string, HidePlace>;
  ziggy: THREE.Vector3;
  stage: THREE.Vector3;
  key: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  /** Glow meshes (lamps, windows) dimmed for the nap ending. */
  glow: THREE.Mesh | null;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

function newPieces(): Pieces {
  return { wood: new Shape(), felt: new Shape(), glow: new Shape() };
}

/** Collects transformed geometries per material. */
class Merger {
  wood: THREE.BufferGeometry[] = [];
  felt: THREE.BufferGeometry[] = [];
  glow: THREE.BufferGeometry[] = [];

  take(p: Pieces, m: THREE.Matrix4 | null) {
    for (const k of ['wood', 'felt', 'glow'] as const) {
      if (p[k].empty) continue;
      const g = p[k].build();
      if (m) g.applyMatrix4(m);
      this[k].push(g);
    }
  }
}

function mergeList(list: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (!list.length) return null;
  return list.length === 1 ? list[0] : mergeGeos(list);
}

function mergeGeos(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // all kit geometries share position / normal / uv / color / main
  let count = 0;
  for (const g of list) count += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'color', 'main'] as const) {
    const size = list[0].attributes[name].itemSize;
    const arr = new Float32Array(count * size);
    let o = 0;
    for (const g of list) {
      const a = g.attributes[name].array as Float32Array;
      arr.set(a, o);
      o += a.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  for (const g of list) g.dispose();
  out.computeBoundingSphere();
  return out;
}

function shell(p: Pieces, layout: RoomLayout) {
  const t = layout.theme;
  const W = ROOM_W;
  const D = ROOM_D;
  // the dollhouse floor slab with a wooden front edge
  p.wood.box(W + 0.5, 0.35, D + 0.4, t.colors.woodDark, { at: [0, -0.19, 0.1] });
  p.wood.box(W + 0.6, 0.12, 0.16, t.colors.wood, { at: [0, -0.06, D / 2 + 0.3] });
  if (t.outdoor) {
    // snow or roof tiles, a low fence at the back, no walls
    p.felt.box(W, 0.06, D, t.floor, { at: [0, 0.0, 0] });
    for (let i = 0; i < 9; i++) p.felt.sphere(0.6 + (i % 3) * 0.2, t.floor === '#eef3ff' ? '#f8faff' : '#c96f4a', { at: [-4.4 + i * 1.1, -0.2, -3.2 + (i % 2) * 0.15], scale: [1.4, 0.55, 1] });
    return;
  }
  // skirting boards and a cornice
  p.wood.box(W, 0.22, 0.08, t.colors.wood, { at: [0, 0.11, -D / 2 + 0.04] });
  p.wood.box(0.08, 0.22, D, t.colors.wood, { at: [-W / 2 + 0.04, 0.11, 0] });
  p.wood.box(0.08, 0.22, D, t.colors.wood, { at: [W / 2 - 0.04, 0.11, 0] });
  p.wood.box(W + 0.4, 0.2, 0.3, t.colors.wood, { at: [0, WALL_H + 0.1, -D / 2 + 0.02] });
  p.wood.box(0.3, 0.2, D + 0.2, t.colors.wood, { at: [-W / 2 - 0.05, WALL_H + 0.1, 0.05] });
  p.wood.box(0.3, 0.2, D + 0.2, t.colors.wood, { at: [W / 2 + 0.05, WALL_H + 0.1, 0.05] });
  // wall edges seen at the front cut (dollhouse)
  p.wood.box(0.3, WALL_H, 0.3, t.colors.woodDark, { at: [-W / 2 - 0.05, WALL_H / 2, D / 2 + 0.05] });
  p.wood.box(0.3, WALL_H, 0.3, t.colors.woodDark, { at: [W / 2 + 0.05, WALL_H / 2, D / 2 + 0.05] });
}

function wallsAndFloor(root: THREE.Group, layout: RoomLayout, mats: KitMats) {
  const t = layout.theme;
  const W = ROOM_W;
  const D = ROOM_D;
  if (!t.outdoor) {
    const fl = new Shape();
    fl.add(new THREE.PlaneGeometry(W, D, 1, 1).rotateX(-Math.PI / 2), t.floor, { main: false });
    // boards UV: repeat along the floor
    const g = fl.build();
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 2.2, pos.getZ(i) / 1.6);
    const floor = new THREE.Mesh(g, mats.boards);
    floor.receiveShadow = true;
    root.add(floor);
    // three walls, one material (wallpaper)
    const wallMat = mats.wall(t.wall, [W / 2.2, WALL_H / 2.2]);
    const back = new THREE.PlaneGeometry(W, WALL_H).translate(0, WALL_H / 2, -D / 2);
    const left = new THREE.PlaneGeometry(D, WALL_H).rotateY(Math.PI / 2).translate(-W / 2, WALL_H / 2, 0);
    const right = new THREE.PlaneGeometry(D, WALL_H).rotateY(-Math.PI / 2).translate(W / 2, WALL_H / 2, 0);
    // side walls: UVs scaled to the back wall's density
    const scaleU = (geo: THREE.BufferGeometry, k: number) => {
      const u = geo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < u.count; i++) u.setX(i, u.getX(i) * k);
    };
    scaleU(left, D / W);
    scaleU(right, D / W);
    const walls = new THREE.Mesh(mergeWalls([back, left, right]), wallMat);
    walls.receiveShadow = true;
    root.add(walls);
  } else {
    // night sky backdrop behind the garden / roof (big enough to fill the view)
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(W * 3.4, 16), mats.wall(t.wall, [4, 2]));
    sky.position.set(0, 4.5, -D / 2 - 2.5);
    root.add(sky);
  }
}

function mergeWalls(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  const nonIdx = list.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const name of ['position', 'normal', 'uv'] as const) {
    const size = nonIdx[0].attributes[name].itemSize;
    let n = 0;
    for (const g of nonIdx) n += g.attributes[name].count;
    const arr = new Float32Array(n * size);
    let o = 0;
    for (const g of nonIdx) {
      arr.set(g.attributes[name].array as Float32Array, o);
      o += g.attributes[name].array.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  for (const g of [...list, ...nonIdx]) g.dispose();
  out.computeBoundingSphere();
  return out;
}

export function buildRoom(room: RoomDef, opts: { lowPower: boolean; shadows: boolean }): RoomSet {
  const layout = layoutFor(room);
  const mats = kitMats(opts.lowPower);
  const root = new THREE.Group();
  root.name = `room:${room.id}`;
  const merger = new Merger();

  const base = newPieces();
  shell(base, layout);
  layout.decor?.(base);
  merger.take(base, null);

  const slots = new Map<string, SlotPlace>();
  for (const st of layout.stations) {
    const prefab = PREFABS[st.prefab] ?? PREFABS.stool;
    const p = newPieces();
    const colors: PrefabColors = { ...layout.theme.colors, ...(st.colors ?? {}) };
    let anchors: Anchor[] = prefab(p, Math.max(1, st.slots.length), colors);
    if (st.row && anchors.length === 1) anchors = [{ ...anchors[0], at: [anchors[0].at[0] + (st.row.dx ?? 0), anchors[0].at[1], anchors[0].at[2]], len: st.row.len ?? anchors[0].len }];
    tmpQ.setFromAxisAngle(UP, st.rotY);
    tmpM.compose(new THREE.Vector3(...st.at), tmpQ, new THREE.Vector3(1, 1, 1));
    merger.take(p, tmpM);
    st.slots.forEach((id, i) => {
      const a = anchors[Math.min(i, anchors.length - 1)] ?? { at: [0, 0, 0] as V3 };
      const at = new THREE.Vector3(...a.at).applyMatrix4(tmpM);
      // two slots on one anchor (more slots than anchors): spread them out
      if (i >= anchors.length) at.x += (i - anchors.length + 1) * 0.5;
      const dir = new THREE.Vector3(...(a.dir ?? [1, 0, 0])).applyQuaternion(tmpQ).normalize();
      slots.set(id, { id, at, dir, len: a.len ?? 0.8, hang: Boolean(a.hang), sink: a.sink ?? 0, tree: a.tree ?? null, yaw: st.rotY });
    });
  }

  const meshes: THREE.Mesh[] = [];
  const woodGeo = mergeList(merger.wood);
  const feltGeo = mergeList(merger.felt);
  const glowGeo = mergeList(merger.glow);
  if (woodGeo) meshes.push(new THREE.Mesh(woodGeo, mats.wood));
  if (feltGeo) meshes.push(new THREE.Mesh(feltGeo, mats.felt('plain')));
  let glow: THREE.Mesh | null = null;
  if (glowGeo) {
    glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    meshes.push(glow);
  }
  for (const m of meshes) {
    m.castShadow = opts.shadows && m !== glow;
    m.receiveShadow = m !== glow;
    root.add(m);
  }
  wallsAndFloor(root, layout, mats);

  const hides = new Map<string, HidePlace>();
  layout.hides.forEach((hp, i) => {
    const kind = hp.kind ?? hideKindFor(hp.id);
    const s = new Shape();
    const { h, w } = buildHide(kind, s, i + room.number);
    const mesh = new THREE.Mesh(s.build(), mats.felt('plain'));
    mesh.castShadow = opts.shadows;
    mesh.receiveShadow = true;
    const obj = new THREE.Group();
    obj.name = `hide:${hp.id}`;
    obj.add(mesh);
    obj.position.set(...hp.at);
    obj.rotation.y = hp.rotY ?? 0;
    root.add(obj);
    const at = new THREE.Vector3(...hp.at);
    // peek out on the side facing the room centre, a bit to the front
    const side = at.x > 0 ? -1 : 1;
    const peek = new THREE.Vector3(at.x + side * (w * 0.55), at.y, at.z + 0.25);
    hides.set(hp.id, { id: hp.id, obj, at, peek, h, w });
  });

  // light: a warm key (shadows on capable devices), a soft sky/floor bounce, a cool fill
  const hemi = new THREE.HemisphereLight('#fff4e0', '#9a7a62', opts.lowPower ? 1.9 : 1.35);
  root.add(hemi);
  const key = new THREE.DirectionalLight(layout.theme.light, opts.lowPower ? 2.0 : 2.4);
  key.position.set(-3.5, 8, 6);
  key.target.position.set(0, 0.5, -0.5);
  if (opts.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(opts.lowPower ? 1024 : 2048, opts.lowPower ? 1024 : 2048);
    Object.assign(key.shadow.camera, { left: -6.5, right: 6.5, top: 6, bottom: -5, near: 1, far: 22 });
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
  }
  root.add(key, key.target);
  const fill = new THREE.DirectionalLight('#dfe8ff', opts.lowPower ? 0.45 : 0.55);
  fill.position.set(5, 3, 5);
  root.add(fill);

  freeze(root);
  // hiding places animate: keep their matrices live
  for (const h of hides.values()) h.obj.traverse((o) => (o.matrixAutoUpdate = true));

  return { root, layout, slots, hides, ziggy: new THREE.Vector3(...layout.ziggy), stage: new THREE.Vector3(...layout.stage), key, hemi, glow };
}

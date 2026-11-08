import { fitDistance, wideness } from '../santa/framing';
import type { ElfId, SheetLayout } from './types';

/**
 * Pure camera and layout maths for the elves' scenes (no three.js, unit
 * tested): the stage orbit camera, the reference-sheet cells and the hero
 * framing for any screen shape.
 */

export type Vec3 = { x: number; y: number; z: number };

const DEG = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Camera position on an orbit around `target`: azimuth 0 = in front (+z),
 * positive azimuth moves toward +x; elevation in degrees above the horizon.
 */
export function orbit(target: Vec3, azimuthDeg: number, elevationDeg: number, distance: number): Vec3 {
  const az = (Number.isFinite(azimuthDeg) ? azimuthDeg : 0) * DEG;
  const el = clamp(Number.isFinite(elevationDeg) ? elevationDeg : 0, -10, 89) * DEG;
  const d = Math.max(0.01, distance);
  return {
    x: target.x + Math.sin(az) * Math.cos(el) * d,
    y: target.y + Math.sin(el) * d,
    z: target.z + Math.cos(az) * Math.cos(el) * d,
  };
}

/** Distance at which a perspective camera sees a whole sphere of `radius`. */
export function fitSphereDistance(radius: number, fovDeg: number, aspect: number): number {
  const half = (fovDeg * DEG) / 2;
  const halfH = Math.atan(Math.tan(half) * Math.max(0.05, aspect));
  return radius / Math.sin(Math.max(0.01, Math.min(half, halfH)));
}

/** Stage camera settings with defaults and safe ranges. */
export function stageCamera(c: { azimuth?: number; elevation?: number; zoom?: number } = {}) {
  return {
    azimuth: clamp(Number.isFinite(c.azimuth) ? (c.azimuth as number) : 0, -180, 180),
    elevation: clamp(Number.isFinite(c.elevation) ? (c.elevation as number) : 12, -5, 80),
    zoom: clamp(Number.isFinite(c.zoom) ? (c.zoom as number) : 1, 0.3, 4),
  };
}

/** Turn for the 3/4 view (the elf's left side toward the camera). */
export const YAW_THREE_QUARTER = 0.62;
export const YAW_SIDE = Math.PI / 2;
export const YAW_BACK = Math.PI;

/** The views of a reference sheet, left to right: which elf, turned by how much. */
export function sheetViews(layout: SheetLayout): { elf: ElfId; yaw: number }[] {
  const order: ElfId[] = ['pepin', 'grelotte', 'noisette'];
  if (layout.kind === 'lineup') return order.map((elf) => ({ elf, yaw: 0 }));
  if (layout.kind === 'lineup34') return order.map((elf) => ({ elf, yaw: YAW_THREE_QUARTER }));
  if (layout.kind === 'turnaround') return [0, YAW_THREE_QUARTER, YAW_BACK].map((yaw) => ({ elf: layout.elf, yaw }));
  return [{ elf: layout.elf, yaw: 0 }];
}

/** Horizontal extent of a silhouette, relative to its own origin. */
export interface Extent {
  min: number;
  max: number;
}

/**
 * Places silhouettes side by side, `gap` apart, the whole row centred on 0.
 * Returns each one's x offset (all keep one scale: Noisette stays half as tall).
 */
export function packRow(extents: Extent[], gap: number): number[] {
  const xs: number[] = [];
  let cursor = 0;
  for (const e of extents) {
    xs.push(cursor - e.min);
    cursor += e.max - e.min + gap;
  }
  const total = cursor - (extents.length ? gap : 0);
  return xs.map((x) => x - total / 2);
}

/**
 * Orthographic frustum showing a box whole, with a `margin` (fraction of
 * the box) all round, in an image of `aspect` (width / height). `lift`
 * moves the content down (> 0) so the floor sits lower in the picture.
 */
export function fitOrtho(box: { minX: number; maxX: number; minY: number; maxY: number }, aspect: number, margin: number) {
  const a = Math.max(0.05, aspect);
  let w = (box.maxX - box.minX) * (1 + margin * 2);
  let h = (box.maxY - box.minY) * (1 + margin * 2);
  if (w / h > a) h = w / a;
  else w = h * a;
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  return { left: cx - w / 2, right: cx + w / 2, top: cy + h / 2, bottom: cy - h / 2 };
}

/**
 * Hero camera for a screen shape: the three elves (a box `w` × `h` centred
 * on `focus`) always fit, wide screens see more of the room around them,
 * tall phones more of the tree and window above.
 */
export function heroView(aspect: number, focus: Vec3, w: number, h: number) {
  const k = wideness(aspect);
  const fov = 34 + (1 - k) * 8;
  const d = fitDistance(w * (1.0 + 0.15 * k), h * (1.25 - 0.1 * k), fov, aspect);
  // Phones look up a little: the elves sit low, the tree and the snowy window fill the top.
  const target = { x: focus.x, y: focus.y + 0.09 + (1 - k) * 0.75, z: focus.z };
  const pos = { x: focus.x + 0.35 * k, y: focus.y + 0.4 * k + 0.2, z: focus.z + d };
  return { pos, target, fov };
}

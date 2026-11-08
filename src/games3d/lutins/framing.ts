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

/** One view on a reference sheet. Rect in fractions of the image, y from the top. */
export interface SheetCell {
  elf: ElfId;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Elf turned by this angle (radians) around its vertical axis; 0 = front. */
  yaw: number;
  /** World units shown across the cell height (orthographic). */
  span: number;
  /** Where the floor sits, as a fraction of the cell height from its bottom. */
  ground: number;
}

/** Turn for the 3/4 view (the elf's left side toward the camera). */
export const YAW_THREE_QUARTER = 0.62;
export const YAW_SIDE = Math.PI / 2;
export const YAW_BACK = Math.PI;

/**
 * The cells of a reference sheet. `heights` are the elves' full heights
 * (hat included), so one scale serves all of them: on the lineup Noisette
 * really is half as tall as the others. `aspect` = image width / height.
 */
export function sheetCells(layout: SheetLayout, heights: Record<ElfId, number>, aspect: number): SheetCell[] {
  if (layout.kind === 'lineup') {
    const order: ElfId[] = ['pepin', 'grelotte', 'noisette'];
    const tallest = Math.max(...order.map((id) => heights[id]));
    const bigH = 0.7;
    const ground = 0.07;
    // The tallest elf fills ~86 % of the big row.
    const span = tallest / (0.86 - ground);
    const cells: SheetCell[] = [];
    order.forEach((elf, i) => {
      const x = i / 3;
      cells.push({ elf, x, y: 0, w: 1 / 3, h: bigH, yaw: 0, span, ground });
      // Small views: half the scale of the big ones (same scale for all elves).
      const smallH = 1 - bigH;
      const smallSpan = span * 2 * (smallH / bigH);
      cells.push({ elf, x, y: bigH, w: 1 / 6, h: smallH, yaw: YAW_THREE_QUARTER, span: smallSpan, ground: 0.1 });
      cells.push({ elf, x: x + 1 / 6, y: bigH, w: 1 / 6, h: smallH, yaw: YAW_SIDE, span: smallSpan, ground: 0.1 });
    });
    void aspect;
    return cells;
  }
  if (layout.kind === 'turnaround') {
    const h = heights[layout.elf];
    const ground = 0.08;
    const span = h / (0.88 - ground);
    return [0, YAW_THREE_QUARTER, YAW_BACK].map((yaw, i) => ({ elf: layout.elf, x: i / 3, y: 0, w: 1 / 3, h: 1, yaw, span, ground }));
  }
  return [{ elf: layout.elf, x: 0, y: 0, w: 1, h: 1, yaw: 0, span: 1, ground: 0 }];
}

/**
 * Orthographic frustum for a cell: half width / half height in world units
 * and the camera height, so the floor lands at `cell.ground`.
 */
export function cellFrustum(cell: SheetCell, imageW: number, imageH: number) {
  const pxW = cell.w * imageW;
  const pxH = cell.h * imageH;
  const halfH = cell.span / 2;
  const halfW = halfH * (pxW / Math.max(1, pxH));
  const centerY = halfH - cell.ground * cell.span;
  return { halfW, halfH, centerY };
}

/** Pixel rectangle of a cell for WebGL viewport / scissor (origin bottom-left). */
export function cellViewport(cell: SheetCell, imageW: number, imageH: number) {
  const x = Math.round(cell.x * imageW);
  const w = Math.round((cell.x + cell.w) * imageW) - x;
  const top = Math.round(cell.y * imageH);
  const h = Math.round((cell.y + cell.h) * imageH) - top;
  return { x, y: imageH - top - h, w, h };
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
  const lift = 0.15 + (1 - k) * 0.35;
  const target = { x: focus.x, y: focus.y + lift * 0.6, z: focus.z };
  const pos = { x: focus.x + 0.35 * k, y: focus.y + lift + 0.25, z: focus.z + d };
  return { pos, target, fov };
}

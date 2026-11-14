import { fitSphereDistance } from '../lutins/framing';

/**
 * CameraRig: named views on a sphere (centre, radius, pitch, yaw),
 * critically-damped smoothing, pan limits, a gentle follow of the focused
 * hotspot, and framing for portrait and landscape screens.
 *
 * Pure maths (no three.js import): `applyTo(camera)` writes into any object
 * with `position.set` and `lookAt` (three.js cameras), and sets `zoom` on
 * orthographic cameras. Reduced motion: every move is a cut, no idle drift.
 */

export type V3 = [number, number, number];

export interface CameraView {
  /** Point looked at. */
  c: V3;
  /** Distance from `c` (perspective) or the framed half-height (orthographic). */
  r: number;
  /** Radians above the horizon. */
  pitch: number;
  /** Radians around +y; 0 = camera on +z looking toward -z. */
  yaw: number;
}

export interface PanLimits {
  min: V3;
  max: V3;
}

/** Critically damped spring toward `target` (Game Programming Gems 4, "smooth damp"). Returns [value, velocity]. */
export function smoothDamp(current: number, target: number, velocity: number, smoothTime: number, dt: number): [number, number] {
  if (dt <= 0) return [current, velocity];
  const st = Math.max(1e-4, smoothTime);
  const omega = 2 / st;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  const v = (velocity - omega * temp) * exp;
  let out = target + (change + temp) * exp;
  // Never overshoot.
  if (target - current > 0 === out > target) {
    out = target;
    return [out, 0];
  }
  return [out, v];
}

/** Shortest signed angle from a to b. */
export function angleDelta(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

/** Camera position for a view (orbit around `c`). */
export function viewPosition(v: CameraView): V3 {
  const cp = Math.cos(v.pitch);
  return [v.c[0] + Math.sin(v.yaw) * cp * v.r, v.c[1] + Math.sin(v.pitch) * v.r, v.c[2] + Math.cos(v.yaw) * cp * v.r];
}

/**
 * Distance so a sphere of `radius` fits a perspective camera of vertical
 * `fovDeg` at this aspect (portrait screens are limited by the horizontal FOV).
 */
export function fitDistance(radius: number, fovDeg: number, aspect: number, margin = 1.1): number {
  return fitSphereDistance(radius * margin, fovDeg, aspect);
}

/**
 * Adapt an authored view (designed for `designAspect`, 16:10 by default) to
 * this screen: on narrower screens the camera backs off so the same width
 * of the scene stays visible; on wider ones it keeps the authored distance.
 */
export function frameForAspect(v: CameraView, aspect: number, fovDeg = 45, designAspect = 1.6): CameraView {
  if (aspect >= designAspect) return { ...v, c: [...v.c] as V3 };
  const half = (fovDeg * Math.PI) / 360;
  const wDesign = Math.atan(Math.tan(half) * designAspect);
  const wNow = Math.atan(Math.tan(half) * Math.max(0.2, aspect));
  return { ...v, c: [...v.c] as V3, r: v.r * (Math.tan(wDesign) / Math.tan(wNow)) };
}

/** Orthographic framing: half-height so a w×h area (+margin) fits this aspect. */
export function fitOrthoHalfHeight(w: number, h: number, aspect: number, margin = 1.1): number {
  return (Math.max(h, w / Math.max(0.05, aspect)) / 2) * margin;
}

export function clampToLimits(c: V3, l: PanLimits | null): V3 {
  if (!l) return c;
  return [Math.min(l.max[0], Math.max(l.min[0], c[0])), Math.min(l.max[1], Math.max(l.min[1], c[1])), Math.min(l.max[2], Math.max(l.min[2], c[2]))];
}

export interface CameraLikeTarget {
  position: { set(x: number, y: number, z: number): unknown };
  lookAt(x: number, y: number, z: number): void;
  isOrthographicCamera?: boolean;
  zoom?: number;
  updateProjectionMatrix?: () => void;
}

export class CameraRig {
  /** Seconds to settle (about 3× this to be still). */
  smoothTime = 0.45;
  reducedMotion = false;
  /** Screen aspect (width / height); set by the host on resize. */
  aspect = 1.6;
  fov = 45;
  /** Orthographic: the radius at which zoom = 1. */
  orthoBase = 0;
  limits: PanLimits | null = null;
  private views = new Map<string, CameraView>();
  private target: CameraView;
  private cur: CameraView;
  private vel = { c: [0, 0, 0] as V3, r: 0, pitch: 0, yaw: 0 };
  private followOffset: V3 = [0, 0, 0];
  private panOffset: V3 = [0, 0, 0];

  constructor(initial: CameraView = { c: [0, 1, 0], r: 8, pitch: 0.35, yaw: 0 }) {
    this.target = { ...initial, c: [...initial.c] as V3 };
    this.cur = { ...initial, c: [...initial.c] as V3 };
  }

  addView(name: string, v: CameraView): this {
    this.views.set(name, { ...v, c: [...v.c] as V3 });
    return this;
  }

  hasView(name: string): boolean {
    return this.views.has(name);
  }

  /** Fly (or cut, with reduced motion or `cut: true`) to a named view or a view. */
  goTo(view: string | CameraView, opts: { cut?: boolean; keepPan?: boolean } = {}): void {
    const v = typeof view === 'string' ? this.views.get(view) : view;
    if (!v) return;
    this.target = { ...v, c: [...v.c] as V3 };
    if (!opts.keepPan) this.panOffset = [0, 0, 0];
    this.followOffset = [0, 0, 0];
    if (opts.cut || this.reducedMotion) this.cut();
  }

  /** Jump to the target now. */
  cut(): void {
    const t = this.wanted();
    this.cur = { ...t, c: [...t.c] as V3 };
    this.vel = { c: [0, 0, 0], r: 0, pitch: 0, yaw: 0 };
  }

  /** Pan along the view's ground axes (world units). Clamped by `limits`. */
  pan(dx: number, dz = 0): void {
    const cy = Math.cos(this.target.yaw);
    const sy = Math.sin(this.target.yaw);
    this.panOffset = [this.panOffset[0] + dx * cy + dz * sy, 0, this.panOffset[2] - dx * sy + dz * cy];
    const c = clampToLimits(this.add(this.target.c, this.panOffset), this.limits);
    this.panOffset = [c[0] - this.target.c[0], 0, c[2] - this.target.c[2]];
    if (this.reducedMotion) this.cut();
  }

  /** Gently lean toward a focused point (TV / keyboard focus), `strength` 0..1 of the way. */
  follow(point: V3 | null, strength = 0.35): void {
    if (!point) {
      this.followOffset = [0, 0, 0];
      return;
    }
    const base = this.add(this.target.c, this.panOffset);
    this.followOffset = [(point[0] - base[0]) * strength, 0, (point[2] - base[2]) * strength];
    if (this.reducedMotion) this.cut();
  }

  /** The view being shown now (after smoothing). */
  get current(): Readonly<CameraView> {
    return this.cur;
  }

  /** Where the rig is heading (target + pan + follow, clamped, framed for the aspect). */
  wanted(): CameraView {
    const c = clampToLimits(this.add(this.add(this.target.c, this.panOffset), this.followOffset), this.limits);
    return frameForAspect({ ...this.target, c }, this.aspect, this.fov);
  }

  /** True when close enough to the target to stop rendering camera changes. */
  get settled(): boolean {
    const t = this.wanted();
    const d = Math.abs(t.r - this.cur.r) + Math.abs(angleDelta(this.cur.yaw, t.yaw)) + Math.abs(t.pitch - this.cur.pitch) + Math.hypot(t.c[0] - this.cur.c[0], t.c[1] - this.cur.c[1], t.c[2] - this.cur.c[2]);
    return d < 1e-3;
  }

  update(dt: number): void {
    const t = this.wanted();
    if (this.reducedMotion) {
      this.cur = { ...t, c: [...t.c] as V3 };
      return;
    }
    const st = this.smoothTime;
    for (let i = 0; i < 3; i++) [this.cur.c[i], this.vel.c[i]] = smoothDamp(this.cur.c[i], t.c[i], this.vel.c[i], st, dt);
    [this.cur.r, this.vel.r] = smoothDamp(this.cur.r, t.r, this.vel.r, st, dt);
    [this.cur.pitch, this.vel.pitch] = smoothDamp(this.cur.pitch, t.pitch, this.vel.pitch, st, dt);
    const yawT = this.cur.yaw + angleDelta(this.cur.yaw, t.yaw);
    [this.cur.yaw, this.vel.yaw] = smoothDamp(this.cur.yaw, yawT, this.vel.yaw, st, dt);
  }

  /** Write the current view into a three.js camera. */
  applyTo(cam: CameraLikeTarget): void {
    const v = this.cur;
    const p = viewPosition(v);
    cam.position.set(p[0], p[1], p[2]);
    cam.lookAt(v.c[0], v.c[1], v.c[2]);
    if (cam.isOrthographicCamera && this.orthoBase > 0) {
      cam.zoom = this.orthoBase / Math.max(1e-3, v.r);
      cam.updateProjectionMatrix?.();
    }
  }

  private add(a: V3, b: V3): V3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }
}

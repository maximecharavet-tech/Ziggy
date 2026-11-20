/**
 * Particle physics for Ziggy's effects (confetti, sparkles, emoji rain).
 *
 * Pure functions, no DOM: the canvas stage calls `stepParticle` every frame,
 * and the tests run the same code. Units are CSS pixels and seconds, and the
 * maths is frame-rate independent (exponential drag), so a 30 fps tablet and a
 * 120 fps laptop see the same arc.
 */

export type ShapeKind = 'star' | 'heart' | 'ball' | 'ribbon' | 'rect' | 'dot' | 'sparkle' | 'emoji';

export interface Particle {
  kind: ShapeKind;
  x: number;
  y: number;
  /** Velocity, px/s. */
  vx: number;
  vy: number;
  /** Rotation and its speed, rad and rad/s. */
  rot: number;
  vr: number;
  /** Paper "flip" phase (confetti and ribbons turning over), rad and rad/s. */
  flip: number;
  vflip: number;
  /** Size in px. */
  size: number;
  color: string;
  age: number;
  /** Lifetime, s. */
  life: number;
  /** Exponential air drag, 1/s (velocity × e^(−drag·dt)). */
  drag: number;
  /** Downward acceleration, px/s². */
  gravity: number;
  /** Lateral flutter: amplitude (px/s) and frequency (Hz). */
  sway: number;
  swayFreq: number;
  phase: number;
  /** Gentle brightness wave, Hz (0 = none; always ≤ MAX_TWINKLE_HZ). */
  twinkle: number;
  /** Scale-in time at birth, s (0 = born full size). */
  popIn: number;
  /** Fade-out time before death, s. */
  fadeOut: number;
  emoji?: string;
  /** Effect that emitted it, so one effect can be cleared on its own. */
  group: number;
  /** Tiny UI sparkles stay visible over controls (they start on the button that was pressed). */
  noGhost?: boolean;
}

/** Brightness waves slower than this never read as flicker (photosensitivity: ≤ 3 flashes/s). */
export const MAX_TWINKLE_HZ = 2;

/** One frame never advances the simulation by more than this (a hidden tab or a long GC must not teleport particles). */
export const MAX_DT = 1 / 20;

export type Rng = () => number;

/** Small seeded generator (mulberry32), for repeatable tests and stable demos. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;

/** Advance one particle by `dt` seconds. Returns false once it has lived its life. */
export function stepParticle(p: Particle, dt: number): boolean {
  const h = Math.min(Math.max(dt, 0), MAX_DT);
  p.age += h;
  if (p.age >= p.life) return false;
  // Not born yet (a rain drop waiting its turn): it waits, unseen.
  if (p.age < 0) return true;
  const flutter = p.sway ? Math.sin(p.age * TAU * p.swayFreq + p.phase) * p.sway : 0;
  if (p.drag > 0) {
    // Exact solution of v' = g − drag·v over the step: the same path at any frame rate.
    const k = Math.exp(-p.drag * h);
    const vt = p.gravity / p.drag;
    const f = (1 - k) / p.drag;
    p.x += p.vx * f + flutter * h;
    p.y += vt * h + (p.vy - vt) * f;
    p.vx *= k;
    p.vy = vt + (p.vy - vt) * k;
  } else {
    p.vy += p.gravity * h;
    p.x += (p.vx + flutter) * h;
    p.y += p.vy * h;
  }
  p.rot += p.vr * h;
  p.flip += p.vflip * h;
  return true;
}

/** Terminal fall speed for a gravity/drag pair, px/s. */
export function terminalVelocity(gravity: number, drag: number): number {
  return drag > 0 ? gravity / drag : Infinity;
}

/** Opacity at the particle's age: fades out at the end, and twinkles slowly if asked. */
export function alphaOf(p: Particle): number {
  if (p.age < 0) return 0;
  const left = p.life - p.age;
  let a = p.fadeOut > 0 && left < p.fadeOut ? Math.max(0, left / p.fadeOut) : 1;
  const hz = Math.min(p.twinkle, MAX_TWINKLE_HZ);
  if (hz > 0) a *= 0.72 + 0.28 * Math.cos(p.age * TAU * hz + p.phase);
  return a;
}

/** Scale at the particle's age: a springy pop-in (easeOutBack), then 1. */
export function scaleOf(p: Particle): number {
  if (p.popIn <= 0 || p.age >= p.popIn) return 1;
  const t = p.age / p.popIn;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** Whether a particle has left the screen for good (falling below it, or far to the side). */
export function isOffscreen(p: Particle, width: number, height: number): boolean {
  const m = p.size * 2 + 40;
  if (p.y > height + m && p.vy >= 0) return true;
  return p.x < -m * 3 || p.x > width + m * 3;
}

// ───────────────────────── spawners ─────────────────────────

export const ZIGGY_COLORS = ['#7FC85C', '#5FB6EA', '#F2647B', '#FBBF24', '#A78BFA', '#4FC9C0', '#F472B6'] as const;

const pick = <T,>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length) % list.length];
const jitter = (rng: Rng, v: number, amount: number) => v * (1 + (rng() * 2 - 1) * amount);

function base(kind: ShapeKind, x: number, y: number, color: string, group: number): Particle {
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    rot: 0,
    vr: 0,
    flip: 0,
    vflip: 0,
    size: 10,
    color,
    age: 0,
    life: 1.6,
    drag: 2,
    gravity: 900,
    sway: 0,
    swayFreq: 0,
    phase: 0,
    twinkle: 0,
    popIn: 0,
    fadeOut: 0.35,
    group,
  };
}

export interface CannonOptions {
  x: number;
  y: number;
  /** Direction in degrees: 0 = right, −90 = straight up. */
  angle?: number;
  /** Cone width in degrees. */
  spread?: number;
  /** Launch speed, px/s. */
  speed?: number;
  count: number;
  kinds?: readonly ShapeKind[];
  colors?: readonly string[];
  /** Seconds; the whole effect stays within MAX_CELEBRATION_S. */
  life?: number;
  size?: number;
  group?: number;
}

/** Longest a celebration may last, s (short, and never in the way). */
export const MAX_CELEBRATION_S = 2;

/** A party cannon: paper, stars, hearts, ribbons and Ziggy's antenna balls in a cone. */
export function spawnCannon(o: CannonOptions, rng: Rng = Math.random): Particle[] {
  const angle = ((o.angle ?? -90) * Math.PI) / 180;
  const spread = ((o.spread ?? 55) * Math.PI) / 180;
  const speed = o.speed ?? 900;
  const kinds = o.kinds ?? (['rect', 'rect', 'ribbon', 'star', 'heart', 'ball'] as const);
  const colors = o.colors ?? ZIGGY_COLORS;
  const life = Math.min(o.life ?? 1.8, MAX_CELEBRATION_S);
  const out: Particle[] = [];
  for (let i = 0; i < o.count; i++) {
    const kind = pick(kinds, rng);
    const a = angle + (rng() - 0.5) * spread;
    const s = jitter(rng, speed, 0.35);
    const p = base(kind, o.x, o.y, kind === 'ball' ? '#7DBF5A' : pick(colors, rng), o.group ?? 0);
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.size = jitter(rng, o.size ?? (kind === 'rect' ? 11 : kind === 'ribbon' ? 16 : 13), 0.3);
    p.rot = rng() * TAU;
    p.vr = (rng() * 2 - 1) * 9;
    p.flip = rng() * TAU;
    p.vflip = kind === 'rect' || kind === 'ribbon' ? jitter(rng, 11, 0.4) : 0;
    p.life = life * (0.82 + rng() * 0.18);
    // Paper floats, stars and balls drop a little faster: the cloud keeps its shape.
    p.drag = kind === 'rect' || kind === 'ribbon' ? 2.6 : 1.9;
    p.gravity = kind === 'rect' || kind === 'ribbon' ? 760 : 980;
    p.sway = kind === 'rect' || kind === 'ribbon' ? 40 : 0;
    p.swayFreq = 1.1 + rng() * 0.6;
    p.phase = rng() * TAU;
    p.twinkle = kind === 'star' ? 1.2 : 0;
    p.fadeOut = 0.4;
    out.push(p);
  }
  return out;
}

export interface BurstOptions {
  x: number;
  y: number;
  count: number;
  kinds?: readonly ShapeKind[];
  colors?: readonly string[];
  /** Outward speed, px/s. */
  speed?: number;
  size?: number;
  life?: number;
  /** A burst usually floats; a little gravity makes hearts drift down. */
  gravity?: number;
  group?: number;
  noGhost?: boolean;
}

/** A ring of sparkles, stars or hearts flying out from one point and fading. */
export function spawnBurst(o: BurstOptions, rng: Rng = Math.random): Particle[] {
  const kinds = o.kinds ?? (['sparkle', 'star', 'sparkle', 'heart'] as const);
  const colors = o.colors ?? ['#FBBF24', '#FFE58A', '#F472B6', '#7FC85C', '#5FB6EA'];
  const speed = o.speed ?? 420;
  const life = Math.min(o.life ?? 0.75, MAX_CELEBRATION_S);
  const out: Particle[] = [];
  const offset = rng() * TAU;
  for (let i = 0; i < o.count; i++) {
    const kind = pick(kinds, rng);
    // Evenly spaced with a little jitter: a burst that reads as a ring, not a clump.
    const a = offset + (i / Math.max(1, o.count)) * TAU + (rng() - 0.5) * 0.5;
    const s = jitter(rng, speed, 0.3);
    const p = base(kind, o.x, o.y, pick(colors, rng), o.group ?? 0);
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.size = jitter(rng, o.size ?? 14, 0.3);
    p.rot = rng() * TAU;
    p.vr = (rng() * 2 - 1) * 4;
    p.life = life * (0.8 + rng() * 0.2);
    p.drag = 5.5;
    p.gravity = o.gravity ?? 120;
    p.popIn = 0.14;
    p.fadeOut = p.life * 0.55;
    p.noGhost = o.noGhost;
    out.push(p);
  }
  return out;
}

export interface RainOptions {
  width: number;
  count: number;
  emojis?: readonly string[];
  kinds?: readonly ShapeKind[];
  colors?: readonly string[];
  size?: number;
  /** Seconds over which the drops are released. */
  span?: number;
  /** Initial fall speed, px/s. */
  speed?: number;
  life?: number;
  group?: number;
}

/**
 * Gentle rain from the top edge. Drops are born above the screen with a small
 * negative age so they arrive one after another, never all at once.
 */
export function spawnRain(o: RainOptions, rng: Rng = Math.random): Particle[] {
  const life = Math.min(o.life ?? 1.9, MAX_CELEBRATION_S);
  const span = Math.min(o.span ?? 0.6, life * 0.4);
  const out: Particle[] = [];
  for (let i = 0; i < o.count; i++) {
    const emoji = o.emojis && o.emojis.length ? pick(o.emojis, rng) : undefined;
    const kind: ShapeKind = emoji ? 'emoji' : pick(o.kinds ?? (['star', 'heart', 'sparkle'] as const), rng);
    const size = jitter(rng, o.size ?? (emoji ? 30 : 16), 0.25);
    const p = base(kind, (i + 0.5 + (rng() - 0.5) * 0.8) * (o.width / o.count), -size * 1.5, pick(o.colors ?? ZIGGY_COLORS, rng), o.group ?? 0);
    p.emoji = emoji;
    p.size = size;
    p.vx = (rng() * 2 - 1) * 30;
    p.vy = jitter(rng, o.speed ?? 420, 0.25);
    p.rot = (rng() * 2 - 1) * 0.5;
    p.vr = (rng() * 2 - 1) * 1.6;
    // Born "in the future": a negative age delays its fall without a timer.
    // Its life is shortened by the longest wait, so the last drop is gone by `life`.
    p.age = -rng() * span;
    p.life = life - span;
    p.drag = 1;
    p.gravity = 520;
    p.sway = 55;
    p.swayFreq = 0.8 + rng() * 0.5;
    p.phase = rng() * TAU;
    p.fadeOut = 0.45;
    out.push(p);
  }
  return out;
}

// ───────────────────────── springs ─────────────────────────

export interface SpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
  /** Initial velocity, units/s. */
  velocity?: number;
}

/**
 * Samples a damped spring from `from` to `to` at `fps`, for Web Animations
 * keyframes (linear easing between samples). Always ends exactly on `to` and
 * never runs longer than `maxMs`.
 */
export function springKeyframes(from: number, to: number, config: SpringConfig = {}, opts: { fps?: number; maxMs?: number; rest?: number } = {}): number[] {
  const { stiffness = 420, damping = 16, mass = 1, velocity = 0 } = config;
  const fps = opts.fps ?? 60;
  const maxFrames = Math.max(2, Math.round(((opts.maxMs ?? 900) / 1000) * fps));
  const rest = opts.rest ?? Math.max(1e-4, Math.abs(to - from) * 0.002);
  const sub = 8;
  const h = 1 / fps / sub;
  let x = from;
  let v = velocity;
  const out = [from];
  for (let f = 1; f < maxFrames; f++) {
    for (let s = 0; s < sub; s++) {
      const a = (-stiffness * (x - to) - damping * v) / mass;
      v += a * h;
      x += v * h;
    }
    out.push(x);
    if (Math.abs(x - to) < rest && Math.abs(v) < rest * fps) break;
  }
  out[out.length - 1] = to;
  return out;
}

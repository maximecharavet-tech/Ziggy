/**
 * The shared effects stage: one fixed, click-through canvas above the page,
 * created on the first effect and hidden whenever nothing is flying.
 *
 * - One requestAnimationFrame loop for every effect, running only while
 *   particles are alive; a hidden tab drops them (celebrations are moments,
 *   not something to resume later).
 * - Global particle budget (budget.ts) with a lower cap on weak devices, and a
 *   lower canvas resolution there.
 * - Keep-clear zones: particles passing over buttons, links and read-aloud
 *   controls are drawn as faint ghosts, so an effect never hides an answer.
 * - pointer-events: none and aria-hidden: it can never block a tap or speak.
 */
import { allowedParticles, stagePixelRatio } from './budget';
import { alphaOf, isOffscreen, scaleOf, stepParticle, type Particle } from './physics';
import { drawParticle } from './shapes';
import { isBrowser, isLowPower, reducedMotionNow } from './env';

/** Above celebration dialogs (z 90–95), below the grown-up gate (z 130). */
export const STAGE_Z = 120;

/** Elements that effects must not hide. */
export const KEEP_CLEAR_SELECTOR =
  '[data-fx-keepclear],button,a[href],[role="button"],input,select,textarea,[data-tv-secondary]';
const GHOST_ALPHA = 0.16;

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let raf = 0;
let last = 0;
let width = 0;
let height = 0;
let dpr = 1;
let low = true;
let groupSeq = 1;
let zones: DOMRect[] = [];
let zonesAt = -Infinity;

function resize() {
  if (!canvas) return;
  width = window.innerWidth;
  height = window.innerHeight;
  dpr = stagePixelRatio(window.devicePixelRatio, low);
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
}

function onVisibility() {
  if (document.hidden) clearAll();
}

function ensureStage(): boolean {
  if (!isBrowser()) return false;
  if (canvas && ctx && canvas.isConnected) return true;
  canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-ziggy-fx', '');
  const s = canvas.style;
  s.position = 'fixed';
  s.top = s.left = s.right = s.bottom = '0';
  s.width = '100%';
  s.height = '100%';
  s.pointerEvents = 'none';
  s.zIndex = String(STAGE_Z);
  s.display = 'none';
  s.contain = 'strict';
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  low = isLowPower();
  resize();
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  return Boolean(ctx);
}

function refreshZones() {
  zones = [];
  const els = document.querySelectorAll(KEEP_CLEAR_SELECTOR);
  const maxArea = width * height * 0.22;
  for (let i = 0; i < els.length && zones.length < 48; i++) {
    const r = els[i].getBoundingClientRect();
    if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > height || r.right < 0 || r.left > width) continue;
    // Whole-card links would ghost the confetti everywhere: only real controls count.
    if (r.width * r.height > maxArea) continue;
    zones.push(r);
  }
}

function inZone(p: Particle): boolean {
  for (const r of zones) {
    if (p.x >= r.left - 4 && p.x <= r.right + 4 && p.y >= r.top - 4 && p.y <= r.bottom + 4) return true;
  }
  return false;
}

function frame(t: number) {
  raf = 0;
  if (!ctx || !canvas) return;
  const dt = last ? (t - last) / 1000 : 1 / 60;
  last = t;
  if (t - zonesAt > 400) {
    zonesAt = t;
    refreshZones();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let n = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!stepParticle(p, dt) || isOffscreen(p, width, height)) continue;
    const ghost = !p.noGhost && inZone(p);
    drawParticle(ctx, p, alphaOf(p) * (ghost ? GHOST_ALPHA : 1), scaleOf(p), dpr);
    particles[n++] = p;
  }
  particles.length = n;
  ctx.globalAlpha = 1;
  if (n > 0 && !document.hidden) {
    raf = requestAnimationFrame(frame);
  } else {
    stop();
  }
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  last = 0;
  zonesAt = -Infinity;
  if (ctx && canvas) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  if (canvas) canvas.style.display = 'none';
}

/** A fresh id for one effect's particles. */
export function nextGroup(): number {
  return groupSeq++;
}

/**
 * Adds particles to the stage, trimmed to the budget. Returns how many were
 * accepted (0 under reduced motion, on the server or in a hidden tab).
 */
export function emit(list: Particle[]): number {
  if (!list.length || !ensureStage() || document.hidden) return 0;
  const n = allowedParticles(list.length, { lowPower: low, reducedMotion: reducedMotionNow(), alive: particles.length });
  if (n <= 0) return 0;
  // Keep an even sample when trimming, so a trimmed burst still has every shape.
  const step = list.length / n;
  for (let i = 0; i < n; i++) particles.push(list[Math.floor(i * step)]);
  if (canvas) canvas.style.display = 'block';
  if (!raf) raf = requestAnimationFrame(frame);
  return n;
}

/** Removes one effect's particles at once (e.g. a component unmounts). */
export function clearGroup(group: number): void {
  particles = particles.filter((p) => p.group !== group);
  if (!particles.length) stop();
}

export function clearAll(): void {
  particles = [];
  stop();
}

export function aliveCount(): number {
  return particles.length;
}

/** The stage size (for spawners that need the viewport). */
export function viewport(): { width: number; height: number } {
  if (!isBrowser()) return { width: 0, height: 0 };
  return { width: window.innerWidth, height: window.innerHeight };
}

/** Whether the stage is on the weak-device path (fewer particles, lower resolution). */
export function stageLowPower(): boolean {
  if (canvas) return low;
  return isLowPower();
}

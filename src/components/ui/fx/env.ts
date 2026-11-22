/**
 * Browser facts the effects need, all safe to import on the server (every
 * function checks for `window` and answers "no effects" there).
 *
 * Nothing here may be called during render to decide what to render: these
 * values differ between the server and the browser. Call them in effects and
 * event handlers only.
 */

export const isBrowser = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined';

/** "Reduce motion" right now (for event handlers; components use `useReducedMotion`). */
export function reducedMotionNow(): boolean {
  if (!isBrowser()) return true;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * A weak device: 4 cores or fewer, 4 GB or less, or data saver on. The same
 * rule as `prefersLowPower()` in the 3D kit, without importing three.js into
 * every page (reduced motion is checked separately).
 */
export function isLowPower(): boolean {
  if (!isBrowser()) return true;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory;
  return cores <= 4 || (typeof memory === 'number' && memory <= 4) || Boolean(nav.connection?.saveData);
}

/** A mouse or trackpad that can hover (no hover effects for fingers). */
export function hasFinePointer(): boolean {
  if (!isBrowser()) return false;
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

type Activation = { isActive?: boolean; hasBeenActive?: boolean };
const activation = (): Activation | undefined =>
  isBrowser() ? (navigator as Navigator & { userActivation?: Activation }).userActivation : undefined;

/** The visitor has interacted with the page at least once (sounds may start). */
export function hasUserGesture(): boolean {
  const a = activation();
  if (a && typeof a.hasBeenActive === 'boolean') return a.hasBeenActive;
  return lastPointer.t > 0 || lastActivity > startedAt;
}

/** A gesture happened a moment ago (what follows was caused by the visitor, e.g. a navigation). */
export function recentGesture(withinMs = 2500): boolean {
  const a = activation();
  if (a && typeof a.isActive === 'boolean' && a.isActive) return true;
  return lastPointer.t > 0 && now() - lastPointer.t < withinMs;
}

export const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// ───────────── activity & last pointer (installed once, passive) ─────────────

let installed = false;
let startedAt = 0;
let lastActivity = 0;
let lastNotify = 0;
const lastPointer = { x: 0, y: 0, t: 0 };
const listeners = new Set<() => void>();

function onActivity() {
  const t = now();
  lastActivity = t;
  // Listeners (sleepy mascots) only need to hear about it a few times a second.
  if (t - lastNotify < 200) return;
  lastNotify = t;
  listeners.forEach((fn) => fn());
}

function onPointerDown(e: PointerEvent) {
  lastPointer.x = e.clientX;
  lastPointer.y = e.clientY;
  lastPointer.t = now();
}

/** Starts listening for activity (idempotent). */
export function installActivity(): void {
  if (installed || !isBrowser()) return;
  installed = true;
  startedAt = lastActivity = now();
  const opts: AddEventListenerOptions = { passive: true, capture: true };
  for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const) {
    window.addEventListener(type, onActivity, opts);
  }
  window.addEventListener('pointerdown', onPointerDown, opts);
}

/** Milliseconds since the visitor last moved, scrolled, tapped or typed. */
export function idleMs(): number {
  installActivity();
  return now() - lastActivity;
}

/** Calls `fn` when the visitor becomes active (throttled). Returns the unsubscribe. */
export function onUserActivity(fn: () => void): () => void {
  installActivity();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Where the last tap/click happened, if recent. */
export function lastTap(withinMs = 2500): { x: number; y: number } | null {
  return lastPointer.t > 0 && now() - lastPointer.t < withinMs ? { x: lastPointer.x, y: lastPointer.y } : null;
}

/** Test hook: forget everything. */
export function _resetEnvForTests(): void {
  lastPointer.t = 0;
  lastActivity = startedAt = 0;
  listeners.clear();
}

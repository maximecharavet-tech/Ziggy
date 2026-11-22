/**
 * "Ziggy juice": the little bounces, sparkles and sounds that make a tap feel
 * alive, bundled per gesture so every part of the site answers the same way.
 *
 *   const juice = createJuice();       // or useJuice() in a component
 *   juice.press(event)                 // squash & stretch + tap
 *   juice.celebrate(el)                // confetti + sparkles + wiggle + tada
 *
 * Element motion uses the Web Animations API on `transform` with
 * `composite: 'add'`, so it stacks on top of whatever transform the element
 * already has (Tailwind, motion) instead of replacing it. Only transform and
 * opacity ever animate. Under reduced motion nothing moves: sounds still play
 * (they are feedback, not motion) and the mute switch still applies.
 *
 * Child-safety: there is deliberately no "wrong" shake. `encourage()` is the
 * gentle answer to a miss: a small nod upward and a soft bubble.
 */
import { springKeyframes } from './physics';
import { confettiAt, heartsAt, sparkleAt, centerOf, type Point } from './effects';
import { fxSound, type FxSound } from './sfx';
import { createRateLimit } from './rate-limit';
import { now, reducedMotionNow, hasFinePointer } from './env';
import { flashGuard } from './flash-guard';

/** How long each gesture's motion lasts, ms. Interface feedback stays short; celebrations ≤ 2 s. */
export const JUICE_MS = {
  press: 280,
  pop: 420,
  boing: 640,
  wiggle: 540,
  sparkle: 750,
  success: 750,
  encourage: 520,
  hover: 220,
  celebrate: 1900,
} as const;

export type JuiceKind = keyof typeof JUICE_MS;

/** A second celebration within this window becomes a simple sparkle (no confetti pile-up). */
export const CELEBRATE_COOLDOWN_MS = 1200;

export type JuiceStep = { at: number; do: 'sound' | 'motion' | 'confetti' | 'sparkle' | 'hearts' | 'glow' };

/**
 * What a gesture does and when (ms after the call). Pure, so the timing rules
 * are tested: everything starts within the gesture's duration, the sound comes
 * with the first frame of motion (never after), and a celebration fits in 2 s.
 */
export function juicePlan(kind: JuiceKind, opts: { reduced?: boolean; cooledDown?: boolean } = {}): { steps: JuiceStep[]; duration: number } {
  const reduced = Boolean(opts.reduced);
  const steps: JuiceStep[] = [{ at: 0, do: 'sound' }];
  const motion = (at = 0) => {
    if (!reduced) steps.push({ at, do: 'motion' });
  };
  switch (kind) {
    case 'celebrate':
      if (opts.cooledDown === false) {
        if (!reduced) steps.push({ at: 0, do: 'sparkle' });
        motion(0);
        return { steps, duration: JUICE_MS.sparkle };
      }
      motion(0);
      if (!reduced) {
        steps.push({ at: 0, do: 'glow' }, { at: 60, do: 'confetti' }, { at: 120, do: 'sparkle' });
      }
      return { steps, duration: JUICE_MS.celebrate };
    case 'sparkle':
    case 'success':
      motion(0);
      if (!reduced) steps.push({ at: 0, do: 'sparkle' });
      return { steps, duration: JUICE_MS[kind] };
    default:
      motion(0);
      return { steps, duration: JUICE_MS[kind] };
  }
}

export type JuiceTarget = Element | EventTarget | null | undefined | Point | { currentTarget: EventTarget | null; clientX?: number; clientY?: number };

function isPoint(t: unknown): t is Point {
  return typeof t === 'object' && t !== null && 'x' in t && 'y' in t && typeof (t as Point).x === 'number';
}

function elementOf(t: JuiceTarget): HTMLElement | null {
  if (!t || isPoint(t)) return null;
  if (typeof Element !== 'undefined' && t instanceof Element) return t as HTMLElement;
  if (typeof t === 'object' && 'currentTarget' in t) {
    const el = (t as { currentTarget: EventTarget | null }).currentTarget;
    return typeof Element !== 'undefined' && el instanceof Element ? (el as HTMLElement) : null;
  }
  return null;
}

function pointOf(t: JuiceTarget): Point | null {
  if (isPoint(t)) return t;
  if (t && typeof t === 'object' && 'clientX' in t) {
    const e = t as { clientX?: number; clientY?: number };
    // Keyboard "clicks" report 0,0: use the element's centre instead.
    if (typeof e.clientX === 'number' && typeof e.clientY === 'number' && (e.clientX !== 0 || e.clientY !== 0)) return { x: e.clientX, y: e.clientY };
  }
  return centerOf(elementOf(t));
}

const running = new WeakMap<Element, Animation>();

/** Plays transform keyframes on an element, added on top of its own transform. */
export function playTransform(el: HTMLElement | null, frames: string[], duration: number, easing = 'linear'): Animation | null {
  if (!el || typeof el.animate !== 'function' || frames.length < 2) return null;
  running.get(el)?.cancel();
  const keyframes = frames.map((transform) => ({ transform }));
  let anim: Animation;
  try {
    anim = el.animate(keyframes, { duration, easing, composite: 'add' });
  } catch {
    // Older engines without additive animation: plain keyframes (still transform only).
    anim = el.animate(keyframes, { duration, easing });
  }
  running.set(el, anim);
  anim.onfinish = () => {
    if (running.get(el) === anim) running.delete(el);
  };
  return anim;
}

const fmt = (n: number) => Math.round(n * 1000) / 1000;
const FPS = 60;

/** Play time of keyframes sampled at 60 fps, capped by the gesture's budget. */
export function framesMs(frames: readonly unknown[], cap: number): number {
  return Math.min(cap, Math.max(1, frames.length - 1) * (1000 / FPS));
}

/** Squash, then a springy release that overshoots into a stretch. Volume is kept (sx ≈ 1/sy^0.7). */
export function squashStretchFrames(squash = 0.1, maxMs: number = JUICE_MS.press): string[] {
  const down = [1, 1 - squash * 0.55, 1 - squash];
  const release = springKeyframes(1 - squash, 1, { stiffness: 900, damping: 24 }, { fps: FPS, maxMs: maxMs - (down.length - 1) * (1000 / FPS) });
  return [...down, ...release.slice(1)].map((sy) => `scale(${fmt(Math.pow(sy, -0.7))}, ${fmt(sy)})`);
}

/** A pop: a quick swell past 1, then a spring back. */
export function popFrames(amount = 0.18, maxMs: number = JUICE_MS.pop): string[] {
  const up = [1, 1 + amount * 0.6];
  const back = springKeyframes(1 + amount, 1, { stiffness: 520, damping: 15 }, { fps: FPS, maxMs: maxMs - (1000 / FPS) * up.length });
  return [...up, ...back].map((s) => `scale(${fmt(s)})`);
}

/** Celebratory wiggle: a damped tilt with a tiny swell. Never a horizontal "no" shake. */
export function wiggleFrames(deg = 7, maxMs: number = JUICE_MS.wiggle): string[] {
  const n = Math.max(2, Math.round((maxMs / 1000) * FPS));
  const out: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = i === n ? 0 : -deg * Math.sin(t * Math.PI * 2 * 1.75) * (1 - t);
    out.push(`rotate(${fmt(r)}deg) scale(${fmt(1 + 0.05 * Math.sin(t * Math.PI))})`);
  }
  return out;
}

/** Squash, jump, land, settle. */
export function boingFrames(height = 14): string[] {
  return [
    'translateY(0px) scale(1, 1)',
    'translateY(0px) scale(1.12, 0.86)',
    `translateY(${-height}px) scale(0.92, 1.1)`,
    `translateY(${-height * 1.15}px) scale(0.98, 1.02)`,
    `translateY(${-height * 0.5}px) scale(0.97, 1.04)`,
    'translateY(0px) scale(1.1, 0.9)',
    'translateY(0px) scale(0.97, 1.04)',
    'translateY(0px) scale(1.01, 0.99)',
    'translateY(0px) scale(1, 1)',
  ];
}

/** A gentle nod upward: "nearly, try again!" */
export function encourageFrames(maxMs: number = JUICE_MS.encourage): string[] {
  const up = [0, -2.5, -4.8];
  const back = springKeyframes(-6, 0, { stiffness: 320, damping: 26 }, { fps: FPS, maxMs: maxMs - (1000 / FPS) * up.length });
  return [...up, ...back].map((y) => `translateY(${fmt(y)}px)`);
}

export interface Juice {
  /** Squash & stretch + tap sound. */
  press(t: JuiceTarget, sound?: FxSound | false): number;
  /** Springy pop + pop sound. */
  pop(t: JuiceTarget, sound?: FxSound | false): number;
  /** Squash, jump and land + boing. */
  boing(t: JuiceTarget, sound?: FxSound | false): number;
  /** Little happy wiggle + squeak. */
  wiggle(t: JuiceTarget, sound?: FxSound | false): number;
  /** Sparkle burst at the element or point + sparkle sound. */
  sparkle(t: JuiceTarget, sound?: FxSound | false): number;
  /** Right answer: pop + star sparkles + correct sound. */
  success(t: JuiceTarget, sound?: FxSound | false): number;
  /** A miss, said kindly: small nod upward + bubble. Never a shake. */
  encourage(t: JuiceTarget, sound?: FxSound | false): number;
  /** Desktop hover: a 2 px lift + a very soft hover sound (rate-limited). */
  hover(t: JuiceTarget, sound?: FxSound | false): number;
  /** Big moment: confetti from the element, sparkles, wiggle and tada (≤ 2 s, cooldown). */
  celebrate(t: JuiceTarget, opts?: { sound?: FxSound | false; count?: number }): number;
  /** Hearts floating up (Ziggy's tap, a kind word). */
  hearts(t: JuiceTarget, sound?: FxSound | false): number;
  /** Just a sound, through the same rate limits. */
  sound(name: FxSound, volume?: number): boolean;
}

export interface JuiceOptions {
  /** Reduced motion, read at each call (the hook passes its SSR-safe value). */
  isReduced?: () => boolean;
  /** Turn every sound of this juice off (e.g. a silent decorative area). */
  silent?: boolean;
}

export function createJuice(options: JuiceOptions = {}): Juice {
  const reduced = () => (options.isReduced ? options.isReduced() : false) || reducedMotionNow();
  const say = (name: FxSound | false | undefined, volume?: number) => (options.silent ? false : fxSound(name, { volume }));
  const hoverLimit = createRateLimit({ perSecond: 6, minGapMs: 120 });
  let lastCelebrate = -Infinity;

  const motion = (t: JuiceTarget, frames: string[], cap: number, easing = 'linear') => {
    if (!reduced()) playTransform(elementOf(t), frames, framesMs(frames, cap), easing);
  };

  // The boing has hand-placed keyframes (not 60 fps samples): it plays over its full time.
  const playBoing = (t: JuiceTarget) => {
    if (!reduced()) playTransform(elementOf(t), boingFrames(), JUICE_MS.boing, 'cubic-bezier(0.33, 0, 0.4, 1)');
  };
  const pressMotion = (t: JuiceTarget) => motion(t, squashStretchFrames(0.1), JUICE_MS.press);
  const hoverMotion = (t: JuiceTarget) => {
    if (!reduced()) playTransform(elementOf(t), ['translateY(0px)', 'translateY(-2px)', 'translateY(0px)'], JUICE_MS.hover, 'ease-out');
  };

  return {
    press(t, sound = 'tap') {
      say(sound);
      pressMotion(t);
      return JUICE_MS.press;
    },
    pop(t, sound = 'pop') {
      say(sound);
      motion(t, popFrames(), JUICE_MS.pop);
      return JUICE_MS.pop;
    },
    boing(t, sound = 'boing') {
      say(sound);
      playBoing(t);
      return JUICE_MS.boing;
    },
    wiggle(t, sound = 'squeak') {
      say(sound);
      motion(t, wiggleFrames(), JUICE_MS.wiggle);
      return JUICE_MS.wiggle;
    },
    sparkle(t, sound = 'sparkle') {
      say(sound);
      const at = pointOf(t);
      if (at && !reduced()) sparkleAt(at, { count: 12 });
      return JUICE_MS.sparkle;
    },
    success(t, sound = 'correct') {
      say(sound);
      motion(t, popFrames(0.12), JUICE_MS.pop);
      const at = pointOf(t);
      if (at && !reduced()) sparkleAt(at, { count: 10, kinds: ['star', 'sparkle'], colors: ['#FBBF24', '#FFE58A', '#7FC85C'] });
      return JUICE_MS.success;
    },
    encourage(t, sound = 'bubble') {
      say(sound);
      motion(t, encourageFrames(), JUICE_MS.encourage);
      return JUICE_MS.encourage;
    },
    hover(t, sound = 'hover') {
      if (!hasFinePointer() || !hoverLimit.take(now())) return 0;
      say(sound, 0.5);
      hoverMotion(t);
      return JUICE_MS.hover;
    },
    celebrate(t, opts = {}) {
      const at = pointOf(t);
      const time = now();
      const cooled = time - lastCelebrate >= CELEBRATE_COOLDOWN_MS;
      const plan = juicePlan('celebrate', { reduced: reduced(), cooledDown: cooled });
      if (!cooled) {
        say('sparkle');
        if (at && !reduced()) sparkleAt(at, { count: 8 });
        motion(t, popFrames(0.1), JUICE_MS.pop);
        return plan.duration;
      }
      lastCelebrate = time;
      say(opts.sound === undefined ? 'tada' : opts.sound);
      motion(t, wiggleFrames(6), JUICE_MS.wiggle);
      if (at && !reduced()) {
        // The glow ring is the one "flash" here: it asks the photosensitivity guard first.
        if (flashGuard.tryFlash(time)) sparkleAt(at, { count: 6, kinds: ['dot'], colors: ['#FFF4C2'], speed: 90, size: 30, life: 0.4 });
        const count = opts.count ?? 60;
        window.setTimeout(() => confettiAt(at, { count }), 60);
        window.setTimeout(() => sparkleAt(at, { count: 14 }), 120);
      }
      return plan.duration;
    },
    hearts(t, sound = 'giggle') {
      say(sound);
      const at = pointOf(t);
      if (at && !reduced()) heartsAt(at);
      return JUICE_MS.sparkle;
    },
    sound(name, volume) {
      return say(name, volume);
    },
  };
}

/** A juice for code outside React (reads reduced motion at each call). */
export const juice: Juice = createJuice();

/**
 * Tweens, timers and easing, driven by the game's own `dt` (deterministic,
 * paused with the loop). Lifted from PizzaGame's tasks/tweens and made generic.
 *
 * Animate transform and opacity only (CLAUDE.md). Reduced motion: `move`
 * tweens (position / rotation / scale) jump to their end at once, `fade`
 * tweens (opacity) stay but are shortened, so nothing pops harshly.
 */

export type Ease = (k: number) => number;

export const ease = {
  linear: (k: number) => k,
  inQuad: (k: number) => k * k,
  outQuad: (k: number) => k * (2 - k),
  inOut: (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
  outCubic: (k: number) => 1 - Math.pow(1 - k, 3),
  outBack: (k: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
  },
  /** A soft felt bounce (never a jarring shake). */
  outBounce: (k: number) => {
    const n = 7.5625;
    const d = 2.75;
    if (k < 1 / d) return n * k * k;
    if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75;
    if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375;
    return n * (k -= 2.625 / d) * k + 0.984375;
  },
  /** 0 → 1 → 0 (a hop). */
  hop: (k: number) => Math.sin(Math.PI * k),
} satisfies Record<string, Ease>;

export type TweenKind = 'move' | 'fade' | 'other';

export interface TweenOptions {
  duration: number;
  ease?: Ease;
  delay?: number;
  /** For reduced motion (default 'move'). */
  kind?: TweenKind;
  onDone?: () => void;
}

export interface TweenHandle {
  readonly id: number;
  cancel(): void;
  /** Jump to the end now (calls onDone). */
  finish(): void;
}

interface Running {
  id: number;
  t: number;
  delay: number;
  dur: number;
  ease: Ease;
  fn: (k: number) => void;
  done?: () => void;
  owner?: object;
  dead: boolean;
}

interface Timer {
  id: number;
  at: number;
  fn: () => void;
  dead: boolean;
}

type NumKeys<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T];

/** Something with x/y/z (three.js Vector3 / Euler). */
export interface XYZ {
  x: number;
  y: number;
  z: number;
}

export class Tweener {
  reducedMotion = false;
  private tweens: Running[] = [];
  private timers: Timer[] = [];
  private time = 0;
  private ids = 1;

  /** Seconds of game time elapsed. */
  get now(): number {
    return this.time;
  }

  get active(): number {
    return this.tweens.length + this.timers.length;
  }

  /** Low level: call `fn(easedK)` from 0 to 1 over `duration` seconds. */
  run(fn: (k: number) => void, opts: TweenOptions, owner?: object): TweenHandle {
    const kind = opts.kind ?? 'move';
    let dur = Math.max(0, opts.duration);
    let delay = Math.max(0, opts.delay ?? 0);
    if (this.reducedMotion) {
      if (kind === 'move') {
        dur = 0;
        delay = 0;
      } else if (kind === 'fade') dur = Math.min(dur, 0.2);
    }
    const r: Running = { id: this.ids++, t: 0, delay, dur, ease: opts.ease ?? ease.inOut, fn, done: opts.onDone, owner, dead: false };
    if (dur === 0 && delay === 0) {
      fn(r.ease(1));
      r.dead = true;
      opts.onDone?.();
    } else this.tweens.push(r);
    return this.handle(r);
  }

  /** Tween numeric properties of an object (`position`, `scale`, a material's `opacity`…). */
  to<T extends object>(target: T, props: Partial<Record<NumKeys<T>, number>>, opts: TweenOptions): TweenHandle {
    const keys = Object.keys(props) as NumKeys<T>[];
    const from = keys.map((k) => target[k] as unknown as number);
    const to = keys.map((k) => props[k] as number);
    return this.run(
      (e) => {
        for (let i = 0; i < keys.length; i++) (target as Record<NumKeys<T>, number>)[keys[i]] = from[i] + (to[i] - from[i]) * e;
      },
      opts,
      target
    );
  }

  /** Move an `{x,y,z}` (Object3D.position / scale) to a point. */
  vec(target: XYZ, to: Partial<XYZ>, opts: TweenOptions): TweenHandle {
    return this.to(target, to, opts);
  }

  /** Fade a material (or anything with `opacity`). */
  fade(target: { opacity: number }, to: number, opts: Omit<TweenOptions, 'kind'>): TweenHandle {
    return this.to(target, { opacity: to }, { ...opts, kind: 'fade' });
  }

  /** Run `fn` after `seconds` of game time. */
  after(seconds: number, fn: () => void): TweenHandle {
    const t: Timer = { id: this.ids++, at: this.time + Math.max(0, seconds), fn, dead: false };
    this.timers.push(t);
    return {
      id: t.id,
      cancel: () => (t.dead = true),
      finish: () => {
        if (t.dead) return;
        t.dead = true;
        t.fn();
      },
    };
  }

  /** Cancel every tween started with `to/vec/fade` on this target. */
  killTweensOf(target: object): void {
    for (const r of this.tweens) if (r.owner === target) r.dead = true;
  }

  update(dt: number): void {
    if (dt < 0) return;
    this.time += dt;
    // Tweens added during this update start next frame.
    const list = this.tweens;
    this.tweens = [];
    for (const r of list) {
      if (r.dead) continue;
      if (r.delay > 0) {
        r.delay -= dt;
        if (r.delay > 0) {
          this.tweens.push(r);
          continue;
        }
        r.t += -r.delay;
        r.delay = 0;
      } else r.t += dt;
      const k = r.dur <= 0 ? 1 : Math.min(1, r.t / r.dur);
      r.fn(r.ease(k));
      if (k >= 1) {
        r.dead = true;
        r.done?.();
      } else this.tweens.push(r);
    }
    const timers = this.timers;
    this.timers = [];
    // Timers fire in due-time order (then creation order): deterministic.
    timers.sort((a, b) => a.at - b.at || a.id - b.id);
    for (const t of timers) {
      if (t.dead) continue;
      if (t.at <= this.time + 1e-9) {
        t.dead = true;
        t.fn();
      } else this.timers.push(t);
    }
  }

  /** Drop everything (scene exit). */
  clear(): void {
    for (const r of this.tweens) r.dead = true;
    for (const t of this.timers) t.dead = true;
    this.tweens = [];
    this.timers = [];
  }

  private handle(r: Running): TweenHandle {
    return {
      id: r.id,
      cancel: () => (r.dead = true),
      finish: () => {
        if (r.dead) return;
        r.dead = true;
        r.fn(r.ease(1));
        r.done?.();
      },
    };
  }
}

import { FrameClock } from '../kit/clock';

/**
 * Game loop: a fixed 60 Hz simulation with an accumulator, rendering every
 * animation frame with an interpolation `alpha`, plus a discrete ticker for
 * step-by-step simulations (Lutin Factory). The maths (`FixedStepLoop`,
 * `DiscreteTicker`) is pure and deterministic; `RafDriver` plugs it into
 * `requestAnimationFrame` and pauses while the tab is hidden.
 *
 * Never uses THREE.Clock (deprecated since r183): frame deltas come from the
 * kit's `FrameClock` (or any `{ getDelta() }`, injected in tests).
 */

/** Seconds per simulation step (60 Hz). */
export const STEP = 1 / 60;
/** Spiral-of-death guard: at most this many simulation steps per frame. */
export const MAX_SUBSTEPS = 5;
/** Longest frame accepted (seconds): a tab coming back never fast-forwards the game. */
export const MAX_FRAME = 0.1;
/** Float slack so 60 frames of exactly 1/60 s give exactly 60 steps. */
const EPS = 1e-9;

export interface LoopHandlers {
  /** One simulation step of `step` seconds; `tick` counts steps since the start (0, 1, 2…). */
  fixedUpdate(step: number, tick: number): void;
  /** Once per rendered frame: visuals, rigs, tweens. `alpha` (0..1) = how far between the last two steps. */
  update(dt: number, alpha: number): void;
}

export interface LoopOptions {
  step?: number;
  maxSubSteps?: number;
  maxFrame?: number;
}

export interface FrameResult {
  /** Simulation steps run this frame. */
  steps: number;
  /** Interpolation factor for rendering. */
  alpha: number;
  /** The frame delta actually used (clamped, scaled), seconds. */
  dt: number;
}

export class FixedStepLoop {
  readonly step: number;
  readonly maxSubSteps: number;
  readonly maxFrame: number;
  /** Test hook (slow software GL playthroughs) and slow-motion: game speed multiplier. */
  timeScale = 1;
  /** When paused, `advance` runs neither steps nor updates (dialogs, hidden tab). */
  paused = false;
  private acc = 0;
  private ticks = 0;

  constructor(
    private handlers: LoopHandlers,
    opts: LoopOptions = {}
  ) {
    this.step = opts.step ?? STEP;
    this.maxSubSteps = opts.maxSubSteps ?? MAX_SUBSTEPS;
    this.maxFrame = opts.maxFrame ?? MAX_FRAME;
  }

  /** Simulation steps run since the start (the replay clock). */
  get tick(): number {
    return this.ticks;
  }

  /** Feed one frame's raw delta (seconds). Runs 0..maxSubSteps fixed steps, then one update. */
  advance(rawDt: number): FrameResult {
    if (this.paused) return { steps: 0, alpha: this.acc / this.step, dt: 0 };
    const safe = Number.isFinite(rawDt) && rawDt > 0 ? rawDt : 0;
    const dt = Math.min(safe, this.maxFrame) * Math.max(0, this.timeScale);
    this.acc += dt;
    let steps = 0;
    while (this.acc + EPS >= this.step && steps < this.maxSubSteps) {
      this.handlers.fixedUpdate(this.step, this.ticks);
      this.ticks++;
      this.acc -= this.step;
      steps++;
    }
    // Behind by more than maxSubSteps: drop the backlog instead of spiralling.
    if (this.acc >= this.step) this.acc %= this.step;
    if (this.acc < EPS) this.acc = 0;
    const alpha = Math.min(1, this.acc / this.step);
    this.handlers.update(dt, alpha);
    return { steps, alpha, dt };
  }

  /** Run exactly one simulation step now (a "step" button, tests), even when paused. */
  stepOnce(): void {
    this.handlers.fixedUpdate(this.step, this.ticks);
    this.ticks++;
    this.handlers.update(0, this.acc / this.step);
  }

  /** Forget the leftover fraction of a step (after a pause or a scene change). */
  resetAccumulator(): void {
    this.acc = 0;
  }
}

/**
 * Discrete ticks on top of the fixed steps: a simulation that advances one
 * whole tick at a time (1 tile per tick, 0.5 s at ×1, 0.25 s at ×2). Call
 * `advance(step)` from `fixedUpdate`; `stepOnce()` is the child's "step" button.
 * `progress` (0..1) is how far into the current tick we are, for smooth belts.
 */
export class DiscreteTicker {
  running = false;
  /** ×1, ×2… */
  speed = 1;
  private acc = 0;
  private count = 0;

  constructor(
    private onTick: (tick: number) => void,
    public tickSeconds = 0.5
  ) {}

  get ticks(): number {
    return this.count;
  }

  /** Fraction of the current tick elapsed (0..1), for interpolating moving items. */
  get progress(): number {
    return this.running ? Math.min(1, this.acc / this.tickSeconds) : 0;
  }

  /** Advance by `dt` seconds of simulation; returns the number of ticks fired. */
  advance(dt: number): number {
    if (!this.running) return 0;
    this.acc += dt * Math.max(0, this.speed);
    let n = 0;
    while (this.acc + EPS >= this.tickSeconds && n < 16) {
      this.acc -= this.tickSeconds;
      this.fire();
      n++;
    }
    if (this.acc < EPS) this.acc = 0;
    return n;
  }

  /** One tick right now (step button); the timer restarts from zero. */
  stepOnce(): void {
    this.acc = 0;
    this.fire();
  }

  reset(): void {
    this.acc = 0;
    this.count = 0;
    this.running = false;
  }

  private fire() {
    this.onTick(this.count);
    this.count++;
  }
}

export interface FrameSource {
  getDelta(): number;
}

/**
 * Drives a `FixedStepLoop` with `requestAnimationFrame`. Pauses while the tab
 * is hidden (no frames, no audio drift) and drops the time spent hidden.
 */
export class RafDriver {
  private raf = 0;
  private running = false;
  private hidden = false;

  constructor(
    private loop: FixedStepLoop,
    private clock: FrameSource = new FrameClock(),
    /** Called before each frame's `advance` (gamepad polling, perf probe). */
    private beforeFrame?: (rawDt: number) => void
  ) {}

  start(): void {
    if (this.running || typeof window === 'undefined') return;
    this.running = true;
    this.hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    document.addEventListener('visibilitychange', this.onVisibility);
    this.clock.getDelta();
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
  }

  get isHidden(): boolean {
    return this.hidden;
  }

  private schedule() {
    if (this.running && !this.hidden && !this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = () => {
    this.raf = 0;
    if (!this.running || this.hidden) return;
    const dt = this.clock.getDelta();
    this.beforeFrame?.(dt);
    this.loop.advance(dt);
    this.schedule();
  };

  private onVisibility = () => {
    this.hidden = document.visibilityState === 'hidden';
    if (this.hidden) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else {
      // Drop the hidden time: the game resumes where the child left it.
      this.clock.getDelta();
      this.loop.resetAccumulator();
      this.schedule();
    }
  };
}

import type { InputEvent } from './input/actions';

/**
 * Game scenes and the scene stack (house map → room → album…).
 *
 * Lifecycle of a scene: `load` (async: build meshes, preload) → `enter` →
 * `fixedUpdate` / `update` / `command` / `input` while on top → `pause` when
 * another scene is pushed over it, `resume` when it comes back (re-register
 * hotspots there: the host clears them before each `enter` / `resume`) → `exit` →
 * `dispose`. Only the top scene updates, receives input and is rendered.
 *
 * Operations are serialised: a `push` during another scene's `load` waits
 * its turn, so lifecycles never interleave. A scene whose `load` throws is
 * disposed and the stack is left as it was.
 *
 * Framework-agnostic: the stack only needs a `render(scene, camera)` renderer
 * (three's WebGLRenderer, or a mock in tests).
 */

export interface RendererLike<S = unknown, C = unknown> {
  render(scene: S, camera: C): void;
}

export interface SceneView<S = unknown, C = unknown> {
  scene: S;
  camera: C;
}

export interface GameScene<Ctx = unknown, Cmd = unknown> {
  /** Debug name. */
  readonly id: string;
  /** What the host renders while this scene is on top (three Scene + camera). */
  view?: SceneView;
  load?(ctx: Ctx): Promise<void> | void;
  enter(ctx: Ctx): void;
  /** Simulation step (pure state). */
  fixedUpdate?(step: number, tick: number): void;
  /** Visuals, rigs, tweens, camera. */
  update?(dt: number, alpha: number): void;
  /** A command from React. */
  command?(c: Cmd): void;
  /** A semantic input action. */
  input?(e: InputEvent): void;
  /** Canvas size changed (CSS pixels). */
  resize?(w: number, h: number): void;
  /** Custom rendering (post-processing); default = `renderer.render(view.scene, view.camera)`. */
  render?(renderer: RendererLike): void;
  /** Covered by a pushed scene. */
  pause?(): void;
  /** Back on top. */
  resume?(): void;
  exit?(): void;
  dispose?(): void;
}

export interface SceneStackOptions<Ctx> {
  ctx: Ctx;
  /** Soft fade around a swap (the host's overlay): 'out' before, 'in' after. */
  transition?: (phase: 'out' | 'in') => Promise<void> | void;
  /** Extra cleanup after `scene.dispose()` (the host disposes the three.js tree). */
  disposeView?: (scene: GameScene<Ctx>) => void;
  /** Right before a scene becomes active (enter or resume): reset per-scene state such as hotspots. */
  beforeActivate?: (scene: GameScene<Ctx>) => void;
  /** The top scene changed. */
  onChange?: (top: GameScene<Ctx> | null) => void;
}

export class SceneStack<Ctx = unknown, Cmd = unknown> {
  private stack: GameScene<Ctx, Cmd>[] = [];
  private chain: Promise<void> = Promise.resolve();
  private disposed = false;
  private size = { w: 0, h: 0 };

  constructor(private opts: SceneStackOptions<Ctx>) {}

  get top(): GameScene<Ctx, Cmd> | null {
    return this.stack.at(-1) ?? null;
  }

  get depth(): number {
    return this.stack.length;
  }

  /** Scene ids, bottom first (tests, debug). */
  get ids(): string[] {
    return this.stack.map((s) => s.id);
  }

  /** Load a scene and put it on top (the previous one pauses). */
  push(scene: GameScene<Ctx, Cmd>): Promise<void> {
    return this.enqueue(async () => {
      await this.load(scene);
      await this.opts.transition?.('out');
      this.top?.pause?.();
      this.stack.push(scene);
      this.enterTop(scene);
      await this.opts.transition?.('in');
    });
  }

  /** Remove the top scene (exit + dispose); the one below resumes. */
  pop(): Promise<void> {
    return this.enqueue(async () => {
      const top = this.top;
      if (!top) return;
      await this.opts.transition?.('out');
      this.stack.pop();
      this.close(top);
      const below = this.top;
      if (below) {
        this.opts.beforeActivate?.(below as GameScene<Ctx>);
        below.resume?.();
      }
      this.changed();
      await this.opts.transition?.('in');
    });
  }

  /** Swap the top scene for another (the new one is loaded first, so the old one stays visible meanwhile). */
  replace(scene: GameScene<Ctx, Cmd>): Promise<void> {
    return this.enqueue(async () => {
      await this.load(scene);
      await this.opts.transition?.('out');
      const old = this.stack.pop();
      if (old) this.close(old);
      this.stack.push(scene);
      this.enterTop(scene);
      await this.opts.transition?.('in');
    });
  }

  /** Close every scene, top first. */
  clear(): Promise<void> {
    return this.enqueue(async () => this.closeAll());
  }

  /** Resolves once every queued operation is done. */
  idle(): Promise<void> {
    return this.chain;
  }

  fixedUpdate(step: number, tick: number): void {
    this.top?.fixedUpdate?.(step, tick);
  }

  update(dt: number, alpha: number): void {
    this.top?.update?.(dt, alpha);
  }

  command(c: Cmd): void {
    this.top?.command?.(c);
  }

  input(e: InputEvent): void {
    this.top?.input?.(e);
  }

  resize(w: number, h: number): void {
    this.size = { w, h };
    for (const s of this.stack) s.resize?.(w, h);
  }

  render(renderer: RendererLike): void {
    const top = this.top;
    if (!top) return;
    if (top.render) top.render(renderer);
    else if (top.view) renderer.render(top.view.scene, top.view.camera);
  }

  /** Synchronous teardown (host dispose): closes every scene now and refuses new work. */
  dispose(): void {
    this.disposed = true;
    this.closeAll();
  }

  private enqueue(op: () => Promise<void>): Promise<void> {
    const run = this.chain.then(() => (this.disposed ? undefined : op()));
    // Keep the chain alive after a failure; the caller still sees the rejection.
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async load(scene: GameScene<Ctx, Cmd>) {
    try {
      await scene.load?.(this.opts.ctx);
    } catch (err) {
      this.safeDispose(scene);
      throw err;
    }
    if (this.disposed) {
      this.safeDispose(scene);
      throw new Error('scene stack disposed during load');
    }
  }

  private enterTop(scene: GameScene<Ctx, Cmd>) {
    if (this.size.w > 0) scene.resize?.(this.size.w, this.size.h);
    this.opts.beforeActivate?.(scene as GameScene<Ctx>);
    scene.enter(this.opts.ctx);
    this.changed();
  }

  private close(scene: GameScene<Ctx, Cmd>) {
    try {
      scene.exit?.();
    } finally {
      this.safeDispose(scene);
    }
  }

  private safeDispose(scene: GameScene<Ctx, Cmd>) {
    try {
      scene.dispose?.();
    } catch (err) {
      console.error('[engine/scene] dispose', scene.id, err);
    }
    try {
      this.opts.disposeView?.(scene as GameScene<Ctx>);
    } catch (err) {
      console.error('[engine/scene] disposeView', scene.id, err);
    }
  }

  private closeAll() {
    while (this.stack.length) this.close(this.stack.pop()!);
    this.changed();
  }

  private changed() {
    this.opts.onChange?.((this.top as GameScene<Ctx>) ?? null);
  }
}

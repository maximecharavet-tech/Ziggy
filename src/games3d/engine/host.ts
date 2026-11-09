import * as THREE from 'three';
import { createRenderer, disposeTree, prefersLowPower, studioEnvironment } from '../kit/look';
import { Post } from '../kit/post';
import type { L } from '@/lib/i18n-text';
import { EngineAudio, kitBackend, type SfxBackend } from './audio';
import { Emitter, GameBus, type EventMap } from './events';
import type { InputEvent } from './input/actions';
import { InputRouter } from './input/index';
import type { KeyMap } from './input/keyboard';
import { FixedStepLoop, RafDriver } from './loop';
import { AdaptiveResolution } from './perf';
import { ActionQueue, ReplayRecorder } from './replay';
import { SceneStack, type GameScene, type RendererLike } from './scene';
import { Tweener } from './tween';

/**
 * GameHost: mounts a game into a canvas and owns everything every game used
 * to re-implement (see PizzaGame): the renderer (kit `createRenderer`), bloom
 * only on capable devices (kit `Post`, never when `prefersLowPower()`),
 * resize (ResizeObserver), adaptive resolution, WebGL-lost handling, the
 * fixed-step loop (paused on hidden tabs), input + DOM hotspots, tweens,
 * audio, the scene stack, and a full `dispose()`.
 *
 * Client-only: create it from a lazy `import()` inside a 'use client'
 * player (or the generic `<GameHost>` React wrapper). Nothing here touches
 * `window` at module top level.
 *
 * Scenes receive the host itself as their context (`GameScene<GameHost>`).
 */

export interface GameHostOptions {
  canvas: HTMLCanvasElement;
  /** Positioned box holding the canvas; the hotspot layer and the fade overlay go in it. Observed for size. */
  container: HTMLElement;
  locale: string;
  reducedMotion?: boolean;
  /** Default: kit `prefersLowPower()` (≤ 4 cores or reduced motion). */
  lowPower?: boolean;
  /** Bloom on capable devices (default true; always off on the low-power tier). */
  bloom?: boolean;
  keymap?: KeyMap;
  /** Accessible name of the hotspot group ("Objets de la pièce"). */
  hotspotLabel?: L;
  /** Drags pan the camera (default true). */
  pan?: boolean;
  /** Sound backend (default: the kit's GameAudio); false = silent. */
  audio?: SfxBackend<string> | false;
  /** Lower the resolution on slow devices (default true). */
  adaptive?: boolean;
  /** Fade colour between scenes (default warm cream). */
  fadeColor?: string;
  /** Inject a renderer (tests); default kit `createRenderer`. */
  renderer?: THREE.WebGLRenderer;
  /** Test builds only: expose the host on `window[exposeAs]` (state injection for Playwright). */
  exposeAs?: string;
}

/** Host-level signals (independent of the game's own events). */
export type HostSignals = {
  scene: { id: string | null };
  webgl: 'lost' | 'restored';
  error: { where: string; error: unknown };
};

export type HostScene<Evt extends EventMap = EventMap, Cmd extends EventMap = EventMap> = GameScene<GameHost<Evt, Cmd>, CommandOf<Cmd>>;

/** A command object: `{ type: 'pause' }`, `{ type: 'music', on: true }`. */
export type CommandOf<Cmd extends EventMap> = { [K in keyof Cmd]: { type: K } & (Cmd[K] extends object ? Cmd[K] : unknown) }[keyof Cmd];

export class GameHost<Evt extends EventMap = EventMap, Cmd extends EventMap = EventMap> {
  readonly renderer: THREE.WebGLRenderer;
  readonly bus = new GameBus<Evt, Cmd>();
  readonly signals = new Emitter<HostSignals>();
  readonly input: InputRouter;
  readonly tween = new Tweener();
  readonly audio: EngineAudio<string> | null;
  readonly loop: FixedStepLoop;
  readonly stack: SceneStack<GameHost<Evt, Cmd>, CommandOf<Cmd>>;
  readonly actions = new ActionQueue<InputEvent>();
  readonly lowPower: boolean;
  locale: string;
  /** Canvas size in CSS pixels. */
  readonly size = { w: 1, h: 1 };
  private driver: RafDriver;
  private post: Post | null = null;
  private bloom: boolean;
  private adaptive: AdaptiveResolution | null;
  private resizeObs: ResizeObserver | null = null;
  private fade: HTMLDivElement;
  private reduce: boolean;
  private cleanups: (() => void)[] = [];
  private userPaused = false;
  private lost = false;
  private disposed = false;
  private recorder: ReplayRecorder<InputEvent> | null = null;

  constructor(private opts: GameHostOptions) {
    this.locale = opts.locale;
    this.reduce = Boolean(opts.reducedMotion);
    this.lowPower = opts.lowPower ?? prefersLowPower();
    this.bloom = (opts.bloom ?? true) && !this.lowPower;
    this.renderer = opts.renderer ?? createRenderer(opts.canvas, { lowPower: this.lowPower });
    this.adaptive = opts.adaptive === false ? null : new AdaptiveResolution(this.renderer.getPixelRatio());
    this.tween.reducedMotion = this.reduce;

    if (getComputedStyle(opts.container).position === 'static') opts.container.style.position = 'relative';
    this.input = new InputRouter({ canvas: opts.canvas, overlay: opts.container, locale: opts.locale, keymap: opts.keymap, pan: opts.pan, hotspots: { label: opts.hotspotLabel } });
    this.input.on((e) => this.actions.push(e));
    this.audio = opts.audio === false ? null : new EngineAudio<string>((opts.audio ?? kitBackend()) as SfxBackend<string>);

    this.fade = document.createElement('div');
    this.fade.setAttribute('aria-hidden', 'true');
    Object.assign(this.fade.style, { position: 'absolute', inset: '0', pointerEvents: 'none', background: opts.fadeColor ?? '#fff6e6', opacity: '0', transition: 'opacity 220ms ease' });
    opts.container.appendChild(this.fade);

    this.stack = new SceneStack<GameHost<Evt, Cmd>, CommandOf<Cmd>>({
      ctx: this,
      transition: (phase) => this.transition(phase),
      disposeView: (s) => {
        if (s.view?.scene instanceof THREE.Object3D) disposeTree(s.view.scene);
      },
      beforeActivate: () => this.input.hotspots.set([]),
      onChange: (top) => this.onTopChange(top),
    });

    this.loop = new FixedStepLoop({
      fixedUpdate: (step, tick) => {
        this.actions.drain(tick, (e) => this.stack.input(e));
        this.stack.fixedUpdate(step, tick);
      },
      update: (dt, alpha) => this.frame(dt, alpha),
    });
    this.driver = new RafDriver(this.loop, undefined, (raw) => {
      this.input.poll();
      this.adapt(raw);
    });

    opts.canvas.addEventListener('webglcontextlost', this.onLost);
    opts.canvas.addEventListener('webglcontextrestored', this.onRestored);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(() => this.fit());
      this.resizeObs.observe(opts.container);
    }
    this.fit();
    if (opts.exposeAs) (window as unknown as Record<string, unknown>)[opts.exposeAs] = this;
  }

  // --- scenes -------------------------------------------------------------

  push(scene: HostScene<Evt, Cmd>): Promise<void> {
    return this.stack.push(scene).catch((error) => this.fail('push', error));
  }

  replace(scene: HostScene<Evt, Cmd>): Promise<void> {
    return this.stack.replace(scene).catch((error) => this.fail('replace', error));
  }

  pop(): Promise<void> {
    return this.stack.pop().catch((error) => this.fail('pop', error));
  }

  // --- running ------------------------------------------------------------

  start(): void {
    if (this.disposed) return;
    this.driver.start();
  }

  /** Pause the game (dialog / pause menu). Rendering stops; audio is suspended. */
  pause(): void {
    this.userPaused = true;
    // Taps made while paused are dropped, never replayed later.
    this.actions.clear();
    this.syncPaused();
  }

  resume(): void {
    this.userPaused = false;
    this.syncPaused();
  }

  get paused(): boolean {
    return this.loop.paused;
  }

  /** Test hook (slow software GL playthroughs). */
  set timeScale(v: number) {
    this.loop.timeScale = v;
  }

  get timeScale(): number {
    return this.loop.timeScale;
  }

  get reducedMotion(): boolean {
    return this.reduce;
  }

  setReducedMotion(on: boolean): void {
    this.reduce = on;
    this.tween.reducedMotion = on;
    this.fade.style.transition = on ? 'none' : 'opacity 220ms ease';
  }

  setLocale(locale: string): void {
    this.locale = locale;
    this.input.setLocale(locale);
  }

  // --- messages -----------------------------------------------------------

  /** Game → React. */
  emit<K extends keyof Evt>(name: K, payload: Evt[K]): void {
    (this.bus.events.emit as (n: K, p: Evt[K]) => void)(name, payload);
  }

  /** React → game: notifies `bus.commands` listeners, then the top scene. */
  command(c: CommandOf<Cmd>): void {
    const { type, ...rest } = c as { type: keyof Cmd } & Record<string, unknown>;
    (this.bus.commands.emit as (n: keyof Cmd, p: unknown) => void)(type, Object.keys(rest).length ? rest : undefined);
    if (type === 'pause') this.pause();
    if (type === 'resume') this.resume();
    if (type === 'music') this.audio?.music(Boolean((rest as { on?: boolean }).on));
    this.stack.command(c);
  }

  // --- helpers for scenes ---------------------------------------------------

  /** Studio reflections on a felt plush (kit `studioEnvironment`); disposed with the host. */
  studio(target: THREE.Object3D, intensity = 0.5): () => void {
    const off = studioEnvironment(this.renderer, target, intensity);
    this.cleanups.push(off);
    return off;
  }

  /** Register cleanup to run on dispose. */
  onDispose(fn: () => void): void {
    this.cleanups.push(fn);
  }

  /** Start recording a replay (seed given by the game). */
  record(game: string, seed: number, band?: string): ReplayRecorder<InputEvent> {
    this.recorder = new ReplayRecorder<InputEvent>(game, seed, band);
    this.actions.record(this.recorder);
    return this.recorder;
  }

  /** Stop recording; returns the replay so far. */
  stopRecording() {
    const r = this.recorder?.finish(this.loop.tick) ?? null;
    this.actions.record(null);
    this.recorder = null;
    return r;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.driver.stop();
    this.stack.dispose();
    this.post?.dispose();
    this.post = null;
    for (const fn of this.cleanups.splice(0)) {
      try {
        fn();
      } catch (error) {
        console.error('[engine/host] cleanup', error);
      }
    }
    this.input.dispose();
    this.audio?.dispose();
    this.tween.clear();
    this.resizeObs?.disconnect();
    this.opts.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.opts.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.fade.remove();
    this.bus.dispose();
    this.signals.clear();
    this.renderer.dispose();
    if (this.opts.exposeAs) delete (window as unknown as Record<string, unknown>)[this.opts.exposeAs];
  }

  // --- internals ------------------------------------------------------------

  private frame(dt: number, alpha: number) {
    this.tween.update(dt);
    this.stack.update(dt, alpha);
    const cam = this.stack.top?.view?.camera;
    if (cam instanceof THREE.Camera) {
      cam.updateMatrixWorld();
      this.input.hotspots.update(cam, this.size);
    }
    this.render(dt);
  }

  private render(dt: number) {
    if (this.lost) return;
    const top = this.stack.top;
    if (!top) return;
    if (!top.render && this.post) this.post.render(dt);
    else this.stack.render(this.renderer as unknown as RendererLike);
  }

  private fit() {
    const r = this.opts.container.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    this.size.w = w;
    this.size.h = h;
    this.renderer.setSize(w, h, false);
    this.post?.setSize(w, h);
    const cam = this.stack.top?.view?.camera;
    if (cam instanceof THREE.PerspectiveCamera) {
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
    this.stack.resize(w, h);
    // Resizing clears the canvas: draw at once.
    if (this.stack.top) this.render(0);
  }

  private adapt(raw: number) {
    const ratio = this.adaptive?.sample(raw);
    if (ratio == null) return;
    this.renderer.setPixelRatio(ratio);
    this.fit();
  }

  private onTopChange(top: GameScene<GameHost<Evt, Cmd>> | null) {
    this.post?.dispose();
    this.post = null;
    if (!top) this.input.hotspots.set([]);
    const v = top?.view;
    if (this.bloom && v && v.scene instanceof THREE.Scene && v.camera instanceof THREE.Camera) {
      this.post = new Post(this.renderer, v.scene, v.camera, { enabled: true });
      this.post.setSize(this.size.w, this.size.h);
    }
    if (v?.camera instanceof THREE.PerspectiveCamera) {
      v.camera.aspect = this.size.w / this.size.h;
      v.camera.updateProjectionMatrix();
    }
    this.loop.resetAccumulator();
    this.signals.emit('scene', { id: top?.id ?? null });
  }

  private async transition(phase: 'out' | 'in') {
    // First scene, reduced motion or nothing on screen yet: a plain cut.
    if (this.reduce || (phase === 'out' && !this.stack.top)) {
      this.fade.style.opacity = '0';
      return;
    }
    this.fade.style.opacity = phase === 'out' ? '1' : '0';
    if (phase === 'out') await new Promise((r) => setTimeout(r, 230));
  }

  private syncPaused() {
    const p = this.userPaused || this.lost;
    this.loop.paused = p;
    this.audio?.suspend(p || document.visibilityState === 'hidden');
    if (!p) {
      this.loop.resetAccumulator();
      this.adaptive?.reset();
    }
  }

  private fail(where: string, error: unknown) {
    console.error(`[engine/host] ${where}`, error);
    this.signals.emit('error', { where, error });
  }

  private onVisibility = () => {
    this.audio?.suspend(document.visibilityState === 'hidden' || this.loop.paused);
    this.adaptive?.reset();
  };

  private onLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    this.syncPaused();
    this.signals.emit('webgl', 'lost');
  };

  private onRestored = () => {
    this.lost = false;
    this.syncPaused();
    this.signals.emit('webgl', 'restored');
  };
}

/** A game module: what a lazy `import()` of a game returns to `<GameHost>`. */
export interface GameDefinition<Evt extends EventMap = EventMap, Cmd extends EventMap = EventMap> {
  id: string;
  /** Push the first scene(s). The host is already sized; it starts right after. */
  start(host: GameHost<Evt, Cmd>): Promise<void> | void;
}

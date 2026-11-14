import { Emitter } from '../events';
import type { Action, InputEvent, InputSource } from './actions';
import { GamepadInput } from './gamepad';
import { HotspotLayer, type HotspotLayerOptions } from './hotspots';
import { KeyboardInput, createKeyMap, type KeyMap } from './keyboard';
import { PointerInput } from './pointer';

export * from './actions';
export * from './hotspot-rects';
export { HotspotLayer, type HotspotDef, type CameraLike, type Vec3Like } from './hotspots';
export { KeyboardInput, DEFAULT_KEYMAP, createKeyMap, keyToAction, type KeyMap, type KeyLike } from './keyboard';
export { PointerInput, isTap, toNdc, TAP_SLOP_PX, TAP_MAX_MS } from './pointer';
export { GamepadInput, gamepadActions, snapshot, type PadSnapshot } from './gamepad';

export interface InputRouterOptions {
  /** The canvas (pointer taps and drags). */
  canvas: HTMLElement;
  /** Element the hotspot buttons are laid over (same box as the canvas). */
  overlay: HTMLElement;
  locale: string;
  keymap?: KeyMap;
  pick?: (ndc: { x: number; y: number }) => string | null;
  hotspots?: Pick<HotspotLayerOptions, 'minSize' | 'label'>;
  /** Drags pan the camera (default true). */
  pan?: boolean;
}

/**
 * Every device → one stream of `InputEvent`s (`router.on('input', …)`).
 * Focus moves without a target (D-pad, gamepad, arrows on the canvas) are
 * applied to the hotspot layer first, then re-emitted with the landed id.
 */
export class InputRouter {
  readonly bus = new Emitter<{ input: InputEvent }>();
  readonly hotspots: HotspotLayer;
  private keyboard: KeyboardInput;
  private pointer: PointerInput;
  private gamepad: GamepadInput;
  /** When false, nothing is emitted (dialogs, cutscenes). */
  enabled = true;

  constructor(opts: InputRouterOptions) {
    this.hotspots = new HotspotLayer(opts.overlay, {
      locale: opts.locale,
      minSize: opts.hotspots?.minSize,
      label: opts.hotspots?.label,
      onSelect: (id, source) => this.push({ type: 'select', target: id }, source),
      onFocus: (id) => this.push({ type: 'focus', target: id }, 'hotspot'),
    });
    this.keyboard = new KeyboardInput((e) => this.route(e), opts.keymap ?? createKeyMap(), () => this.hotspots.root);
    this.pointer = new PointerInput(opts.canvas, (e) => this.route(e), opts.pick, opts.pan ?? true);
    this.gamepad = new GamepadInput((e) => this.route(e));
  }

  on(fn: (e: InputEvent) => void): () => void {
    return this.bus.on('input', fn);
  }

  /** Inject an action (HUD buttons, tests, replays). */
  push(action: Action, source: InputSource = 'ui'): void {
    if (!this.enabled) return;
    this.bus.emit('input', { action, source });
  }

  setKeyMap(map: KeyMap): void {
    this.keyboard.setMap(map);
  }

  setPick(pick: (ndc: { x: number; y: number }) => string | null): void {
    this.pointer.setPick(pick);
  }

  setLocale(locale: string): void {
    this.hotspots.setLocale(locale);
  }

  /** Once per frame (the host calls it). */
  poll(): void {
    this.gamepad.poll();
  }

  dispose(): void {
    this.keyboard.dispose();
    this.pointer.dispose();
    this.gamepad.dispose();
    this.hotspots.dispose();
    this.bus.clear();
  }

  private route(e: InputEvent) {
    const a = e.action;
    // A D-pad / arrow focus move lands on a hotspot button; the focusin event reports it.
    if (a.type === 'focus' && a.dir && a.target === undefined) {
      this.hotspots.moveFocus(a.dir);
      return;
    }
    // Enter/Space/A with no focused hotspot: select the focused one if any.
    if (a.type === 'select' && a.target === null && !a.ndc) {
      this.push({ type: 'select', target: this.hotspots.focusedId() }, e.source);
      return;
    }
    this.push(a, e.source);
  }
}

import { tr, type L } from '@/lib/i18n-text';
import { nextFocus, type Box } from '@/lib/tv/spatial-nav';
import type { Dir, InputSource } from './actions';
import { layoutHotspots, multiplyMat4, projectBox, type LaidOut, type Rect, type Vec3Tuple, type Viewport } from './hotspot-rects';

/**
 * Hotspots ⇄ DOM proxy buttons, the key accessibility decision of the
 * engine: every tappable 3D thing registers a hotspot, and each frame the
 * layer positions a real, transparent `<button>` over it on the canvas.
 *
 * - Hit area ≥ 64 px even when the object is tiny; targets never overlap.
 * - `aria-label` in FR/EN (`tr`), so screen readers read the object.
 * - Focusable: Tab, the TV remote (the site's spatial navigation sees normal
 *   buttons) and switch scanning ("cycle the buttons") all work natively.
 *   DOM order = scan order (`order`, then registration order).
 * - Outside TV mode, the arrow keys move the focus between hotspots with the
 *   same algorithm as the TV remote (`nextFocus`).
 * - Hotspots off screen or behind the camera are hidden (not focusable).
 * - Styles are only written when a rect moves by more than half a pixel.
 */

export type Vec3Like = Vec3Tuple | { x: number; y: number; z: number };

export interface HotspotDef {
  id: string;
  label: L;
  /** World position of the box centre. A live object (THREE.Vector3) is read every frame. */
  at: Vec3Like;
  /** Box size in world units (full extents), or one number for a cube. Default 0.5. */
  size?: Vec3Like | number;
  /** Switch-scan / Tab order (lower first). */
  order?: number;
  disabled?: boolean;
  /** Extra attributes on the button (`data-tv-autofocus`, `data-testid`…). */
  attrs?: Record<string, string>;
}

/** What the layer needs from a camera (three.js cameras match it). */
export interface CameraLike {
  projectionMatrix: { elements: ArrayLike<number> };
  matrixWorldInverse: { elements: ArrayLike<number> };
}

export interface HotspotLayerOptions {
  locale: string;
  onSelect: (id: string, source: InputSource) => void;
  onFocus?: (id: string | null) => void;
  minSize?: number;
  /** Accessible name of the whole layer. */
  label?: L;
}

const STYLE_ID = 'zg-hotspot-style';
const CSS = `.zg-hotspots{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.zg-hotspot{position:absolute;left:0;top:0;margin:0;padding:0;border:0;background:transparent;border-radius:18px;pointer-events:auto;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;will-change:transform}
.zg-hotspot[hidden]{display:none}
.zg-hotspot:focus{outline:none}
.zg-hotspot:focus-visible,.zg-hotspot[data-scan]{outline:4px solid #ffd54a;outline-offset:2px;box-shadow:0 0 0 8px rgba(255,213,74,.35)}
@media (prefers-reduced-motion:no-preference){.zg-hotspot:focus-visible{transition:box-shadow .2s}}`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

const vx = (v: Vec3Like) => ('x' in v ? v.x : v[0]);
const vy = (v: Vec3Like) => ('y' in v ? v.y : v[1]);
const vz = (v: Vec3Like) => ('z' in v ? v.z : v[2]);

interface Entry {
  def: HotspotDef;
  el: HTMLButtonElement;
  last: Rect & { visible: boolean };
  seq: number;
}

export class HotspotLayer {
  readonly root: HTMLDivElement;
  private entries = new Map<string, Entry>();
  private ordered: Entry[] = [];
  private seq = 0;
  private vp: Viewport = { w: 1, h: 1 };
  private m = new Float64Array(16);
  private scanTimer = 0;
  private laid: LaidOut[] = [];

  constructor(
    container: HTMLElement,
    private opts: HotspotLayerOptions
  ) {
    ensureStyle();
    this.root = document.createElement('div');
    this.root.className = 'zg-hotspots';
    this.root.setAttribute('role', 'group');
    this.root.dataset.engineHotspots = '';
    if (opts.label) this.root.setAttribute('aria-label', tr(opts.label, opts.locale));
    container.appendChild(this.root);
    this.root.addEventListener('click', this.onClick);
    this.root.addEventListener('keydown', this.onKey);
    this.root.addEventListener('focusin', this.onFocusIn);
    this.root.addEventListener('focusout', this.onFocusOut);
  }

  setLocale(locale: string): void {
    this.opts.locale = locale;
    if (this.opts.label) this.root.setAttribute('aria-label', tr(this.opts.label, locale));
    for (const e of this.entries.values()) e.el.setAttribute('aria-label', tr(e.def.label, locale));
  }

  /** Replace the whole set (a new room / step). Existing ids keep their button (and focus). */
  set(defs: readonly HotspotDef[]): void {
    const keep = new Set(defs.map((d) => d.id));
    for (const [id, e] of this.entries)
      if (!keep.has(id)) {
        e.el.remove();
        this.entries.delete(id);
      }
    for (const d of defs) this.upsert(d, false);
    this.reorder();
  }

  /** Add or update one hotspot. */
  upsert(def: HotspotDef, reorder = true): void {
    let e = this.entries.get(def.id);
    if (!e) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'zg-hotspot';
      el.dataset.hotspot = def.id;
      el.hidden = true;
      e = { def, el, last: { x: 0, y: 0, w: 0, h: 0, visible: false }, seq: this.seq++ };
      this.entries.set(def.id, e);
    }
    e.def = def;
    e.el.setAttribute('aria-label', tr(def.label, this.opts.locale));
    e.el.disabled = Boolean(def.disabled);
    for (const [k, v] of Object.entries(def.attrs ?? {})) e.el.setAttribute(k, v);
    if (reorder) this.reorder();
  }

  remove(id: string): void {
    const e = this.entries.get(id);
    if (!e) return;
    e.el.remove();
    this.entries.delete(id);
    this.reorder();
  }

  /** Reposition every button for this camera and viewport (call once per frame, after the camera moved). */
  update(camera: CameraLike, vp: Viewport): void {
    this.vp = vp;
    multiplyMat4(camera.projectionMatrix.elements, camera.matrixWorldInverse.elements, this.m);
    const items = this.ordered.map((e) => {
      const s = e.def.size ?? 0.5;
      const half: Vec3Tuple = typeof s === 'number' ? [s / 2, s / 2, s / 2] : [vx(s) / 2, vy(s) / 2, vz(s) / 2];
      const at = e.def.at;
      return { id: e.def.id, rect: projectBox(this.m, [vx(at), vy(at), vz(at)], half, vp) };
    });
    this.laid = layoutHotspots(items, vp, { minSize: this.opts.minSize });
    for (let i = 0; i < this.ordered.length; i++) this.apply(this.ordered[i], this.laid[i]);
  }

  /** The last laid-out rects (tests, debug overlay). */
  rects(): readonly LaidOut[] {
    return this.laid;
  }

  /** Focus a hotspot by id. */
  focus(id: string): void {
    const e = this.entries.get(id);
    if (e && !e.el.hidden && !e.el.disabled) e.el.focus({ preventScroll: true });
  }

  focusedId(): string | null {
    const a = document.activeElement as HTMLElement | null;
    return a && this.root.contains(a) ? (a.dataset.hotspot ?? null) : null;
  }

  /** Move the focus like the TV remote (D-pad / gamepad / arrows). Focuses the first one when none is focused. */
  moveFocus(dir: Dir): string | null {
    const usable = this.ordered.filter((e) => !e.el.hidden && !e.el.disabled);
    if (!usable.length) return null;
    const cur = usable.findIndex((e) => e.def.id === this.focusedId());
    if (cur < 0) {
      usable[0].el.focus({ preventScroll: true });
      return usable[0].def.id;
    }
    const boxes: Box[] = usable.map((e) => ({ x: e.last.x, y: e.last.y, w: e.last.w, h: e.last.h }));
    const next = nextFocus(boxes, new Array(boxes.length).fill(0), cur, dir);
    if (next < 0) return usable[cur].def.id;
    usable[next].el.focus({ preventScroll: true });
    return usable[next].def.id;
  }

  /** Switch access: auto-scan the hotspots in order; one switch press (Enter/Space) selects. */
  startScan(intervalMs = 1500): void {
    this.stopScan();
    let i = -1;
    const tick = () => {
      const usable = this.ordered.filter((e) => !e.el.hidden && !e.el.disabled);
      for (const e of this.ordered) delete e.el.dataset.scan;
      if (!usable.length) return;
      i = (i + 1) % usable.length;
      usable[i].el.dataset.scan = '';
      usable[i].el.focus({ preventScroll: true });
    };
    tick();
    this.scanTimer = window.setInterval(tick, Math.max(500, intervalMs));
  }

  stopScan(): void {
    if (this.scanTimer) window.clearInterval(this.scanTimer);
    this.scanTimer = 0;
    for (const e of this.ordered) delete e.el.dataset.scan;
  }

  dispose(): void {
    this.stopScan();
    this.root.removeEventListener('click', this.onClick);
    this.root.removeEventListener('keydown', this.onKey);
    this.root.removeEventListener('focusin', this.onFocusIn);
    this.root.removeEventListener('focusout', this.onFocusOut);
    this.root.remove();
    this.entries.clear();
    this.ordered = [];
  }

  private reorder() {
    this.ordered = [...this.entries.values()].sort((a, b) => (a.def.order ?? 0) - (b.def.order ?? 0) || a.seq - b.seq);
    // DOM order = Tab / screen-reader / scan order. Only move nodes that are out of place (keeps focus).
    let prev: Element | null = null;
    for (const e of this.ordered) {
      const want: Element | null = prev ? prev.nextElementSibling : this.root.firstElementChild;
      if (want !== e.el) this.root.insertBefore(e.el, want);
      prev = e.el;
    }
  }

  private apply(e: Entry, l: LaidOut) {
    const last = e.last;
    if (!l.visible) {
      if (last.visible) {
        if (document.activeElement === e.el) e.el.blur();
        e.el.hidden = true;
        last.visible = false;
      }
      return;
    }
    const r = l.rect;
    if (!last.visible) e.el.hidden = false;
    // Whole pixels: positions rounded, sizes rounded up (a 63.99 px box is not a 64 px target).
    if (!last.visible || Math.abs(r.x - last.x) > 0.5 || Math.abs(r.y - last.y) > 0.5) e.el.style.transform = `translate(${Math.round(r.x)}px,${Math.round(r.y)}px)`;
    if (!last.visible || Math.abs(r.w - last.w) > 0.5 || Math.abs(r.h - last.h) > 0.5) {
      e.el.style.width = `${Math.ceil(r.w)}px`;
      e.el.style.height = `${Math.ceil(r.h)}px`;
    }
    e.last = { ...r, visible: true };
  }

  private idOf(t: EventTarget | null): string | null {
    const el = (t as HTMLElement | null)?.closest?.<HTMLElement>('[data-hotspot]');
    return el && this.root.contains(el) ? (el.dataset.hotspot ?? null) : null;
  }

  private onClick = (ev: MouseEvent) => {
    const id = this.idOf(ev.target);
    if (!id) return;
    const e = this.entries.get(id);
    if (!e || e.def.disabled) return;
    // A native button click: pointer tap, Enter/Space, TV OK or a switch press while scanning.
    this.opts.onSelect(id, this.scanTimer ? 'scan' : 'hotspot');
  };

  private onKey = (ev: KeyboardEvent) => {
    const dirs: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const dir = dirs[ev.key];
    // TV mode: the site's spatial navigation already moves the focus.
    if (!dir || document.documentElement.hasAttribute('data-tv')) return;
    ev.preventDefault();
    this.moveFocus(dir);
  };

  private onFocusIn = (ev: FocusEvent) => this.opts.onFocus?.(this.idOf(ev.target));

  private onFocusOut = (ev: FocusEvent) => {
    if (!ev.relatedTarget || !this.root.contains(ev.relatedTarget as Node)) this.opts.onFocus?.(null);
  };
}

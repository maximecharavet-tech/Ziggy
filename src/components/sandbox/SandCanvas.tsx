'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { createSandbox, loadSandboxEngine, type EngineEvent, type SandEngine } from '@/games2d/sandbox/engine';
import { REACTIONS, WORLDS, type Reaction, type Tool, type WorldId } from '@/games2d/sandbox/content';
import { TIER_SCALE, createTierGovernor, type Tier } from '@/games2d/sandbox/tier';
import { globeNote, pourNote } from './sounds';

const STEP_MS = 1000 / 60;
/** The grid is the same on every device (saves are portable): landscape or portrait. */
const LAND = { w: 320, h: 192 };
const PORT = { w: 192, h: 320 };

export type Speed = 'pause' | 'slow' | 'normal';

export interface SandApi {
  loadScene(): void;
  clear(): void;
  burst(x: number, y: number, color: string): void;
  /** Cell → position on screen (CSS pixels). */
  toClient(x: number, y: number): { x: number; y: number };
  /** Screen → cell. */
  toCell(clientX: number, clientY: number): { x: number; y: number };
  snapshot(): { bytes: Uint8Array; thumb: string; w: number; h: number } | null;
  restore(bytes: Uint8Array, w: number, h: number): boolean;
  /** The picture as a PNG data URL (for the photo). */
  photo(): string | null;
  dropParcel(clientX: number, clientY: number): boolean;
  parcel(): { state: number; x: number; y: number } | null;
  placeGift(kind: number, x: number, y: number): void;
  hatchBaby(x: number, y: number): void;
  /** Cell size on screen, in CSS pixels. */
  cellPx(): number;
  /** What floats in the sky behind a screen box: bit 0 a cloud, bit 1 a geyser's mist (for the saucer). */
  probeSky(box: { left: number; top: number; right: number; bottom: number }): number;
  /** The buried treasure of the map: where its X is across the world (0 left … 1 right), or null. */
  treasure(): { across: number; kind: number } | null;
  /** Hides the map's treasure again under the ground at `across` (a map kept from an earlier visit). */
  setTreasure(across: number): void;
  /** Toys out in the world: bit 0 snow-globe, bit 1 kite, bit 2 treasure buried. */
  toys(): number;
}

/** One-tap tools: they place something where the finger (or the remote's OK) lands. */
const ONE_TAP = new Set(['critter', 'baby', 'rainbowSeed', 'pocketStar', 'toy', 'globe']);

export interface ClientEvent extends EngineEvent {
  clientX: number;
  clientY: number;
}

/** Throttled report to React: the first event of each kind with its place, and exact counts since the last report. */
export interface EventBatch {
  events: ClientEvent[];
  deltas: Partial<Record<Reaction, number>>;
}

type Stroke = { x: number; y: number; px: number; py: number; down: boolean };

export function SandCanvas({
  world,
  tool,
  radius,
  speed,
  night,
  label,
  help,
  loadingLabel,
  failLabel,
  reduceMotion,
  gravity = 100,
  temperature = 0,
  onEvents,
  onPaint,
  onReady,
  apiRef,
}: {
  world: WorldId;
  tool: Tool;
  radius: number;
  speed: Speed;
  night: boolean;
  label: string;
  help: string;
  loadingLabel: string;
  failLabel: string;
  reduceMotion: boolean;
  /** Big kids' science controls: gravity in percent of the world's own, temperature offset. */
  gravity?: number;
  temperature?: number;
  onEvents: (batch: EventBatch) => void;
  onPaint: () => void;
  onReady?: () => void;
  apiRef: Ref<SandApi>;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<SandEngine | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [shape, setShape] = useState<'land' | 'port' | null>(null);
  // Everything the animation loop reads, kept in one ref so the loop never restarts.
  const live = useRef({ tool, radius, speed, night, reduceMotion, onEvents, onPaint, world, gravity, temperature });
  live.current = { tool, radius, speed, night, reduceMotion, onEvents, onPaint, world, gravity, temperature };
  const strokes = useRef(new Map<number, Stroke>());
  const keyboard = useRef({ on: false, x: -1, y: -1, down: false, focused: false, since: 0, release: 0 });
  const cursor = useRef<HTMLDivElement>(null);
  // The quality tier survives a rebuild of the world (a new world, a turned screen).
  const tierRef = useRef<Tier | null>(null);

  // Load the engine once.
  useEffect(() => {
    let alive = true;
    loadSandboxEngine().then(
      () => alive && setStatus('ready'),
      () => alive && setStatus('failed'),
    );
    return () => {
      alive = false;
    };
  }, []);

  // Pick the grid from the room we have, and again when the screen turns.
  useEffect(() => {
    const box = wrap.current;
    if (!box) return;
    const pick = () => {
      const r = box.getBoundingClientRect();
      setShape((r.width || 4) >= (r.height || 3) * 0.95 ? 'land' : 'port');
    };
    pick();
    const ro = new ResizeObserver(pick);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  const toCell = (clientX: number, clientY: number) => {
    const e = engine.current;
    const r = canvas.current?.getBoundingClientRect();
    if (!e || !r || !r.width) return { x: -1, y: -1 };
    return { x: ((clientX - r.left) / r.width) * e.w, y: ((clientY - r.top) / r.height) * e.h };
  };
  const toClient = (x: number, y: number) => {
    const e = engine.current;
    const r = canvas.current?.getBoundingClientRect();
    if (!e || !r) return { x: 0, y: 0 };
    return { x: r.left + ((x + 0.5) / e.w) * r.width, y: r.top + ((y + 0.5) / e.h) * r.height };
  };

  useImperativeHandle(apiRef, () => ({
    loadScene: () => engine.current?.raw.load_scene(),
    clear: () => engine.current?.raw.clear(),
    burst(x, y, color) {
      const n = live.current.reduceMotion ? 6 : 24;
      engine.current?.raw.burst(x, y, parseInt(color.replace('#', ''), 16) || 0xffd447, n);
    },
    toClient,
    toCell,
    snapshot() {
      const e = engine.current;
      const c = canvas.current;
      if (!e || !c) return null;
      const t = document.createElement('canvas');
      const k = 200 / Math.max(c.width, c.height);
      t.width = Math.round(c.width * k);
      t.height = Math.round(c.height * k);
      t.getContext('2d')?.drawImage(c, 0, 0, t.width, t.height);
      return { bytes: e.save(), thumb: t.toDataURL('image/png'), w: e.w, h: e.h };
    },
    restore(bytes, w, h) {
      const e = engine.current;
      if (!e || e.w !== w || e.h !== h) return false;
      return e.load(bytes);
    },
    photo: () => canvas.current?.toDataURL('image/png') ?? null,
    dropParcel(clientX, clientY) {
      const c = toCell(clientX, clientY);
      return engine.current?.raw.drop_parcel(Math.round(c.x), Math.round(Math.max(4, c.y))) ?? false;
    },
    parcel() {
      const e = engine.current;
      return e ? { state: e.raw.parcel_state(), x: e.raw.parcel_x(), y: e.raw.parcel_y() } : null;
    },
    placeGift: (kind, x, y) => engine.current?.raw.place_gift(kind, Math.round(x), Math.round(y)),
    hatchBaby: (x, y) => engine.current?.raw.hatch_baby(Math.round(x), Math.round(y)),
    cellPx() {
      const e = engine.current;
      const r = canvas.current?.getBoundingClientRect();
      return e && r ? r.width / e.w : 4;
    },
    probeSky(box) {
      const e = engine.current;
      if (!e) return 0;
      const a = toCell(box.left, box.top);
      const b = toCell(box.right, box.bottom);
      return e.raw.probe_sky(Math.floor(a.x), Math.floor(a.y), Math.ceil(b.x), Math.ceil(b.y));
    },
    treasure() {
      const e = engine.current;
      if (!e || !(e.raw.toys() & 4)) return null;
      return { across: e.raw.treasure_x() / Math.max(1, e.w - 1), kind: e.raw.treasure_kind() };
    },
    setTreasure(across) {
      const e = engine.current;
      if (e) e.raw.set_treasure(Math.round(Math.min(1, Math.max(0, across)) * (e.w - 1)), -1);
    },
    toys: () => engine.current?.raw.toys() ?? 0,
  }));

  // Build the world (again when the world or the shape changes), and run it.
  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    if (status !== 'ready' || !shape || !el || !box) return;
    const ctx = el.getContext('2d', { alpha: false });
    if (!ctx) return;
    const { w, h } = shape === 'land' ? LAND : PORT;
    const e = createSandbox(w, h, (Math.random() * 2 ** 32) >>> 0, WORLDS.indexOf(world));
    engine.current = e;
    e.raw.load_scene();
    e.raw.set_night(live.current.night);
    // Quality tier: 3× on capable devices, 2× on small ones. It adapts to what the frames really cost:
    // one tier down when the median stays above the 8 ms budget, back up (with hysteresis) when calm.
    const cores = navigator.hardwareConcurrency || 4;
    const governor = createTierGovernor(cores > 4 ? 'high' : 'low', { at: tierRef.current ?? undefined });
    let tierNow: Tier = governor.tier;
    const applyTier = (t: Tier, change = true) => {
      tierNow = t;
      tierRef.current = t;
      e.raw.set_quality(TIER_SCALE[t].scale, TIER_SCALE[t].high);
      el.dataset.tier = t;
      // How many times the tier really changed (read by the tests).
      if (change) el.dataset.tierChanges = `${el.dataset.tierChanges ? `${el.dataset.tierChanges} ` : ''}${t}`;
    };
    applyTier(tierNow, false);
    let gravityNow = 100;
    let temperatureNow = 0;

    const fit = () => {
      const r = box.getBoundingClientRect();
      const k = Math.max(0.5, Math.min((r.width - 26) / w, (r.height - 30) / h));
      el.style.width = `${Math.floor(w * k)}px`;
      el.style.height = `${Math.floor(h * k)}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    live.current.onEvents({ events: [], deltas: {} });
    onReady?.();

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let slowTick = 0;
    let lastFlush = 0;
    let counts = e.counts();
    const pending = new Map<Reaction, EngineEvent>();
    let nightNow = live.current.night;
    let frames = 0;
    let busy = 0;
    let lastPointer = '';

    const brush = () => {
      const { tool: t, radius: r } = live.current;
      const list = [...strokes.current.values()];
      const k = keyboard.current;
      if (k.release && performance.now() >= k.release) {
        k.down = false;
        k.release = 0;
      }
      // The kite follows the remote's cursor without holding OK.
      if (t.id === 'kite' && k.on && k.focused) e.raw.steer_kite(k.x, k.y);
      if (k.down && k.on && !ONE_TAP.has(t.id)) list.push({ x: k.x, y: k.y, px: k.x, py: k.y, down: true });
      for (const s of list) {
        if (!s.down || s.x < 0) continue;
        const px = s.px < 0 ? s.x : s.px;
        const py = s.py < 0 ? s.y : s.py;
        if (t.id === 'kite') e.raw.steer_kite(s.x, s.y);
        else if (t.wind) e.raw.wind(s.x, s.y, r + 2, t.wind);
        else if (t.id === 'beam') e.raw.beam(px, py, s.x, s.y, r + 3);
        else if (t.element !== undefined) {
          e.raw.paint_line(px, py, s.x, s.y, r, t.element, t.id === 'cloud' ? 1 : 0);
          pourNote(t.element);
        }
        s.px = s.x;
        s.py = s.y;
      }
    };

    const flush = (now: number) => {
      for (const ev of e.takeEvents()) if (!pending.has(ev.kind)) pending.set(ev.kind, ev);
      if (now - lastFlush < 250 || !pending.size) return;
      lastFlush = now;
      const next = e.counts();
      const deltas: Partial<Record<Reaction, number>> = {};
      for (let k = 0; k < next.length; k++) if (next[k] !== counts[k]) deltas[REACTIONS[k]] = next[k] - counts[k];
      counts = next;
      const r = el.getBoundingClientRect();
      const events = [...pending.values()].map((ev) => ({ ...ev, clientX: r.left + ((ev.x + 0.5) / w) * r.width, clientY: r.top + ((ev.y + 0.5) / h) * r.height }));
      pending.clear();
      live.current.onEvents({ events, deltas });
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(100, now - last);
      last = now;
      const t0 = performance.now();
      const { speed: sp, night: nt, reduceMotion: rm, gravity: gv, temperature: tp } = live.current;
      if (nt !== nightNow) {
        nightNow = nt;
        e.raw.set_night(nt);
      }
      if (gv !== gravityNow) {
        gravityNow = gv;
        e.raw.set_gravity(gv);
      }
      if (tp !== temperatureNow) {
        temperatureNow = tp;
        e.raw.set_temperature(tp);
      }
      brush();
      if (sp === 'normal') {
        acc += dt;
        let n = 0;
        while (acc >= STEP_MS && n < 2) {
          e.raw.step(1);
          acc -= STEP_MS;
          n++;
        }
        if (n === 2) acc = 0; // a slow device: drop the backlog rather than spiral
      } else if (sp === 'slow') {
        acc = 0;
        if (++slowTick % 4 === 0) e.raw.step(1);
      } else acc = 0;
      // The finger, for the faces and the babies.
      const first = strokes.current.values().next().value as Stroke | undefined;
      const p = first ?? (keyboard.current.on ? keyboard.current : null);
      const key = p ? `${p.x | 0},${p.y | 0}` : '';
      if (key !== lastPointer) {
        lastPointer = key;
        e.raw.set_pointer(p ? p.x : -1, p ? p.y : -1);
      }
      const img = e.render(now, rm);
      if (el.width !== img.width || el.height !== img.height) {
        el.width = img.width;
        el.height = img.height;
      }
      ctx.putImageData(img as ImageData, 0, 0);
      // The snow-globe sings what fell near it.
      for (const n of e.takeNotes()) globeNote(n.element, n.degree);
      flush(now);
      placeCursor();
      // Frame time, measured in the page (read by the tests); the tier steps down when it stays high.
      const spent = performance.now() - t0;
      busy += spent;
      // Paused frames cost almost nothing: they say nothing about the scene.
      const changed = sp === 'pause' ? null : governor.push(spent);
      if (changed) applyTier(changed);
      if (++frames % 60 === 0) {
        const avg = busy / 60;
        el.dataset.frameMs = avg.toFixed(2);
        el.dataset.frameMedian = governor.median.toFixed(2);
        el.dataset.parcel = `${e.raw.parcel_state()},${e.raw.parcel_x().toFixed(1)},${e.raw.parcel_y().toFixed(1)}`;
        el.dataset.toys = String(e.raw.toys());
        el.dataset.kite = `${e.raw.kite_x().toFixed(1)},${e.raw.kite_y().toFixed(1)}`;
        el.dataset.treasure = `${e.raw.treasure_x()},${e.raw.treasure_y()}`;
        busy = 0;
      }
    };

    // The remote's (or the keyboard's) brush, drawn as a ring over the canvas.
    const placeCursor = () => {
      const c = cursor.current;
      const k = keyboard.current;
      if (!c) return;
      if (!k.on || !k.focused) {
        if (c.style.display !== 'none') c.style.display = 'none';
        return;
      }
      const r = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const cell = r.width / w;
      const d = Math.max(18, (live.current.radius * 2 + 1) * cell);
      c.style.display = 'block';
      c.style.width = `${d}px`;
      c.style.height = `${d}px`;
      c.style.transform = `translate(${r.left - b.left + (k.x + 0.5) * cell - d / 2}px, ${r.top - b.top + (k.y + 0.5) * cell - d / 2}px)`;
      c.dataset.down = k.down ? '1' : '0';
    };

    const start = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    // No work at all while the tab is hidden.
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    if (!document.hidden) start();
    return () => {
      stop();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      engine.current = null;
      e.free();
    };
    // The world is rebuilt only when the world or the shape changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, shape, world]);

  const down = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    const c = toCell(ev.clientX, ev.clientY);
    const t = live.current.tool;
    const e = engine.current;
    live.current.onPaint();
    keyboard.current.on = false;
    if (e && oneTap(e, t, c.x, c.y)) return;
    strokes.current.set(ev.pointerId, { x: c.x, y: c.y, px: -1, py: -1, down: true });
  };

  /** One-tap tools act once where the finger lands; true if it was one. The kite tool launches the kite if there is none. */
  const oneTap = (e: SandEngine, t: Tool, x: number, y: number): boolean => {
    const cx = Math.round(x);
    const cy = Math.round(y);
    if (t.id === 'kite') {
      if (e.raw.toys() & 2) return false;
      e.raw.place_kite(cx, cy);
      return true;
    }
    if (!ONE_TAP.has(t.id)) return false;
    if (t.id === 'critter') e.raw.stamp_critter(cx, cy);
    else if (t.id === 'baby') e.raw.hatch_baby(cx, cy);
    else if (t.id === 'globe') e.raw.place_globe(cx, cy);
    else e.raw.place_gift(t.id === 'rainbowSeed' ? 9 : t.id === 'pocketStar' ? 8 : WORLDS.indexOf(live.current.world), cx, cy);
    return true;
  };
  const move = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const s = strokes.current.get(ev.pointerId);
    const c = toCell(ev.clientX, ev.clientY);
    if (s) {
      s.x = c.x;
      s.y = c.y;
    } else if (ev.pointerType === 'mouse') engine.current?.raw.set_pointer(c.x, c.y);
  };
  const up = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    strokes.current.delete(ev.pointerId);
    if (!strokes.current.size) engine.current?.raw.beam_off();
  };

  const onKeyDown = (ev: React.KeyboardEvent) => {
    const e = engine.current;
    if (!e) return;
    const k = keyboard.current;
    const step = ev.shiftKey ? 8 : 2;
    const go = (dx: number, dy: number) => {
      // Already at the edge and pushing out: let the key go, so a TV remote's focus can leave the canvas.
      if (k.on && ((dx < 0 && k.x <= 0) || (dx > 0 && k.x >= e.w - 1) || (dy < 0 && k.y <= 0) || (dy > 0 && k.y >= e.h - 1))) {
        k.down = false;
        // Down from the bottom edge: straight onto the tool under the brush.
        if (dy > 0) {
          const x = toClient(k.x, k.y).x;
          let best: HTMLElement | null = null;
          let bd = Infinity;
          for (const b of document.querySelectorAll<HTMLElement>('[role=toolbar] button')) {
            const r = b.getBoundingClientRect();
            const d = Math.abs(r.left + r.width / 2 - x);
            if (r.width && d < bd) {
              bd = d;
              best = b;
            }
          }
          if (best) {
            ev.preventDefault();
            best.focus({ preventScroll: true });
          }
        }
        return;
      }
      ev.preventDefault();
      if (!k.on || k.x < 0) {
        k.x = e.w >> 1;
        k.y = e.h >> 2;
      }
      k.on = true;
      k.x = Math.max(0, Math.min(e.w - 1, k.x + dx * step));
      k.y = Math.max(0, Math.min(e.h - 1, k.y + dy * step));
    };
    if (ev.key === 'ArrowLeft') go(-1, 0);
    else if (ev.key === 'ArrowRight') go(1, 0);
    else if (ev.key === 'ArrowUp') go(0, -1);
    else if (ev.key === 'ArrowDown') go(0, 1);
    else if (ev.key === ' ' || ev.key === 'Enter') {
      ev.preventDefault();
      if (!k.on) go(0, 0);
      if (ev.repeat && k.down) return;
      live.current.onPaint();
      if (!ev.repeat && oneTap(e, live.current.tool, k.x, k.y)) return;
      if (!k.down) k.since = performance.now();
      k.down = true;
      k.release = 0;
    }
  };
  const onKeyUp = (ev: React.KeyboardEvent) => {
    if (ev.key !== ' ' && ev.key !== 'Enter') return;
    const k = keyboard.current;
    // A quick press of a remote's OK still pours a little blob.
    const until = k.since + 260;
    if (performance.now() < until) k.release = until;
    else k.down = false;
  };

  return (
    <div ref={wrap} className="absolute inset-0 grid place-items-center">
      <canvas
        ref={canvas}
        role="application"
        tabIndex={0}
        aria-label={label}
        aria-describedby="sandbox-help"
        data-sandbox-canvas=""
        data-tv-autofocus=""
        className="sandbox-canvas touch-none select-none rounded-[22px] outline-none focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-[14px] focus-visible:outline-white/80"
        style={{
          width: 320,
          height: 192,
          background: '#7db5ee',
          // A moulded toy tank: white lip, sunny plastic rim with its thickness, soft shadow.
          boxShadow: '0 0 0 4px rgba(255,255,255,0.95), 0 0 0 11px #ffc94a, 0 0 0 12px #f0a92c, 0 9px 0 12px #d4861c, 0 40px 70px -18px rgba(10,8,40,0.75)',
        }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={(ev) => {
          if (ev.pointerType === 'mouse' && !strokes.current.has(ev.pointerId)) engine.current?.raw.set_pointer(-1, -1);
        }}
        onFocus={() => (keyboard.current.focused = true)}
        onBlur={() => Object.assign(keyboard.current, { focused: false, down: false })}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      />
      <div ref={cursor} aria-hidden="true" data-sandbox-cursor="" className="pointer-events-none absolute left-0 top-0 rounded-full border-[3px] border-white shadow-[0_0_0_3px_rgba(44,36,112,0.85),0_0_18px_rgba(255,255,255,0.8)] data-[down='1']:bg-white/25" style={{ display: 'none' }} />
      {status !== 'ready' ? (
        <p role="status" className="pointer-events-none absolute rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-[#2c2470] shadow-lg">
          {status === 'loading' ? loadingLabel : failLabel}
        </p>
      ) : null}
      <p id="sandbox-help" className="sr-only">
        {help}
      </p>
    </div>
  );
}

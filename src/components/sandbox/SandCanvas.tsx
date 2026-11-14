'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { createSandbox, loadSandboxEngine, type EngineEvent, type SandEngine } from '@/games2d/sandbox/engine';
import { REACTIONS, WORLDS, type Reaction, type Tool, type WorldId } from '@/games2d/sandbox/content';
import { pourNote } from './sounds';

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
}

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
  const live = useRef({ tool, radius, speed, night, reduceMotion, onEvents, onPaint, world });
  live.current = { tool, radius, speed, night, reduceMotion, onEvents, onPaint, world };
  const strokes = useRef(new Map<number, Stroke>());
  const keyboard = useRef({ on: false, x: -1, y: -1, down: false, focused: false });

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
    // Quality tier: 3× on capable devices, 2× on small ones; drops to 1× if the frames get slow.
    const cores = navigator.hardwareConcurrency || 4;
    let scale = cores > 4 ? 3 : 2;
    e.raw.set_quality(scale, scale === 3);
    el.dataset.tier = scale === 3 ? 'high' : 'low';

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
      if (k.down && k.on) list.push({ x: k.x, y: k.y, px: k.x, py: k.y, down: true });
      for (const s of list) {
        if (!s.down || s.x < 0) continue;
        const px = s.px < 0 ? s.x : s.px;
        const py = s.py < 0 ? s.y : s.py;
        if (t.wind) e.raw.wind(s.x, s.y, r + 2, t.wind);
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
      const { speed: sp, night: nt, reduceMotion: rm } = live.current;
      if (nt !== nightNow) {
        nightNow = nt;
        e.raw.set_night(nt);
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
      flush(now);
      // Frame time, measured in the page (read by the tests); the tier steps down when it stays high.
      const spent = performance.now() - t0;
      busy += spent;
      if (++frames % 60 === 0) {
        const avg = busy / 60;
        el.dataset.frameMs = avg.toFixed(2);
        busy = 0;
        if (avg > 12 && scale > 1) {
          scale -= 1;
          e.raw.set_quality(scale, false);
          el.dataset.tier = scale === 1 ? 'rescue' : 'low';
        }
      }
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
    // One-tap tools.
    if (e && (t.id === 'critter' || t.id === 'baby' || t.id === 'rainbowSeed' || t.id === 'pocketStar' || t.id === 'toy')) {
      if (t.id === 'critter') e.raw.stamp_critter(Math.round(c.x), Math.round(c.y));
      else if (t.id === 'baby') e.raw.hatch_baby(Math.round(c.x), Math.round(c.y));
      else e.raw.place_gift(t.id === 'rainbowSeed' ? 9 : t.id === 'pocketStar' ? 8 : WORLDS.indexOf(live.current.world), Math.round(c.x), Math.round(c.y));
      return;
    }
    strokes.current.set(ev.pointerId, { x: c.x, y: c.y, px: -1, py: -1, down: true });
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
      if (!k.down) live.current.onPaint();
      k.down = true;
    }
  };
  const onKeyUp = (ev: React.KeyboardEvent) => {
    if (ev.key === ' ' || ev.key === 'Enter') keyboard.current.down = false;
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

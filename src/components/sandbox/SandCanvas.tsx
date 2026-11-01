'use client';

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { Sandbox, type SimEvent } from '@/games2d/sandbox/sim';
import { glowSize, renderGlow, renderPixels } from '@/games2d/sandbox/render';
import { loadScene, type SceneId } from '@/games2d/sandbox/scenes';
import type { Tool } from '@/games2d/sandbox/content';
import { enrich } from './shading';

/** Roughly how many cells the world has (200×120 in landscape, 120×200 in portrait). */
const CELLS = 24000;
const STEP_MS = 1000 / 60;

export interface SandApi {
  loadScene(id: SceneId): void;
  clear(): void;
  /** A burst of sparkles at a cell. */
  burst(x: number, y: number, color: string): void;
  /** Cell → position on screen (CSS pixels). */
  toClient(x: number, y: number): { x: number; y: number };
}

export interface ClientEvent extends SimEvent {
  clientX: number;
  clientY: number;
}

type Sparkle = { x: number; y: number; vx: number; vy: number; life: number; size: number; color: string };

export function SandCanvas({
  tool,
  radius,
  paused,
  initialScene,
  label,
  help,
  reduceMotion,
  onEvents,
  onPaint,
  apiRef,
}: {
  tool: Tool;
  radius: number;
  paused: boolean;
  initialScene: SceneId;
  label: string;
  help: string;
  reduceMotion: boolean;
  onEvents: (events: ClientEvent[]) => void;
  onPaint: () => void;
  apiRef: Ref<SandApi>;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const glass = useRef<HTMLDivElement>(null);
  const sim = useRef<Sandbox | null>(null);
  // Everything the animation loop reads, kept in one ref so the loop never restarts.
  const live = useRef({ tool, radius, paused, reduceMotion, onEvents, onPaint });
  live.current = { tool, radius, paused, reduceMotion, onEvents, onPaint };
  const input = useRef({ down: false, keyboard: false, x: -1, y: -1, px: -1, py: -1, hover: false, focused: false });
  const sparkles = useRef<Sparkle[]>([]);

  const toClient = (x: number, y: number) => {
    const s = sim.current;
    const r = canvas.current?.getBoundingClientRect();
    if (!s || !r) return { x: 0, y: 0 };
    return { x: r.left + ((x + 0.5) / s.w) * r.width, y: r.top + ((y + 0.5) / s.h) * r.height };
  };

  useImperativeHandle(apiRef, () => ({
    loadScene(id) {
      if (sim.current) loadScene(sim.current, id);
    },
    clear() {
      sim.current?.clear();
    },
    burst(x, y, color) {
      const n = live.current.reduceMotion ? 8 : 26;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + Math.random() * 0.4;
        const v = 0.25 + Math.random() * 0.55;
        sparkles.current.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.15, life: 1, size: 0.9 + Math.random() * 1.3, color: k % 3 === 0 ? '#ffffff' : k % 3 === 1 ? '#fff3a3' : color });
      }
    },
    toClient,
  }));

  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    if (!el || !box) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    // Pick the grid to match the room we have: landscape on a computer, portrait on a phone.
    const rect = box.getBoundingClientRect();
    const aspect = Math.min(2.2, Math.max(0.45, (rect.width || 4) / (rect.height || 3)));
    const h = Math.round(Math.sqrt(CELLS / aspect));
    const w = Math.round(h * aspect);
    const world = new Sandbox(w, h, (Math.random() * 2 ** 32) >>> 0);
    sim.current = world;
    loadScene(world, initialScene);

    const pixels = new ImageData(w, h);
    const pix32 = new Uint32Array(pixels.data.buffer);
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const offCtx = off.getContext('2d')!;
    const { gw, gh } = glowSize(world);
    const glow = new ImageData(gw, gh);
    const glow32 = new Uint32Array(glow.data.buffer);
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = gw;
    glowCanvas.height = gh;
    const glowCtx = glowCanvas.getContext('2d')!;

    // The sky is painted in the canvas itself, so the glow can truly add light to it.
    let sky: CanvasGradient | null = null;
    let sun: CanvasGradient | null = null;
    const paintSky = () => {
      const W = el.width;
      const H = el.height;
      sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#7db5ee');
      sky.addColorStop(0.4, '#a8d1f6');
      sky.addColorStop(0.72, '#d5eafb');
      sky.addColorStop(1, '#fbe3cf');
      sun = ctx.createRadialGradient(W * 0.86, H * 0.08, 0, W * 0.86, H * 0.08, Math.max(W, H) * 0.32);
      sun.addColorStop(0, 'rgba(255,248,214,0.95)');
      sun.addColorStop(0.18, 'rgba(255,240,196,0.55)');
      sun.addColorStop(1, 'rgba(255,240,196,0)');
    };

    // Fit the canvas in its box, keeping square cells; crisp backing store at the device pixel ratio.
    const fit = () => {
      const r = box.getBoundingClientRect();
      // Room for the toy frame around the glass.
      const scale = Math.max(0.5, Math.min((r.width - 26) / w, (r.height - 30) / h));
      const cssW = Math.floor(w * scale);
      const cssH = Math.floor(h * scale);
      el.style.width = `${cssW}px`;
      el.style.height = `${cssH}px`;
      if (glass.current) {
        glass.current.style.width = `${cssW}px`;
        glass.current.style.height = `${cssH}px`;
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      el.width = Math.round(cssW * dpr);
      el.height = Math.round(cssH * dpr);
      paintSky();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const applyBrush = () => {
      const i = input.current;
      if (!i.down || i.x < 0) return;
      const { tool: t, radius: r } = live.current;
      if (t.wind) world.wind(i.x, i.y, r + 2, t.wind);
      else if (t.element !== undefined) {
        if (i.px >= 0) world.paintLine(i.px, i.py, i.x, i.y, r, t.element);
        else world.paint(i.x, i.y, r, t.element);
      }
      i.px = i.x;
      i.py = i.y;
    };

    const draw = (now: number) => {
      const W = el.width;
      const H = el.height;
      const k = W / w;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = sky ?? '#a8d1f6';
      ctx.fillRect(0, 0, W, H);
      if (sun) {
        ctx.fillStyle = sun;
        ctx.fillRect(0, 0, W, H);
      }
      renderPixels(world, pix32, now, !live.current.reduceMotion);
      enrich(world, pix32, now, !live.current.reduceMotion);
      offCtx.putImageData(pixels, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, W, H);
      // Soft light: the glow map, blown up smoothly and added on top.
      renderGlow(world, glow32, now);
      glowCtx.putImageData(glow, 0, 0);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.85;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // Each glow pixel covers 4×4 cells.
      ctx.drawImage(glowCanvas, 0, 0, gw * 4 * k, gh * 4 * k);
      ctx.restore();
      // Sparkles of a new discovery.
      const list = sparkles.current;
      for (let n = list.length - 1; n >= 0; n--) {
        const p = list[n];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.012;
        p.life -= 0.016;
        if (p.life <= 0) {
          list.splice(n, 1);
          continue;
        }
        const s = p.size * k * (0.6 + p.life * 0.6);
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life * 1.4);
        ctx.fillStyle = p.color;
        ctx.translate((p.x + 0.5) * k, (p.y + 0.5) * k);
        ctx.rotate(p.life * 3);
        ctx.beginPath();
        for (let q = 0; q < 8; q++) {
          const rr = q % 2 ? s * 0.32 : s;
          const ang = (q / 8) * Math.PI * 2;
          ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // The brush, where the finger, mouse or keyboard cursor is.
      const i = input.current;
      if (i.x >= 0 && (i.hover || i.down || (i.keyboard && i.focused))) {
        const r = (live.current.radius + (live.current.tool.wind ? 2 : 0) + 0.5) * k;
        ctx.save();
        ctx.lineWidth = Math.max(1.5, k * 0.35);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.shadowColor = 'rgba(30,20,80,0.45)';
        ctx.shadowBlur = 6;
        ctx.setLineDash(live.current.tool.wind ? [k * 1.2, k * 0.9] : []);
        ctx.beginPath();
        ctx.arc((i.x + 0.5) * k, (i.y + 0.5) * k, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(100, now - last);
      last = now;
      const events: SimEvent[] = [];
      const seen = new Set<string>();
      if (live.current.paused) {
        applyBrush();
        acc = 0;
      } else {
        acc += dt;
        let n = 0;
        while (acc >= STEP_MS && n < 3) {
          applyBrush();
          world.step();
          for (const e of world.events) {
            if (seen.has(e.kind)) continue;
            seen.add(e.kind);
            events.push(e);
          }
          acc -= STEP_MS;
          n++;
        }
        if (n === 3) acc = 0; // a slow device: drop the backlog rather than spiral
      }
      draw(now);
      if (events.length) {
        const r = el.getBoundingClientRect();
        live.current.onEvents(events.map((e) => ({ ...e, clientX: r.left + ((e.x + 0.5) / w) * r.width, clientY: r.top + ((e.y + 0.5) / h) * r.height })));
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
      sim.current = null;
    };
    // The world is built once; scenes and clearing go through the API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cell = (e: { clientX: number; clientY: number }) => {
    const s = sim.current;
    const r = canvas.current?.getBoundingClientRect();
    if (!s || !r || !r.width) return { x: -1, y: -1 };
    return { x: Math.floor(((e.clientX - r.left) / r.width) * s.w), y: Math.floor(((e.clientY - r.top) / r.height) * s.h) };
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const s = sim.current;
    if (!s) return;
    const i = input.current;
    const step = e.shiftKey ? 8 : 2;
    const move = (dx: number, dy: number) => {
      e.preventDefault();
      if (!i.keyboard || i.x < 0) {
        i.x = s.w >> 1;
        i.y = s.h >> 2;
      }
      i.keyboard = true;
      i.x = Math.max(0, Math.min(s.w - 1, i.x + dx * step));
      i.y = Math.max(0, Math.min(s.h - 1, i.y + dy * step));
    };
    if (e.key === 'ArrowLeft') move(-1, 0);
    else if (e.key === 'ArrowRight') move(1, 0);
    else if (e.key === 'ArrowUp') move(0, -1);
    else if (e.key === 'ArrowDown') move(0, 1);
    else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!i.keyboard || i.x < 0) move(0, 0);
      if (!i.down) {
        i.down = true;
        i.px = -1;
        live.current.onPaint();
      }
    }
  };

  const onKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      input.current.down = false;
      input.current.px = -1;
    }
  };

  return (
    <div ref={wrap} className="absolute inset-0 grid place-items-center">
      <canvas
        ref={canvas}
        role="application"
        tabIndex={0}
        aria-label={label}
        aria-describedby="sandbox-help"
        className="sandbox-canvas touch-none select-none rounded-[22px] outline-none focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-[14px] focus-visible:outline-white/80"
        style={{
          imageRendering: 'pixelated',
          background: '#a8d1f6',
          // A moulded toy tank: white lip, sunny plastic rim with its thickness, soft shadow.
          boxShadow: '0 0 0 4px rgba(255,255,255,0.95), 0 0 0 11px #ffc94a, 0 0 0 12px #f0a92c, 0 9px 0 12px #d4861c, 0 40px 70px -18px rgba(10,8,40,0.75)',
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const c = cell(e);
          Object.assign(input.current, { down: true, keyboard: false, x: c.x, y: c.y, px: -1, py: -1, hover: e.pointerType === 'mouse' });
          live.current.onPaint();
        }}
        onPointerMove={(e) => {
          const c = cell(e);
          Object.assign(input.current, { x: c.x, y: c.y, keyboard: false, hover: e.pointerType === 'mouse' || input.current.down });
        }}
        onPointerUp={(e) => Object.assign(input.current, { down: false, px: -1, hover: e.pointerType === 'mouse' })}
        onPointerCancel={() => Object.assign(input.current, { down: false, px: -1, hover: false })}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse' && !input.current.down) input.current.hover = false;
        }}
        onFocus={() => (input.current.focused = true)}
        onBlur={() => Object.assign(input.current, { focused: false, down: false, px: -1 })}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      />
      {/* Glass reflection over the tank (never catches the pointer). */}
      <div
        ref={glass}
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[22px]"
        style={{ background: 'linear-gradient(118deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 18%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 78%, rgba(255,255,255,0.1) 100%)', boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -10px 24px -12px rgba(20,10,60,0.35)' }}
      />
      <p id="sandbox-help" className="sr-only">
        {help}
      </p>
    </div>
  );
}

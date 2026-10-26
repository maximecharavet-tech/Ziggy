'use client';

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { motion } from 'framer-motion';
import { glitterPoints, paintAll, paintStroke } from '@/coloring/brush-render';
import { MAGIC, fillAttr, gradientVector } from '@/coloring/palette';
import { EMOJI_FONT } from '@/coloring/raster';
import { pointCount, StrokeCapture, strokeLength } from '@/coloring/smoothing';
import { Sparkles } from '@/coloring/sparkles';
import { newId } from '@/coloring/storage';
import { lineArtSvg, viewSize } from '@/coloring/svg';
import type { ColoringPage, Drawing, Sticker, Stroke, StrokeTool, Tool } from '@/coloring/types';

/** Canvas pixels per page unit (600 units → 1200 px: crisp on phones and tablets). */
const RES = 2;

export type StageApi = {
  /** Sparkle burst on a region (used by the magic fill). */
  burstRegion: (id: string) => void;
};

type Ripple = { key: number; id: string; x: number; y: number; from?: string; to: string; r: number };

export type CommitKind = 'fill' | 'stroke' | 'sticker' | 'erase';

export function Stage({
  page,
  drawing,
  commit,
  tool,
  color,
  brushSize,
  sticker,
  stickerSize,
  modelMode,
  selectedSticker,
  onSelectSticker,
  label,
  reduced,
  apiRef,
}: {
  page: ColoringPage;
  drawing: Drawing;
  commit: (next: Drawing, kind: CommitKind) => void;
  tool: Tool;
  color: string;
  brushSize: number;
  sticker: string;
  stickerSize: number;
  modelMode: boolean;
  selectedSticker: string | null;
  onSelectSticker: (id: string | null) => void;
  label: string;
  reduced: boolean;
  apiRef?: Ref<StageApi>;
}) {
  const { w: W, h: H } = viewSize(page);
  const root = useRef<HTMLDivElement>(null);
  const strokesCanvas = useRef<HTMLCanvasElement>(null);
  const sparkCanvas = useRef<HTMLCanvasElement>(null);
  const sparkles = useRef<Sparkles | null>(null);
  const paths = useRef(new Map<string, SVGPathElement>());
  const [ripple, setRipple] = useState<Ripple | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [focusIdx, setFocusIdx] = useState(-1);
  const [focused, setFocused] = useState(false);
  const live = useRef<{ capture: StrokeCapture; stroke: Stroke; drawn: number; pointer: number } | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number; moved: boolean; pointer: number } | null>(null);
  const rippleKey = useRef(0);
  const latest = useRef(drawing);
  latest.current = drawing;

  const lineArt = useMemo(() => lineArtSvg(page), [page]);

  // Sparkle system.
  useEffect(() => {
    if (!sparkCanvas.current) return;
    const s = new Sparkles(sparkCanvas.current, reduced);
    sparkles.current = s;
    return () => s.dispose();
  }, [reduced]);

  // Repaint the brush layer whenever the strokes change (undo, redo, new stroke).
  useEffect(() => {
    const c = strokesCanvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    paintAll(ctx, drawing.strokes, RES);
    sparkles.current?.setSpots(glitterPoints(drawing.strokes).map((p) => ({ x: p.x * RES, y: p.y * RES, w: p.w * RES })));
  }, [drawing.strokes]);

  const toPage = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = root.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };

  const hitRegion = useCallback(
    (x: number, y: number) => {
      const p = new DOMPoint(x, y);
      for (let i = page.regions.length - 1; i >= 0; i--) {
        const el = paths.current.get(page.regions[i].id);
        if (el?.isPointInFill(p)) return page.regions[i];
      }
      return null;
    },
    [page]
  );

  const burstRegion = useCallback(
    (id: string) => {
      const el = paths.current.get(id);
      if (!el) return;
      const b = el.getBBox();
      sparkles.current?.burst((b.x + b.width / 2) * RES, (b.y + b.height / 2) * RES, 6, 0.7);
    },
    []
  );
  useImperativeHandle(apiRef, () => ({ burstRegion }), [burstRegion]);

  const fillAt = (regionId: string, x: number, y: number) => {
    const region = page.regions.find((r) => r.id === regionId);
    if (!region) return;
    const next = modelMode ? region.c : color;
    const d = latest.current;
    if (d.fills[regionId] === next) {
      sparkles.current?.burst(x * RES, y * RES, 6, 0.6);
      return;
    }
    const el = paths.current.get(regionId);
    if (el && !reduced) {
      const b = el.getBBox();
      const r = Math.max(...[[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([cx, cy]) => Math.hypot(cx - x, cy - y)));
      setRipple({ key: ++rippleKey.current, id: regionId, x, y, from: d.fills[regionId], to: next, r: r + 4 });
    }
    sparkles.current?.burst(x * RES, y * RES, 12, 1);
    commit({ ...d, fills: { ...d.fills, [regionId]: next } }, 'fill');
  };

  const stickerAt = (x: number, y: number): Sticker | undefined =>
    [...latest.current.stickers].reverse().find((s) => Math.hypot(s.x - x, s.y - y) < s.s * 0.62);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
    const [x, y] = toPage(e);
    root.current?.focus({ preventScroll: true });
    if (tool === 'fill') {
      const r = hitRegion(x, y);
      if (r) fillAt(r.id, x, y);
      return;
    }
    if (tool === 'sticker') {
      const hit = stickerAt(x, y);
      e.currentTarget.setPointerCapture(e.pointerId);
      if (hit) {
        onSelectSticker(hit.id);
        dragRef.current = { id: hit.id, dx: x - hit.x, dy: y - hit.y, moved: false, pointer: e.pointerId };
        return;
      }
      const s: Sticker = { id: newId('k'), e: sticker, x, y, s: stickerSize, r: Math.round((Math.random() - 0.5) * 26) };
      const d = latest.current;
      commit({ ...d, stickers: [...d.stickers, s] }, 'sticker');
      onSelectSticker(s.id);
      sparkles.current?.burst(x * RES, y * RES, 10, 0.8);
      return;
    }
    // Brushes and eraser.
    e.currentTarget.setPointerCapture(e.pointerId);
    const strokeTool = tool as StrokeTool;
    const size = strokeTool === 'eraser' ? brushSize * 1.6 : brushSize;
    const capture = new StrokeCapture(size);
    capture.add(x, y, e.timeStamp);
    live.current = { capture, stroke: { id: newId('s'), tool: strokeTool, color, size, pts: capture.pts }, drawn: 0, pointer: e.pointerId };
    const ctx = strokesCanvas.current?.getContext('2d');
    if (ctx) paintStroke(ctx, live.current.stroke, RES);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const dr = dragRef.current;
    if (dr && dr.pointer === e.pointerId) {
      const [x, y] = toPage(e);
      dr.moved = true;
      setDrag({ id: dr.id, x: Math.max(0, Math.min(W, x - dr.dx)), y: Math.max(0, Math.min(H, y - dr.dy)) });
      return;
    }
    const l = live.current;
    if (!l || l.pointer !== e.pointerId) return;
    const events = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [];
    const list = events.length ? events : [e.nativeEvent];
    let added = false;
    for (const ev of list) {
      const [x, y] = toPage(ev);
      if (l.capture.add(x, y, ev.timeStamp)) {
        added = true;
        if (l.stroke.tool === 'glitter') sparkles.current?.trail(x * RES, y * RES, l.stroke.size * RES);
      }
    }
    if (!added) return;
    const ctx = strokesCanvas.current?.getContext('2d');
    const final = pointCount(l.capture.pts) - 2; // every segment but the tail is final
    if (ctx && final > l.drawn) {
      paintStroke(ctx, l.stroke, RES, Math.max(0, l.drawn), final);
      l.drawn = final;
    }
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const dr = dragRef.current;
    if (dr && dr.pointer === e.pointerId) {
      dragRef.current = null;
      if (dr.moved && drag) {
        const d = latest.current;
        commit({ ...d, stickers: d.stickers.map((s) => (s.id === dr.id ? { ...s, x: Math.round(drag.x * 10) / 10, y: Math.round(drag.y * 10) / 10 } : s)) }, 'sticker');
      }
      setDrag(null);
      return;
    }
    const l = live.current;
    if (!l || l.pointer !== e.pointerId) return;
    live.current = null;
    const stroke: Stroke = { ...l.stroke, pts: [...l.capture.pts] };
    const d = latest.current;
    let fills = d.fills;
    let stickers = d.stickers;
    if (stroke.tool === 'eraser' && strokeLength(stroke.pts) < 8) {
      // A tap with the eraser also removes the colour of the zone (or a sticker).
      const [x, y] = [stroke.pts[0], stroke.pts[1]];
      const s = stickerAt(x, y);
      if (s) stickers = stickers.filter((k) => k.id !== s.id);
      else {
        const r = hitRegion(x, y);
        if (r && fills[r.id]) {
          const { [r.id]: _gone, ...rest } = fills;
          fills = rest;
        }
      }
    }
    commit({ fills, stickers, strokes: [...d.strokes, stroke] }, stroke.tool === 'eraser' ? 'erase' : 'stroke');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const n = page.regions.length;
    if (['ArrowRight', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      setFocusIdx((i) => (i + 1) % n);
    } else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      setFocusIdx((i) => (i <= 0 ? n - 1 : i - 1));
    } else if ((e.key === 'Enter' || e.key === ' ') && focusIdx >= 0) {
      e.preventDefault();
      const r = page.regions[focusIdx];
      const b = paths.current.get(r.id)?.getBBox();
      if (b) fillAt(r.id, b.x + b.width / 2, b.y + b.height / 2);
    }
  };

  const focusRegion = focused && focusIdx >= 0 ? page.regions[focusIdx] : null;
  const cursor = tool === 'fill' ? 'cursor-pointer' : tool === 'sticker' ? 'cursor-copy' : 'cursor-crosshair';

  return (
    <div
      ref={root}
      role="application"
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative h-full w-full touch-none select-none overflow-hidden rounded-[1.75rem] bg-white shadow-[0_24px_60px_-28px_rgba(76,52,160,0.55)] ring-1 ring-black/5 outline-none focus-visible:ring-4 focus-visible:ring-sky ${cursor}`}
      style={{ WebkitTouchCallout: 'none', isolation: 'isolate' }}
    >
      {/* 1. Colours */}
      <svg viewBox={page.viewBox} className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          {MAGIC.map((m) => {
            const v = gradientVector(m.angle);
            return (
              <linearGradient key={m.id} id={`magic-${m.id}`} x1={v.x1} y1={v.y1} x2={v.x2} y2={v.y2}>
                {m.stops.map((c, i) => (
                  <stop key={i} offset={i / (m.stops.length - 1)} stopColor={c} />
                ))}
              </linearGradient>
            );
          })}
        </defs>
        {page.regions.map((r) => {
          const rip = ripple && ripple.id === r.id ? ripple : null;
          return (
            <g key={r.id}>
              <path
                ref={(el) => {
                  if (el) paths.current.set(r.id, el);
                  else paths.current.delete(r.id);
                }}
                d={r.d}
                fill={fillAttr(rip ? rip.from : drawing.fills[r.id])}
              />
              {rip && (
                <>
                  <clipPath id={`rip-${rip.key}`}>
                    <path d={r.d} />
                  </clipPath>
                  <motion.circle
                    cx={rip.x}
                    cy={rip.y}
                    fill={fillAttr(rip.to)}
                    clipPath={`url(#rip-${rip.key})`}
                    initial={{ r: 0 }}
                    animate={{ r: rip.r }}
                    transition={{ duration: Math.min(0.55, 0.22 + rip.r / 900), ease: [0.23, 1, 0.32, 1] }}
                    onAnimationComplete={() => setRipple((cur) => (cur?.key === rip.key ? null : cur))}
                  />
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* 2. Brush strokes */}
      <canvas ref={strokesCanvas} width={W * RES} height={H * RES} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />

      {/* 3. Line art, multiplied so white vanishes and outlines stay on top */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [&>svg]:h-full [&>svg]:w-full"
        style={{ mixBlendMode: 'multiply' }}
        dangerouslySetInnerHTML={{ __html: lineArt }}
      />

      {/* Keyboard focus */}
      {focusRegion && (
        <svg viewBox={page.viewBox} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <path d={focusRegion.d} fill="rgba(176,124,255,0.18)" stroke="#7C3AED" strokeWidth={6} strokeDasharray="14 10" strokeLinejoin="round" />
        </svg>
      )}

      {/* 4. Stickers */}
      <svg viewBox={page.viewBox} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        {drawing.stickers.map((s) => {
          const pos = drag?.id === s.id ? drag : s;
          const selected = tool === 'sticker' && selectedSticker === s.id;
          return (
            <g key={s.id}>
              {selected && <circle cx={pos.x} cy={pos.y} r={s.s * 0.64} fill="rgba(255,255,255,0.35)" stroke="#8B5CF6" strokeWidth={3.5} strokeDasharray="10 8" />}
              <motion.text
                x={pos.x}
                y={pos.y}
                fontSize={s.s}
                textAnchor="middle"
                dominantBaseline="central"
                style={{ fontFamily: EMOJI_FONT, transformBox: 'fill-box', transformOrigin: 'center' }}
                initial={reduced ? { rotate: s.r, scale: 1 } : { scale: 0, rotate: s.r - 40 }}
                animate={{ scale: drag?.id === s.id ? 1.12 : 1, rotate: s.r }}
                transition={{ type: 'spring', duration: 0.45, bounce: 0.45 }}
              >
                {s.e}
              </motion.text>
            </g>
          );
        })}
      </svg>

      {/* Sparkles */}
      <canvas ref={sparkCanvas} width={W * RES} height={H * RES} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
    </div>
  );
}

'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface DrawPadHandle {
  /** The ink as Ziggy reads it: alpha values 0..1 on a small square grid. */
  read(): { ink: Float32Array; size: number } | null;
  clear(): void;
}

const READ_SIZE = 112;

/**
 * A slate to draw on with a finger or a mouse. Thick round strokes, so a
 * five-year-old's drawing reads well; `onStroke` fires when a stroke ends.
 */
export const DrawPad = forwardRef<DrawPadHandle, { color: string; onStroke?: () => void; label: string }>(function DrawPad(
  { color, onStroke, label },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = canvas.clientWidth;
      if (!size) return;
      // Resizing wipes the canvas; only do it while it is still empty.
      if (canvas.width === Math.round(size * dpr) || dirty.current) return;
      canvas.width = canvas.height = Math.round(size * dpr);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useImperativeHandle(ref, () => ({
    read() {
      const canvas = canvasRef.current;
      if (!canvas || !dirty.current) return null;
      const small = document.createElement('canvas');
      small.width = small.height = READ_SIZE;
      const sctx = small.getContext('2d', { willReadFrequently: true });
      if (!sctx) return null;
      sctx.drawImage(canvas, 0, 0, READ_SIZE, READ_SIZE);
      const data = sctx.getImageData(0, 0, READ_SIZE, READ_SIZE).data;
      const ink = new Float32Array(READ_SIZE * READ_SIZE);
      for (let i = 0; i < ink.length; i++) ink[i] = data[i * 4 + 3] / 255;
      return { ink, size: READ_SIZE };
    },
    clear() {
      const canvas = canvasRef.current;
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      dirty.current = false;
    },
  }));

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const k = e.currentTarget.width / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
  };

  const line = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = canvas.width * 0.055;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    dirty.current = true;
  };

  return (
    <canvas
      ref={canvasRef}
      aria-label={label}
      role="img"
      className="block w-full aspect-square touch-none rounded-[1.6rem] bg-white cursor-crosshair [background-image:radial-gradient(circle,rgba(127,200,92,0.18)_1px,transparent_1px)] [background-size:22px_22px]"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        const p = point(e);
        last.current = p;
        line(p, p);
      }}
      onPointerMove={(e) => {
        if (!drawing.current || !last.current) return;
        const p = point(e);
        line(last.current, p);
        last.current = p;
      }}
      onPointerUp={() => {
        if (!drawing.current) return;
        drawing.current = false;
        last.current = null;
        onStroke?.();
      }}
      onPointerCancel={() => {
        drawing.current = false;
        last.current = null;
      }}
    />
  );
});

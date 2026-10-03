'use client';

import { useEffect, useRef } from 'react';
import { GRID, type Vector } from '@/lib/lab/knn';

/**
 * A drawing as Ziggy sees it: GRID × GRID squares of ink. Drawn on a tiny
 * canvas and scaled up with crisp pixels — cheap enough for dozens of
 * thumbnails.
 */
export function PixelView({
  vector,
  color,
  className = '',
  grid = false,
}: {
  vector: Vector;
  color: string;
  className?: string;
  /** Show the cell lines, for the big "what Ziggy sees" panel. */
  grid?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, GRID, GRID);
    for (let i = 0; i < vector.length; i++) {
      const v = vector[i];
      if (v < 0.04) continue;
      ctx.globalAlpha = Math.min(1, v * 1.15);
      ctx.fillStyle = color;
      ctx.fillRect(i % GRID, Math.floor(i / GRID), 1, 1);
    }
    ctx.globalAlpha = 1;
  }, [vector, color]);

  return (
    <span className={`relative block overflow-hidden ${className}`}>
      <canvas ref={ref} width={GRID} height={GRID} className="block w-full h-full [image-rendering:pixelated]" aria-hidden="true" />
      {grid && (
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(127,127,127,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(127,127,127,0.18) 1px, transparent 1px)',
            backgroundSize: `${100 / GRID}% ${100 / GRID}%`,
          }}
          aria-hidden="true"
        />
      )}
    </span>
  );
}

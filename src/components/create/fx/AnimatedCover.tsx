'use client';

import { useMemo, useRef, type CSSProperties } from 'react';
import { motion, useTransform } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { Twinkle } from './Burst';
import { DepthProvider, useAwake, usePointerDepth } from './Parallax';
import { fx, loop } from './toy';

export type CoverFX = 'coloriage' | 'creatures' | 'chansons' | 'bac-a-sable' | 'jardin' | 'histoires' | 'avatar';

const GLOW: Record<CoverFX, string> = {
  coloriage: 'rgba(255, 122, 184, 0.5)',
  creatures: 'rgba(138, 99, 255, 0.5)',
  chansons: 'rgba(111, 78, 240, 0.5)',
  'bac-a-sable': 'rgba(247, 201, 72, 0.55)',
  jardin: 'rgba(47, 168, 101, 0.5)',
  histoires: 'rgba(63, 143, 224, 0.5)',
  avatar: 'rgba(163, 91, 214, 0.5)',
};

const GLYPHS: Record<CoverFX, string[]> = {
  coloriage: ['🖍️', '✏️', '✨', '🎨'],
  creatures: ['👁️', '✨', '🎩', '⭐'],
  chansons: ['♪', '♫', '♩', '♬'],
  'bac-a-sable': ['·', '•', '˚', '✦'],
  jardin: ['🍃', '🌸', '🍂', '✨'],
  histoires: ['⭐', '✧', '✦', '✨'],
  avatar: ['💗', '✨', '👑', '💖'],
};

type Props = {
  src: string;
  /** Optional smaller WebP for phones (`*-sm.webp`). */
  srcSm?: string;
  alt: string;
  fxKind: CoverFX;
  /** Gradient fallback while the image loads / if it fails. */
  from?: string;
  to?: string;
  className?: string;
  priority?: boolean;
};

/**
 * Still illustration → living card window: Ken Burns + pointer parallax +
 * shimmer + themed floating bits. Pauses off-screen (`data-still`) and with
 * prefers-reduced-motion. No extra npm deps (framer-motion already in tree).
 * Covers are already WebP in /public — plain img + srcSet keeps it light.
 */
export function AnimatedCover({
  src,
  srcSm,
  alt,
  fxKind,
  from = '#ff9a8b',
  to = '#ff5f86',
  className = '',
  priority = false,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const awake = useAwake(box);
  const reduce = useReducedMotion();
  const p = usePointerDepth<HTMLDivElement>();
  const shiftX = useTransform(p.x, [-1, 1], reduce ? [0, 0] : [-10, 10]);
  const shiftY = useTransform(p.y, [-1, 1], reduce ? [0, 0] : [-6, 6]);

  const bits = useMemo(() => {
    const glyphs = GLYPHS[fxKind];
    return Array.from({ length: 8 }, (_, i) => ({
      g: glyphs[i % glyphs.length],
      left: `${6 + ((i * 41) % 88)}%`,
      top: `${10 + ((i * 53) % 72)}%`,
      size: 11 + (i % 4) * 3.5,
      twinkle: fxKind === 'histoires' || fxKind === 'creatures' || fxKind === 'coloriage' ? i % 3 === 0 : i % 4 === 0,
      style: loop({
        dur: 4.4 + (i % 5) * 0.75,
        delay: (i % 7) * 0.38,
        dx: 6 + (i % 3) * 4,
        dy: -12 - (i % 4) * 3,
        tilt: (i % 2 ? 1 : -1) * (6 + (i % 3) * 3),
      }),
    }));
  }, [fxKind]);

  return (
    <div
      ref={box}
      data-still={awake && !reduce ? undefined : ''}
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={
        {
          '--cover-glow': GLOW[fxKind],
          background: `linear-gradient(150deg, ${from}, ${to})`,
        } as CSSProperties
      }
      {...p.handlers}
    >
      <DepthProvider x={p.x} y={p.y}>
        <motion.div className="absolute inset-[-8%]" style={{ x: shiftX, y: shiftY }}>
          <div className={`relative h-full w-full ${reduce ? '' : fx.kenBurns}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              srcSet={srcSm ? `${srcSm} 640w, ${src} 1280w` : undefined}
              sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 380px"
              alt={alt}
              className="absolute inset-0 h-full w-full object-cover"
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
            />
          </div>
        </motion.div>
      </DepthProvider>

      {!reduce ? <span className={fx.coverShimmer} aria-hidden="true" /> : null}
      <span className={fx.coverGlow} aria-hidden="true" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(ellipse_at_50%_120%,rgba(20,8,40,0.28),transparent_55%)]"
      />

      {!reduce
        ? bits.map((b, i) => (
            <span
              key={i}
              className={fx.coverFloat}
              style={{ left: b.left, top: b.top, fontSize: b.size, ...b.style }}
              aria-hidden="true"
            >
              {b.twinkle ? <Twinkle size={b.size} color={i % 2 ? '#FFD447' : '#ffffff'} /> : b.g}
            </span>
          ))
        : null}
    </div>
  );
}

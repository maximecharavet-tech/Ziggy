'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';
import { fx } from './toy';

export type BurstKind = 'confetti' | 'stars' | 'notes' | 'hearts';

const PALETTE = ['#FF7AB8', '#FFD447', '#5FB6EA', '#7FC85C', '#B07CFF', '#FF9F43'];
const NOTES = ['♪', '♫', '♩', '♬'];

/** Four-point twinkle, as in the mascot artwork. */
export function Twinkle({ size = 18, color = '#FFD447', className = '', style }: { size?: number; color?: string; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={style} aria-hidden="true">
      <path d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z" fill={color} />
    </svg>
  );
}

function rand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A short, joyful burst (confetti, stars, notes or hearts) from the centre of
 * the parent (which must be `relative`). It fires each time `fire` changes to
 * a new non-zero value, with at most 28 small DOM particles, transform and
 * opacity only. With reduced motion it is a soft glow instead.
 */
export function Burst({ fire, kind = 'confetti', count = 20, spread = 1, colors = PALETTE, className = '' }: { fire: number; kind?: BurstKind; count?: number; spread?: number; colors?: string[]; className?: string }) {
  const reduce = useReducedMotion();
  const [live, setLive] = useState<number | null>(null);

  useEffect(() => {
    if (!fire) return;
    setLive(fire);
    const t = window.setTimeout(() => setLive((v) => (v === fire ? null : v)), 1500);
    return () => window.clearTimeout(t);
  }, [fire]);

  const parts = useMemo(() => {
    if (live === null) return [];
    const r = rand(live * 7919 + kind.length);
    const n = Math.min(28, count);
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + r() * 0.5;
      const dist = (60 + r() * 70) * spread;
      return {
        dx: Math.cos(a) * dist,
        dy: Math.sin(a) * dist * 0.8 - 30 * spread,
        r: (r() - 0.5) * 540,
        s: 0.7 + r() * 0.6,
        delay: r() * 0.08,
        color: colors[i % colors.length],
        w: 6 + r() * 6,
        round: r() > 0.6,
        glyph: NOTES[i % NOTES.length],
      };
    });
  }, [live, kind, count, spread, colors]);

  if (live === null) return null;
  if (reduce) return <span key={live} className={fx.glowRing} aria-hidden="true" />;

  return (
    <span key={live} className={`pointer-events-none absolute inset-0 z-30 overflow-visible ${className}`} aria-hidden="true">
      {parts.map((p, i) => {
        const style = { '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--r': `${p.r}deg`, '--s': p.s, '--delay': `${p.delay}s` } as CSSProperties;
        if (kind === 'confetti')
          return <span key={i} className={fx.particle} style={{ ...style, width: p.w, height: p.round ? p.w : p.w * 0.55, borderRadius: p.round ? 999 : 2, backgroundColor: p.color }} />;
        if (kind === 'stars')
          return (
            <span key={i} className={fx.particle} style={style}>
              <Twinkle size={10 + p.w * 1.2} color={i % 3 === 0 ? '#ffffff' : p.color} />
            </span>
          );
        if (kind === 'hearts')
          return (
            <span key={i} className={fx.particle} style={{ ...style, color: p.color, fontSize: 12 + p.w * 1.3 }}>
              ♥
            </span>
          );
        return (
          <span key={i} className={`${fx.particle} font-black`} style={{ ...style, color: p.color, fontSize: 14 + p.w * 1.4, textShadow: '0 2px 0 rgba(0,0,0,0.12)' }}>
            {p.glyph}
          </span>
        );
      })}
    </span>
  );
}

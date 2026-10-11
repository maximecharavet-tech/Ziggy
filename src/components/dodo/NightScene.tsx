'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { DodoArt, DodoSky } from '@/data/dodo/types';

/** Night palettes: deep, low-contrast, warm glow — easy on sleepy eyes. */
export const SKY: Record<DodoSky, { top: string; bottom: string; glow: string }> = {
  indigo: { top: '#0b1030', bottom: '#2a2f6b', glow: '#f7d58b' },
  violet: { top: '#140c2e', bottom: '#4a2d73', glow: '#f2b8e6' },
  ocean: { top: '#04152b', bottom: '#0d4a6e', glow: '#9fe3ff' },
  forest: { top: '#071a17', bottom: '#1f4a3a', glow: '#d8f5a2' },
  dawn: { top: '#1d1640', bottom: '#b0607a', glow: '#ffd2a1' },
  snow: { top: '#0f1a33', bottom: '#5a7aa6', glow: '#ffffff' },
  rose: { top: '#1d0f2a', bottom: '#7a3a6b', glow: '#ffc1d9' },
  gold: { top: '#1a1233', bottom: '#8a6a3a', glow: '#ffe09a' },
};

function seeded(n: number) {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PARTICLE: Record<DodoArt['ambience'], { glyph: string; drift: number; count: number }> = {
  stars: { glyph: '✦', drift: 0, count: 26 },
  moon: { glyph: '✧', drift: 0, count: 18 },
  fireflies: { glyph: '•', drift: -18, count: 20 },
  snow: { glyph: '❄', drift: 40, count: 22 },
  bubbles: { glyph: '○', drift: -50, count: 16 },
  petals: { glyph: '❀', drift: 30, count: 16 },
  sunrise: { glyph: '✦', drift: 0, count: 10 },
};

/**
 * A scene drawn on the device: sky gradient, moon, slow particles, the hero
 * breathing gently in the middle and the props floating around. Shown until
 * the pre-generated illustration exists, and as the offline fallback.
 */
export function NightScene({ art, seed, still = false }: { art: DodoArt; seed: number; still?: boolean }) {
  const sky = SKY[art.sky];
  const p = PARTICLE[art.ambience];
  const dots = useMemo(() => {
    const r = seeded(seed);
    return Array.from({ length: p.count }, () => ({ x: r() * 100, y: r() * 70, s: 0.5 + r() * 1.1, d: 2.5 + r() * 4, delay: r() * 4 }));
  }, [seed, p.count]);
  const props = useMemo(() => {
    const r = seeded(seed + 99);
    const slots = [
      { x: 16, y: 62 },
      { x: 82, y: 58 },
      { x: 26, y: 30 },
      { x: 74, y: 26 },
      { x: 50, y: 82 },
    ];
    return art.props.slice(0, 5).map((e, i) => ({ e, ...slots[i], d: 5 + r() * 3, delay: r() * 2 }));
  }, [art.props, seed]);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: `linear-gradient(180deg, ${sky.top} 0%, ${sky.bottom} 100%)` }} aria-hidden="true">
      {/* Moon / sun glow */}
      <motion.div
        className="absolute rounded-full"
        style={{
          right: '12%',
          top: art.ambience === 'sunrise' ? '58%' : '10%',
          width: '13vmin',
          height: '13vmin',
          background: `radial-gradient(circle at 35% 35%, #fff, ${sky.glow} 60%, transparent 72%)`,
          boxShadow: `0 0 80px 30px ${sky.glow}40`,
        }}
        animate={still ? undefined : { scale: [1, 1.04, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      {dots.map((d, i) => (
        <motion.span
          key={i}
          className="absolute select-none"
          style={{ left: `${d.x}%`, top: `${d.y}%`, fontSize: `${d.s}rem`, color: sky.glow }}
          animate={still ? { opacity: 0.6 } : { opacity: [0.15, 0.85, 0.15], y: p.drift ? [0, p.drift] : 0 }}
          transition={{ duration: d.d, repeat: Infinity, delay: d.delay, ease: 'easeInOut' }}
        >
          {p.glyph}
        </motion.span>
      ))}
      {/* Soft hills */}
      <svg className="absolute bottom-0 left-0 h-[34%] w-full" viewBox="0 0 100 30" preserveAspectRatio="none">
        <path d="M0 18 Q20 8 40 16 T80 14 T100 12 V30 H0Z" fill="#000" opacity="0.25" />
        <path d="M0 24 Q25 16 50 22 T100 20 V30 H0Z" fill="#000" opacity="0.35" />
      </svg>
      {props.map((p2, i) => (
        <motion.span
          key={`${p2.e}-${i}`}
          className="absolute -translate-x-1/2 -translate-y-1/2 select-none"
          style={{ left: `${p2.x}%`, top: `${p2.y}%`, fontSize: '9vmin', filter: 'drop-shadow(0 6px 18px rgba(0,0,0,.35)) saturate(.85)' }}
          animate={still ? undefined : { y: [0, -8, 0], rotate: [0, i % 2 ? 4 : -4, 0] }}
          transition={{ duration: p2.d, repeat: Infinity, delay: p2.delay, ease: 'easeInOut' }}
        >
          {p2.e}
        </motion.span>
      ))}
      <motion.span
        className="absolute left-1/2 top-[50%] -translate-x-1/2 -translate-y-1/2 select-none"
        style={{ fontSize: '24vmin', filter: `drop-shadow(0 0 40px ${sky.glow}55) saturate(.9)` }}
        animate={still ? undefined : { scale: [1, 1.035, 1], y: [0, -6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        {art.hero}
      </motion.span>
    </div>
  );
}

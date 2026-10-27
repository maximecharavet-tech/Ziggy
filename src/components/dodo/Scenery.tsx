'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, type MotionValue } from 'framer-motion';
import type { DodoArt } from '@/data/dodo/types';
import { NightScene } from './NightScene';
import css from './dodo.module.css';

export function seeded(n: number) {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KB = [css.kbA, css.kbB, css.kbC, css.kbD];

/**
 * The scene's picture: the illustration drifting slowly (Ken Burns), cross-
 * fading softly into the next one; the night scene drawn on the device when
 * the illustration does not exist (yet) or cannot load.
 */
export function SceneArt({ id, src, art, seed, eager = true }: { id: string; src: string | null | undefined; art: DodoArt; seed: number; eager?: boolean }) {
  const [failed, setFailed] = useState<string[]>([]);
  const show = src && !failed.includes(src) ? src : null;
  // Still finding out whether an illustration exists: a calm dark sky, no flash of the drawn scene.
  const pending = src === undefined;
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={pending ? 'pending' : `${id}:${show ?? 'night'}`}
        className="absolute inset-0 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.6, ease: 'easeInOut' }}
      >
        {pending ? (
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#0b1036_0%,#1b1650_100%)]" />
        ) : show ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={show}
            alt=""
            decoding="async"
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={eager ? 'high' : 'auto'}
            className={`${css.kb} ${KB[seed % KB.length]}`}
            onError={() => setFailed((f) => [...f, show])}
          />
        ) : (
          <NightScene art={art} seed={seed * 7 + 3} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/** Soft golden sparkles rising slowly, at two depths (the far ones smaller and slower). */
export function Sparkles({ count = 14, seed = 1, className = '' }: { count?: number; seed?: number; className?: string }) {
  const dots = useMemo(() => {
    const r = seeded(seed);
    return Array.from({ length: count }, (_, i) => {
      const near = i % 3 === 0;
      return {
        left: r() * 100,
        top: 20 + r() * 75,
        size: near ? 7 + r() * 6 : 3 + r() * 3,
        dur: near ? 9 + r() * 4 : 14 + r() * 6,
        delay: -r() * 14,
        dx: (r() - 0.5) * (near ? 50 : 24),
        dy: -(near ? 70 + r() * 50 : 30 + r() * 25),
      };
    });
  }, [count, seed]);
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {dots.map((d, i) => (
        <span
          key={i}
          className={css.sparkle}
          style={
            {
              left: `${d.left}%`,
              top: `${d.top}%`,
              width: d.size,
              height: d.size,
              animationDuration: `${d.dur}s`,
              animationDelay: `${d.delay}s`,
              '--dx': `${d.dx}px`,
              '--dy': `${d.dy}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** A soft night cloud: a few overlapping glows, no hard edge and no blur filter. */
function Cloud({ className = '', style, opacity = 0.08 }: { className?: string; style?: CSSProperties; opacity?: number }) {
  const puff = (a: number) => `radial-gradient(closest-side, rgba(226,228,255,${a}) 0%, rgba(226,228,255,${a * 0.55}) 55%, rgba(226,228,255,0) 100%)`;
  return (
    <div className={`aspect-[3/1] ${className}`} style={style} aria-hidden="true">
      <div className="absolute inset-x-0 bottom-0 h-[62%]" style={{ background: puff(opacity) }} />
      <div className="absolute bottom-[22%] left-[16%] h-[70%] w-[38%]" style={{ background: puff(opacity * 0.9) }} />
      <div className="absolute bottom-[26%] left-[42%] h-[88%] w-[40%]" style={{ background: puff(opacity) }} />
    </div>
  );
}

type Layer = MotionValue<number> | number;

/**
 * A calm night sky: deep gradient, twinkling stars at two depths, slow
 * clouds, a glowing moon. The layers take an optional vertical offset so the
 * page can move them at different speeds (parallax).
 */
export function NightSky({
  seed = 7,
  stars = 70,
  moon = true,
  far = 0,
  near = 0,
  moonY = 0,
  className = 'absolute inset-0',
}: {
  seed?: number;
  stars?: number;
  moon?: boolean;
  far?: Layer;
  near?: Layer;
  moonY?: Layer;
  className?: string;
}) {
  const field = useMemo(() => {
    const r = seeded(seed);
    return Array.from({ length: stars }, (_, i) => ({
      x: r() * 100,
      y: r() * 100,
      s: i % 9 === 0 ? 3 : 1 + r() * 1.6,
      d: 3 + r() * 5,
      delay: -r() * 6,
      near: i % 3 === 0,
      glint: i % 17 === 0,
    }));
  }, [seed, stars]);
  const layer = (isNear: boolean) =>
    field
      .filter((s) => s.near === isNear)
      .map((s, i) =>
        s.glint ? (
          <span
            key={i}
            className={`${css.glint} select-none`}
            style={{ left: `${s.x}%`, top: `${s.y}%`, fontSize: 14, lineHeight: 1, animationDuration: `${s.d + 2}s`, animationDelay: `${s.delay}s` }}
          >
            ✦
          </span>
        ) : (
          <span key={i} className={css.star} style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDuration: `${s.d}s`, animationDelay: `${s.delay}s` }} />
        )
      );
  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#050822_0%,#0b1036_38%,#1b1650_72%,#2a1d5e_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(99,102,241,0.22),transparent_55%),radial-gradient(ellipse_at_85%_75%,rgba(217,70,239,0.12),transparent_55%)]" />
      <motion.div className="absolute inset-0" style={{ y: far }}>
        {layer(false)}
      </motion.div>
      <motion.div className="absolute inset-0" style={{ y: near }}>
        {layer(true)}
      </motion.div>
      {moon ? (
        <motion.div className="absolute right-[8%] top-[9%]" style={{ y: moonY }}>
          <Moon size="clamp(5rem, 12vw, 9rem)" />
        </motion.div>
      ) : null}
      <Cloud className={`${css.cloud} ${css.cloudAlt} left-[-8%] top-[20%] w-[52vw] max-w-[720px]`} style={{ animationDuration: '70s' }} opacity={0.11} />
      <Cloud className={`${css.cloud} ${css.cloudAlt} right-[-12%] top-[50%] w-[44vw] max-w-[600px]`} style={{ animationDuration: '90s', animationDelay: '-30s' }} opacity={0.09} />
      <Cloud className={`${css.cloud} ${css.cloudAlt} left-[28%] top-[80%] w-[60vw] max-w-[820px]`} style={{ animationDuration: '110s', animationDelay: '-60s' }} opacity={0.08} />
    </div>
  );
}

/** A warm, softly glowing moon. */
export function Moon({ size = '8rem', className = '' }: { size?: string; className?: string }) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <div className={`${css.moonHalo} absolute -inset-[70%] rounded-full bg-[radial-gradient(circle,rgba(255,226,160,0.32)_0%,rgba(255,214,140,0.12)_35%,transparent_68%)]`} />
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_34%_32%,#fffaf0_0%,#ffefc4_38%,#f6d58f_72%,#e8bd72_100%)] shadow-[inset_-10px_-12px_24px_rgba(190,130,60,0.35)]" />
      <div className="absolute left-[56%] top-[24%] h-[16%] w-[16%] rounded-full bg-[#e9c37f]/45" />
      <div className="absolute left-[28%] top-[58%] h-[11%] w-[11%] rounded-full bg-[#e9c37f]/40" />
      <div className="absolute left-[62%] top-[64%] h-[8%] w-[8%] rounded-full bg-[#e9c37f]/35" />
    </div>
  );
}

/** Rolling hills with a little house whose window glows: the end of the sky. */
export function Horizon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 220" preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="dodo-hill-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d1b55" />
          <stop offset="1" stopColor="#0c0d2c" />
        </linearGradient>
        <linearGradient id="dodo-hill-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141440" />
          <stop offset="1" stopColor="#070a1f" />
        </linearGradient>
        <radialGradient id="dodo-window" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M0 120 C 160 70 300 80 430 108 S 720 150 860 104 S 1100 60 1200 92 V220 H0Z" fill="url(#dodo-hill-a)" />
      <g transform="translate(905 64)">
        <circle cx="18" cy="26" r="34" fill="url(#dodo-window)" />
        <path d="M0 22 L18 6 L36 22 V44 H0Z" fill="#0e0f33" />
        <rect x="13" y="24" width="10" height="9" rx="2" fill="#ffd98a" />
      </g>
      <g fill="#0f1036">
        <path d="M250 96 l10 -26 l10 26z" />
        <path d="M268 98 l8 -20 l8 20z" />
        <path d="M1050 82 l9 -24 l9 24z" />
      </g>
      <path d="M0 160 C 200 120 380 140 560 158 S 900 190 1200 140 V220 H0Z" fill="url(#dodo-hill-b)" />
    </svg>
  );
}

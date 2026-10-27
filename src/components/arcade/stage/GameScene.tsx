'use client';

import { useEffect, type CSSProperties } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'framer-motion';
import type { ScenePalette } from './themes';
import { rgba } from './color';
import css from './stage.module.css';

const FAR = 'M0,190 C140,120 260,110 400,150 C540,190 640,120 800,105 C960,90 1080,160 1220,150 C1330,142 1390,120 1440,115 L1440,330 L0,330 Z';
const MID = 'M0,232 C120,190 250,172 380,200 C510,228 600,248 760,214 C920,180 1020,170 1160,200 C1290,228 1380,214 1440,204 L1440,330 L0,330 Z';
const NEAR = 'M0,272 C150,246 300,240 450,262 C600,284 720,290 880,268 C1040,246 1180,240 1300,258 C1370,268 1410,272 1440,270 L1440,330 L0,330 Z';

const MOTIF_SPOTS = [
  { x: 3, y: 22, s: 1, d: 5.2 },
  { x: 90, y: 25, s: 0.9, d: 6.1 },
  { x: 10, y: 45, s: 0.72, d: 4.6 },
  { x: 85, y: 47, s: 1.08, d: 5.6 },
  { x: 4, y: 68, s: 0.86, d: 6.4 },
  { x: 93, y: 70, s: 0.78, d: 4.9 },
];

const STARS = Array.from({ length: 22 }, (_, i) => ({ x: (i * 47 + 13) % 100, y: (i * 29 + 7) % 46, s: 2 + (i % 3), d: 1.8 + (i % 5) * 0.5 }));

const TREES = [
  { x: 7, y: 44, s: 1 },
  { x: 15, y: 50, s: 0.7 },
  { x: 71, y: 40, s: 0.85 },
  { x: 80, y: 47, s: 1.1 },
  { x: 93, y: 38, s: 0.75 },
  { x: 41, y: 56, s: 0.6 },
];

function Hill({ d, fill, x, className }: { d: string; fill: string; x: MotionValue<number>; className: string }) {
  return (
    <motion.svg className={`absolute -inset-x-[5%] bottom-0 w-[110%] ${className}`} viewBox="0 0 1440 330" preserveAspectRatio="none" style={{ x }}>
      <path d={d} fill={fill} />
      <path d={d.split(' L1440,330')[0]} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={3} vectorEffect="non-scaling-stroke" />
    </motion.svg>
  );
}

/**
 * The themed world behind a game: a gradient sky with a soft sun (or stars),
 * drifting clouds, three rows of hills in the game's own tints that slide
 * in parallax under the pointer, and the game's motifs floating in bubbles.
 * Purely decorative; calm and static when motion is reduced.
 */
export function GameScene({
  palette: p,
  motifs = [],
  horizon = '56vh',
  startOnly = false,
  className = '',
}: {
  palette: ScenePalette;
  motifs?: string[];
  horizon?: string;
  /** Keep the motifs on the start side (the other side is busy, e.g. Ziggy coaching). */
  startOnly?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 40, damping: 18 });
  const far = useTransform(sx, (v) => v * 8);
  const mid = useTransform(sx, (v) => v * 18);
  const near = useTransform(sx, (v) => v * 30);
  const front = useTransform(sx, (v) => v * 42);

  useEffect(() => {
    if (reduce) return;
    const fine = window.matchMedia('(pointer: fine)').matches;
    if (!fine) return;
    const move = (e: PointerEvent) => px.set((e.clientX / window.innerWidth) * 2 - 1);
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [reduce, px]);

  const bandTop = `calc(${horizon} - 20vh)`;
  const bandH = '30vh';

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`} aria-hidden="true">
      {/* Sky */}
      <div className="absolute inset-x-0 top-0" style={{ height: `calc(${bandTop} + ${bandH})`, background: `linear-gradient(180deg, ${p.skyTop} 0%, ${p.skyBottom} 78%)` }} />
      {/* Sun or moon glow */}
      <div
        className={`absolute rounded-full ${css.breathe}`}
        style={{
          right: '8%',
          top: '6vh',
          width: 'min(34vw, 340px)',
          aspectRatio: '1',
          background: p.night
            ? `radial-gradient(circle, ${rgba('#FFFFFF', 0.9)} 0 9%, ${rgba(p.sun, 0.35)} 18%, transparent 62%)`
            : `radial-gradient(circle, #FFF7D6 0 12%, ${rgba(p.sun, 0.7)} 22%, ${rgba(p.sun, 0)} 66%)`,
        }}
      />
      {p.night ? (
        // Moonlit haze at the very top: the site's light navbar stays readable over a night sky.
        <div className="absolute inset-x-0 top-0 h-36 dark:hidden" style={{ background: 'linear-gradient(180deg, rgba(226,220,255,0.92) 0, rgba(196,186,255,0.45) 72px, rgba(170,160,255,0) 144px)' }} />
      ) : null}
      {p.night ? (
        STARS.map((s, i) => (
          <span
            key={i}
            className={`absolute rounded-full bg-white ${css.twinkle}`}
            style={{ left: `${s.x}%`, top: `${s.y}vh`, width: s.s, height: s.s, '--dur': `${s.d}s`, '--delay': `${-i * 0.37}s` } as CSSProperties}
          />
        ))
      ) : (
        [
          { top: '7vh', w: 220, dur: 110, delay: -20, o: 0.9 },
          { top: '17vh', w: 150, dur: 80, delay: -55, o: 0.75 },
          { top: '27vh', w: 190, dur: 140, delay: -95, o: 0.6 },
        ].map((c, i) => (
          <div key={i} className={css.cloudTrack} style={{ top: c.top, '--dur': `${c.dur}s`, '--delay': `${c.delay}s` } as CSSProperties}>
            <svg width={c.w} height={c.w * 0.42} viewBox="0 0 200 84" style={{ opacity: c.o }}>
              <path d="M30 78 C8 78 4 52 26 48 C24 24 54 14 70 30 C80 6 122 4 132 30 C150 18 178 28 172 52 C196 54 196 78 172 78 Z" fill="#FFFFFF" />
              <path d="M30 78 C14 78 10 66 18 60 C30 70 150 72 186 64 C190 74 184 78 172 78 Z" fill="rgba(160,190,230,0.25)" />
            </svg>
          </div>
        ))
      )}

      {/* Hills */}
      <div className="absolute inset-x-0" style={{ top: bandTop, height: bandH }}>
        <Hill d={FAR} fill={p.far} x={far} className="h-full" />
        <Hill d={MID} fill={p.mid} x={mid} className="h-[86%]" />
        <motion.div className="absolute -inset-x-[5%] bottom-0 h-full" style={{ x: mid }}>
          {TREES.map((t, i) => (
            <span key={i} className="absolute flex flex-col items-center" style={{ left: `${t.x}%`, top: `${t.y}%`, transform: `scale(${t.s})` }}>
              <span className="block h-7 w-7 rounded-full sm:h-9 sm:w-9" style={{ background: `radial-gradient(circle at 35% 30%, ${rgba('#FFFFFF', 0.35)}, transparent 55%), ${p.near}` }} />
              <span className="-mt-1 block h-3 w-1.5 rounded-b" style={{ background: p.night ? '#0d0a26' : rgba('#5B4636', 0.55) }} />
            </span>
          ))}
        </motion.div>
        <Hill d={NEAR} fill={p.near} x={near} className="h-[60%]" />
      </div>
      {/* Ground: the nearest hill carried on down the page */}
      <div className="absolute inset-x-0 bottom-0" style={{ top: `calc(${bandTop} + ${bandH} - 2px)`, background: `linear-gradient(180deg, ${p.near} 0, ${p.groundDeep} 60vh)` }} />

      {/* Floating motifs */}
      {motifs.length ? (
        <motion.div className={`absolute inset-0 ${startOnly ? 'hidden lg:block' : ''}`} style={{ x: front }}>
          {MOTIF_SPOTS.map((m, i) => {
            if (startOnly && m.x > 50) return null;
            const e = motifs[i % motifs.length];
            const size = 64 * m.s;
            return (
              <span
                key={i}
                className={`absolute grid place-items-center rounded-full ${css.bob}`}
                style={
                  {
                    insetInlineStart: `${m.x}%`,
                    top: `${m.y}vh`,
                    width: size,
                    height: size,
                    fontSize: size * 0.52,
                    background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.85), rgba(255,255,255,0.28) 45%, ${rgba(p.accent, 0.12)} 100%)`,
                    boxShadow: `inset 0 -6px 14px ${rgba(p.accent, 0.18)}, 0 12px 26px -12px ${rgba(p.accent, 0.5)}`,
                    '--dur': `${m.d}s`,
                    '--delay': `${-i * 0.9}s`,
                    '--r0': `${i % 2 ? 6 : -6}deg`,
                    '--r1': `${i % 2 ? -4 : 4}deg`,
                  } as CSSProperties
                }
              >
                {e}
              </span>
            );
          })}
        </motion.div>
      ) : null}
      {/* Dark theme: dusk over the whole scene */}
      {!p.night ? <div className="absolute inset-0 hidden bg-[#0A0A1A]/60 dark:block" /> : null}
    </div>
  );
}

'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { animate, motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { playSound } from '@/lib/sound';
import { Burst, SparkleIcon } from './Burst';
import { darken, lighten, rgba, strong } from './color';
import css from './stage.module.css';

/** Sticker-style 3D title: coloured letters, a white outline and a deep extrusion; words pop in. */
export function Title3D({ text, color, className = '', delay = 0, as = 'h1', id }: { text: string; color: string; className?: string; delay?: number; as?: 'h1' | 'h2'; id?: string }) {
  const ink = darken(strong(color), 0.18);
  const deep = darken(strong(color), 0.5);
  const o = 3;
  const outline = [`${-o}px ${-o}px 0 #fff`, `${o}px ${-o}px 0 #fff`, `${-o}px ${o}px 0 #fff`, `${o}px ${o}px 0 #fff`, `0 ${-o}px 0 #fff`, `0 ${o}px 0 #fff`, `${-o}px 0 0 #fff`, `${o}px 0 0 #fff`];
  const extrude = [`0 ${o + 4}px 0 ${deep}`, `${o}px ${o + 3}px 0 ${deep}`, `${-o}px ${o + 3}px 0 ${deep}`, `0 ${o + 12}px 18px ${rgba(deep, 0.35)}`];
  const Tag = as;
  const words = text.split(' ');
  return (
    <Tag id={id} dir="auto" className={`font-display font-bold leading-[1.08] tracking-tight ${className}`} style={{ color: ink, textShadow: [...outline, ...extrude].join(', ') }}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`}>
          <motion.span
            className="inline-block max-w-full [overflow-wrap:anywhere]"
            initial={{ y: 36, opacity: 0, rotateX: -75, scale: 0.6 }}
            animate={{ y: 0, opacity: 1, rotateX: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 15, delay: delay + i * 0.08 }}
            style={{ transformPerspective: 600 }}
          >
            {w}
          </motion.span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </Tag>
  );
}

/** The game's emoji as a glossy 3D token, swaying in space above its own shadow. */
export function GameToken({ emoji, color, size = 104, className = '' }: { emoji: string; color: string; size?: number; className?: string }) {
  const base = strong(color);
  return (
    <div className={`pointer-events-none flex flex-col items-center ${className}`} style={{ perspective: 600 }} aria-hidden="true">
      <div className={css.sway} style={{ '--dur': '5.5s' } as CSSProperties}>
        <div
          className="relative grid place-items-center rounded-full"
          style={{
            width: size,
            height: size,
            fontSize: size * 0.5,
            background: `radial-gradient(circle at 34% 28%, ${lighten(base, 0.7)} 0%, ${lighten(base, 0.25)} 38%, ${base} 72%, ${darken(base, 0.18)} 100%)`,
            boxShadow: `inset 0 -${size * 0.07}px ${size * 0.12}px ${rgba(darken(base, 0.4), 0.45)}, inset 0 ${size * 0.04}px 0 rgba(255,255,255,0.6), 0 ${size * 0.08}px 0 ${darken(base, 0.32)}`,
          }}
        >
          <span className="absolute inset-[9%] rounded-full border-2 border-white/40" />
          <span className="relative drop-shadow-[0_4px_3px_rgba(0,0,0,0.25)]">{emoji}</span>
          <span className="absolute left-[18%] top-[12%] h-[22%] w-[34%] -rotate-[24deg] rounded-full bg-white/55 blur-[1px]" />
          <SparkleIcon size={size * 0.2} color="#FFFFFF" className={`absolute -right-1 top-0 ${css.twinkle}`} />
        </div>
      </div>
      <div className={`mt-3 rounded-[50%] ${css.breathe}`} style={{ width: size * 0.7, height: size * 0.12, background: rgba(darken(base, 0.5), 0.22) }} />
    </div>
  );
}

/** A soft speech bubble with a tail; `tail` says where the speaker stands. */
export function SpeechBubble({ children, color, tail = 'start', className = '' }: { children: ReactNode; color: string; tail?: 'start' | 'top' | 'bottom' | 'auto' | 'none'; className?: string }) {
  const rim = lighten(color, 0.55);
  const tailCls =
    tail === 'start'
      ? '-start-2 top-7 rotate-45 border-b-[3px] border-s-[3px]'
      : tail === 'top'
        ? 'left-1/2 -top-2 -translate-x-1/2 rotate-45 border-s-[3px] border-t-[3px]'
        : tail === 'bottom'
          ? 'left-1/2 -bottom-2 -translate-x-1/2 rotate-45 border-b-[3px] border-e-[3px]'
          : tail === 'auto'
            ? // Points up to the speaker on phones, sideways to it on wide screens.
              'left-1/2 -top-[11px] -translate-x-1/2 rotate-45 border-s-[3px] border-t-[3px] lg:left-auto lg:-start-[11px] lg:top-1/2 lg:-translate-y-1/2 lg:translate-x-0 lg:border-t-0 lg:border-b-[3px] rtl:lg:translate-x-0'
            : 'hidden';
  return (
    <div className={`relative rounded-[1.6rem] border-[3px] bg-bg-card px-5 py-4 shadow-[0_6px_0_rgba(40,30,80,0.06),0_18px_36px_-18px_rgba(40,30,80,0.35)] ${className}`} style={{ borderColor: rim }}>
      <span className={`absolute h-5 w-5 bg-bg-card ${tailCls}`} style={{ borderColor: rim }} aria-hidden="true" />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Slowly turning rays of light behind a celebration. */
export function Sunburst({ color, className = '' }: { color: string; className?: string }) {
  const rays = Array.from({ length: 16 }, (_, i) => `${rgba('#FFFFFF', i % 2 ? 0 : 0.55)} ${i * 22.5}deg ${(i + 1) * 22.5}deg`).join(', ');
  return (
    <div className={`pointer-events-none absolute aspect-square ${className}`} aria-hidden="true" style={{ maskImage: 'radial-gradient(closest-side, #000 30%, transparent 100%)', WebkitMaskImage: 'radial-gradient(closest-side, #000 30%, transparent 100%)' }}>
      <div className={`absolute inset-0 rounded-full ${css.spin}`} style={{ background: `conic-gradient(${rays})`, '--dur': '60s' } as CSSProperties} />
      <div className="absolute inset-[20%] rounded-full" style={{ background: `radial-gradient(closest-side, ${rgba('#FFF4C2', 0.9)}, ${rgba(color, 0.15)} 70%, transparent)` }} />
    </div>
  );
}

const STAR = 'M12 1.8l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17l-6.1 3.4 1.4-6.8L2.2 8.9l6.9-.8z';

function StarShape({ size, filled }: { size: number; filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {filled ? (
        <>
          <defs>
            <linearGradient id="zg-star" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFF3A3" />
              <stop offset="0.45" stopColor="#FCD34D" />
              <stop offset="1" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
          <path d={STAR} transform="translate(0 1.2)" fill="#C2410C" opacity="0.55" strokeLinejoin="round" stroke="#C2410C" strokeWidth="1.6" />
          <path d={STAR} fill="url(#zg-star)" stroke="#D97706" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M8.2 8.6c1.4-.4 2.4-1.6 2.9-3" stroke="#FFFBEB" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.9" />
        </>
      ) : (
        <path d={STAR} fill="rgba(255,255,255,0.35)" stroke="rgba(120,110,150,0.45)" strokeWidth="1.4" strokeDasharray="2.2 2" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/**
 * Three star slots; the earned stars fly in one after the other, land with
 * a bounce and a sparkle burst. Slots not earned stay softly outlined —
 * waiting for next time, never a "lost" star.
 */
export function StarTray({ stars, color, size = 84, delay = 0.5 }: { stars: number; color: string; size?: number; delay?: number }) {
  const reduce = useReducedMotion();
  const [landed, setLanded] = useState(0);
  return (
    <div className="flex items-end justify-center gap-3 sm:gap-5" dir="ltr">
      {[1, 2, 3].map((n) => {
        const earned = n <= stars;
        const big = n === 2 ? 1.18 : 1;
        return (
          <div key={n} className="relative grid place-items-center" style={{ width: size * big, height: size * big, marginBottom: n === 2 ? 14 : 0 }}>
            <span className="absolute inset-[8%] rounded-full" style={{ background: `radial-gradient(closest-side, ${rgba(color, 0.18)}, transparent)` }} />
            <span className="absolute inset-0 grid place-items-center">
              <StarShape size={size * big} filled={false} />
            </span>
            {earned ? (
              <motion.span
                className="absolute inset-0 grid place-items-center drop-shadow-[0_8px_10px_rgba(180,83,9,0.35)]"
                initial={reduce ? false : { x: (2 - n) * 60 - 40, y: 220, scale: 0.2, rotate: -260, opacity: 0 }}
                animate={{ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 170, damping: 13, delay: delay + (n - 1) * 0.42 }}
                onAnimationComplete={() => {
                  setLanded((l) => Math.max(l, n));
                  if (!reduce) playSound('star');
                }}
              >
                <StarShape size={size * big} filled />
              </motion.span>
            ) : null}
            {landed >= n ? <Burst fire={n} color={color} count={10} spread={size * 0.9} /> : null}
          </div>
        );
      })}
    </div>
  );
}

/** A number that counts up from 0 (immediately final for reduced motion). */
export function CountUp({ value, delay = 0, className = '' }: { value: number; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setN(value);
      return;
    }
    const c = animate(0, value, { duration: 1.1, delay, ease: 'easeOut', onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [value, delay, reduce]);
  return <span className={`tabular-nums ${className}`}>{n}</span>;
}

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SayButton } from '@/components/arcade/read-aloud';
import { discoveryById } from '@/games2d/sandbox/content';
import type { Reaction } from '@/games2d/sandbox/sim';
import { tr } from '@/lib/i18n-text';
import { Equation } from './Notebook';

export interface Celebrate {
  id: Reaction;
  /** Where it happened on screen. */
  from: { x: number; y: number };
}

const TEXT = {
  eyebrow: { fr: 'Nouvelle découverte !', en: 'New discovery!' },
  keep: { fr: 'Dans mon carnet !', en: 'Into my notebook!' },
};

const STARS = [
  { x: -150, y: -70, d: 0 },
  { x: 150, y: -80, d: 0.15 },
  { x: -165, y: 50, d: 0.3 },
  { x: 160, y: 60, d: 0.1 },
  { x: -40, y: -120, d: 0.25 },
  { x: 60, y: 115, d: 0.35 },
];

/**
 * A discovery: the card pops out of the spot where it happened, shines for a
 * moment, then flies into the notebook (straight away with its button).
 */
export function Celebration({ item, locale, target, reduceMotion, onDone }: { item: Celebrate; locale: string; target: () => { x: number; y: number } | null; reduceMotion: boolean; onDone: () => void }) {
  const d = discoveryById(item.id);
  const [phase, setPhase] = useState<'show' | 'fly'>('show');
  const [to, setTo] = useState({ x: 0, y: 0 });
  const [origin] = useState(() => ({ x: typeof window === 'undefined' ? 0 : window.innerWidth / 2, y: typeof window === 'undefined' ? 0 : Math.min(window.innerHeight * 0.38, 330) }));

  const fly = () => {
    if (phase === 'fly') return;
    const t = target();
    setTo(t ? { x: t.x - origin.x, y: t.y - origin.y } : { x: 0, y: -origin.y });
    setPhase('fly');
  };

  useEffect(() => {
    const t = setTimeout(fly, 4200);
    return () => clearTimeout(t);
    // Starts once per card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!d) return null;
  const start = { x: item.from.x - origin.x, y: item.from.y - origin.y };
  return (
    <div className="pointer-events-none fixed left-0 top-0 z-[70]" style={{ transform: `translate(${origin.x}px, ${origin.y}px)` }}>
      <motion.div
        role="status"
        aria-live="polite"
        className="absolute w-[min(88vw,22rem)] -translate-x-1/2 -translate-y-1/2"
        initial={reduceMotion ? { opacity: 0 } : { x: start.x, y: start.y, scale: 0.15, opacity: 0, rotate: -12 }}
        animate={
          phase === 'show'
            ? { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }
            : reduceMotion
              ? { opacity: 0 }
              : { x: to.x, y: to.y, scale: 0.08, opacity: 0.3, rotate: 10 }
        }
        transition={phase === 'show' ? { type: 'spring', stiffness: 170, damping: 17 } : { duration: 0.75, ease: [0.55, 0, 0.75, 0.25] }}
        onAnimationComplete={() => phase === 'fly' && onDone()}
      >
        {!reduceMotion && phase === 'show'
          ? STARS.map((s, k) => (
              <motion.span
                key={k}
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 text-2xl"
                initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                animate={{ x: s.x, y: s.y, scale: [0, 1.3, 1], opacity: [0, 1, 0.9], rotate: [0, 90, 180] }}
                transition={{ delay: 0.15 + s.d, duration: 0.9 }}
              >
                {k % 2 ? '✨' : '⭐'}
              </motion.span>
            ))
          : null}
        <div className="relative overflow-hidden rounded-[28px] bg-white p-5 text-center text-[#1f1b3a] shadow-[0_30px_80px_-20px_rgba(20,10,60,0.6)]" style={{ boxShadow: `0 0 0 4px ${d.color}55, 0 30px 80px -20px rgba(20,10,60,0.6), 0 0 60px ${d.color}66` }}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24" style={{ background: `radial-gradient(120% 100% at 50% 0%, ${d.color}40, transparent 70%)` }} aria-hidden="true" />
          <p className="relative text-xs font-black uppercase tracking-[0.18em]" style={{ color: d.color }}>
            ✨ {tr(TEXT.eyebrow, locale)}
          </p>
          <div className="relative mt-3">
            <Equation d={d} size="lg" />
          </div>
          <h3 className="relative mt-3 font-display text-2xl font-bold">{tr(d.title, locale)}</h3>
          <p className="relative mt-1.5 text-[15px] leading-snug text-[#4b4669]">{tr(d.science, locale)}</p>
          {/* Only the buttons catch taps: the child can keep drawing under the card. */}
          <div className="pointer-events-auto relative mt-4 flex items-center justify-center gap-3">
            <SayButton texts={[tr(d.title, locale), tr(d.science, locale)]} locale={locale} />
            <button type="button" onClick={(e) => (e.stopPropagation(), fly())} className="rounded-full px-5 py-3 text-sm font-black text-white shadow-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2" style={{ backgroundColor: d.color, outlineColor: `${d.color}88` }}>
              📒 {tr(TEXT.keep, locale)}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

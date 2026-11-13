'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue } from 'motion/react';
import { useLocale } from 'next-intl';
import { tr, type L } from '@/lib/i18n-text';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import type { Prank } from '@/data/lutins/pranks';
import { favouritesFirst, rng } from '@/lib/lutins/family';
import { sfx } from '@/components/lutins/sfx';
import { BodyPortal } from '@/components/lutins/BodyPortal';

/**
 * "La roue des farces": a festive wheel of up to 10 pranks of the chosen room
 * (favourites first), that spins with a ratchet sound and lands on one.
 */

const T = {
  title: { fr: 'La roue des farces', en: 'The prank wheel' },
  lead: { fr: 'Pas d’idée ce soir ? Laissez la roue choisir.', en: 'No idea tonight? Let the wheel choose.' },
  spin: { fr: 'Tourner la roue', en: 'Spin the wheel' },
  again: { fr: 'Relancer', en: 'Spin again' },
  picked: { fr: 'La roue a choisi :', en: 'The wheel picked:' },
  take: { fr: 'Choisir cette farce', en: 'Pick this prank' },
  close: { fr: 'Fermer', en: 'Close' },
} satisfies Record<string, L>;

const MAX = 10;
const COLORS = ['#c92a2a', '#2b8a3e', '#e8590c', '#1864ab', '#a61e4d', '#5f3dc4'];

/** Pie slice path (angles in degrees, clockwise from the top), on a 200×200 box. */
function slice(a0: number, a1: number, r = 92) {
  const p = (a: number) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return `${(100 + Math.cos(rad) * r).toFixed(2)} ${(100 + Math.sin(rad) * r).toFixed(2)}`;
  };
  return `M100 100 L${p(a0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)} Z`;
}

export function PrankWheel({ pranks, favs, onPick, onClose }: { pranks: Prank[]; favs: string[]; onPick: (id: string) => void; onClose: () => void }) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  // The slices: favourites first, then a random handful (made once, when the wheel opens).
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  const items = useMemo(() => {
    const r = rng(seed);
    const shuffled = [...pranks]
      .map((p) => ({ p, k: r() }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.p);
    return favouritesFirst(shuffled, favs).slice(0, MAX);
  }, [pranks, favs, seed]);
  const seg = 360 / Math.max(1, items.length);
  const rot = useMotionValue(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Prank | null>(null);
  const [flick, setFlick] = useState(0);
  const lastSeg = useRef(0);
  const lastT = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const spin = () => {
    if (spinning || !items.length) return;
    const i = Math.floor(Math.random() * items.length);
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const r0 = rot.get();
    const base = r0 - (((r0 % 360) + 360) % 360);
    const target = base + 360 * 6 + (360 - (i + 0.5) * seg - jitter);
    setResult(null);
    sfx.tick();
    const land = () => {
      setSpinning(false);
      setResult(items[i]);
      sfx.jingle();
    };
    if (reduced) {
      rot.set(target);
      land();
      return;
    }
    setSpinning(true);
    lastSeg.current = Math.floor(r0 / seg);
    animate(rot, target, {
      duration: 4.6,
      ease: [0.12, 0.75, 0.18, 1],
      onUpdate: (v) => {
        const s = Math.floor(v / seg);
        if (s !== lastSeg.current) {
          lastSeg.current = s;
          const now = performance.now();
          const gap = now - lastT.current;
          lastT.current = now;
          // Don't machine-gun the speaker at full speed.
          if (gap > 45) {
            sfx.tick(Math.min(1, 120 / Math.max(gap, 1)));
            setFlick((f) => f + 1);
          }
        }
      },
      onComplete: land,
    });
  };

  return (
    <BodyPortal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-[#0b0a26]/92 px-4 pb-10 pt-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label={tr(T.title, locale)}
      >
        <div className="mx-auto flex max-w-md flex-col items-center text-center text-white">
          <div className="flex w-full justify-end">
            <button type="button" onClick={onClose} className="min-h-12 rounded-full bg-white/15 px-5 font-bold ring-1 ring-white/30">
              ✕ {tr(T.close, locale)}
            </button>
          </div>
          <h2 className="mt-2 font-display text-3xl font-bold">🎡 {tr(T.title, locale)}</h2>
          <p className="mt-1 text-white/80">{tr(T.lead, locale)}</p>

          <div className="relative mt-6 aspect-square w-[min(84vw,340px)]">
            {/* Glow */}
            <div aria-hidden="true" className="absolute inset-[-8%] rounded-full bg-[radial-gradient(circle,rgba(255,212,59,0.35),transparent_65%)]" />
            <motion.div className="relative h-full w-full" style={{ rotate: rot }}>
              <svg viewBox="0 0 200 200" className="h-full w-full drop-shadow-[0_18px_30px_rgba(0,0,0,0.55)]" aria-hidden="true">
                <circle cx="100" cy="100" r="99" fill="#7a4a1d" />
                <circle cx="100" cy="100" r="96" fill="#f5c542" />
                {items.map((p, i) => (
                  <g key={p.id}>
                    <path d={slice(i * seg, (i + 1) * seg)} fill={COLORS[i % COLORS.length]} stroke="#fffaf0" strokeWidth="1.2" />
                    <text x="100" y="34" textAnchor="middle" dominantBaseline="middle" fontSize={items.length > 8 ? 17 : 20} transform={`rotate(${(i + 0.5) * seg} 100 100)`}>
                      {p.emoji}
                    </text>
                  </g>
                ))}
                {/* Bulbs on the rim */}
                {Array.from({ length: 20 }, (_, i) => {
                  const a = ((i * 18 - 90) * Math.PI) / 180;
                  return <circle key={i} cx={100 + Math.cos(a) * 94} cy={100 + Math.sin(a) * 94} r="2.2" fill={i % 2 ? '#fff9db' : '#ffd43b'} />;
                })}
                <circle cx="100" cy="100" r="20" fill="#f5c542" stroke="#7a4a1d" strokeWidth="3" />
                <circle cx="100" cy="100" r="13" fill="#c92a2a" />
                <text x="100" y="101" textAnchor="middle" dominantBaseline="middle" fontSize="13">
                  ⭐
                </text>
              </svg>
            </motion.div>
            {/* Pointer */}
            <motion.div
              key={flick}
              aria-hidden="true"
              initial={reduced ? false : { rotate: -18 }}
              animate={{ rotate: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 14 }}
              className="absolute left-1/2 top-[-6%] h-[16%] w-[12%] origin-top -translate-x-1/2"
            >
              <svg viewBox="0 0 40 52" className="h-full w-full drop-shadow-[0_4px_4px_rgba(0,0,0,0.45)]">
                <path d="M20 50 L4 12 A16 16 0 1 1 36 12 Z" fill="#fffaf0" stroke="#7a4a1d" strokeWidth="3" strokeLinejoin="round" />
                <circle cx="20" cy="14" r="6" fill="#c92a2a" />
              </svg>
            </motion.div>
          </div>

          <div className="mt-6 min-h-[9.5rem] w-full" aria-live="polite">
            {result ? (
              <motion.div initial={reduced ? false : { opacity: 0, y: 12, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="rounded-[1.5rem] bg-white p-4 text-[#1b2150] shadow-xl">
                <p className="text-sm font-bold uppercase tracking-wide text-[#5c6390]">{tr(T.picked, locale)}</p>
                <p className="mt-1 flex items-center justify-center gap-2 font-display text-2xl font-bold">
                  <span className="text-4xl" aria-hidden="true">
                    {result.emoji}
                  </span>
                  {tr(result.title, locale)}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <button type="button" onClick={() => onPick(result.id)} className="min-h-14 rounded-full bg-[#2fb344] px-6 font-display text-lg font-bold text-white shadow">
                    ✓ {tr(T.take, locale)}
                  </button>
                  <button type="button" onClick={spin} className="min-h-14 rounded-full bg-[#1b2150]/10 px-6 font-display text-lg font-bold">
                    🔁 {tr(T.again, locale)}
                  </button>
                </div>
              </motion.div>
            ) : (
              <button
                type="button"
                onClick={spin}
                disabled={spinning}
                className="min-h-16 w-full max-w-xs rounded-full bg-gradient-to-r from-[#c92a2a] to-[#f03e3e] px-8 font-display text-2xl font-bold text-white shadow-[0_8px_0_#8a1c1c] transition-transform active:translate-y-1 active:shadow-[0_3px_0_#8a1c1c] disabled:opacity-70"
              >
                {spinning ? '🎡 …' : `🎡 ${tr(T.spin, locale)}`}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </BodyPortal>
  );
}

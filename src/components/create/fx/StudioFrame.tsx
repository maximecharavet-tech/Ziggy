'use client';

import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { SayButton } from '@/components/arcade/read-aloud';
import { SplitWords } from '@/components/ui/motion-primitives';
import { Link } from '@/i18n/navigation';
import { tr } from '@/lib/i18n-text';
import { Twinkle } from './Burst';
import { DepthProvider, Layer, useAwake, usePointerDepth } from './Parallax';
import { alpha, fx, loop, shade } from './toy';

const BACK = { fr: 'L’Atelier', en: 'Workshop' };

/**
 * The page frame of the Makers' Workshop studios: a coloured wash, a back
 * button to the workshop, a title with floating props at different depths,
 * the read-aloud button, then the studio itself.
 */
export function StudioFrame({
  eyebrow,
  emoji,
  title,
  subtitle,
  color,
  locale,
  props = [],
  children,
  wide = false,
  say,
}: {
  /** What the 🔊 button reads (title and subtitle by default). */
  say?: string[];
  eyebrow: string;
  emoji: string;
  title: string;
  subtitle: string;
  color: string;
  locale: string;
  /** Floating emoji around the title. */
  props?: string[];
  children: ReactNode;
  wide?: boolean;
}) {
  const p = usePointerDepth<HTMLElement>({ global: true });
  const awake = useAwake(p.ref);
  const spots = [
    { x: '6%', y: '18%', d: 18, s: 'text-4xl', dur: 4 },
    { x: '88%', y: '12%', d: 26, s: 'text-5xl', dur: 5 },
    { x: '12%', y: '72%', d: 30, s: 'text-3xl', dur: 4.6 },
    { x: '84%', y: '70%', d: 22, s: 'text-4xl', dur: 3.8 },
  ];
  return (
    <div className="relative min-h-screen overflow-clip px-4 pb-24 pt-24 sm:px-6 sm:pt-28 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(70% 45% at 50% 0%, ${alpha(color, 0.2)}, transparent 70%), radial-gradient(40% 40% at 100% 40%, ${alpha(shade(color, 0.3), 0.18)}, transparent 70%), radial-gradient(40% 40% at 0% 70%, rgba(255,212,71,0.12), transparent 70%)` }}
      />
      <div className={`relative mx-auto ${wide ? 'max-w-6xl' : 'max-w-5xl'}`}>
        <header ref={p.ref} data-still={awake ? undefined : ''} className="relative pb-2 pt-2 text-center">
          <DepthProvider x={p.x} y={p.y}>
            {props.slice(0, 4).map((e, i) => (
              <Layer key={i} depth={spots[i].d} className={`hidden sm:block ${spots[i].s}`} style={{ left: spots[i].x, top: spots[i].y }}>
                <span className={`block drop-shadow-[0_8px_8px_rgba(40,10,60,0.18)] ${fx.bob}`} style={loop({ dur: spots[i].dur, delay: i * 0.5, tilt: i % 2 ? -8 : 8, amp: -10 })}>
                  {e}
                </span>
              </Layer>
            ))}
            <Layer depth={14} className="left-[24%] top-[6%] hidden sm:block">
              <Twinkle size={18} color="#FFD447" className={fx.twinkle} style={loop({ dur: 2.6 })} />
            </Layer>
            <Layer depth={20} className="right-[22%] top-[60%] hidden sm:block">
              <Twinkle size={14} color={color} className={fx.twinkle} style={loop({ dur: 3.1, delay: 0.8 })} />
            </Layer>
          </DepthProvider>
          <div className="relative flex items-center justify-center">
            <div className="absolute start-0 top-0 hidden md:block">
              <Link href="/creer" className={`${fx.toy} ${fx.light} inline-flex h-14 items-center gap-2 rounded-full px-4 font-display text-base font-bold`} style={{ '--ink': shade(color, -0.4) } as CSSProperties}>
                <span aria-hidden="true" className="inline-block rtl:-scale-x-100">
                  ←
                </span>
                <span aria-hidden="true">🧰</span> {tr(BACK, locale)}
              </Link>
            </div>
            <motion.span
              initial={{ opacity: 0, y: 10, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-black uppercase tracking-[0.12em] shadow-[0_6px_14px_-8px_rgba(60,20,120,0.5)] ring-1 ring-white/70"
              style={{ color: shade(color, -0.3), background: `linear-gradient(180deg, #ffffff, ${alpha(color, 0.14)})` }}
            >
              <span aria-hidden="true" className="text-lg leading-none">
                {emoji}
              </span>
              {eyebrow}
            </motion.span>
          </div>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-[2.3rem] font-bold leading-[1.05] text-text-body text-balance sm:text-5xl lg:text-[3.4rem]">
            <SplitWords text={title} />
          </h1>
          <div className="mx-auto mt-3 flex max-w-2xl items-center justify-center gap-3">
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="text-base leading-snug text-text-muted sm:text-lg">
              {subtitle}
            </motion.p>
            <SayButton texts={say ?? [title, subtitle]} locale={locale} />
          </div>
        </header>
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, type: 'spring', stiffness: 120, damping: 18 }} className="relative mt-8">
          {children}
        </motion.section>
      </div>
    </div>
  );
}

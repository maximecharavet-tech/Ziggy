'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Sparkles, ArrowRight, Play, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { ZiggyRobot } from '@/components/ziggy/ZiggyRobot';
import { ZiggyLogo } from '@/components/ziggy/ZiggyLogo';
import { StarBurst } from '@/components/ziggy/StarBurst';
import { useSound } from '@/hooks/useSound';
import type { SiteConfig } from '@/lib/site-config';

const ease = [0.22, 1, 0.36, 1] as const;

const rise = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.1 + i * 0.1, duration: 0.8, ease } }),
};

/** Four-point sparkle, as in the mascot artwork. */
function Sparkle({ className = '', color = '#FBBF24', delay = 0 }: { className?: string; color?: string; delay?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`absolute animate-twinkle ${className}`}
      style={{ animationDelay: `${delay}s` }}
      aria-hidden="true"
    >
      <path d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z" fill={color} />
    </svg>
  );
}

export function HeroSection({ stats: figures }: { stats: SiteConfig['stats'] }) {
  const t = useTranslations('hero');
  const { play } = useSound();
  const [happy, setHappy] = useState(false);

  const cheer = () => {
    play('pop');
    setHappy(true);
    setTimeout(() => setHappy(false), 1800);
  };

  const stats = [
    { value: figures.children, label: t('stats_children'), tint: 'text-leaf' },
    { value: figures.sessions, label: t('stats_sessions'), tint: 'text-sky' },
    { value: figures.countries, label: t('stats_countries'), tint: 'text-coral' },
    { value: figures.rating, label: t('stats_rating'), tint: 'text-apricot' },
  ];

  return (
    <section className="relative overflow-hidden pt-24 sm:pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      {/* Soft clay-coloured light, no clutter */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-40 -start-32 w-[36rem] h-[36rem] rounded-full bg-leaf/15 blur-3xl" />
        <div className="absolute top-20 -end-40 w-[32rem] h-[32rem] rounded-full bg-peach/40 blur-3xl dark:bg-peach/10" />
        <div className="absolute bottom-0 start-1/3 w-[28rem] h-[28rem] rounded-full bg-sky/10 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_1fr] items-center gap-6 lg:gap-8">
        {/* ── Copy ── */}
        <div className="text-center lg:text-start">
          <motion.div variants={rise} initial="hidden" animate="visible" custom={0}>
            <span className="inline-flex items-center gap-2 rounded-full border border-green/25 bg-green/10 px-4 py-1.5 text-sm font-bold text-green">
              <Sparkles size={15} />
              {t('badge')}
            </span>
          </motion.div>

          <motion.h1
            variants={rise}
            initial="hidden"
            animate="visible"
            custom={1}
            className="mt-6 text-[2.6rem] leading-[1.02] sm:text-6xl xl:text-7xl font-bold text-text-body text-balance"
          >
            {t('title')}
          </motion.h1>

          <motion.p
            variants={rise}
            initial="hidden"
            animate="visible"
            custom={2}
            className="mt-6 text-lg sm:text-xl text-text-muted max-w-xl mx-auto lg:mx-0 leading-relaxed"
          >
            {t('subtitle')}
          </motion.p>

          <motion.div
            variants={rise}
            initial="hidden"
            animate="visible"
            custom={3}
            className="mt-9 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
          >
            <Button href="/signup" size="lg" className="group gap-2 shadow-[0_12px_30px_-8px_rgba(34,197,94,0.55)]">
              {t('cta_primary')}
              <ArrowRight size={20} className="transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </Button>
            <Button href="/demo" variant="secondary" size="lg" className="gap-2">
              <span className="w-7 h-7 rounded-full bg-green/10 text-green flex items-center justify-center">
                <Play size={13} className="fill-current rtl:rotate-180" />
              </span>
              {t('cta_secondary')}
            </Button>
          </motion.div>

          <motion.ul
            variants={rise}
            initial="hidden"
            animate="visible"
            custom={4}
            className="mt-7 flex flex-wrap gap-x-5 gap-y-2 justify-center lg:justify-start text-sm font-semibold text-text-muted"
          >
            {[t('trust_1'), t('trust_2'), t('trust_3')].map((item) => (
              <li key={item} className="inline-flex items-center gap-1.5">
                <Check size={16} className="text-green" strokeWidth={3} />
                {item}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* ── Stage: the mascot artwork, rebuilt ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.9, ease }}
          className="relative mx-auto w-full max-w-[290px] sm:max-w-[420px] lg:max-w-[540px] aspect-square order-first lg:order-none -mt-2 lg:mt-0"
        >
          <div className="absolute inset-x-[4%] bottom-[2%] top-[18%] stage-disc opacity-90" />
          <motion.div
            initial={{ rotate: -8, y: -20, opacity: 0 }}
            animate={{ rotate: -4, y: 0, opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.9, ease }}
            className="absolute inset-x-[6%] top-[3%] h-[46%] stage-blob clay-shadow flex items-start justify-center pt-[7%]"
          >
            <ZiggyLogo size={300} className="w-[74%] h-auto drop-shadow-[0_3px_0_rgba(138,90,43,0.12)]" />
          </motion.div>

          <Sparkle className="w-6 top-[8%] end-[6%]" color="#FFFFFF" delay={0} />
          <Sparkle className="w-4 top-[40%] start-[4%]" color="#FBBF24" delay={0.7} />
          <Sparkle className="w-5 bottom-[22%] end-[3%]" color="#5FB6EA" delay={1.3} />
          <Sparkle className="w-3 top-[30%] end-[18%]" color="#F2647B" delay={1.9} />

          <motion.button
            type="button"
            onClick={cheer}
            whileTap={{ scale: 0.95 }}
            animate={happy ? { rotate: [0, -7, 7, -4, 0], y: [0, -14, 0] } : {}}
            transition={{ duration: 0.7 }}
            className="absolute start-1/2 -translate-x-1/2 rtl:translate-x-1/2 bottom-[1%] w-[53%] cursor-pointer focus-visible:outline-none"
            aria-label={t('bubble')}
          >
            <div className="animate-float">
              <ZiggyRobot size={320} excited={happy} className="w-full h-auto drop-shadow-[0_22px_30px_rgba(47,107,28,0.25)]" />
            </div>
            <StarBurst trigger={happy} x={130} y={110} />
          </motion.button>

          {/* Speech bubble */}
          <div className="absolute end-[-7%] top-[66%] sm:end-[-6%] sm:top-[40%] z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={happy ? 'happy' : 'hi'}
                initial={{ opacity: 0, scale: 0.6, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22, delay: happy ? 0 : 1.1 }}
                className="relative max-w-[8.5rem] sm:max-w-[11rem] rounded-2xl rounded-es-md bg-bg-card border border-border/60 px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold text-text-body shadow-xl"
              >
                {happy ? t('bubble_happy') : t('bubble')}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* ── Figures ── */}
      <motion.div
        variants={rise}
        initial="hidden"
        animate="visible"
        custom={5}
        className="relative max-w-5xl mx-auto mt-16 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        {stats.map((s) => (
          <div key={s.label} className="glass-strong rounded-2xl border border-border/60 px-5 py-5 text-center">
            <AnimatedCounter value={s.value} className={`font-display text-3xl sm:text-4xl font-bold ${s.tint}`} />
            <div className="mt-1 text-xs sm:text-sm font-semibold text-text-dim">{s.label}</div>
          </div>
        ))}
      </motion.div>
    </section>
  );
}

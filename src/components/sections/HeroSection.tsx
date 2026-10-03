'use client';

import { useState } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'framer-motion';
import { useTranslations } from 'next-intl';
import { ArrowRight, Play, Check, Star, Heart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { StarBurst } from '@/components/ziggy/StarBurst';
import { HyperBadge } from '@/components/ziggy/HyperBadge';
import { ZiggyVideo } from '@/components/ziggy/ZiggyVideo';
import { Sparkle, ZiggyAvatar } from '@/components/ziggy/Mascot';
import { useSound } from '@/hooks/useSound';
import { SplitWords } from '@/components/ui/motion-primitives';
import { FILMS, FILM_ASPECT } from '@/lib/mascot';
import type { SiteConfig } from '@/lib/site-config';

const ease = [0.22, 1, 0.36, 1] as const;

const rise = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.1 + i * 0.1, duration: 0.8, ease } }),
};

/** Little stickers that drift around the film. */
function Sticker({ className, delay, children }: { className: string; delay: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 16 }}
      className={`absolute z-20 ${className}`}
      aria-hidden="true"
    >
      <div className="animate-bob" style={{ animationDelay: `${delay}s` }}>
        {children}
      </div>
    </motion.div>
  );
}

export function HeroSection({ stats: figures }: { stats: SiteConfig['stats'] }) {
  const t = useTranslations('hero');
  const { play } = useSound();
  const reduce = useReducedMotion();
  const [happy, setHappy] = useState(false);

  // Gentle 3D tilt that follows the pointer (mouse only).
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-9, 9]), { stiffness: 140, damping: 18 });
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [7, -7]), { stiffness: 140, damping: 18 });
  const glareX = useTransform(px, [-0.5, 0.5], ['20%', '80%']);
  const glareY = useTransform(py, [-0.5, 0.5], ['15%', '85%']);
  const glare = useTransform(
    [glareX, glareY],
    ([x, y]) => `radial-gradient(circle at ${x} ${y}, rgba(255,255,255,0.55), transparent 55%)`
  );

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => {
    px.set(0);
    py.set(0);
  };

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
      {/* Clay-coloured light taken from the emblem */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-40 -start-32 w-[36rem] h-[36rem] rounded-full bg-leaf/15 blur-3xl" />
        <div className="absolute top-10 -end-40 w-[34rem] h-[34rem] rounded-full bg-peach/45 blur-3xl dark:bg-peach/10" />
        <div className="absolute top-1/3 end-1/4 w-[22rem] h-[22rem] rounded-full bg-blush/40 blur-3xl dark:bg-blush/10" />
        <div className="absolute bottom-0 start-1/3 w-[28rem] h-[28rem] rounded-full bg-sky/10 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_1fr] items-center gap-8 lg:gap-8">
        {/* ── Copy ── */}
        <div className="text-center lg:text-start">
          <motion.div variants={rise} initial="hidden" animate="visible" custom={0}>
            <span className="inline-flex items-center gap-2 rounded-full border border-green/25 bg-green/10 ps-1.5 pe-4 py-1 text-sm font-bold text-green">
              <ZiggyAvatar size={26} ring={false} />
              {t('badge')}
            </span>
          </motion.div>

          <h1 className="mt-6 text-[2.6rem] leading-[1.04] sm:text-6xl xl:text-7xl font-bold text-text-body text-balance">
            <SplitWords text={t('title')} delay={0.12} />
          </h1>

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
            <Button href="/signup" size="lg" magnetic className="group gap-2 shadow-[0_12px_30px_-8px_rgba(34,197,94,0.55)]">
              {t('cta_primary')}
              <ArrowRight size={20} className="transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </Button>
            <Button href="/demo" variant="secondary" size="lg" magnetic className="gap-2">
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

        {/* ── Stage: the official Ziggy film ── */}
        <div className="flex flex-col items-center gap-5 order-first lg:order-none">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.9, ease }}
            className="relative w-[232px] sm:w-[320px] lg:w-[380px] xl:w-[410px] [perspective:1200px]"
            onPointerMove={onMove}
            onPointerLeave={onLeave}
          >
            {/* Halo and orbit behind the card */}
            <div className="pointer-events-none absolute -inset-[22%] rounded-full stage-disc opacity-60 blur-2xl" aria-hidden="true" />
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 w-[128%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-leaf/25 dark:border-leaf/20"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 w-0 h-0 [--orbit-r:148px] sm:[--orbit-r:205px] lg:[--orbit-r:243px] xl:[--orbit-r:262px]"
              aria-hidden="true"
            >
              {[
                { c: '#F2647B', d: 0 },
                { c: '#5FB6EA', d: -4.7 },
                { c: '#FBBF24', d: -9.4 },
              ].map((o) => (
                <span
                  key={o.c}
                  className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full animate-orbit"
                  style={{ background: o.c, boxShadow: `0 0 14px ${o.c}`, animationDelay: `${o.d}s` }}
                />
              ))}
            </div>

            <motion.button
              type="button"
              onClick={cheer}
              style={reduce ? undefined : { rotateX, rotateY, transformStyle: 'preserve-3d' }}
              animate={happy ? { y: [0, -18, 0], scale: [1, 1.04, 1] } : {}}
              transition={{ duration: 0.6 }}
              whileTap={{ scale: 0.97 }}
              className="relative block w-full rounded-[2.2rem] p-[6px] bg-gradient-to-br from-white via-[#FFE7C2] to-blush/70 dark:from-white/20 dark:via-peach/20 dark:to-blush/20 shadow-[0_40px_80px_-30px_rgba(107,74,43,0.55)] cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green/40"
              aria-label={t('bubble')}
            >
              <div className="relative overflow-hidden rounded-[1.8rem] bg-[#F4F2F1]" style={{ aspectRatio: FILM_ASPECT }}>
                <ZiggyVideo
                  src={FILMS.loop.src}
                  webm={FILMS.loop.webm}
                  poster={FILMS.loop.poster}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Light that follows the pointer, and a slow sheen */}
                <motion.span
                  className="pointer-events-none absolute inset-0 mix-blend-soft-light"
                  style={{ background: glare }}
                  aria-hidden="true"
                />
                <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-sheen" aria-hidden="true" />
              </div>
              <StarBurst trigger={happy} x={150} y={170} />
            </motion.button>

            <Sparkle className="w-7 -top-4 end-[8%] z-20" color="#FFFFFF" delay={0} />
            <Sparkle className="w-5 top-[38%] -start-7 z-20" color="#FBBF24" delay={0.7} />
            <Sparkle className="w-6 bottom-[16%] -end-6 z-20" color="#5FB6EA" delay={1.3} />
            <Sparkle className="w-4 top-[12%] -start-3 z-20" color="#F2647B" delay={1.9} />

            {/* Stickers */}
            <Sticker className="-start-10 sm:-start-16 top-[18%]" delay={1.1}>
              <div className="flex items-center gap-1 rounded-2xl bg-bg-card/95 border border-border/60 px-2.5 py-1.5 shadow-xl">
                {[0, 1, 2].map((i) => (
                  <Star key={i} size={15} className="text-apricot fill-apricot" />
                ))}
              </div>
            </Sticker>
            <Sticker className="-end-8 sm:-end-12 top-[6%]" delay={1.5}>
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-coral text-white flex items-center justify-center shadow-xl shadow-coral/40 rotate-6">
                <Heart size={22} className="fill-current" />
              </div>
            </Sticker>
            <Sticker className="-start-8 sm:-start-12 bottom-[10%]" delay={1.9}>
              <ZiggyAvatar size={46} />
            </Sticker>

            {/* Speech bubble */}
            <div className="absolute -end-6 sm:-end-16 bottom-[24%] z-30">
              <AnimatePresence mode="wait">
                <motion.div
                  key={happy ? 'happy' : 'hi'}
                  initial={{ opacity: 0, scale: 0.6, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22, delay: happy ? 0 : 1.2 }}
                  className="relative max-w-[8.5rem] sm:max-w-[11rem] rounded-2xl rounded-es-md bg-bg-card border border-border/60 px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold text-text-body shadow-xl"
                >
                  {happy ? t('bubble_happy') : t('bubble')}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.6, ease }}
          >
            <Link href="/hyper" className="press inline-flex rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E9C46A]/50">
              <HyperBadge />
            </Link>
          </motion.div>
        </div>
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
          <div key={s.label} className="glass-strong rounded-2xl border border-border/60 px-5 py-5 text-center transition-transform duration-300 hover:-translate-y-1">
            <AnimatedCounter value={s.value} className={`font-display text-3xl sm:text-4xl font-bold ${s.tint}`} />
            <div className="mt-1 text-xs sm:text-sm font-semibold text-text-dim">{s.label}</div>
          </div>
        ))}
      </motion.div>

    </section>
  );
}

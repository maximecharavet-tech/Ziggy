'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ZiggyVideo } from '@/components/ziggy/ZiggyVideo';
import { HeartGlow, Sparkle } from '@/components/ziggy/Mascot';
import { SCENES, SCENE_ORDER, FILMS, type ScenePose } from '@/lib/mascot';
import { useSound } from '@/hooks/useSound';

type Mood = ScenePose | 'film';
const MOODS: Mood[] = [...SCENE_ORDER, 'film'];
const STEP_MS = 4200;

/** Where each thumbnail is framed: on Ziggy's face. */
const THUMB_FOCUS: Record<ScenePose, string> = {
  cheer: '50% 34%',
  wave: '46% 36%',
  heart: '50% 30%',
  closeup: '50% 38%',
  stand: '52% 38%',
};

/**
 * Ziggy's moods: the official artwork, one pose at a time. The poses turn by
 * themselves until the visitor picks one; the film is only fetched when asked.
 */
export function ZiggyShowcase() {
  const t = useTranslations('showcase');
  const { play } = useSound();
  const reduce = useReducedMotion();
  const [mood, setMood] = useState<Mood>('cheer');
  const [auto, setAuto] = useState(true);
  const [hovered, setHovered] = useState(false);

  const running = auto && !hovered && !reduce && mood !== 'film';

  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => {
      const i = SCENE_ORDER.indexOf(mood as ScenePose);
      setMood(SCENE_ORDER[(i + 1) % SCENE_ORDER.length]);
    }, STEP_MS);
    return () => clearTimeout(id);
  }, [running, mood]);

  const pick = (m: Mood) => {
    play('tap');
    setAuto(false);
    setMood(m);
  };

  const scene = mood === 'film' ? null : SCENES[mood];

  return (
    <section id="meet-ziggy" className="relative py-20 sm:py-28 overflow-clip">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" aria-hidden="true" />
      <div className="pointer-events-none absolute -end-40 top-10 w-[34rem] h-[34rem] rounded-full bg-peach/35 blur-3xl dark:bg-peach/10" aria-hidden="true" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-16 items-center">
          {/* Copy + moods */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-start"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-border/50 text-xs font-bold text-green mb-5">
              <Sparkles size={14} />
              {t('badge')}
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-text-body tracking-tight text-balance">
              {t('title')}
            </h2>

            <p className="mt-5 text-base sm:text-lg text-text-muted leading-relaxed max-w-lg mx-auto lg:mx-0">
              {t('subtitle')}
            </p>

            <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-text-dim">{t('moods_hint')}</p>
            <div
              className="mt-3 flex flex-wrap gap-2 justify-center lg:justify-start"
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
            >
              {MOODS.map((m) => {
                const active = m === mood;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pick(m)}
                    aria-pressed={active}
                    className={`relative inline-flex items-center gap-2 rounded-full ps-1 pe-3.5 py-1 text-sm font-bold transition-all duration-300 overflow-hidden ${
                      active
                        ? 'bg-green text-white shadow-lg shadow-green/30 scale-105'
                        : 'bg-bg-card text-text-body border border-border/60 hover:-translate-y-0.5 hover:shadow-md'
                    }`}
                  >
                    <span className="relative w-8 h-8 rounded-full overflow-hidden bg-peach shrink-0 flex items-center justify-center">
                      {m === 'film' ? (
                        <Play size={14} className={`fill-current ${active ? 'text-green' : 'text-coral'} rtl:rotate-180`} />
                      ) : (
                        <Image
                          src={SCENES[m].src}
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover scale-[2.1]"
                          style={{ objectPosition: THUMB_FOCUS[m], transformOrigin: THUMB_FOCUS[m] }}
                        />
                      )}
                    </span>
                    {t(`moods.${m}`)}
                    {active && running && (
                      <motion.span
                        key={`${m}-bar`}
                        className="absolute bottom-0 start-0 h-[3px] bg-white/70"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: STEP_MS / 1000, ease: 'linear' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Button href="/demo" size="lg">{t('cta')}</Button>
              <Button href="/games" variant="secondary" size="lg">{t('cta_games')}</Button>
            </div>
          </motion.div>

          {/* Stage */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, rotate: 2 }}
            whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-[300px] sm:max-w-[360px] settle"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div className="pointer-events-none absolute -inset-[18%] rounded-full stage-disc opacity-50 blur-2xl" aria-hidden="true" />
            <Sparkle className="w-7 -top-3 -start-3 z-10" color="#FBBF24" delay={0.3} />
            <Sparkle className="w-5 top-1/3 -end-5 z-10" color="#5FB6EA" delay={1.1} />
            <Sparkle className="w-4 bottom-10 -start-5 z-10" color="#F2647B" delay={1.8} />

            <div className="relative rounded-[2.2rem] p-[6px] bg-gradient-to-br from-white via-[#FFE7C2] to-blush/70 dark:from-white/20 dark:via-peach/20 dark:to-blush/20 shadow-[0_40px_80px_-30px_rgba(107,74,43,0.5)]">
              <div className="relative overflow-hidden rounded-[1.8rem] bg-[#F4F2F1]" style={{ aspectRatio: '784 / 1168' }}>
                <AnimatePresence initial={false}>
                  {scene ? (
                    <motion.div
                      key={mood}
                      className="absolute inset-0"
                      initial={{ opacity: 0, scale: 1.08 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ opacity: { duration: 0.7 }, scale: { duration: 4.6, ease: 'easeOut' } }}
                    >
                      <Image
                        src={scene.src}
                        alt={t(`moods.${mood}`)}
                        fill
                        sizes="(min-width: 640px) 360px, 300px"
                        className="object-cover"
                      />
                      <HeartGlow spot={scene.heart} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="film"
                      className="absolute inset-0"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6 }}
                    >
                      <ZiggyVideo
                        src={FILMS.film.src}
                        webm={FILMS.film.webm}
                        poster={FILMS.film.poster}
                        label={t('play')}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
                <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-sheen" aria-hidden="true" />
              </div>
            </div>

            {/* Mood caption */}
            <div className="absolute -bottom-5 inset-x-0 flex justify-center z-10">
              <AnimatePresence mode="wait">
                <motion.span
                  key={mood}
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                  className="rounded-full bg-bg-card border border-border/60 px-4 py-2 text-sm font-bold text-text-body shadow-xl"
                >
                  {t(`moods.${mood}`)}
                </motion.span>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

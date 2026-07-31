'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Play, Sparkles } from 'lucide-react';
import { ZiggyRobot } from '@/components/ziggy/ZiggyRobot';
import { Button } from '@/components/ui/Button';

/**
 * The mascot's moment. The animated SVG Ziggy is always there, so the frame is
 * never empty; the film itself is only fetched once the section scrolls into
 * view, and on a phone only after a tap — a 14 MB download is not something to
 * spend of someone's mobile data uninvited.
 */
export function ZiggyShowcase() {
  const t = useTranslations('showcase');
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [coarsePointer, setCoarsePointer] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCoarsePointer(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setInView(true),
      { rootMargin: '200px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // On a desktop the film is the hero of the section, so it rolls by itself.
  useEffect(() => {
    if (!inView || coarsePointer || failed) return;
    videoRef.current?.play().then(() => setPlaying(true)).catch(() => {});
  }, [inView, coarsePointer, failed]);

  const start = () => {
    videoRef.current?.play().then(() => setPlaying(true)).catch(() => setFailed(true));
  };

  const showVideo = inView && !failed;

  return (
    <section
      ref={sectionRef}
      id="meet-ziggy"
      className="relative py-20 sm:py-28 overflow-hidden"
    >
      <div className="absolute inset-0 gradient-mesh pointer-events-none" aria-hidden="true" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center">
          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55 }}
            className="text-center lg:text-start"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-border/50 text-xs font-bold text-green mb-5">
              <Sparkles size={14} />
              {t('badge')}
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-text-body tracking-tight text-balance">
              {t('title')}
            </h2>

            <p className="mt-5 text-base sm:text-lg text-text-muted leading-relaxed max-w-lg mx-auto lg:mx-0">
              {t('subtitle')}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Button href="/demo" size="lg">{t('cta')}</Button>
              <Button href="/games" variant="secondary" size="lg">{t('cta_games')}</Button>
            </div>
          </motion.div>

          {/* Film */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative"
          >
            <div
              className="absolute -inset-6 rounded-[2.5rem] blur-3xl opacity-60 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 30% 30%, rgba(127,200,92,0.35), transparent 60%), radial-gradient(circle at 70% 70%, rgba(255,185,56,0.25), transparent 60%)',
              }}
              aria-hidden="true"
            />

            <div className="relative rounded-[2rem] overflow-hidden border border-border/50 glass-strong shadow-[0_20px_60px_rgba(47,107,28,0.18)] aspect-[3/4] sm:aspect-square lg:aspect-[4/5]">
              {/* Always-present mascot: the poster, and the fallback if the film can't play */}
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-700 ${
                  playing ? 'opacity-0' : 'opacity-100'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-green/10 via-transparent to-yellow/10" />
                <div className="animate-float">
                  <ZiggyRobot size={230} excited className="w-[190px] sm:w-[230px] h-auto" />
                </div>
              </div>

              {showVideo && (
                <video
                  ref={videoRef}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                    playing ? 'opacity-100' : 'opacity-0'
                  }`}
                  src="/media/ziggy-hero.mp4"
                  preload="none"
                  muted
                  loop
                  playsInline
                  onPlaying={() => setPlaying(true)}
                  onError={() => setFailed(true)}
                />
              )}

              {/* Tap to play — the only way in on a phone */}
              {!playing && (
                <button
                  type="button"
                  onClick={start}
                  className="absolute inset-0 flex items-end justify-center pb-8 group"
                  aria-label={t('play')}
                >
                  <span className="inline-flex items-center gap-2.5 px-5 py-3 rounded-full gradient-green-cta text-white text-sm font-bold shadow-lg shadow-green/30 transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
                    <Play size={16} className="fill-current rtl:rotate-180" />
                    {t('play')}
                  </span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

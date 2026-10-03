'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { AudioLines, ShieldCheck, BrainCircuit, Sparkles, Lock, ArrowRight } from 'lucide-react';
import { ZiggyVideo } from '@/components/ziggy/ZiggyVideo';
import { MascotCutout } from '@/components/ziggy/Mascot';
import { Spotlight } from '@/components/ui/motion-primitives';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Button } from '@/components/ui/Button';
import { EASE_OUT } from '@/lib/motion';

const PILLARS = [
  { key: 'voice', icon: AudioLines, color: '#52DCFF' },
  { key: 'safety', icon: ShieldCheck, color: '#7FC85C' },
  { key: 'brain', icon: BrainCircuit, color: '#9B6CFF' },
  { key: 'motion', icon: Sparkles, color: '#FBBF24' },
  { key: 'privacy', icon: Lock, color: '#F2647B' },
] as const;

/**
 * What the Hyper™ AI Engine brings to Ziggy — only what is actually built.
 * Dark blue, as on the engine's own emblem; Ziggy's colours return at the end.
 */
export function HyperPageContent() {
  const t = useTranslations('hyper');

  return (
    <div className="relative overflow-clip bg-[#02040b] text-white">
      {/* Engine light */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-24 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-[#1e9bff]/20 blur-[120px]" />
        <div className="absolute -right-40 top-[60%] h-[30rem] w-[30rem] rounded-full bg-[#9b6cff]/15 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#52dcff_1px,transparent_1px),linear-gradient(90deg,#52dcff_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(circle_at_50%_30%,black,transparent_70%)]" />
      </div>

      <section className="relative px-4 pt-28 sm:pt-36 pb-16 text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="text-xs font-bold uppercase tracking-[0.34em] text-[#52dcff]"
        >
          {t('eyebrow')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.1 }}
          className="relative mx-auto mt-8 w-full max-w-2xl"
        >
          {/* The engine film, lit into the page */}
          <div className="relative aspect-[640/492] [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_74%)]">
            <ZiggyVideo
              src="/hyper/hyper-engine.mp4"
              webm="/hyper/hyper-engine.webm"
              poster="/hyper/hyper-engine-poster.webp"
              label="Hyper™ AI Engine"
              className="absolute inset-0 h-full w-full object-cover mix-blend-screen"
            />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.35 }}
          className="mx-auto -mt-6 max-w-3xl font-display text-4xl font-bold sm:text-6xl text-balance bg-gradient-to-b from-white via-[#c8f1ff] to-[#52dcff] bg-clip-text text-transparent"
        >
          {t('title')}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.5 }}
          className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#b8c7e0]"
        >
          {t('subtitle')}
        </motion.p>
      </section>

      <section className="relative px-4 pb-24">
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p, i) => (
            <ScrollReveal key={p.key} delay={i * 70} className={i === 0 ? 'lg:col-span-2' : ''}>
              <Spotlight
                color={p.color}
                className="h-full rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm lift"
              >
                <div
                  className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${p.color}22`, color: p.color, boxShadow: `0 0 30px -6px ${p.color}` }}
                >
                  <p.icon size={24} />
                </div>
                <h2 className="font-display text-xl font-bold">{t(`pillars.${p.key}.title`)}</h2>
                <p className="mt-2 leading-relaxed text-[#b8c7e0]">{t(`pillars.${p.key}.desc`)}</p>
              </Spotlight>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Back to Ziggy */}
      <section className="relative px-4 pb-24">
        <ScrollReveal variant="zoom">
          <div className="relative mx-auto grid max-w-5xl items-center gap-6 overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#FFE7C2] via-peach to-blush px-8 pt-10 text-[#3B2410] sm:px-14 md:grid-cols-[1.4fr_1fr]">
            <div className="pb-10 text-center md:text-start">
              <h2 className="font-display text-3xl font-bold sm:text-4xl text-balance">{t('ziggy_title')}</h2>
              <p className="mt-3 text-lg text-[#6B4A2B]">{t('ziggy_text')}</p>
              <Button href="/demo" size="lg" magnetic className="mt-7 gap-2">
                {t('cta')}
                <ArrowRight size={20} className="rtl:rotate-180" />
              </Button>
            </div>
            <div className="mx-auto w-48 sm:w-60" aria-hidden="true">
              <div className="animate-float">
                <MascotCutout pose="heart" width={240} />
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}

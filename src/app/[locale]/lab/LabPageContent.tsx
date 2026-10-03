'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { FlaskConical, Database, ScanEye, Users, ShieldCheck } from 'lucide-react';
import { AiLab } from '@/components/lab/AiLab';
import { SplitWords, Spotlight } from '@/components/ui/motion-primitives';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { EASE_OUT } from '@/lib/motion';

const HOW = [
  { key: 'data', icon: Database, color: '#F59E0B' },
  { key: 'see', icon: ScanEye, color: '#5FB6EA' },
  { key: 'vote', icon: Users, color: '#7FC85C' },
] as const;

export function LabPageContent() {
  const t = useTranslations('lab');
  return (
    <div className="relative min-h-screen overflow-clip pt-28 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-32 left-1/4 h-[30rem] w-[30rem] rounded-full bg-sky/15 blur-3xl" />
        <div className="absolute top-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-peach/40 blur-3xl dark:bg-peach/10" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <header className="text-center">
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="inline-flex items-center gap-2 rounded-full border border-sky/30 bg-sky/10 px-4 py-1.5 text-sm font-bold text-sky"
          >
            <FlaskConical size={15} /> {t('eyebrow')}
          </motion.span>
          <h1 className="mt-5 font-display text-4xl font-bold text-text-body sm:text-6xl text-balance">
            <SplitWords text={t('title')} />
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25, ease: EASE_OUT }}
            className="mx-auto mt-4 max-w-2xl text-lg text-text-muted"
          >
            {t('subtitle')}
          </motion.p>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.3, ease: EASE_OUT }}
          className="mt-12"
        >
          <AiLab />
        </motion.section>

        <section className="mt-20">
          <ScrollReveal>
            <h2 className="text-center font-display text-3xl font-bold text-text-body sm:text-4xl">{t('how_title')}</h2>
          </ScrollReveal>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {HOW.map((h, i) => (
              <ScrollReveal key={h.key} delay={i * 80}>
                <Spotlight color={h.color} className="h-full rounded-3xl border border-border/50 glass-strong p-6 lift">
                  <div
                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                    style={{ backgroundColor: h.color, boxShadow: `0 10px 24px -8px ${h.color}` }}
                  >
                    <h.icon size={22} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-text-dim">{i + 1}</p>
                  <h3 className="mt-1 font-display text-xl font-bold text-text-body">{t(`how.${h.key}.title`)}</h3>
                  <p className="mt-2 text-text-muted leading-relaxed">{t(`how.${h.key}.desc`)}</p>
                </Spotlight>
              </ScrollReveal>
            ))}
          </div>
          <p className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-text-dim">
            <ShieldCheck size={16} className="text-green" /> {t('private')}
          </p>
        </section>
      </div>
    </div>
  );
}

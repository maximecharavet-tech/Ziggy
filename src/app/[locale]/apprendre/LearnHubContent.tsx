'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, ArrowRight, Wind } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { AppPage } from '@/components/learn/AppPage';
import { Spotlight } from '@/components/ui/motion-primitives';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Breathe } from '@/components/wellbeing/Breathe';
import { ForgettingCurve } from '@/components/learn/ForgettingCurve';

type Href = '/memo' | '/palais' | '/lab' | '/games' | '/demo';

/** The six methods, each with the Ziggy app that puts it into practice. */
const METHODS: { key: string; emoji: string; color: string; href: Href }[] = [
  { key: 'spaced', emoji: '📦', color: '#8B5CF6', href: '/memo' },
  { key: 'recall', emoji: '🧠', color: '#3B82F6', href: '/memo' },
  { key: 'palace', emoji: '🏰', color: '#F59E0B', href: '/palais' },
  { key: 'teach', emoji: '🧑‍🏫', color: '#0EA5E9', href: '/lab' },
  { key: 'mix', emoji: '🔀', color: '#EC4899', href: '/games' },
  { key: 'dual', emoji: '🖼️', color: '#22C55E', href: '/memo' },
];

/**
 * Learning to learn: the strategies that research shows work best (spacing,
 * retrieval, the method of loci, learning by teaching, interleaving, dual
 * coding), explained for children, each one a door into an app — plus the
 * part everyone forgets: breaks and mistakes are part of learning.
 */
export function LearnHubContent() {
  const t = useTranslations('learn');
  const [breathing, setBreathing] = useState(false);

  return (
    <AppPage eyebrow={<><GraduationCap size={15} /> {t('eyebrow')}</>} title={t('title')} subtitle={t('subtitle')} color="#22C55E">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {METHODS.map((m, i) => (
          <ScrollReveal key={m.key} delay={i * 60}>
            <Spotlight color={m.color} className="group h-full rounded-3xl border border-border/50 glass-strong p-6 lift">
              <span className="inline-block text-4xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">{m.emoji}</span>
              <h2 className="mt-3 font-display text-xl font-bold text-text-body">{t(`methods.${m.key}.title`)}</h2>
              <p className="mt-2 text-text-muted leading-relaxed">{t(`methods.${m.key}.kid`)}</p>
              <p className="mt-3 rounded-2xl px-3 py-2 text-xs font-semibold" style={{ backgroundColor: `${m.color}14`, color: m.color }}>
                🔬 {t(`methods.${m.key}.science`)}
              </p>
              <Link href={m.href} className="press mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white" style={{ backgroundColor: m.color }}>
                {t(`methods.${m.key}.cta`)} <ArrowRight size={15} className="rtl:rotate-180" />
              </Link>
            </Spotlight>
          </ScrollReveal>
        ))}
      </div>

      <div className="mt-14 grid items-start gap-6 lg:grid-cols-2">
        <ScrollReveal>
          <ForgettingCurve />
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <div className="rounded-3xl border border-border/50 glass-strong p-6">
            <h2 className="font-display text-xl font-bold text-text-body">{t('mindset_title')}</h2>
            <ul className="mt-4 space-y-3">
              {(['m1', 'm2', 'm3', 'm4'] as const).map((k) => (
                <li key={k} className="flex gap-3 text-text-body">
                  <span aria-hidden="true">🌱</span>
                  <span>{t(`mindset.${k}`)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-3xl bg-gradient-to-br from-sky/10 to-leaf/10 p-5 text-center">
              <AnimatePresence mode="wait">
                {breathing ? (
                  <motion.div key="b" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Breathe onDone={() => window.setTimeout(() => setBreathing(false), 2500)} />
                  </motion.div>
                ) : (
                  <motion.div key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p className="font-display text-lg font-bold text-text-body">{t('break_title')}</p>
                    <p className="mt-1 text-sm text-text-muted">{t('break_text')}</p>
                    <button type="button" onClick={() => setBreathing(true)} className="press mt-4 inline-flex items-center gap-2 rounded-full gradient-green-cta px-5 py-2.5 font-bold text-white">
                      <Wind size={16} /> {t('break_cta')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </AppPage>
  );
}

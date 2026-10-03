'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { FlaskConical, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { EASE_OUT } from '@/lib/motion';

const N = 16;

/** A little sun on the 16 × 16 grid Ziggy reads, built once. */
function sunPixels(): number[] {
  const out: number[] = [];
  const c = (N - 1) / 2;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - c, y - c);
      const a = Math.atan2(y - c, x - c);
      const ring = Math.abs(d - 3.6) < 0.9;
      const ray = d > 5.2 && d < 7.6 && Math.abs(Math.sin(a * 4)) > 0.92;
      out.push(ring ? 1 : ray ? 0.75 : 0);
    }
  }
  return out;
}

/**
 * Home teaser for the AI Lab: a sun is "read" pixel by pixel, then Ziggy's
 * certainty bars fill — the whole idea of the lab in three seconds.
 */
export function LabTeaser() {
  const t = useTranslations('lab');
  const pixels = useMemo(sunPixels, []);

  return (
    <section id="lab" className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 overflow-clip">
      <div className="pointer-events-none absolute inset-0 drift" aria-hidden="true">
        <div className="absolute left-0 top-1/4 h-[26rem] w-[26rem] rounded-full bg-sky/15 blur-3xl" />
      </div>
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <ScrollReveal className="text-center lg:text-start">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky/30 bg-sky/10 px-4 py-1.5 text-sm font-bold text-sky">
            <FlaskConical size={15} /> {t('eyebrow')}
          </span>
          <h2 className="mt-5 font-display text-3xl font-bold text-text-body sm:text-5xl text-balance">{t('teaser_title')}</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-muted lg:mx-0">{t('teaser_text')}</p>
          <Button href="/lab" size="lg" magnetic className="group mt-8 gap-2">
            {t('teaser_cta')}
            <ArrowRight size={20} className="transition-transform group-hover:translate-x-1 rtl:rotate-180" />
          </Button>
        </ScrollReveal>

        <ScrollReveal variant="zoom" delay={120}>
          <div className="relative mx-auto flex max-w-md flex-col items-center gap-6 rounded-[2.2rem] border border-border/50 glass-strong p-6 sm:p-8 shadow-[0_40px_80px_-40px_rgba(59,130,246,0.45)]">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-dim">{t('sees')}</p>
            <motion.div
              className="grid w-full max-w-[17rem] gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}
              initial="off"
              whileInView="on"
              viewport={{ once: true, margin: '-15%' }}
              aria-hidden="true"
            >
              {pixels.map((v, i) => (
                <motion.span
                  key={i}
                  className="aspect-square rounded-[3px]"
                 
                  variants={{
                    off: { backgroundColor: 'rgba(127,127,127,0.12)', scale: 0.6 },
                    on: {
                      backgroundColor: v ? `rgba(245, 158, 11, ${0.35 + v * 0.65})` : 'rgba(127,127,127,0.12)',
                      scale: 1,
                      transition: { delay: v ? 0.2 + (i % N) * 0.025 + Math.floor(i / N) * 0.025 : 0, duration: 0.3, ease: EASE_OUT },
                    },
                  }}
                />
              ))}
            </motion.div>
            <div className="w-full space-y-2.5">
              {[
                { emoji: '☀️', value: 0.94, color: '#F59E0B' },
                { emoji: '🌙', value: 0.06, color: '#6366F1' },
              ].map((b, i) => (
                <div key={b.emoji} className="flex items-center gap-3">
                  <span className="w-8 text-center text-2xl">{b.emoji}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-border/40">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: b.color }}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${b.value * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ delay: 1.3 + i * 0.1, duration: 0.7, ease: EASE_OUT }}
                    />
                  </div>
                  <span className="w-10 text-end text-sm font-bold tabular-nums text-text-muted">{Math.round(b.value * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

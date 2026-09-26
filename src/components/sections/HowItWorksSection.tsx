'use client';

import { useTranslations } from 'next-intl';
import { UserPlus, Bot, TrendingUp, Route } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ScrollReveal } from '@/components/ui/ScrollReveal';

const STEPS = [
  { icon: UserPlus, color: '#7FC85C' },
  { icon: Bot, color: '#5FB6EA' },
  { icon: TrendingUp, color: '#F2647B' },
];

export function HowItWorksSection() {
  const t = useTranslations('how_it_works');

  return (
    <section className="py-24 sm:py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <ScrollReveal>
          <SectionHeading
            eyebrow={<><Route size={14} /> {t('eyebrow')}</>}
            title={t('title')}
            subtitle={t('subtitle')}
          />
        </ScrollReveal>

        <ol className="grid md:grid-cols-3 gap-5 relative">
          {/* Dotted path joining the steps */}
          <div
            className="hidden md:block absolute top-[4.25rem] inset-x-[18%] border-t-[3px] border-dashed border-border"
            aria-hidden="true"
          />

          {STEPS.map(({ icon: Icon, color }, i) => (
            <ScrollReveal key={i} delay={i * 140} variant="fade-up">
              <li className="relative h-full rounded-3xl border border-border/60 bg-bg-card p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-24px_rgba(26,26,46,0.25)]">
                <div className="relative mx-auto mb-6 w-[5.5rem] h-[5.5rem]">
                  <div className="absolute inset-0 rounded-[1.75rem] rotate-6" style={{ backgroundColor: `${color}33` }} />
                  <div
                    className="relative w-full h-full rounded-[1.75rem] flex items-center justify-center"
                    style={{ backgroundColor: color, boxShadow: `0 14px 28px -10px ${color}` }}
                  >
                    <Icon size={34} className="text-white" strokeWidth={2.2} />
                  </div>
                  <span
                    className="absolute -top-3 -end-3 w-9 h-9 rounded-full bg-bg-card border-2 flex items-center justify-center font-display text-lg font-bold"
                    style={{ borderColor: color, color }}
                  >
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-text-body mb-3">{t(`step${i + 1}_title`)}</h3>
                <p className="text-text-muted leading-relaxed">{t(`step${i + 1}_desc`)}</p>
              </li>
            </ScrollReveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

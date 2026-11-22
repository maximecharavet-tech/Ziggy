'use client';

import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { UserPlus, Bot, TrendingUp, Route } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Stagger } from '@/components/sections/magic/Stagger';
import { rise } from '@/components/sections/magic/rise';
import { Sparkle4 } from '@/components/sections/magic/Sparkle4';
import { deepFor } from '@/components/sections/magic/color';

const STEPS = [
  { icon: UserPlus, color: '#7FC85C' },
  { icon: Bot, color: '#5FB6EA' },
  { icon: TrendingUp, color: '#F2647B' },
];

export function HowItWorksSection() {
  const t = useTranslations('how_it_works');

  return (
    <section className="relative overflow-hidden px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <SectionHeading
            eyebrow={
              <span className="inline-flex items-center gap-1.5 text-leaf-ink dark:text-green">
                <Route size={14} /> {t('eyebrow')}
              </span>
            }
            title={t('title')}
            subtitle={t('subtitle')}
          />
        </ScrollReveal>

        <div className="relative">
          {/* A dotted, wavy path joining the steps, with a sparkle on each bend */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-[16%] top-[3.1rem] hidden h-10 md:block">
            <svg viewBox="0 0 400 40" preserveAspectRatio="none" className="h-full w-full">
              <path d="M0 22 C 60 2, 140 2, 200 20 S 340 38, 400 18" fill="none" stroke="var(--color-border)" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <Sparkle4 className="mg-star absolute start-[24%] top-0" style={{ '--size': '14px', '--c': '#FBBF24' } as CSSProperties} />
            <Sparkle4 className="mg-star absolute end-[24%] top-6" style={{ '--size': '12px', '--c': '#F2647B', '--delay': '-1.4s' } as CSSProperties} />
          </div>

          <Stagger as="ol" className="relative grid gap-x-5 gap-y-8 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, color }, i) => (
            <li key={i} className="mg-rise" style={rise(i)}>
              <div className="mg-card mg-static h-full p-8 text-center" style={{ '--tint': color } as CSSProperties}>
                <div className="relative mx-auto mb-6 h-[5.5rem] w-[5.5rem]">
                  <div className="absolute inset-0 rotate-6 rounded-[1.75rem]" style={{ backgroundColor: `${color}33` }} />
                  <span className="mg-icon relative h-full w-full rounded-[1.75rem]" style={{ '--tint': color } as CSSProperties}>
                    <Icon size={34} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  <span
                    className="absolute -end-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full border-[3px] bg-bg-card font-display text-lg font-bold shadow-soft"
                    style={{ borderColor: color, color: deepFor(color) }}
                  >
                    {i + 1}
                  </span>
                </div>
                <h3 className="mb-3 text-xl font-bold text-text-body">{t(`step${i + 1}_title`)}</h3>
                <p className="leading-relaxed text-text-muted">{t(`step${i + 1}_desc`)}</p>
              </div>
            </li>
          ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}

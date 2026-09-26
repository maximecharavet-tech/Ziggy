'use client';

import { useTranslations } from 'next-intl';
import { Zap } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { ExpressTrial } from '@/components/trial/ExpressTrial';

/** The landing page's "try it" moment: a one-minute trial, no sign-up. */
export function DemoSection() {
  const t = useTranslations('trial');

  return (
    <section id="demo" className="py-24 sm:py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" aria-hidden="true" />
      <div className="relative max-w-3xl mx-auto">
        <ScrollReveal>
          <SectionHeading
            eyebrow={<><Zap size={14} className="fill-current" /> {t('eyebrow')}</>}
            title={t('section_title')}
            subtitle={t('section_subtitle')}
          />
        </ScrollReveal>
        <ScrollReveal variant="zoom" delay={120}>
          <ExpressTrial compact />
        </ScrollReveal>
      </div>
    </section>
  );
}

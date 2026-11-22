'use client';

import { useTranslations } from 'next-intl';
import { FlaskConical, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ScrollReveal } from '@/components/ui/ScrollReveal';

/** Home teaser for the AI Lab: a title, one line and the way in. */
export function LabTeaser() {
  const t = useTranslations('lab');

  return (
    <section id="lab" className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 overflow-clip">
      <div className="pointer-events-none absolute inset-0 drift" aria-hidden="true">
        <div className="absolute left-0 top-1/4 h-[26rem] w-[26rem] rounded-full bg-sky/15 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-3xl">
        <ScrollReveal className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky/30 bg-sky/10 px-4 py-1.5 text-sm font-bold text-sky-ink dark:text-sky">
            <FlaskConical size={15} /> {t('eyebrow')}
          </span>
          <h2 className="mt-5 font-display text-3xl font-bold text-text-body sm:text-5xl text-balance">{t('teaser_title')}</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-muted">{t('teaser_text')}</p>
          <Button href="/lab" size="lg" magnetic className="group mt-8 gap-2">
            {t('teaser_cta')}
            <ArrowRight size={20} className="transition-transform group-hover:translate-x-1 rtl:rotate-180" />
          </Button>
        </ScrollReveal>
      </div>
    </section>
  );
}

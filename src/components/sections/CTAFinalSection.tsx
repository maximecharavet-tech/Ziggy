'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { ZiggyRobot } from '@/components/ziggy/ZiggyRobot';

export function CTAFinalSection() {
  const t = useTranslations('cta_final');

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <ScrollReveal variant="zoom">
        <div className="relative max-w-5xl mx-auto overflow-hidden rounded-[2.5rem] clay-shadow">
          <div className="absolute inset-0 bg-gradient-to-br from-[#FFE7C2] via-peach to-apricot dark:from-[#3a2a17] dark:via-[#4a3218] dark:to-[#5a3a1a]" />
          <div className="absolute -bottom-24 -end-16 w-[26rem] h-[26rem] stage-disc opacity-80" aria-hidden="true" />

          <div className="relative grid md:grid-cols-[1.3fr_1fr] items-center gap-6 p-10 sm:p-14">
            <div className="text-center md:text-start">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#3B2410] dark:text-[#FFE7C2] mb-4 leading-[1.08] text-balance">
                {t('title')}
              </h2>
              <p className="text-[#6B4A2B] dark:text-[#F3D3A8] text-lg mb-8 max-w-xl mx-auto md:mx-0 leading-relaxed">
                {t('subtitle')}
              </p>
              <Button href="/signup" size="lg" className="group gap-2 shadow-[0_14px_30px_-10px_rgba(22,163,74,0.7)]">
                {t('cta')}
                <ArrowRight size={20} className="transition-transform group-hover:translate-x-1 rtl:rotate-180" />
              </Button>
            </div>
            <div className="relative mx-auto w-48 sm:w-64" aria-hidden="true">
              <div className="animate-float">
                <ZiggyRobot size={260} excited className="w-full h-auto drop-shadow-[0_24px_30px_rgba(107,74,43,0.35)]" />
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}

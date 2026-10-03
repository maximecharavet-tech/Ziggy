'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { MascotCutout, Sparkle } from '@/components/ziggy/Mascot';

export function CTAFinalSection() {
  const t = useTranslations('cta_final');

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <ScrollReveal variant="zoom">
        <div className="relative max-w-5xl mx-auto overflow-hidden rounded-[2.5rem] clay-shadow settle">
          <div className="absolute inset-0 bg-gradient-to-br from-[#FFE7C2] via-peach to-apricot dark:from-[#3a2a17] dark:via-[#4a3218] dark:to-[#5a3a1a]" />
          <div className="absolute -bottom-24 -end-16 w-[26rem] h-[26rem] stage-disc opacity-80" aria-hidden="true" />

          <div className="relative grid md:grid-cols-[1.3fr_1fr] items-center gap-6 px-8 pt-10 pb-0 sm:px-14 sm:pt-14 md:pb-0">
            <div className="text-center md:text-start md:pb-14">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#3B2410] dark:text-[#FFE7C2] mb-4 leading-[1.08] text-balance">
                {t('title')}
              </h2>
              <p className="text-[#6B4A2B] dark:text-[#F3D3A8] text-lg mb-8 max-w-xl mx-auto md:mx-0 leading-relaxed">
                {t('subtitle')}
              </p>
              <Button href="/signup" size="lg" magnetic className="group gap-2 shadow-[0_14px_30px_-10px_rgba(22,163,74,0.7)]">
                {t('cta')}
                <ArrowRight size={20} className="transition-transform group-hover:translate-x-1 rtl:rotate-180" />
              </Button>
            </div>
            <div className="relative mx-auto w-52 sm:w-72 -mb-10 sm:-mb-14" aria-hidden="true">
              <div className="absolute inset-[12%] rounded-full bg-[#FFF3C4] blur-3xl opacity-70 animate-pulse" />
              <Sparkle className="w-6 top-[6%] start-[4%] z-10" color="#FFFFFF" delay={0} />
              <Sparkle className="w-5 top-[30%] end-[2%] z-10" color="#F2647B" delay={0.9} />
              <Sparkle className="w-4 top-[58%] start-0 z-10" color="#5FB6EA" delay={1.6} />
              <div className="animate-float">
                <MascotCutout pose="heart" width={288} />
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}

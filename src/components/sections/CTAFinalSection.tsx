'use client';

import { useTranslations } from 'next-intl';
import { Rocket } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { ParticleField } from '@/components/ui/ParticleField';

export function CTAFinalSection() {
  const t = useTranslations('cta_final');

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <ScrollReveal variant="zoom">
        <div className="max-w-4xl mx-auto relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 gradient-green-cta" />
          <ParticleField color="#ffffff" count={25} className="opacity-30" />
          <div className="relative z-10 text-center p-10 sm:p-16">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-6 animate-float">
              <Rocket size={30} className="text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 leading-tight">
              {t('title')}
            </h2>
            <p className="text-white/80 text-base sm:text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
              {t('subtitle')}
            </p>
            <Button
              variant="secondary"
              size="lg"
              className="bg-white text-green hover:bg-white/90 border-0 shadow-xl shadow-black/10"
            >
              {t('cta')}
            </Button>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}

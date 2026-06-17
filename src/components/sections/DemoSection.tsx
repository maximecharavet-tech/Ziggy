'use client';

import { useTranslations } from 'next-intl';
import { MessageCircle } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { ParticleField } from '@/components/ui/ParticleField';
import { ZiggyRobot } from '@/components/ziggy/ZiggyRobot';
import { ZiggyChat } from '@/components/ziggy/ZiggyChat';

export function DemoSection() {
  const t = useTranslations('demo');

  return (
    <section id="demo" className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden gradient-mesh">
      <ParticleField color="#22C55E" count={20} className="opacity-40" />
      <div className="max-w-6xl mx-auto relative z-10">
        <ScrollReveal>
          <div className="text-center mb-12">
            <div className="w-16 h-16 rounded-2xl bg-green/10 flex items-center justify-center mx-auto mb-6">
              <MessageCircle size={30} className="text-green" />
            </div>
            <SectionHeading title={t('title')} subtitle={t('subtitle')} />
          </div>
        </ScrollReveal>

        <ScrollReveal variant="zoom" delay={200}>
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            {/* Ziggy character */}
            <div className="hidden lg:flex flex-col items-center gap-4 flex-shrink-0">
              <div className="relative">
                <div className="absolute inset-0 bg-green/10 rounded-full blur-3xl scale-150" />
                <div className="relative animate-float">
                  <ZiggyRobot size={200} />
                </div>
              </div>
              <div className="glass rounded-2xl border border-border/50 px-4 py-2 text-sm text-text-muted text-center max-w-[200px]">
                {t('subtitle')}
              </div>
            </div>

            {/* Chat interface */}
            <div className="w-full max-w-lg mx-auto lg:mx-0">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-green/5 via-blue/5 to-purple/5 rounded-3xl blur-xl" />
                <div className="relative">
                  <ZiggyChat />
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

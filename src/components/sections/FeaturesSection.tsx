'use client';

import { useTranslations } from 'next-intl';
import { Bot, ShieldCheck, Brain, Globe, Trophy, BookOpen } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { GlowCard } from '@/components/ui/GlowCard';

const iconBgs = [
  'bg-green/10 text-green',
  'bg-blue/10 text-blue',
  'bg-purple/10 text-purple',
  'bg-yellow/10 text-yellow',
  'bg-pink/10 text-pink',
  'bg-green/10 text-green',
];

export function FeaturesSection() {
  const t = useTranslations('features');

  const features = [
    { icon: Bot, title: t('ai_companion'), desc: t('ai_companion_desc') },
    { icon: ShieldCheck, title: t('safe_space'), desc: t('safe_space_desc') },
    { icon: Brain, title: t('cognitive_tracking'), desc: t('cognitive_tracking_desc') },
    { icon: Globe, title: t('multilingual'), desc: t('multilingual_desc') },
    { icon: Trophy, title: t('gamified'), desc: t('gamified_desc') },
    { icon: BookOpen, title: t('curriculum'), desc: t('curriculum_desc') },
  ];

  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        </ScrollReveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <ScrollReveal key={f.title} delay={i * 80} variant="fade-up">
              <GlowCard>
                <div className={`w-14 h-14 rounded-2xl ${iconBgs[i]} flex items-center justify-center mb-5`}>
                  <f.icon size={26} />
                </div>
                <h3 className="text-lg font-bold text-text-body mb-2">{f.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{f.desc}</p>
              </GlowCard>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

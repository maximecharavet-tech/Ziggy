'use client';

import { useTranslations } from 'next-intl';
import { UserPlus, Bot, TrendingUp } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ScrollReveal } from '@/components/ui/ScrollReveal';

const stepIcons = [UserPlus, Bot, TrendingUp];
const stepColors = ['from-green to-green-dark', 'from-blue to-purple', 'from-pink to-purple'];

export function HowItWorksSection() {
  const t = useTranslations('how_it_works');

  const steps = [
    { num: '01', title: t('step1_title'), desc: t('step1_desc') },
    { num: '02', title: t('step2_title'), desc: t('step2_desc') },
    { num: '03', title: t('step3_title'), desc: t('step3_desc') },
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
          {/* Connection line */}
          <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-[2px] bg-gradient-to-r from-green/20 via-green/40 to-green/20" />

          {steps.map((step, i) => {
            const Icon = stepIcons[i];
            return (
              <ScrollReveal key={step.num} delay={i * 150} variant="fade-up">
                <div className="text-center relative">
                  <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${stepColors[i]} text-white flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green/20 group`}>
                    <Icon size={32} />
                  </div>
                  <div className="text-xs font-bold text-green mb-2 tracking-wider uppercase">
                    {step.num}
                  </div>
                  <h3 className="text-xl font-bold text-text-body mb-3">{step.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{step.desc}</p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

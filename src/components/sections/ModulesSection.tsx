'use client';

import { useTranslations } from 'next-intl';
import { Cpu, MessageSquare, Calculator, Palette, Sun } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Badge } from '@/components/ui/Badge';

const moduleColors = [
  { bg: 'from-green/10 to-green/5', icon: 'bg-green/15 text-green' },
  { bg: 'from-blue/10 to-blue/5', icon: 'bg-blue/15 text-blue' },
  { bg: 'from-yellow/10 to-yellow/5', icon: 'bg-yellow/15 text-yellow' },
  { bg: 'from-purple/10 to-purple/5', icon: 'bg-purple/15 text-purple' },
  { bg: 'from-pink/10 to-pink/5', icon: 'bg-pink/15 text-pink' },
];

export function ModulesSection() {
  const t = useTranslations('modules');

  const modules = [
    { icon: Cpu, title: t('ai_basics'), desc: t('ai_basics_desc'), ages: t('ai_basics_ages') },
    { icon: MessageSquare, title: t('prompt_champion'), desc: t('prompt_champion_desc'), ages: t('prompt_champion_ages') },
    { icon: Calculator, title: t('math_logic'), desc: t('math_logic_desc'), ages: t('math_logic_ages') },
    { icon: Palette, title: t('creativity'), desc: t('creativity_desc'), ages: t('creativity_ages') },
    { icon: Sun, title: t('holiday'), desc: t('holiday_desc'), ages: t('holiday_ages') },
  ];

  return (
    <section id="modules" className="py-24 px-4 sm:px-6 lg:px-8 gradient-mesh relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <ScrollReveal>
          <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        </ScrollReveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((m, i) => (
            <ScrollReveal key={m.title} delay={i * 100} variant="zoom">
              <div className={`group relative bg-gradient-to-br ${moduleColors[i].bg} rounded-2xl border border-border/50 p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300`}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-14 h-14 rounded-2xl ${moduleColors[i].icon} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <m.icon size={26} />
                  </div>
                  <Badge className="text-xs">{m.ages}</Badge>
                </div>
                <h3 className="text-lg font-bold text-text-body mb-2">{m.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{m.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

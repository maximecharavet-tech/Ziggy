'use client';

import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { Cpu, MessageSquare, Calculator, Palette, Sun } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { MagicBackdrop } from '@/components/sections/magic/MagicBackdrop';
import { Stagger } from '@/components/sections/magic/Stagger';
import { rise } from '@/components/sections/magic/rise';
import { deepFor } from '@/components/sections/magic/color';

const TINTS = ['#7FC85C', '#5FB6EA', '#F9BE7C', '#A78BFA', '#F472B6'];

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
    <section id="modules" className="relative overflow-clip px-4 py-24 sm:px-6 lg:px-8">
      <MagicBackdrop variant="day" stars={7} clouds={2} seed={5} />
      <div className="relative z-10 mx-auto max-w-6xl">
        <ScrollReveal>
          <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        </ScrollReveal>
        {/* Five modules: the last row is centred, so there is no hole. */}
        <Stagger as="ul" className="flex flex-wrap justify-center gap-6">
          {modules.map((m, i) => {
            const tint = TINTS[i];
            return (
              <li key={m.title} className="mg-rise w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]" style={rise(i)}>
                <div className="mg-card mg-static h-full p-6" style={{ '--tint': tint } as CSSProperties}>
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <span className="mg-icon h-14 w-14" style={{ '--tint': tint } as CSSProperties}>
                      <m.icon size={26} strokeWidth={2.4} aria-hidden="true" />
                    </span>
                    <span className="rounded-full px-3 py-1 text-sm font-bold" style={{ backgroundColor: `${tint}26`, color: deepFor(tint) }}>
                      <span className="dark:text-text-body">{m.ages}</span>
                    </span>
                  </div>
                  <h3 className="mb-2 font-display text-xl font-bold text-text-body">{m.title}</h3>
                  <p className="leading-relaxed text-text-muted">{m.desc}</p>
                </div>
              </li>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}

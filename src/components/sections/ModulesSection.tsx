'use client';

import { useTranslations } from 'next-intl';
import { Cpu, MessageSquare, Calculator, Palette, Sun } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { MagicBackdrop } from '@/components/sections/magic/MagicBackdrop';
import { deepFor } from '@/components/sections/magic/color';

const COLORS = ['#7FC85C', '#5FB6EA', '#F9BE7C', '#A78BFA', '#F2647B'];

/**
 * The five learning modules as quiet cards that stand up in 3D as they
 * scroll in (CSS scroll-driven animation, no JavaScript; static where the
 * browser lacks it or the visitor prefers reduced motion).
 */
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
    <section id="modules" className="relative overflow-clip px-5 py-24 sm:px-6 sm:py-32 lg:px-8">
      <MagicBackdrop variant="day" stars={7} clouds={2} seed={5} />
      <div className="relative z-10 mx-auto max-w-6xl">
        <ScrollReveal>
          <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        </ScrollReveal>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:gap-5">
          {modules.map((m, i) => {
            const c = COLORS[i];
            return (
              <li
                key={m.title}
                className={`depth-in group relative overflow-hidden rounded-[1.75rem] border p-6 sm:p-7 transition-[transform,box-shadow] duration-300 ease-[var(--ease-out)] [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-[0_28px_50px_-30px_rgba(26,26,46,0.35)] ${
                  i < 2 ? 'lg:col-span-3' : 'lg:col-span-2'
                } ${i === 4 ? 'sm:col-span-2 lg:col-span-2' : ''}`}
                style={{
                  backgroundColor: `color-mix(in srgb, ${c} 6%, var(--color-bg-card))`,
                  borderColor: `color-mix(in srgb, ${c} 20%, transparent)`,
                }}
              >
                {/* Big quiet numeral, for rhythm */}
                <span
                  className="pointer-events-none absolute -end-2 -top-5 font-display text-[6.5rem] font-bold leading-none tabular-nums opacity-[0.09]"
                  style={{ color: c }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div className="relative flex items-center justify-between gap-3">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-300 [@media(hover:hover)]:group-hover:-rotate-6 [@media(hover:hover)]:group-hover:scale-110"
                    style={{ backgroundColor: `color-mix(in srgb, ${c} 18%, transparent)`, color: c }}
                  >
                    <m.icon size={22} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{ backgroundColor: `color-mix(in srgb, ${c} 14%, transparent)`, color: deepFor(c) }}
                  >
                    <span className="dark:text-text-body">{m.ages}</span>
                  </span>
                </div>
                <h3 className="relative mt-5 text-xl font-bold text-text-body">{m.title}</h3>
                <p className="relative mt-1.5 text-text-muted leading-relaxed">{m.desc}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

'use client';

import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { Bot, ShieldCheck, Brain, Globe, Trophy, BookOpen, Heart, type LucideIcon } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { MascotCutout } from '@/components/ziggy/Mascot';
import { Stagger } from '@/components/sections/magic/Stagger';
import { rise } from '@/components/sections/magic/rise';

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
  color: string;
  span: string;
}

export function FeaturesSection() {
  const t = useTranslations('features');

  const features: Feature[] = [
    { icon: Bot, title: t('ai_companion'), desc: t('ai_companion_desc'), color: '#7FC85C', span: 'lg:col-span-2' },
    { icon: ShieldCheck, title: t('safe_space'), desc: t('safe_space_desc'), color: '#5FB6EA', span: '' },
    { icon: Brain, title: t('cognitive_tracking'), desc: t('cognitive_tracking_desc'), color: '#A78BFA', span: '' },
    { icon: Globe, title: t('multilingual'), desc: t('multilingual_desc'), color: '#4FC9C0', span: '' },
    { icon: Trophy, title: t('gamified'), desc: t('gamified_desc'), color: '#F9BE7C', span: '' },
    { icon: BookOpen, title: t('curriculum'), desc: t('curriculum_desc'), color: '#F2647B', span: 'lg:col-span-3' },
  ];

  return (
    <section id="features" className="relative px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <SectionHeading
            eyebrow={
              <span className="inline-flex items-center gap-1.5 text-leaf-ink dark:text-green">
                <Heart size={14} className="fill-current" /> {t('eyebrow')}
              </span>
            }
            title={t('title')}
            subtitle={t('subtitle')}
          />
        </ScrollReveal>

        <Stagger className="grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => {
            const hero = i === 0;
            const wide = i === features.length - 1;
            return (
              <div key={f.title} className={`mg-rise ${f.span} ${hero || wide ? 'sm:col-span-2' : ''}`} style={rise(i)}>
                <div
                  className={`mg-card mg-static group h-full p-7 sm:p-8 ${hero ? 'overflow-hidden' : ''} ${wide ? 'flex flex-col gap-6 sm:flex-row sm:items-center' : ''}`}
                  style={{ '--tint': f.color } as CSSProperties}
                >
                  <span className={`mg-icon h-14 w-14 ${wide ? '' : 'mb-5'}`} style={{ '--tint': f.color } as CSSProperties}>
                    <f.icon size={26} strokeWidth={2.4} aria-hidden="true" />
                  </span>
                  <div className={hero ? 'relative max-w-md' : ''}>
                    <h3 className={`${hero ? 'text-2xl sm:text-3xl' : 'text-xl'} mb-2 font-bold text-text-body`}>{f.title}</h3>
                    <p className="leading-relaxed text-text-muted">{f.desc}</p>
                  </div>

                  {hero && (
                    <div
                      className="pointer-events-none absolute -bottom-16 end-4 hidden w-40 transition-transform duration-500 ease-toy group-hover:-translate-y-3 group-hover:-rotate-3 sm:block sm:w-48 lg:w-52"
                      aria-hidden="true"
                    >
                      <MascotCutout pose="wave" width={208} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}

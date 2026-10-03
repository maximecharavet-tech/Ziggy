'use client';

import { useTranslations } from 'next-intl';
import { Bot, ShieldCheck, Brain, Globe, Trophy, BookOpen, Heart, type LucideIcon } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { MascotCutout } from '@/components/ziggy/Mascot';
import { Spotlight } from '@/components/ui/motion-primitives';

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
    <section id="features" className="py-24 sm:py-28 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <ScrollReveal>
          <SectionHeading
            eyebrow={<><Heart size={14} className="fill-current" /> {t('eyebrow')}</>}
            title={t('title')}
            subtitle={t('subtitle')}
          />
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {features.map((f, i) => {
            const hero = i === 0;
            const wide = i === features.length - 1;
            return (
              <ScrollReveal key={f.title} delay={i * 70} variant="fade-up" className={`${f.span} ${hero || wide ? 'sm:col-span-2' : ''}`}>
                <Spotlight
                  color={f.color}
                  className={`group h-full overflow-hidden rounded-3xl border p-7 sm:p-8 lift hover:shadow-[0_24px_50px_-24px_rgba(26,26,46,0.25)] ${
                    wide ? 'flex flex-col sm:flex-row sm:items-center gap-6' : ''
                  }`}
                  style={{
                    backgroundColor: `color-mix(in srgb, ${f.color} 7%, var(--color-bg-card))`,
                    borderColor: `color-mix(in srgb, ${f.color} 22%, transparent)`,
                  }}
                >
                  <div
                    className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
                    style={{ backgroundColor: f.color, boxShadow: `0 10px 24px -8px ${f.color}` }}
                  >
                    <f.icon size={26} className="text-white" strokeWidth={2.2} />
                  </div>
                  <div className={hero ? 'max-w-md' : ''}>
                    <h3 className={`${hero ? 'text-2xl sm:text-3xl' : 'text-xl'} font-bold text-text-body mb-2`}>{f.title}</h3>
                    <p className="text-text-muted leading-relaxed">{f.desc}</p>
                  </div>

                  {hero && (
                    <div
                      className="pointer-events-none absolute -bottom-16 end-4 w-40 sm:w-48 lg:w-52 transition-transform duration-500 group-hover:-translate-y-3 group-hover:-rotate-3 hidden sm:block"
                      aria-hidden="true"
                    >
                      <MascotCutout pose="wave" width={208} />
                    </div>
                  )}
                </Spotlight>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

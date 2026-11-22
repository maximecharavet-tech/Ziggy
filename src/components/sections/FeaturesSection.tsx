'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bot, ShieldCheck, Brain, Globe, Trophy, BookOpen, Heart, type LucideIcon } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { ZiggyStage } from '@/components/ziggy/ZiggyStage';
import type { CutoutPose } from '@/lib/mascot';

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
  color: string;
  pose: CutoutPose;
}

/**
 * "Why parents love Ziggy", as a quiet story: one living Ziggy on a 3D stage,
 * and the six reasons beside him. On a phone the reasons are a swipeable
 * rail (native scroll-snap, so it scrolls at the display's own frame rate);
 * on a large screen Ziggy stays put while the list scrolls past. Whichever
 * reason is in focus sets Ziggy's pose and the colour of his halo.
 */
export function FeaturesSection() {
  const t = useTranslations('features');
  const [active, setActive] = useState(0);
  const railRef = useRef<HTMLOListElement>(null);

  const features: Feature[] = [
    { icon: Bot, title: t('ai_companion'), desc: t('ai_companion_desc'), color: '#7FC85C', pose: 'wave' },
    { icon: ShieldCheck, title: t('safe_space'), desc: t('safe_space_desc'), color: '#5FB6EA', pose: 'heart' },
    { icon: Brain, title: t('cognitive_tracking'), desc: t('cognitive_tracking_desc'), color: '#A78BFA', pose: 'stand' },
    { icon: Globe, title: t('multilingual'), desc: t('multilingual_desc'), color: '#4FC9C0', pose: 'wave' },
    { icon: Trophy, title: t('gamified'), desc: t('gamified_desc'), color: '#F9BE7C', pose: 'heart' },
    { icon: BookOpen, title: t('curriculum'), desc: t('curriculum_desc'), color: '#F2647B', pose: 'stand' },
  ];

  // Which reason is in focus: the centred card of the rail on a phone, the
  // row crossing the middle of the screen on a large one.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof IntersectionObserver === 'undefined') return;
    const wide = window.matchMedia('(min-width: 1024px)');
    let io: IntersectionObserver | null = null;
    const watch = () => {
      io?.disconnect();
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
          }
        },
        wide.matches
          ? { root: null, rootMargin: '-45% 0px -45% 0px', threshold: 0 }
          : { root: rail, rootMargin: '0px -45% 0px -45%', threshold: 0 }
      );
      rail.querySelectorAll('[data-i]').forEach((el) => io!.observe(el));
    };
    watch();
    wide.addEventListener('change', watch);
    return () => {
      io?.disconnect();
      wide.removeEventListener('change', watch);
    };
  }, []);

  const go = (i: number) => {
    const el = railRef.current?.querySelector<HTMLElement>(`[data-i="${i}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  const current = features[active];

  return (
    <section id="features" className="relative overflow-clip py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
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
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:px-8">
        <div className="px-5 lg:sticky lg:top-24 lg:h-fit lg:px-0 lg:py-10">
          <ZiggyStage pose={current.pose} color={current.color} />
        </div>

        <div>
          <ol
            ref={railRef}
            className="snap-rail flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-[9%] pb-2 lg:snap-none lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 lg:py-[18vh]"
          >
            {features.map((f, i) => {
              const on = i === active;
              return (
                <li
                  key={f.title}
                  data-i={i}
                  className={`relative w-[82%] shrink-0 snap-center rounded-[1.75rem] border p-6 transition-[opacity,transform,border-color,background-color] duration-500 ease-[var(--ease-out)] sm:w-[60%] lg:w-auto lg:rounded-none lg:border-0 lg:border-s-2 lg:bg-transparent lg:py-8 lg:ps-8 ${
                    on ? 'opacity-100 scale-100' : 'opacity-55 scale-[0.94] lg:scale-100 lg:opacity-40'
                  }`}
                  style={{
                    borderColor: on ? `color-mix(in srgb, ${f.color} 45%, transparent)` : 'color-mix(in srgb, var(--color-text-body) 8%, transparent)',
                    backgroundColor: `color-mix(in srgb, ${f.color} ${on ? 9 : 4}%, var(--color-bg-card))`,
                  }}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-2xl transition-transform duration-500"
                      style={{ backgroundColor: `color-mix(in srgb, ${f.color} 18%, transparent)`, color: f.color, transform: on ? 'scale(1)' : 'scale(0.9)' }}
                    >
                      <f.icon size={20} strokeWidth={2.2} aria-hidden="true" />
                    </span>
                    <span className="font-display text-sm font-bold tabular-nums text-text-dim">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <h3 className="mb-2 text-xl font-bold text-text-body sm:text-2xl">{f.title}</h3>
                  <p className="leading-relaxed text-text-muted">{f.desc}</p>
                </li>
              );
            })}
          </ol>

          {/* Rail position, phone and tablet only */}
          <div className="mt-6 flex justify-center gap-1 lg:hidden">
            {features.map((f, i) => (
              <button
                key={f.title}
                type="button"
                onClick={() => go(i)}
                aria-label={f.title}
                aria-current={i === active ? 'true' : undefined}
                className="flex items-center justify-center"
              >
                <span
                  className="block h-2 rounded-full transition-[width,background-color] duration-300"
                  style={{ width: i === active ? 22 : 8, backgroundColor: i === active ? f.color : 'color-mix(in srgb, var(--color-text-body) 18%, transparent)' }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

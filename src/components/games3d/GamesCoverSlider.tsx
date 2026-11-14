'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { playRobotSelect, playRobotTick } from '@/lib/robot-sfx';
import { GAMES_3D } from './Games3DShowcase';
import { PLATFORMER_PATH, PT } from '@/components/platformer/text';
import styles from './GamesCoverSlider.module.css';

export type ShowcaseGame = {
  href: string;
  cover: string;
  title: L;
  teaser: L;
  from: string;
  to: string;
  badge?: L;
  kind: '2d' | '3d';
};

/** 2D platformer + all 3D posters, for the coverflow slider. */
export function allShowcaseGames(): ShowcaseGame[] {
  const platformer: ShowcaseGame = {
    href: PLATFORMER_PATH,
    cover: '/covers/ziggy-plateforme.webp',
    title: PT.title,
    teaser: PT.teaser,
    from: '#10172a',
    to: '#2f7a4f',
    badge: { fr: '2D · Nouveau', en: '2D · New' },
    kind: '2d',
  };
  return [
    platformer,
    ...GAMES_3D.map((g) => ({
      href: g.href,
      cover: g.cover,
      title: g.title,
      teaser: g.teaser,
      from: g.from,
      to: g.to,
      badge: { fr: '3D', en: '3D' } as L,
      kind: '3d' as const,
    })),
  ];
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Coverflow of Ziggy 2D + 3D game posters.
 * Embla Carousel (MIT) + CSS coverflow tilt; robot SFX on pick / soft tick on slide.
 * Patterns: Embla docs (align center, loop, scrollSnapList tween), classic coverflow depth.
 */
export function GamesCoverSlider({ locale, title = true }: { locale: string; title?: boolean }) {
  const games = useMemo(() => allShowcaseGames(), []);
  const reduce = useReducedMotion();
  const [emblaRef, embla] = useEmblaCarousel({
    align: 'center',
    loop: true,
    containScroll: false,
    skipSnaps: false,
    dragFree: false,
  });
  const [index, setIndex] = useState(0);
  const [scales, setScales] = useState<number[]>(() => games.map((_, i) => (i === 0 ? 1 : 0.82)));
  const paused = useRef(false);
  const autoplay = useRef<ReturnType<typeof setInterval> | null>(null);
  const live = useRef<HTMLParagraphElement>(null);
  const skipTick = useRef(true);

  const tween = useCallback(() => {
    if (!embla) return;
    const progress = embla.scrollProgress();
    const snaps = embla.scrollSnapList();
    setScales(
      snaps.map((snap) => {
        const t = clamp(1 - Math.abs(snap - progress) * 2.2, 0, 1);
        return 0.78 + 0.22 * t;
      }),
    );
  }, [embla]);

  const onSelect = useCallback(() => {
    if (!embla) return;
    const i = embla.selectedScrollSnap();
    setIndex((prev) => {
      if (prev !== i && !skipTick.current) playRobotTick();
      return i;
    });
    skipTick.current = false;
    const name = tr(games[i]?.title ?? { fr: '', en: '' }, locale);
    if (live.current) live.current.textContent = name;
  }, [embla, games, locale]);

  useEffect(() => {
    if (!embla) return;
    embla.on('select', onSelect);
    embla.on('scroll', tween);
    embla.on('reInit', tween);
    tween();
    onSelect();
    return () => {
      embla.off('select', onSelect);
      embla.off('scroll', tween);
      embla.off('reInit', tween);
    };
  }, [embla, onSelect, tween]);

  useEffect(() => {
    if (reduce || !embla) return;
    const tick = () => {
      if (!paused.current) embla.scrollNext();
    };
    autoplay.current = setInterval(tick, 4200);
    return () => {
      if (autoplay.current) clearInterval(autoplay.current);
    };
  }, [embla, reduce]);

  const pause = () => {
    paused.current = true;
  };
  const resume = () => {
    paused.current = false;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!embla) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        pause();
        embla.scrollNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        pause();
        embla.scrollPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [embla]);

  const active = games[index];

  return (
    <section
      aria-roledescription="carousel"
      aria-label={locale === 'fr' ? 'Jeux Ziggy en 3D et 2D' : 'Ziggy 3D and 2D games'}
      className="mt-8"
    >
      {title ? (
        <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-bold text-text-body">
          ✨ {locale === 'fr' ? 'Les jeux en 3D & 2D' : '3D & 2D games'}
        </h2>
      ) : null}

      <div
        className="relative"
        onPointerDown={pause}
        onTouchStart={pause}
        onFocusCapture={pause}
        onMouseEnter={pause}
        onMouseLeave={resume}
      >
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex touch-pan-y [perspective:1100px]">
            {games.map((g, i) => {
              const name = tr(g.title, locale);
              const scale = reduce ? (i === index ? 1 : 0.9) : (scales[i] ?? 0.82);
              const activeCard = i === index;
              const rot = reduce ? 0 : (0.5 - scale) * 58;
              return (
                <div
                  key={g.href}
                  className="relative min-w-0 shrink-0 grow-0 basis-[78%] px-2 sm:basis-[50%] lg:basis-[34%]"
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} / ${games.length}: ${name}`}
                  aria-hidden={!activeCard}
                >
                  <div
                    className="relative will-change-transform"
                    style={{
                      transform: `translateZ(0) scale(${scale}) rotateY(${rot}deg)`,
                      transformStyle: 'preserve-3d',
                      zIndex: activeCard ? 5 : 1,
                      transition: reduce ? 'none' : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  >
                    <Link
                      href={g.href}
                      onClick={() => playRobotSelect()}
                      className={`group relative block overflow-hidden rounded-[1.75rem] text-white shadow-xl ring-1 ring-white/15 transition focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-300/70 ${
                        activeCard
                          ? 'shadow-[0_22px_55px_-16px_rgba(120,60,200,0.55)] ring-2 ring-amber-300/55'
                          : 'opacity-95'
                      }`}
                      style={{ background: `linear-gradient(150deg, ${g.from}, ${g.to})` }}
                      tabIndex={activeCard ? 0 : -1}
                    >
                      <span className="relative block aspect-[4/5] w-full overflow-hidden">
                        <Image
                          src={g.cover}
                          alt={name}
                          fill
                          sizes="(max-width: 640px) 78vw, (max-width: 1024px) 50vw, 360px"
                          className="object-cover"
                        />
                        {activeCard && !reduce ? (
                          <>
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_38%,rgba(255,255,255,0.4)_50%,transparent_62%)] ${styles.shimmer}`}
                            />
                            <span aria-hidden="true" className="pointer-events-none absolute inset-0">
                              {Array.from({ length: 8 }, (_, k) => (
                                <span
                                  key={k}
                                  className={`absolute h-1.5 w-1.5 rounded-full bg-white/90 ${styles.spark}`}
                                  style={{
                                    left: `${12 + ((k * 37) % 76)}%`,
                                    top: `${10 + ((k * 29) % 70)}%`,
                                    animationDelay: `${k * 0.18}s`,
                                  }}
                                />
                              ))}
                            </span>
                          </>
                        ) : null}
                        <span className="absolute left-3 top-3 rounded-full bg-amber-300 px-2.5 py-0.5 text-xs font-black text-[#2a1650]">
                          {g.badge ? tr(g.badge, locale) : g.kind.toUpperCase()}
                        </span>
                      </span>
                      <span className="relative flex flex-col gap-1 p-4">
                        <span className="font-display text-lg font-bold leading-tight">{name}</span>
                        <span className="line-clamp-2 text-sm text-white/85">{tr(g.teaser, locale)}</span>
                        <span className="mt-2 inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-white/95 px-4 font-bold text-[#1b2150]">
                          ▶ {locale === 'fr' ? 'Jouer' : 'Play'}
                        </span>
                      </span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              pause();
              embla?.scrollPrev();
            }}
            className="grid h-12 w-12 place-items-center rounded-full bg-bg-card text-xl font-bold text-text-body shadow ring-1 ring-black/5 transition hover:-translate-y-0.5"
            aria-label={locale === 'fr' ? 'Jeu précédent' : 'Previous game'}
          >
            ←
          </button>
          <div className="flex gap-1.5" role="tablist" aria-label={locale === 'fr' ? 'Choisir un jeu' : 'Choose a game'}>
            {games.map((g, i) => (
              <button
                key={g.href}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={tr(g.title, locale)}
                onClick={() => {
                  pause();
                  embla?.scrollTo(i);
                }}
                className={`h-2.5 rounded-full transition-all ${i === index ? 'w-7 bg-amber-400' : 'w-2.5 bg-black/20 hover:bg-black/35'}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              pause();
              embla?.scrollNext();
            }}
            className="grid h-12 w-12 place-items-center rounded-full bg-bg-card text-xl font-bold text-text-body shadow ring-1 ring-black/5 transition hover:-translate-y-0.5"
            aria-label={locale === 'fr' ? 'Jeu suivant' : 'Next game'}
          >
            →
          </button>
        </div>

        <p className="mt-3 text-center text-sm font-semibold text-text-muted" aria-live="polite" ref={live}>
          {active ? tr(active.title, locale) : ''}
        </p>
      </div>
    </section>
  );
}

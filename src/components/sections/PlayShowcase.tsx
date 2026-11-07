'use client';

import type { CSSProperties } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { GAMES_3D } from '@/components/games3d/Games3DShowcase';
import { CREATE_APPS } from '@/components/create/CreateHub';
import { DioramaCard } from '@/components/create/fx/DioramaCard';
import { fx, shade } from '@/components/create/fx/toy';

const T = {
  eyebrow: { fr: 'Joue · Invente · Crée', en: 'Play · Invent · Create' },
  title: { fr: 'Ici, on apprend en s’amusant !', en: 'Here, learning is play!' },
  subtitle: {
    fr: 'Des jeux en 3D pour compter, lire et explorer, et des ateliers où c’est toi qui inventes. Sans publicité, et jamais d’écran d’échec.',
    en: '3D games to count, read and explore, and workshops where you are the inventor. No ads, and never a game-over screen.',
  },
  create: { fr: 'L’Atelier des créateurs', en: 'The Makers’ Workshop' },
  createHint: { fr: 'Pas de bonne ou de mauvaise réponse : tout ce que tu inventes est réussi.', en: 'No right or wrong answer: everything you make is a success.' },
  allCreate: { fr: 'Les 7 ateliers', en: 'All 7 workshops' },
  games: { fr: 'Les jeux en 3D', en: '3D games' },
  gamesHint: { fr: 'Pilote, livre, creuse, enquête… et apprends sans t’en rendre compte.', en: 'Drive, deliver, dig, investigate… and learn without noticing.' },
  allGames: { fr: 'Tous les jeux', en: 'All games' },
  fresh: { fr: 'Nouveau', en: 'New' },
  play: { fr: 'Jouer', en: 'Play' },
  make: { fr: 'Créer', en: 'Create' },
  playNow: { fr: 'Jouer maintenant', en: 'Play now' },
  makeNow: { fr: 'Inventer quelque chose', en: 'Make something' },
} satisfies Record<string, L>;

/** Home page: the games and the creative workshops, front and centre. */
export function PlayShowcase() {
  const locale = useLocale();
  const t = (k: keyof typeof T) => tr(T[k], locale);
  const workshops = CREATE_APPS.slice(0, 3);

  return (
    <section id="jouer" aria-labelledby="jouer-title" className="relative overflow-clip py-16 sm:py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_35%_at_8%_12%,rgba(138,99,255,0.14),transparent_70%),radial-gradient(40%_35%_at_95%_40%,rgba(255,111,181,0.13),transparent_70%),radial-gradient(50%_35%_at_40%_98%,rgba(255,212,71,0.14),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#8a63ff] to-[#ff6fb5] px-4 py-1.5 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg">
              <span aria-hidden="true" className={`inline-block ${fx.wiggle}`}>
                🎮
              </span>
              {t('eyebrow')}
            </span>
            <h2 id="jouer-title" className="mt-5 font-display text-4xl font-bold text-text-body text-balance sm:text-5xl">
              {t('title')}
            </h2>
            <div className="mx-auto mt-4 flex max-w-2xl items-start justify-center gap-3">
              <p className="text-lg text-text-muted">{t('subtitle')}</p>
              <SayButton texts={[t('title'), t('subtitle')]} locale={locale} size="md" className="shrink-0" />
            </div>
          </div>

        {/* The creative workshops: the three favourites, as pocket dioramas. */}
        <div className="mt-14 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl font-bold text-text-body sm:text-3xl">
              <span aria-hidden="true">🧰 </span>
              {t('create')}
            </h3>
            <p className="mt-1 text-text-muted">{t('createHint')}</p>
          </div>
          <Link href="/creer" className="press inline-flex min-h-12 items-center gap-1 rounded-full px-4 font-bold text-[#8a63ff] hover:bg-[#8a63ff]/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8a63ff]/30">
            {t('allCreate')} <span aria-hidden="true" className="rtl:rotate-180">→</span>
          </Link>
        </div>
        <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {workshops.map((a, i) => {
            const title = tr(a.title, locale);
            const text = tr(a.text, locale);
            return (
              <li key={a.href} className={i === 2 ? 'sm:max-lg:hidden' : undefined}>
                <DioramaCard
                  href={a.href}
                  label={`${title}. ${text}`}
                  from={a.from}
                  to={a.to}
                  index={i}
                  window={a.scene(title)}
                  corner={<SayButton texts={[title, text]} locale={locale} size="md" className="!bg-white/90 !text-[#5FB6EA] shadow-[0_4px_0_rgba(0,0,0,0.12)] !ring-white" />}
                >
                  <span className="flex flex-1 flex-col px-1.5 pb-1.5 pt-4">
                    <span className="w-fit rounded-full bg-white/25 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-white">{tr(a.tag, locale)}</span>
                    <span className="mt-2 font-display text-[1.6rem] font-bold leading-tight [text-shadow:0_2px_0_rgba(0,0,0,0.14)]">{title}</span>
                    <span className="mt-1.5 flex-1 text-[0.98rem] leading-snug text-white/90">{text}</span>
                    <span
                      className={`${fx.toy} ${fx.light} ${fx.sheen} mt-5 inline-flex min-h-14 w-fit items-center gap-2 rounded-full px-6 font-display text-lg font-bold`}
                      style={{ '--ink': shade(a.to, -0.35), '--delay': `${1 + i * 0.7}s` } as CSSProperties}
                    >
                      <span aria-hidden="true">▶</span> {t('make')}
                    </span>
                  </span>
                </DioramaCard>
              </li>
            );
          })}
        </ul>

        {/* The 3D games: a swipeable row of posters on phones, a grid on large screens. */}
        <div className="mt-16 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-display text-2xl font-bold text-text-body sm:text-3xl">
              <span aria-hidden="true">🕹️</span>
              {t('games')}
              <span className="rounded-full bg-amber-300 px-2.5 py-0.5 text-xs font-black uppercase text-[#2a1650]">{t('fresh')}</span>
            </h3>
            <p className="mt-1 text-text-muted">{t('gamesHint')}</p>
          </div>
          <Link href="/monde" className="press inline-flex min-h-12 items-center gap-1 rounded-full px-4 font-bold text-[#2f8fd8] hover:bg-[#2f8fd8]/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8fd8]/30">
            {t('allGames')} <span aria-hidden="true" className="rtl:rotate-180">→</span>
          </Link>
        </div>
        <ul className="-mx-4 mt-6 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto overscroll-x-contain px-4 pb-4 sm:scroll-px-6 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
          {GAMES_3D.map((g, i) => {
            const title = tr(g.title, locale);
            return (
              <li key={g.href} className="w-[74%] max-w-[300px] shrink-0 snap-start sm:w-[44%] lg:w-auto lg:max-w-none">
                <Link
                  href={g.href}
                  aria-label={`${title}. ${tr(g.teaser, locale)}`}
                  className="group relative flex h-full min-h-[17rem] flex-col overflow-hidden rounded-[1.75rem] p-5 text-white shadow-xl ring-1 ring-white/10 transition-transform duration-300 hover:-translate-y-1.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-300/70"
                  style={{ background: `linear-gradient(150deg, ${g.from}, ${g.to})` }}
                >
                  {Array.from({ length: 10 }, (_, k) => (
                    <span
                      key={k}
                      aria-hidden="true"
                      className="pointer-events-none absolute h-1 w-1 rounded-full bg-white/70"
                      style={{ left: `${(k * 37 + i * 11) % 100}%`, top: `${(k * 29 + i * 7) % 100}%` }}
                    />
                  ))}
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute -right-3 -top-3 text-[6.5rem] leading-none drop-shadow-[0_10px_12px_rgba(0,0,0,0.3)] transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110 ${fx.bob}`}
                    style={{ '--delay': `${i * 0.4}s` } as CSSProperties}
                  >
                    {g.emoji}
                  </span>
                  <span className="relative w-fit rounded-full bg-amber-300 px-2.5 py-0.5 text-xs font-black text-[#2a1650]">3D</span>
                  <span className="relative mt-auto pt-16 font-display text-xl font-bold leading-tight [text-shadow:0_2px_0_rgba(0,0,0,0.2)]">{title}</span>
                  <span className="relative mt-1 line-clamp-3 text-sm text-white/85">{tr(g.teaser, locale)}</span>
                  <span className="relative mt-4 inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-white/95 px-5 font-bold text-[#1b2150] shadow-[0_4px_0_rgba(0,0,0,0.18)] transition-transform group-hover:scale-105">
                    <span aria-hidden="true">▶</span> {t('play')}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/monde"
            className="press inline-flex min-h-16 items-center gap-2 rounded-full bg-gradient-to-r from-[#2f8fd8] to-[#22c55e] px-8 font-display text-xl font-bold text-white shadow-[0_12px_30px_-8px_rgba(34,140,200,0.6)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8fd8]/40"
          >
            <span aria-hidden="true">🎮</span> {t('playNow')}
          </Link>
          <Link
            href="/creer"
            className="press inline-flex min-h-16 items-center gap-2 rounded-full bg-gradient-to-r from-[#8a63ff] to-[#ff6fb5] px-8 font-display text-xl font-bold text-white shadow-[0_12px_30px_-8px_rgba(255,111,181,0.6)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ff6fb5]/40"
          >
            <span aria-hidden="true">🎨</span> {t('makeNow')}
          </Link>
        </div>
      </div>
    </section>
  );
}

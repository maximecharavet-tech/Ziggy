'use client';

import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { DODO_STORIES } from '@/data/dodo';
import { VALUE_LABEL, type DodoStory, type DodoValue } from '@/data/dodo/types';
import { tr, type L } from '@/lib/i18n-text';
import { storyMinutes, storyOfTheNight, updateDodo, useDodoSettings, useManifest, type DodoManifest } from '@/lib/dodo/client';
import { useHydrated } from '@/lib/world/store';
import { MascotCutout } from '@/components/ziggy/Mascot';
import { useProfile } from '@/components/account/ProfileProvider';
import { NightScene } from './NightScene';
import { DodoPrepare } from './DodoPrepare';

const T = {
  eyebrow: { fr: 'Mode dodo · Hyper Engine', en: 'Bedtime mode · Hyper Engine' },
  title: { fr: 'Ziggy te raconte une histoire', en: 'Ziggy tells you a story' },
  subtitle: {
    fr: '31 histoires douces, pleines de valeurs, avec des sons du sommeil pour s’endormir tranquillement.',
    en: '31 gentle stories full of values, with sleep sounds to drift off peacefully.',
  },
  tonight: { fr: 'L’histoire de ce soir', en: 'Tonight’s story' },
  listen: { fr: 'Écouter', en: 'Listen' },
  surprise: { fr: 'Histoire surprise', en: 'Surprise story' },
  all: { fr: 'Toutes', en: 'All' },
  favorites: { fr: 'Mes préférées', en: 'My favourites' },
  heard: { fr: 'déjà écoutée', en: 'heard' },
  min: { fr: 'min', en: 'min' },
  special: { fr: 'Histoire spéciale', en: 'Special story' },
  age: { fr: 'dès {n} ans', en: 'age {n}+' },
  fav: { fr: 'Ajouter aux préférées', en: 'Add to favourites' },
} satisfies Record<string, L>;

export function DodoHome() {
  const locale = useLocale();
  const hydrated = useHydrated();
  const settings = useDodoSettings();
  const manifest = useManifest();
  const { isOwner } = useProfile();
  const [filter, setFilter] = useState<DodoValue | 'all' | 'fav'>('all');
  const lili = DODO_STORIES.find((s) => s.id === 'lili')!;
  const tonight = useMemo(() => storyOfTheNight(DODO_STORIES.filter((s) => s.id !== 'lili'), hydrated ? settings.heard : []), [hydrated, settings.heard]);
  const values = useMemo(() => [...new Set(DODO_STORIES.map((s) => s.value))], []);
  const shown = DODO_STORIES.filter((s) => filter === 'all' || (filter === 'fav' ? settings.favorites.includes(s.id) : s.value === filter));

  const surprise = () => {
    const pool = DODO_STORIES.filter((s) => s.id !== tonight.id);
    window.location.href = `${window.location.pathname.replace(/\/$/, '')}/${pool[Math.floor(Math.random() * pool.length)].id}`;
  };

  return (
    <div className="relative min-h-screen overflow-clip bg-[#080b22] px-4 pb-24 pt-28 text-white sm:px-6 lg:px-8">
      <StarField />
      <div className="relative mx-auto max-w-6xl">
        <header className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="inline-flex rounded-full border border-amber-200/30 bg-amber-200/10 px-4 py-1.5 text-sm font-bold text-amber-100">
              🌙 {tr(T.eyebrow, locale)}
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-4 font-display text-4xl font-bold sm:text-6xl">
              {tr(T.title, locale)}
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-3 max-w-2xl text-lg text-white/70">
              {tr(T.subtitle, locale)}
            </motion.p>
          </div>
          <motion.div className="mx-auto w-40 sm:w-52" animate={{ y: [0, -8, 0], rotate: [0, -2, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
            <MascotCutout pose="heart" width={208} />
          </motion.div>
        </header>

        {/* Princesse Lili */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-10">
          <Link href={`/dodo/${lili.id}`} className="group relative block overflow-hidden rounded-[2rem] shadow-2xl ring-1 ring-white/10 focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-200/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lili.cover} alt={tr(lili.title, locale)} className="aspect-[16/10] w-full object-cover transition duration-[2000ms] group-hover:scale-105 sm:aspect-[16/7]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080b22] via-[#080b22]/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-6 sm:p-8">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-amber-200">✨ {tr(T.special, locale)}</p>
                <h2 className="mt-1 max-w-xl font-display text-3xl font-bold sm:text-4xl">{tr(lili.title, locale)}</h2>
                <p className="mt-1 text-white/75">{tr(lili.teaser, locale)}</p>
              </div>
              <span className="rounded-full bg-gradient-to-r from-pink-300 to-amber-200 px-6 py-3 font-bold text-[#2a1650] shadow-lg transition group-hover:scale-105">▶ {tr(T.listen, locale)}</span>
            </div>
          </Link>
        </motion.section>

        {/* Tonight */}
        {hydrated ? (
          <section className="mt-8 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center" aria-label={tr(T.tonight, locale)}>
            <Link href={`/dodo/${tonight.id}`} className="flex items-center gap-4 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10 transition hover:bg-white/10">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-amber-200/15 text-4xl">{tonight.emoji}</span>
              <span className="min-w-0">
                <span className="block text-xs font-bold uppercase tracking-widest text-amber-200/80">🌙 {tr(T.tonight, locale)}</span>
                <span className="block truncate font-display text-xl font-bold">{tr(tonight.title, locale)}</span>
                <span className="block text-sm text-white/60">
                  {tr(VALUE_LABEL[tonight.value], locale)} · {storyMinutes(tonight, locale)} {tr(T.min, locale)}
                </span>
              </span>
            </Link>
            <button type="button" onClick={surprise} className="rounded-full bg-white/10 px-6 py-3 font-bold ring-1 ring-white/15 transition hover:bg-white/20">
              🎲 {tr(T.surprise, locale)}
            </button>
          </section>
        ) : null}

        {/* Filters */}
        <div className="mt-10 flex flex-wrap gap-2" role="group" aria-label={tr(T.all, locale)}>
          {(['all', 'fav', ...values] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={filter === v}
              onClick={() => setFilter(v)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${filter === v ? 'bg-amber-200 text-[#2a1650]' : 'bg-white/5 text-white/75 ring-1 ring-white/10 hover:bg-white/10'}`}
            >
              {v === 'all' ? tr(T.all, locale) : v === 'fav' ? `♥ ${tr(T.favorites, locale)}` : tr(VALUE_LABEL[v], locale)}
            </button>
          ))}
        </div>

        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s, i) => (
            <motion.li key={s.id} layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
              <StoryCard story={s} locale={locale} manifest={manifest} heard={hydrated && settings.heard.includes(s.id)} fav={hydrated && settings.favorites.includes(s.id)} />
            </motion.li>
          ))}
        </ul>

        {isOwner ? <DodoPrepare locale={locale} /> : null}
      </div>
    </div>
  );
}

function StoryCard({ story, locale, manifest, heard, fav }: { story: DodoStory; locale: string; manifest: DodoManifest | null; heard: boolean; fav: boolean }) {
  const image = story.cover ?? manifest?.images[story.id]?.[1];
  const settings = useDodoSettings();
  return (
    <div className="group relative overflow-hidden rounded-3xl bg-white/5 ring-1 ring-white/10 transition hover:-translate-y-1 hover:ring-amber-200/40">
      <Link href={`/dodo/${story.id}`} className="block focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-200/60">
        <div className="relative aspect-[16/10] overflow-hidden">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" loading="lazy" className="h-full w-full object-cover transition duration-[1500ms] group-hover:scale-105" />
          ) : (
            <NightScene art={story.scenes[0].art} seed={story.id.length * 13} still />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-xs font-bold backdrop-blur">
            {tr(VALUE_LABEL[story.value], locale)}
          </span>
          {heard ? <span className="absolute right-12 top-3 rounded-full bg-black/40 px-2 py-1 text-xs backdrop-blur">✓ {tr(T.heard, locale)}</span> : null}
        </div>
        <div className="p-4">
          <h3 className="font-display text-lg font-bold leading-snug">
            {story.emoji} {tr(story.title, locale)}
          </h3>
          <p className="mt-1 text-sm text-white/65">{tr(story.teaser, locale)}</p>
          <p className="mt-2 text-xs font-semibold text-white/45">
            {storyMinutes(story, locale)} {tr(T.min, locale)} · {tr(T.age, locale).replace('{n}', String(story.age))}
          </p>
        </div>
      </Link>
      <button
        type="button"
        aria-pressed={fav}
        aria-label={tr(T.fav, locale)}
        onClick={() => updateDodo({ favorites: fav ? settings.favorites.filter((x) => x !== story.id) : [...settings.favorites, story.id] })}
        className="absolute right-3 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-lg backdrop-blur transition hover:scale-110"
      >
        {fav ? '💖' : '🤍'}
      </button>
    </div>
  );
}

function StarField() {
  const stars = useMemo(() => Array.from({ length: 70 }, (_, i) => ({ x: (i * 37.7) % 100, y: (i * 53.3) % 100, s: 1 + (i % 3), d: 2 + (i % 5) })), []);
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute -top-40 left-1/4 h-[36rem] w-[36rem] rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-[30rem] w-[30rem] rounded-full bg-fuchsia-500/10 blur-3xl" />
      {stars.map((s, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s }}
          animate={{ opacity: [0.15, 0.9, 0.15] }}
          transition={{ duration: s.d, repeat: Infinity, delay: (i % 7) * 0.4 }}
        />
      ))}
    </div>
  );
}

'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { Link, useRouter } from '@/i18n/navigation';
import { DODO_STORIES } from '@/data/dodo';
import { VALUE_LABEL, type DodoStory, type DodoValue } from '@/data/dodo/types';
import { tr, type L } from '@/lib/i18n-text';
import { knownTiming, storyOfTheNight, updateDodo, useAllTimings, useDodoSettings, useManifest, type DodoManifest } from '@/lib/dodo/client';
import { durationBucket, minutesOf, storySeconds, textLocale, voiceSummaryOf, type DurationBucket, type VoiceSummary } from '@/lib/dodo/player';
import { voiceBase } from '@/lib/dodo/voice';
import { useHydrated } from '@/lib/world/store';
import { useProfile } from '@/components/account/ProfileProvider';
import { Ziggy3D } from '@/components/ziggy3d/Ziggy3D';
import { NightScene, SKY } from './NightScene';
import { DodoPrepare } from './DodoPrepare';
import { DodoSay } from './DodoSay';
import { Horizon, Moon, NightSky, Sparkles } from './Scenery';
import css from './dodo.module.css';

const T = {
  eyebrow: { fr: 'Mode dodo', en: 'Bedtime mode' },
  title1: { fr: 'Ziggy te raconte', en: 'Ziggy tells you' },
  title2: { fr: 'une histoire', en: 'a story' },
  subtitle: {
    fr: '31 histoires douces pour s’endormir. Ziggy lit avec sa petite voix, les mots s’allument un par un, et les sons du sommeil te bercent.',
    en: '31 gentle stories to fall asleep to. Ziggy reads in his little voice, the words light up one by one, and sleep sounds rock you gently.',
  },
  f1: { fr: 'La voix de Ziggy', en: 'Ziggy’s voice' },
  f2: { fr: 'Les mots s’allument', en: 'Words light up' },
  f3: { fr: 'Sons du sommeil', en: 'Sleep sounds' },
  tonight: { fr: 'L’histoire de ce soir', en: 'Tonight’s story' },
  listen: { fr: 'Écouter', en: 'Listen' },
  surprise: { fr: 'Une autre, au hasard', en: 'Another one, at random' },
  library: { fr: 'Toutes les histoires', en: 'All the stories' },
  all: { fr: 'Toutes', en: 'All' },
  favorites: { fr: 'Mes préférées', en: 'My favourites' },
  values: { fr: 'Les valeurs', en: 'Values' },
  lengths: { fr: 'La durée', en: 'Length' },
  short: { fr: 'Courtes', en: 'Short' },
  medium: { fr: 'Moyennes', en: 'Medium' },
  long: { fr: 'Longues', en: 'Longer' },
  heard: { fr: 'Déjà écoutée', en: 'Heard' },
  min: { fr: 'min', en: 'min' },
  special: { fr: 'Histoire spéciale', en: 'Special story' },
  age: { fr: 'dès {n} ans', en: 'age {n}+' },
  voice: { fr: 'Voix de Ziggy', en: 'Ziggy’s voice' },
  fav: { fr: 'Ajouter aux préférées', en: 'Add to favourites' },
  unfav: { fr: 'Retirer des préférées', en: 'Remove from favourites' },
  none: { fr: 'Pas d’histoire ici… Essaie un autre choix.', en: 'No story here… Try another choice.' },
  reset: { fr: 'Tout voir', en: 'Show all' },
} satisfies Record<string, L>;

/** A little picture for each value, for children who cannot read yet. */
const VALUE_EMOJI: Record<DodoValue, string> = {
  kindness: '💛',
  sharing: '🤲',
  honesty: '🪞',
  courage: '🦁',
  patience: '🐢',
  friendship: '🤝',
  respect: '🙏',
  gratitude: '🌻',
  perseverance: '🧗',
  forgiveness: '🕊️',
  empathy: '💞',
  nature: '🌿',
  cooperation: '🧩',
  self_confidence: '⭐',
  difference: '🌈',
  responsibility: '🎒',
  generosity: '🎁',
  listening: '👂',
  calm: '🍃',
  curiosity: '🔭',
  humility: '🌾',
  family: '🏡',
  helping: '🤗',
  trust: '🫶',
};

type Info = { seconds: number; recorded: boolean; titleClip: string | null };

/** `voices`: the recorded stories, read when the page was built (undefined: look from the browser). */
export function DodoHome({ voices }: { voices?: VoiceSummary }) {
  const locale = useLocale();
  const l = textLocale(locale);
  const hydrated = useHydrated();
  const settings = useDodoSettings();
  const manifest = useManifest();
  const { isOwner } = useProfile();
  const reduce = useReducedMotion();
  const router = useRouter();
  const [value, setValue] = useState<DodoValue | 'all' | 'fav'>('all');
  const [length, setLength] = useState<DurationBucket | 'all'>('all');
  const [valuesOpen, setValuesOpen] = useState(false);

  // Durations come from Ziggy's recordings when they exist (fetched quietly), else from a calm reading pace.
  const ids = useMemo(() => DODO_STORIES.map((s) => s.id), []);
  const version = useAllTimings(locale, ids, !voices);
  const info = useMemo<Record<string, Info>>(() => {
    void version;
    return Object.fromEntries(
      DODO_STORIES.map((s) => {
        const t = voices ? null : (knownTiming(locale, s.id) ?? null);
        const v = voices?.[s.id] ?? (t ? voiceSummaryOf(s, locale, t) : null);
        return [s.id, { seconds: v?.seconds ?? storySeconds(s, locale), recorded: Boolean(v?.complete), titleClip: v?.title ? `${voiceBase(locale, s.id)}/${v.title}` : null }];
      })
    );
  }, [locale, version, voices]);

  const heard = useMemo(() => (hydrated ? settings.heard : []), [hydrated, settings.heard]);
  const favorites = hydrated ? settings.favorites : [];
  const tonight = useMemo(() => storyOfTheNight(DODO_STORIES.filter((s) => s.id !== 'lili'), heard), [heard]);
  const values = useMemo(() => [...new Set(DODO_STORIES.map((s) => s.value))], []);
  const buckets = useMemo(() => {
    const n: Record<DurationBucket, number> = { short: 0, medium: 0, long: 0 };
    for (const s of DODO_STORIES) n[durationBucket(info[s.id].seconds)]++;
    return n;
  }, [info]);
  const lengthChoices = (['short', 'medium', 'long'] as const).filter((b) => buckets[b] > 0);
  const shown = DODO_STORIES.filter(
    (s) =>
      (value === 'all' || (value === 'fav' ? favorites.includes(s.id) : s.value === value)) &&
      (length === 'all' || durationBucket(info[s.id].seconds) === length)
  );

  const surprise = () => {
    const pool = DODO_STORIES.filter((s) => s.id !== tonight.id);
    router.push(`/dodo/${pool[Math.floor(Math.random() * pool.length)].id}`);
  };
  const toggleFav = (id: string) => updateDodo({ favorites: settings.favorites.includes(id) ? settings.favorites.filter((x) => x !== id) : [...settings.favorites, id] });

  // Parallax: far stars, near stars and the moon move at different speeds as the page scrolls.
  const { scrollY } = useScroll();
  const far = useTransform(scrollY, [0, 1200], [0, reduce ? 0 : -50]);
  const near = useTransform(scrollY, [0, 1200], [0, reduce ? 0 : -150]);
  const moonY = useTransform(scrollY, [0, 800], [0, reduce ? 0 : 90]);

  return (
    <div className="relative isolate min-h-screen overflow-clip bg-[#060a24] text-white [clip-path:inset(0)]">
      {/* The sky stays in view while the page scrolls; the clip-path above keeps it inside this page (never over the footer). */}
      <NightSky className="fixed inset-0 -z-10" far={far} near={near} moon={false} stars={80} />

      <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-28 sm:px-6 lg:px-8">
        {/* Hero */}
        <header className="relative grid items-center gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <div className="relative z-10">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full bg-amber-200/10 px-4 py-1.5 text-sm font-bold text-amber-100 ring-1 ring-amber-200/25"
            >
              🌙 {tr(T.eyebrow, locale)}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.8 }}
              className="mt-4 font-display text-[clamp(2.4rem,1.6rem+3.6vw,4.5rem)] font-bold leading-[1.05] [text-wrap:balance]"
            >
              {tr(T.title1, locale)}{' '}
              <span className="bg-gradient-to-r from-amber-200 via-[#ffd9a8] to-pink-200 bg-clip-text text-transparent">{tr(T.title2, locale)}</span>
            </motion.h1>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.8 }} className="mt-4 flex max-w-2xl items-start gap-3">
              <p className="text-lg leading-relaxed text-white/75">{tr(T.subtitle, locale)}</p>
              <DodoSay texts={[`${tr(T.title1, locale)} ${tr(T.title2, locale)}.`, tr(T.subtitle, locale)]} locale={locale} size="sm" className="mt-1" />
            </motion.div>
            <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.8 }} className="mt-5 flex flex-wrap gap-2 text-sm font-semibold text-white/80">
              {[`🎙️ ${tr(T.f1, locale)}`, `✨ ${tr(T.f2, locale)}`, `🌧️ ${tr(T.f3, locale)}`].map((f) => (
                <li key={f} className="rounded-full bg-white/[0.07] px-3 py-1.5 ring-1 ring-white/10">
                  {f}
                </li>
              ))}
            </motion.ul>
          </div>
          <div className="relative mx-auto -mt-2 h-[14rem] w-[16rem] sm:mt-0 sm:h-[20rem] sm:w-[20rem]">
            <motion.div className="absolute right-0 top-0" style={{ y: moonY }}>
              <Moon size="clamp(7.5rem, 6rem + 7vw, 13rem)" />
            </motion.div>
            <div className={`${css.float} absolute bottom-0 left-3 sm:left-4`}>
              <Ziggy3D className="h-48 w-36 sm:h-64 sm:w-48" idle="calm" mood="calm" accessory="nightcap" framing="full" fallback="heart" />
            </div>
            {/* A soft cloud for Ziggy to sit on. */}
            <div className="pointer-events-none absolute -bottom-4 left-0 h-14 w-[80%]" aria-hidden="true">
              <div className="absolute inset-x-0 bottom-0 h-[70%] rounded-full bg-[radial-gradient(closest-side,rgba(139,132,240,0.55),rgba(139,132,240,0.22)_60%,transparent)]" />
              <div className="absolute bottom-[30%] left-[18%] h-[80%] w-[36%] rounded-full bg-[radial-gradient(closest-side,rgba(160,152,250,0.5),transparent)]" />
              <div className="absolute bottom-[34%] left-[46%] h-full w-[40%] rounded-full bg-[radial-gradient(closest-side,rgba(160,152,250,0.45),transparent)]" />
            </div>
          </div>
        </header>

        {/* Tonight's story */}
        {hydrated ? (
          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }} className="mt-14" aria-labelledby="dodo-tonight">
            <h2 id="dodo-tonight" className="mb-4 flex items-center gap-2 font-display text-xl font-bold text-amber-100">
              <span aria-hidden="true">🌙</span> {tr(T.tonight, locale)}
            </h2>
            <article className="group relative grid overflow-hidden rounded-[2rem] bg-[#0d1138]/85 shadow-[0_30px_80px_rgba(2,3,14,.55)] ring-1 ring-white/10 transition focus-within:ring-2 focus-within:ring-amber-200/60 md:grid-cols-[1.35fr_1fr]">
              <Link href={`/dodo/${tonight.id}`} tabIndex={-1} aria-hidden="true" className="relative block aspect-[16/10] overflow-hidden md:aspect-auto md:min-h-[24rem]">
                <Cover story={tonight} manifest={manifest} big />
                <Sparkles seed={9} count={reduce ? 4 : 10} />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d1138] via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-[#0d1138]" />
              </Link>
              <div className="relative flex flex-col justify-center gap-4 p-6 sm:p-8">
                <Badges story={tonight} info={info[tonight.id]} locale={locale} />
                <div className="flex items-start gap-3">
                  <h3 className="font-display text-3xl font-bold leading-tight text-[#fff8ea] [text-wrap:balance] sm:text-4xl">
                    <Link href={`/dodo/${tonight.id}`} className="rounded-lg focus-visible:outline-none">
                      {tonight.emoji} {tr(tonight.title, l)}
                    </Link>
                  </h3>
                  <DodoSay texts={[tr(tonight.title, l), tr(tonight.teaser, l)]} clip={info[tonight.id].titleClip} locale={locale} size="sm" className="mt-1" />
                </div>
                <p className="text-lg text-white/70">{tr(tonight.teaser, l)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/dodo/${tonight.id}`}
                    className="inline-flex min-h-14 items-center gap-2 rounded-full bg-gradient-to-r from-amber-200 via-amber-100 to-pink-200 px-7 py-3.5 text-lg font-bold text-[#24164a] shadow-[0_10px_30px_rgba(255,200,140,.25)] transition hover:scale-[1.03] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                  >
                    ▶ {tr(T.listen, locale)}
                  </Link>
                  <button
                    type="button"
                    onClick={surprise}
                    className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/[0.08] px-5 py-3 font-bold text-white/85 ring-1 ring-white/15 transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200"
                  >
                    🎲 {tr(T.surprise, locale)}
                  </button>
                </div>
              </div>
            </article>
          </motion.section>
        ) : (
          <div className="mt-14 h-[30rem] rounded-[2rem] bg-white/[0.04] md:h-[24rem]" aria-hidden="true" />
        )}

        {/* The library */}
        <section className="mt-16" aria-labelledby="dodo-library">
          <h2 id="dodo-library" className="font-display text-3xl font-bold">
            📚 {tr(T.library, locale)} <span className="text-lg font-semibold text-white/45">· {shown.length}</span>
          </h2>

          <div className="-mx-4 mt-5 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            <div role="group" aria-label={tr(T.library, locale)} className="flex shrink-0 gap-2 sm:flex-wrap">
              <Chip
                on={value === 'all' && length === 'all'}
                onClick={() => {
                  setValue('all');
                  setLength('all');
                  setValuesOpen(false);
                }}
              >
                ✨ {tr(T.all, locale)}
              </Chip>
              <Chip on={value === 'fav'} onClick={() => setValue(value === 'fav' ? 'all' : 'fav')}>
                💖 {tr(T.favorites, locale)}
              </Chip>
              <Chip on={valuesOpen || (value !== 'all' && value !== 'fav')} onClick={() => setValuesOpen((o) => !o)} expanded={valuesOpen} controls="dodo-values">
                {value !== 'all' && value !== 'fav' ? `${VALUE_EMOJI[value]} ${tr(VALUE_LABEL[value], locale)}` : `🌈 ${tr(T.values, locale)}`}{' '}
                <span aria-hidden="true" className={`inline-block transition-transform ${valuesOpen ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </Chip>
            </div>
            {lengthChoices.length > 1 ? (
              <div role="group" aria-label={tr(T.lengths, locale)} className="flex shrink-0 gap-2 border-s border-white/10 ps-3 sm:ms-2 sm:flex-wrap sm:ps-4">
                {lengthChoices.map((b) => (
                  <Chip key={b} on={length === b} onClick={() => setLength(length === b ? 'all' : b)}>
                    ⏱ {tr(T[b], locale)} <span className="text-xs opacity-60">{b === 'short' ? '≤ 3' : b === 'medium' ? '3–4' : '5+'} min</span>
                  </Chip>
                ))}
              </div>
            ) : null}
          </div>
          <AnimatePresence initial={false}>
            {valuesOpen ? (
              <motion.div
                id="dodo-values"
                key="values"
                role="group"
                aria-label={tr(T.values, locale)}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="mt-3 flex flex-wrap gap-2 rounded-[1.5rem] bg-white/[0.04] p-3 ring-1 ring-white/10">
                  {values.map((v) => (
                    <Chip
                      key={v}
                      small
                      on={value === v}
                      onClick={() => {
                        setValue(value === v ? 'all' : v);
                        setValuesOpen(false);
                      }}
                    >
                      {VALUE_EMOJI[v]} {tr(VALUE_LABEL[v], locale)}
                    </Chip>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {shown.length ? (
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((s, i) => (
                <motion.li
                  key={s.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ delay: (i % 3) * 0.06, duration: 0.6 }}
                  className={s.id === 'lili' ? 'sm:col-span-2' : ''}
                >
                  <StoryCard
                    story={s}
                    locale={locale}
                    manifest={manifest}
                    info={info[s.id]}
                    heard={heard.includes(s.id)}
                    fav={favorites.includes(s.id)}
                    onFav={() => toggleFav(s.id)}
                    wide={s.id === 'lili'}
                  />
                </motion.li>
              ))}
            </ul>
          ) : (
            <div className="mt-10 flex flex-col items-center gap-4 rounded-[2rem] bg-white/[0.04] p-10 text-center ring-1 ring-white/10">
              <p className="text-lg text-white/70">🌙 {tr(T.none, locale)}</p>
              <Chip
                on
                onClick={() => {
                  setValue('all');
                  setLength('all');
                }}
              >
                {tr(T.reset, locale)}
              </Chip>
            </div>
          )}
        </section>

        {isOwner ? <DodoPrepare locale={locale} /> : null}
      </div>
      <Horizon className="pointer-events-none relative -mt-24 block h-28 w-full sm:h-36" />
    </div>
  );
}

function Chip({
  children,
  on,
  onClick,
  small,
  expanded,
  controls,
}: {
  children: ReactNode;
  on: boolean;
  onClick: () => void;
  small?: boolean;
  expanded?: boolean;
  controls?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={expanded === undefined ? on : undefined}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 ${small ? 'min-h-10 px-3.5 py-1.5 text-sm' : 'min-h-11 px-4 py-2 text-sm'} ${
        on ? 'bg-amber-200 text-[#24164a] shadow-[0_6px_20px_rgba(253,230,138,.25)]' : 'bg-white/[0.06] text-white/80 ring-1 ring-white/10 hover:bg-white/[0.12]'
      }`}
    >
      {children}
    </button>
  );
}

/** First scene illustration (or the story's own cover); the drawn night scene until it exists. */
function Cover({ story, manifest, big }: { story: DodoStory; manifest: DodoManifest | null; big?: boolean }) {
  const image = story.cover ?? manifest?.images[story.id]?.[1] ?? null;
  const [failed, setFailed] = useState(false);
  if (!image && !manifest) {
    // Still finding out whether the illustration exists: the scene's sky only, no emoji flash.
    const sky = SKY[story.scenes[0].art.sky];
    return <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${sky.top} 0%, ${sky.bottom} 100%)` }} />;
  }
  if (image && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        loading={big ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-transform duration-[2500ms] ease-out group-hover:scale-[1.06] ${story.cover ? 'object-[50%_25%]' : ''}`}
      />
    );
  }
  return <NightScene art={story.scenes[0].art} seed={story.id.length * 13} still={!big} />;
}

function Badges({ story, info, locale, compact }: { story: DodoStory; info: Info; locale: string; compact?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>
      <span className="rounded-full bg-amber-200/12 px-3 py-1 text-amber-100 ring-1 ring-amber-200/25">
        {VALUE_EMOJI[story.value]} {tr(VALUE_LABEL[story.value], locale)}
      </span>
      <span className="rounded-full bg-white/[0.07] px-3 py-1 text-white/75 ring-1 ring-white/10">
        ⏱ {minutesOf(info.seconds)} {tr(T.min, locale)}
      </span>
      {!compact ? <span className="rounded-full bg-white/[0.07] px-3 py-1 text-white/75 ring-1 ring-white/10">{tr(T.age, locale).replace('{n}', String(story.age))}</span> : null}
      {info.recorded ? <span className="rounded-full bg-white/[0.07] px-3 py-1 text-white/75 ring-1 ring-white/10">🎙️ {tr(T.voice, locale)}</span> : null}
    </div>
  );
}

function StoryCard({
  story,
  locale,
  manifest,
  info,
  heard,
  fav,
  onFav,
  wide,
}: {
  story: DodoStory;
  locale: string;
  manifest: DodoManifest | null;
  info: Info;
  heard: boolean;
  fav: boolean;
  onFav: () => void;
  wide?: boolean;
}) {
  const l = textLocale(locale);
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-[#0d1138]/85 ring-1 ring-white/10 transition duration-500 focus-within:ring-2 focus-within:ring-amber-200/70 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(2,3,14,.55)] hover:ring-amber-200/35">
      <div className={`relative overflow-hidden ${wide ? 'aspect-[16/10] sm:aspect-[21/9]' : 'aspect-[16/10]'}`}>
        <Cover story={story} manifest={manifest} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0d1138] via-[#0d1138]/10 to-transparent" />
        {wide ? (
          <span className="absolute left-4 top-4 rounded-full bg-gradient-to-r from-pink-200 to-amber-200 px-3 py-1 text-xs font-bold text-[#24164a] shadow">✨ {tr(T.special, locale)}</span>
        ) : (
          <span className="absolute left-3 top-3 rounded-full bg-[#0b0e2c]/75 px-3 py-1 text-xs font-bold text-white/90 ring-1 ring-white/10">
            {VALUE_EMOJI[story.value]} {tr(VALUE_LABEL[story.value], locale)}
          </span>
        )}
        {heard ? (
          <span className="absolute bottom-3 left-3 rounded-full bg-[#0b0e2c]/75 px-2.5 py-1 text-xs font-semibold text-amber-100/90 ring-1 ring-white/10">🌙 {tr(T.heard, locale)}</span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5 pt-3">
        <h3 className={`font-display font-bold leading-snug text-[#fff8ea] ${wide ? 'text-2xl sm:text-3xl' : 'text-xl'}`}>
          <Link href={`/dodo/${story.id}`} className="focus-visible:outline-none after:absolute after:inset-0 after:content-['']">
            {story.emoji} {tr(story.title, l)}
          </Link>
        </h3>
        <p className={`mt-1.5 text-white/65 ${wide ? 'text-base' : 'line-clamp-2 text-sm'}`}>{tr(story.teaser, l)}</p>
        <div className="mt-auto flex items-center gap-2 pt-4">
          <span className="text-xs font-semibold text-white/50">
            ⏱ {minutesOf(info.seconds)} {tr(T.min, locale)} · {tr(T.age, locale).replace('{n}', String(story.age))}
            {info.recorded ? ` · 🎙️ ${tr(T.voice, locale)}` : ''}
          </span>
          <DodoSay texts={[tr(story.title, l)]} clip={info.titleClip} locale={locale} size="sm" className="relative z-10 ms-auto" />
        </div>
      </div>
      <button
        type="button"
        aria-pressed={fav}
        aria-label={tr(fav ? T.unfav : T.fav, locale)}
        title={tr(fav ? T.unfav : T.fav, locale)}
        onClick={onFav}
        className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-[#0b0e2c]/75 text-lg ring-1 ring-white/10 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200"
      >
        {fav ? '💖' : '🤍'}
      </button>
    </article>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { DODO_STORIES } from '@/data/dodo';
import { VALUE_LABEL, type DodoStory } from '@/data/dodo/types';
import { tr, type L } from '@/lib/i18n-text';
import { minutesOf, storySeconds, textLocale, type VoiceSummary } from '@/lib/dodo/player';
import { voiceBase } from '@/lib/dodo/voice';
import { storyOfTheNight, useDodoSettings, useManifest } from '@/lib/dodo/client';
import { useHydrated } from '@/lib/world/store';
import { getGame } from '@/lib/arcade/registry';
import { TV_GAMES } from '@/lib/tv/catalog';
import { FACE, FILMS } from '@/lib/mascot';
import { isMuted } from '@/lib/sound';
import { useBackLayer, useFocusReturn } from '@/lib/back-layer';
import { lighten, darken, strong } from '@/components/arcade/stage/color';
import { DodoCover, VALUE_EMOJI } from '@/components/dodo/DodoHome';
import { NightSky } from '@/components/dodo/Scenery';
import { Ziggy3D } from '@/components/ziggy3d/Ziggy3D';
import { ZiggyLogo } from '@/components/ziggy/ZiggyLogo';
import { SayButton } from '@/components/arcade/read-aloud';
import { PAGE_BACK_EVENT } from '@/components/app/AppBack';
import css from './tv.module.css';

const T = {
  hello: { fr: 'Coucou !', en: 'Hello!' },
  morning: { fr: 'Bonjour !', en: 'Good morning!' },
  afternoon: { fr: 'Coucou !', en: 'Hello!' },
  evening: { fr: 'Bonsoir !', en: 'Good evening!' },
  bubble: { fr: 'On lit une histoire ensemble ?', en: 'Shall we read a story together?' },
  tonight: { fr: 'L’histoire de ce soir', en: 'Tonight’s story' },
  today: { fr: 'L’histoire du jour', en: 'Today’s story' },
  listen: { fr: 'Écouter', en: 'Listen' },
  stories: { fr: 'Ziggy te raconte une histoire', en: 'Ziggy tells you a story' },
  games: { fr: 'Jouer avec Ziggy', en: 'Play with Ziggy' },
  films: { fr: 'Les films de Ziggy', en: 'Ziggy’s films' },
  count: { fr: '{n} histoires', en: '{n} stories' },
  gamesNote: { fr: 'avec les flèches et OK', en: 'with the arrows and OK' },
  min: { fr: 'min', en: 'min' },
  play: { fr: 'Jouer', en: 'Play' },
  watch: { fr: 'Regarder', en: 'Watch' },
  hint: { fr: 'pour choisir', en: 'to choose' },
  ok: { fr: 'pour ouvrir', en: 'to open' },
  parents: { fr: 'Parents', en: 'Parents' },
  back: { fr: 'Retour', en: 'Back' },
  filmLoop: { fr: 'Ziggy dit bonjour', en: 'Ziggy says hello' },
  filmLoopNote: { fr: 'Un petit coucou', en: 'A little wave' },
  filmFilm: { fr: 'Ziggy, le vrai !', en: 'The real Ziggy!' },
  filmFilmNote: { fr: 'Le film de Ziggy', en: 'Ziggy’s film' },
} satisfies Record<string, L>;

const FOCUS_KEY = 'ziggy:tv:focus';
type Film = keyof typeof FILMS;
const FILM_LIST: { id: Film; title: L; note: L }[] = [
  { id: 'loop', title: T.filmLoop, note: T.filmLoopNote },
  { id: 'film', title: T.filmFilm, note: T.filmFilmNote },
];

function rememberTile(id: string) {
  try {
    sessionStorage.setItem(FOCUS_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Ziggy says a story's title (his own recording) when a tile stays focused a moment. */
let titleAudio: HTMLAudioElement | null = null;
function sayTitle(clip: string | null) {
  titleAudio?.pause();
  if (!clip || isMuted()) return;
  titleAudio ??= new Audio();
  titleAudio.src = clip;
  void titleAudio.play().catch(() => {});
}

/**
 * The 10-foot home of the Ziggy app on TV: Ziggy and tonight's story first,
 * then three rows driven by the remote — stories, games, films.
 */
export function TvHome({ voices }: { voices?: VoiceSummary }) {
  const locale = useLocale();
  const l = textLocale(locale);
  const hydrated = useHydrated();
  const settings = useDodoSettings();
  const manifest = useManifest();
  const [film, setFilm] = useState<Film | null>(null);
  const [greeting, setGreeting] = useState<L>(T.hello);
  const [evening, setEvening] = useState(true);
  const heroButton = useRef<HTMLAnchorElement>(null);
  const root = useRef<HTMLDivElement>(null);

  const heard = useMemo(() => (hydrated ? settings.heard : []), [hydrated, settings.heard]);
  const tonight = useMemo(
    () =>
      storyOfTheNight(
        DODO_STORIES.filter((s) => s.id !== 'lili'),
        heard
      ),
    [heard]
  );
  const titleClip = (s: DodoStory) => {
    const v = voices?.[s.id];
    return v?.title ? `${voiceBase(locale, s.id)}/${v.title}` : null;
  };
  const seconds = (s: DodoStory) => voices?.[s.id]?.seconds ?? storySeconds(s, locale);

  // Time of day (the browser's clock, after hydration).
  useEffect(() => {
    const h = new Date().getHours();
    setEvening(h >= 17 || h < 5);
    setGreeting(h >= 17 || h < 5 ? T.evening : h < 12 ? T.morning : T.afternoon);
  }, []);

  // Where the focus starts: the tile the child came back from, else "Listen" (the remote's landing spot).
  const [landing, setLanding] = useState('hero');
  useEffect(() => {
    if (!hydrated) return;
    let id: string | null = null;
    try {
      id = sessionStorage.getItem(FOCUS_KEY);
    } catch {
      /* ignore */
    }
    const tile = id && id !== 'hero' ? root.current?.querySelector<HTMLElement>(`[data-tv-id="${CSS.escape(id)}"]`) : null;
    setLanding(tile ? id! : 'hero');
    const el = tile ?? heroButton.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if (tile) tile.scrollIntoView({ block: 'center', inline: 'nearest' });
    else window.scrollTo({ top: 0 });
  }, [hydrated]);
  const spot = (id: string) => (landing === id ? '' : undefined);

  // Back on the home: first back up to the top ("Listen"); from there, Back offers to leave.
  useEffect(() => {
    const onBack = (e: Event) => {
      const hero = heroButton.current;
      if (!hero || document.activeElement === hero || film) return;
      e.preventDefault();
      hero.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener(PAGE_BACK_EVENT, onBack);
    return () => window.removeEventListener(PAGE_BACK_EVENT, onBack);
  }, [film]);

  // Story titles are said in Ziggy's voice when a tile stays focused.
  useEffect(() => {
    let timer = 0;
    const onFocus = (e: FocusEvent) => {
      window.clearTimeout(timer);
      titleAudio?.pause();
      const clip = (e.target as HTMLElement | null)?.getAttribute?.('data-clip');
      if (clip) timer = window.setTimeout(() => sayTitle(clip), 700);
    };
    document.addEventListener('focusin', onFocus);
    return () => {
      window.clearTimeout(timer);
      titleAudio?.pause();
      document.removeEventListener('focusin', onFocus);
    };
  }, []);

  const cover = tonight.cover ?? manifest?.images[tonight.id]?.[1] ?? null;

  return (
    <div ref={root} className={css.root}>
      <div className={css.sky} aria-hidden="true">
        <NightSky className="absolute inset-0" stars={90} moon={false} seed={11} />
        <span className={css.glow} style={{ left: '-10%', top: '-18%', width: '50%', height: '70%', '--c': '#5b3fd0' } as CSSProperties} />
        <span className={css.glow} style={{ right: '-10%', bottom: '-16%', width: '52%', height: '64%', '--c': '#c2477a', opacity: 0.3 } as CSSProperties} />
      </div>

      <header className={css.head}>
        <div className={css.brand}>
          <span className={css.face}>
            <Image src={FACE} alt="" fill sizes="136px" className="object-cover" priority />
          </span>
          <span className={css.logo}>
            <ZiggyLogo size={150} />
          </span>
          <span className={css.hello}>{tr(greeting, locale)}</span>
          <SayButton texts={[tr(greeting, locale), tr(T.bubble, locale)]} locale={locale} size="md" />
        </div>
        <div className={css.hint}>
          <span className={css.key} aria-hidden="true">
            ◀ ▶
          </span>
          <span>{tr(T.hint, locale)}</span>
          <span className={css.key} aria-hidden="true">
            OK
          </span>
          <span>{tr(T.ok, locale)}</span>
          <Link href="/monde/parents" className={css.parents}>
            🔒 {tr(T.parents, locale)}
          </Link>
        </div>
      </header>

      {/* Tonight's story, Ziggy beside it */}
      <section className={css.hero} aria-labelledby="tv-tonight">
        <div className={css.billboard} aria-hidden="true">
          {hydrated ? (
            cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <DodoCover story={tonight} manifest={manifest} big />
            )
          ) : null}
        </div>
        {/* Tonight's story depends on the day and on what was heard: shown once in the browser. */}
        {hydrated ? (
          <motion.div className={css.heroText} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className={css.eyebrow}>🌙 {tr(evening ? T.tonight : T.today, locale)}</p>
            <h1 id="tv-tonight" className={css.title}>
              {tonight.emoji} {tr(tonight.title, l)}
            </h1>
            <p className={css.teaser}>{tr(tonight.teaser, l)}</p>
            <div className={css.actions}>
              <Link ref={heroButton} href={`/dodo/${tonight.id}`} className={css.cta} data-tv-autofocus={spot('hero')} data-clip={titleClip(tonight) ?? undefined} onClick={() => rememberTile('hero')}>
                ▶ {tr(T.listen, locale)} · {minutesOf(seconds(tonight))} {tr(T.min, locale)}
              </Link>
            </div>
          </motion.div>
        ) : (
          <div className={css.heroText} />
        )}
        <div className={css.ziggy}>
          <Ziggy3D className="h-full w-full" idle="calm" mood="happy" accessory={evening ? 'nightcap' : 'none'} framing="full" fallback="wave" followPointer={false} />
        </div>
        <motion.p
          className={css.bubble}
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 22 }}
          aria-hidden="true"
        >
          {tr(T.bubble, locale)}
        </motion.p>
      </section>

      <Row title={`🌙 ${tr(T.stories, locale)}`} note={tr(T.count, locale).replace('{n}', String(DODO_STORIES.length))} id="stories">
        {DODO_STORIES.map((s) => (
          <Link
            key={s.id}
            href={`/dodo/${s.id}`}
            className={`${css.tile} ${css.story}`}
            data-tv-id={`story-${s.id}`}
            data-tv-autofocus={spot(`story-${s.id}`)}
            data-clip={titleClip(s) ?? undefined}
            onClick={() => rememberTile(`story-${s.id}`)}
            aria-label={tr(s.title, l)}
          >
            <span className={css.art}>
              <DodoCover story={s} manifest={manifest} />
              <span className={css.badge}>
                {VALUE_EMOJI[s.value]} {tr(VALUE_LABEL[s.value], locale)}
              </span>
              <span className={css.play} aria-hidden="true">
                ▶
              </span>
            </span>
            <span className={css.caption}>
              <strong>
                {s.emoji} {tr(s.title, l)}
              </strong>
              <span>
                ⏱ {minutesOf(seconds(s))} {tr(T.min, locale)}
                {settings.heard.includes(s.id) && hydrated ? ' · 🌙' : ''}
              </span>
            </span>
          </Link>
        ))}
      </Row>

      <Row title={`🎮 ${tr(T.games, locale)}`} note={tr(T.gamesNote, locale)} id="games">
        {TV_GAMES.map((id) => {
          const g = getGame(id);
          const base = strong(g.color);
          return (
            <Link key={id} href={`/monde/arcade/${id}`} className={`${css.tile} ${css.game}`} data-tv-id={`game-${id}`} data-tv-autofocus={spot(`game-${id}`)} onClick={() => rememberTile(`game-${id}`)} aria-label={tr(g.name, locale)}>
              <span className={css.art} style={{ background: `radial-gradient(circle at 50% 35%, ${lighten(base, 0.55)} 0%, ${lighten(base, 0.15)} 55%, ${darken(base, 0.2)} 100%)` }}>
                <span
                  className={css.token}
                  style={{ background: `radial-gradient(circle at 34% 28%, ${lighten(base, 0.7)} 0%, ${lighten(base, 0.25)} 38%, ${base} 72%, ${darken(base, 0.18)} 100%)` }}
                  aria-hidden="true"
                >
                  {g.emoji}
                </span>
                <span className={css.play} aria-hidden="true">
                  ▶
                </span>
              </span>
              <span className={css.caption}>
                <strong>{tr(g.name, locale)}</strong>
                <span>{tr(T.play, locale)}</span>
              </span>
            </Link>
          );
        })}
      </Row>

      <Row title={`🎬 ${tr(T.films, locale)}`} id="films">
        {FILM_LIST.map((f) => (
          <button key={f.id} type="button" className={`${css.tile} ${css.film} text-start`} data-tv-id={`film-${f.id}`} data-tv-autofocus={spot(`film-${f.id}`)} onClick={() => setFilm(f.id)} aria-label={tr(f.title, locale)}>
            <span className={css.art}>
              <Image src={FILMS[f.id].poster} alt="" fill sizes="(min-width: 1200px) 420px, 220px" className="object-cover object-[50%_28%]" />
              <span className={css.play} aria-hidden="true">
                ▶
              </span>
            </span>
            <span className={css.caption}>
              <strong>{tr(f.title, locale)}</strong>
              <span>
                {tr(T.watch, locale)} · {tr(f.note, locale)}
              </span>
            </span>
          </button>
        ))}
      </Row>

      <AnimatePresence>
        {film ? <FilmPlayer key={film} film={film} title={tr(FILM_LIST.find((f) => f.id === film)!.title, locale)} back={tr(T.back, locale)} onClose={() => setFilm(null)} /> : null}
      </AnimatePresence>
    </div>
  );
}

function Row({ title, note, id, children }: { title: string; note?: string; id: string; children: ReactNode }) {
  return (
    <section className={css.row} aria-labelledby={`tv-row-${id}`}>
      <h2 id={`tv-row-${id}`} className={css.rowTitle}>
        {title} {note ? <small>· {note}</small> : null}
      </h2>
      <div className={css.scroller} data-tv-row="">
        {children}
      </div>
    </section>
  );
}

/** A Ziggy film, full screen. Back (or OK on "Back") returns to the films row. */
function FilmPlayer({ film, title, back, onClose }: { film: Film; title: string; back: string; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  const present = useIsPresent();
  useBackLayer(true, onClose);
  useFocusReturn(present);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    close.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack' || e.key === 'Backspace') {
        e.preventDefault();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const f = FILMS[film];
  return (
    <motion.div role="dialog" aria-modal={present ? 'true' : undefined} inert={!present} aria-label={title} className={css.player} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={f.poster} alt="" className={css.playerBlur} aria-hidden="true" />
      <video className={css.playerVideo} poster={f.poster} autoPlay muted loop playsInline disablePictureInPicture aria-label={title}>
        <source src={f.src} type="video/mp4" />
        <source src={f.webm} type="video/webm" />
      </video>
      <button ref={close} type="button" className={css.playerBack} onClick={onClose} data-close="">
        <span aria-hidden="true">↩</span> {back}
      </button>
    </motion.div>
  );
}

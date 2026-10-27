'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { ARCADE_GAMES } from '@/lib/arcade/registry';
import type { GameDefinition } from '@/lib/arcade/types';
import { SKILL_FAMILY, SKILL_NAMES } from '@/lib/learning/skills';
import { useHydrated, useWorldMemory } from '@/lib/world/store';
import { tr } from '@/lib/i18n-text';
import { wt } from './text';
import { Games3DShowcase } from '@/components/games3d/Games3DShowcase';
import { Tilt3D } from '@/components/ui/Tilt3D';
import { GameScene } from '@/components/arcade/stage/GameScene';
import { GAME_MOTIFS, NIGHT_GAMES, scenePalette } from '@/components/arcade/stage/themes';
import { SpeechBubble, Title3D } from '@/components/arcade/stage/Showpieces';
import { ZiggyHost } from '@/components/arcade/stage/ZiggyHost';
import { darken, lighten, rgba, strong } from '@/components/arcade/stage/color';
import css from '@/components/arcade/stage/stage.module.css';

const FAMILIES = ['all', 'math', 'language', 'logic', 'discovery', 'creativity'] as const;
const FAMILY_TEXT: Record<(typeof FAMILIES)[number], { fr: string; en: string }> = {
  all: { fr: 'Tous', en: 'All' },
  math: { fr: 'Nombres', en: 'Numbers' },
  language: { fr: 'Lettres & mots', en: 'Letters & words' },
  logic: { fr: 'Logique & mémoire', en: 'Logic & memory' },
  discovery: { fr: 'Découverte', en: 'Discovery' },
  creativity: { fr: 'Créativité', en: 'Creativity' },
};
const FAMILY_EMOJI: Record<(typeof FAMILIES)[number], string> = { all: '🌈', math: '🔢', language: '🔤', logic: '🧠', discovery: '🔭', creativity: '🎨' };

const ARCADE_COLOR = '#FF8A65';
const HELLO = { kind: 'wave' as const, id: 0 };

/** The 20 arcade games, free play. Each one adapts its level to the child's skill. */
export function ArcadeHome() {
  const locale = useLocale();
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const [family, setFamily] = useState<(typeof FAMILIES)[number]>('all');
  const games = useMemo(() => Object.values(ARCADE_GAMES).filter((g) => family === 'all' || g.skills.some((s) => SKILL_FAMILY[s] === family)), [family]);
  const palette = useMemo(() => scenePalette(ARCADE_COLOR), []);
  const title = locale === 'fr' ? '20 jeux qui grandissent avec toi' : '20 games that grow with you';
  const subtitle =
    locale === 'fr'
      ? 'Chaque jeu s’adapte à ton niveau : jamais trop facile, jamais trop dur. Et aucune partie n’est perdue !'
      : 'Every game adapts to your level: never too easy, never too hard. And no game is ever lost!';

  return (
    <div className="relative min-h-screen overflow-clip px-4 pb-24 pt-24 sm:px-6 lg:px-8" style={{ backgroundColor: palette.groundDeep }}>
      <GameScene palette={palette} motifs={['🕹️', '⭐', '🎲', '🧩', '🎈', '🏆']} horizon="52vh" />
      <div className="relative mx-auto max-w-6xl">
        <header className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="text-center lg:text-start">
            <motion.span
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className="inline-flex items-center gap-2 rounded-full border-2 bg-white/85 px-4 py-1.5 font-display text-sm font-bold shadow-[0_3px_0_rgba(40,30,80,0.08)] dark:bg-bg-card/85"
              style={{ color: darken(ARCADE_COLOR, 0.3), borderColor: lighten(ARCADE_COLOR, 0.5) }}
            >
              🕹️ Ziggy Arcade
            </motion.span>
            <Title3D text={title} color={ARCADE_COLOR} className="mt-4 text-4xl sm:text-6xl" delay={0.05} />
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mx-auto mt-5 max-w-2xl lg:mx-0">
              <SpeechBubble color={ARCADE_COLOR} tail="none" className="lg:me-6">
                <p className="text-lg font-semibold text-text-body" dir="auto">
                  {subtitle}
                </p>
              </SpeechBubble>
            </motion.div>
          </div>
          <div className="relative mx-auto hidden h-[300px] w-[230px] lg:block">
            <ZiggyHost className="h-full w-full" idle="wave" reaction={HELLO} pose="wave" color={ARCADE_COLOR} label={locale === 'fr' ? 'Ziggy t’accueille' : 'Ziggy welcomes you'} />
          </div>
        </header>

        <Games3DShowcase locale={locale} />
        {/* One arcade: the 8 original mini-games are reachable from here too. */}
        <Link
          href="/games"
          className="group mt-5 flex items-center justify-between gap-3 rounded-[1.6rem] border-[3px] bg-bg-card px-5 py-4 font-bold text-text-body shadow-[0_6px_0_rgba(40,30,80,0.1),0_18px_30px_-18px_rgba(40,30,80,0.4)] transition-transform hover:-translate-y-0.5 active:translate-y-1"
          style={{ borderColor: lighten(ARCADE_COLOR, 0.6) }}
        >
          <span className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: lighten(ARCADE_COLOR, 0.8) }} aria-hidden="true">
              🧩
            </span>
            {locale === 'fr' ? 'Les 8 jeux classiques : mémoire, Simon, puzzle, code, logique…' : 'The 8 classic games: memory, Simon, puzzle, code, logic…'}
          </span>
          <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full text-white transition-transform group-hover:translate-x-1 rtl:rotate-180" style={{ background: strong(ARCADE_COLOR) }}>
            →
          </span>
        </Link>

        <div className="mt-10 flex flex-wrap justify-center gap-2.5" role="group" aria-label={wt('skill', locale)}>
          {FAMILIES.map((f) => {
            const on = family === f;
            return (
              <motion.button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => setFamily(f)}
                whileTap={{ y: 3 }}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-2 text-sm font-extrabold transition-colors"
                style={
                  on
                    ? { background: `linear-gradient(180deg, ${lighten(strong(ARCADE_COLOR), 0.2)}, ${strong(ARCADE_COLOR)})`, color: '#fff', boxShadow: `0 4px 0 ${darken(strong(ARCADE_COLOR), 0.32)}`, textShadow: '0 1px 0 rgba(0,0,0,0.2)' }
                    : { background: 'var(--color-bg-card)', color: 'var(--color-text-body)', boxShadow: '0 4px 0 rgba(40,30,80,0.1)', border: `2px solid ${lighten(ARCADE_COLOR, 0.7)}` }
                }
              >
                <span aria-hidden="true">{FAMILY_EMOJI[f]}</span>
                {tr(FAMILY_TEXT[f], locale)}
              </motion.button>
            );
          })}
        </div>

        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {games.map((g, i) => {
              const level = hydrated ? (memory.skills[g.skills[0]]?.difficulty ?? 1) : 1;
              const plays = hydrated ? (memory.gamesPlayed[g.id] ?? 0) : 0;
              return (
                <motion.li
                  key={g.id}
                  layout
                  initial={{ opacity: 0, y: 30, rotateX: -25 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 240, damping: 20, delay: i * 0.03 }}
                  style={{ transformPerspective: 900 }}
                >
                  <GameCard game={g} level={level} plays={plays} locale={locale} />
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  );
}

/** A game as a toy cartridge: a tiny themed scene on top, the details below. */
function GameCard({ game: g, level, plays, locale }: { game: GameDefinition; level: number; plays: number; locale: string }) {
  const night = NIGHT_GAMES.has(g.id);
  const base = strong(g.color);
  const p = scenePalette(g.color, { night });
  const motifs = GAME_MOTIFS[g.id];
  return (
    <Tilt3D className="h-full rounded-[1.8rem]" max={8}>
      <Link
        href={`/monde/arcade/${g.id}`}
        className="group relative flex h-full flex-col overflow-hidden rounded-[1.8rem] border-[3px] bg-bg-card outline-none focus-visible:ring-4"
        style={{
          borderColor: lighten(g.color, 0.45),
          boxShadow: `0 8px 0 ${lighten(g.color, 0.15)}, 0 26px 40px -22px ${rgba(darken(g.color, 0.5), 0.55)}`,
          ['--tw-ring-color' as string]: rgba(g.color, 0.55),
        }}
      >
        {/* Mini scene */}
        <span className="relative block h-36 overflow-hidden" style={{ background: `linear-gradient(180deg, ${p.skyTop}, ${p.skyBottom})` }} aria-hidden="true">
          <svg className="absolute inset-x-0 bottom-0 h-16 w-full" viewBox="0 0 400 80" preserveAspectRatio="none">
            <path d="M0 40 C60 10 120 14 180 34 C240 54 300 20 400 26 V80 H0Z" fill={p.mid} />
            <path d="M0 60 C80 44 160 48 230 60 C300 72 350 56 400 58 V80 H0Z" fill={p.near} />
          </svg>
          {night ? (
            <>
              {[12, 30, 58, 76, 88, 44].map((x, k) => (
                <span key={k} className={`absolute h-1 w-1 rounded-full bg-white ${css.twinkle}`} style={{ left: `${x}%`, top: `${10 + ((k * 23) % 40)}%`, '--delay': `${-k * 0.5}s` } as CSSProperties} />
              ))}
            </>
          ) : (
            <span className="absolute right-4 top-3 h-12 w-12 rounded-full" style={{ background: 'radial-gradient(circle, #FFF7D6 0 30%, rgba(255,233,168,0.6) 45%, transparent 70%)' }} />
          )}
          <span className="absolute left-3 top-3 text-xl opacity-80 transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-12">{motifs[0]}</span>
          <span className="absolute bottom-6 right-4 text-lg opacity-80 transition-transform duration-500 group-hover:-translate-y-2">{motifs[1]}</span>
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[45%]">
            <span
              className="grid h-20 w-20 place-items-center rounded-full text-4xl transition-transform duration-300 group-hover:-translate-y-2 group-hover:scale-110 group-hover:-rotate-6"
              style={{
                background: `radial-gradient(circle at 34% 28%, ${lighten(base, 0.7)} 0%, ${lighten(base, 0.25)} 38%, ${base} 74%, ${darken(base, 0.18)} 100%)`,
                boxShadow: `inset 0 -6px 10px ${rgba(darken(base, 0.4), 0.45)}, inset 0 3px 0 rgba(255,255,255,0.6), 0 6px 0 ${darken(base, 0.32)}, 0 16px 20px -8px ${rgba(darken(base, 0.5), 0.5)}`,
              }}
            >
              <span className="drop-shadow-[0_3px_2px_rgba(0,0,0,0.25)]">{g.emoji}</span>
            </span>
          </span>
          {g.aiContent ? <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-extrabold text-purple shadow-sm">✨ AI</span> : null}
        </span>
        {/* Details */}
        <span className="flex flex-1 flex-col p-4 pt-3">
          <span className="font-display text-lg font-bold leading-tight text-text-body" dir="auto">
            {tr(g.name, locale)}
          </span>
          <span className="mt-1 flex-1 text-sm text-text-muted" dir="auto">
            {tr(g.description, locale)}
          </span>
          <span className="mt-3 flex flex-wrap gap-1">
            {g.skills.slice(0, 3).map((s) => (
              <span key={s} className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: rgba(g.color, 0.14), color: darken(base, 0.2) }}>
                {tr(SKILL_NAMES[s], locale)}
              </span>
            ))}
          </span>
          <span className="mt-3 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-text-muted">
              <span className="sr-only">
                {wt('difficulty', locale)} {level}/5
              </span>
              <span className="flex gap-0.5" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className="h-2 w-2 rounded-full" style={{ background: n <= level ? base : rgba(g.color, 0.2) }} />
                ))}
              </span>
              {plays ? <span>· {plays}×</span> : null}
            </span>
            <span
              className="grid h-10 w-10 place-items-center rounded-full text-sm text-white transition-transform group-hover:scale-110 group-active:translate-y-0.5"
              style={{ background: `linear-gradient(180deg, ${lighten(base, 0.2)}, ${base})`, boxShadow: `0 3px 0 ${darken(base, 0.35)}` }}
              aria-hidden="true"
            >
              <span className="ms-0.5">▶</span>
            </span>
          </span>
        </span>
      </Link>
    </Tilt3D>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { WORLDS } from '@/data/worlds';
import { COMPANIONS } from '@/data/companions';
import type { WorldDefinition } from '@/data/types';
import { nextAdventure, type AdventurePlan } from '@/lib/world/engine';
import { dayKey, isWorldUnlocked, worldProgress } from '@/lib/world/gamification';
import { totalStars, type WorldMemory } from '@/lib/world/memory';
import { accessToken, syncWorld, useHydrated, useWorldMemory } from '@/lib/world/store';
import { getGame } from '@/lib/arcade/registry';
import { tr } from '@/lib/i18n-text';
import { EASE_OUT } from '@/lib/motion';
import { StatusBar } from './StatusBar';
import { CompanionBuddy } from './CompanionBuddy';
import { wt } from './text';

export function WorldMapHome() {
  const locale = useLocale();
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    void accessToken().then((t) => {
      setSignedIn(Boolean(t));
      if (t) void syncWorld();
    });
  }, []);

  const today = dayKey();
  const plan = useMemo(() => (hydrated ? nextAdventure(memory, WORLDS, today) : null), [hydrated, memory, today]);

  return (
    <div className="relative min-h-screen overflow-clip px-4 pb-24 pt-28 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-40 left-1/3 h-[34rem] w-[34rem] rounded-full bg-sky/20 blur-3xl" />
        <div className="absolute top-60 -left-40 h-[28rem] w-[28rem] rounded-full bg-pink/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[30rem] w-[30rem] rounded-full bg-leaf/15 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-6xl">
        <header className="text-center">
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-purple/40 bg-purple/10 px-4 py-1.5 text-sm font-bold text-purple">
            🌍 Hyper Engine · ZIGGY WORLD
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, ease: EASE_OUT }} className="mt-4 font-display text-5xl font-bold text-text-body sm:text-7xl">
            {wt('title', locale)}
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mx-auto mt-3 max-w-2xl text-lg text-text-muted">
            {wt('tagline', locale)}
          </motion.p>
        </header>

        <div className="mt-8 min-h-[4.5rem]">{hydrated ? <StatusBar memory={memory} locale={locale} /> : null}</div>

        {hydrated && plan ? <ContinueCard plan={plan} memory={memory} locale={locale} /> : <div className="mt-6 h-48 animate-pulse rounded-[2rem] bg-bg-card/60" aria-hidden="true" />}

        <QuickLinks locale={locale} />

        <section className="mt-12" aria-labelledby="map-title">
          <h2 id="map-title" className="font-display text-3xl font-bold text-text-body">
            🗺️ {wt('map', locale)}
          </h2>
          {hydrated ? <MapBoard memory={memory} locale={locale} current={plan?.worldId} /> : <div className="mt-6 aspect-[16/10] animate-pulse rounded-[2rem] bg-bg-card/60" aria-hidden="true" />}
        </section>

        {signedIn !== null ? <p className="mt-8 text-center text-sm text-text-muted">{signedIn ? wt('syncedNote', locale) : wt('guestNote', locale)}</p> : null}
      </div>
    </div>
  );
}

function ContinueCard({ plan, memory, locale }: { plan: AdventurePlan; memory: WorldMemory; locale: string }) {
  const world = WORLDS.find((w) => w.id === plan.worldId)!;
  const quest = world.quests.find((q) => q.id === plan.questId)!;
  const game = getGame(plan.gameId);
  const companion = COMPANIONS.find((c) => c.id === memory.companion) ?? COMPANIONS[0];
  const fresh = Object.keys(memory.completedQuests).length === 0;
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT }}
      className="relative mt-6 overflow-hidden rounded-[2rem] p-6 shadow-xl sm:p-8"
      style={{ background: `linear-gradient(135deg, ${world.colors.from}, ${world.colors.to})`, color: world.colors.ink }}
      aria-labelledby="continue-title"
    >
      <div className="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
        {world.background.slice(0, 6).map((e, i) => (
          <motion.span
            key={i}
            className="absolute text-4xl opacity-30"
            style={{ left: `${8 + i * 16}%`, top: `${i % 2 ? 62 : 12}%` }}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut' }}
          >
            {e}
          </motion.span>
        ))}
      </div>
      <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider opacity-80">
            {world.icon} {tr(world.name, locale)} · {wt('chapter', locale)} {plan.chapter}
            {plan.isDaily ? <span className="ms-2 rounded-full bg-white/70 px-2 py-0.5 normal-case tracking-normal">☀️ {wt('dailyBonus', locale)}</span> : null}
          </p>
          <h2 id="continue-title" className="mt-2 font-display text-3xl font-bold sm:text-4xl">
            {tr(quest.title, locale)}
          </h2>
          <p className="mt-2 max-w-xl text-base font-medium opacity-90">{tr(quest.intro, locale)}</p>
          <p className="mt-3 text-sm font-semibold opacity-80">
            {game.emoji} {tr(game.name, locale)} · {wt('difficulty', locale)} {plan.difficulty}/5 · +{plan.reward.xp} XP
          </p>
          <Link
            href={{ pathname: '/monde/jouer', query: { world: plan.worldId, quest: plan.questId } }}
            className="mt-5 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-lg font-bold text-white shadow-lg transition hover:scale-[1.03] focus-visible:outline focus-visible:outline-4 focus-visible:outline-white/70"
            style={{ backgroundColor: world.colors.accent }}
          >
            ▶ {fresh ? wt('start', locale) : wt('continue', locale)}
          </Link>
        </div>
        <CompanionBuddy profile={companion} mood="HAPPY" locale={locale} size={96} line={tr(companion.reactions.hint[0], locale)} />
      </div>
    </motion.section>
  );
}

const LINKS = [
  { href: '/monde/arcade', emoji: '🕹️', key: 'arcade', color: '#FF8A65' },
  { href: '/monde/avatar', emoji: '🧑‍🎨', key: 'avatar', color: '#BA68C8' },
  { href: '/monde/histoires', emoji: '📚', key: 'stories', color: '#5FB6EA' },
  { href: '/monde/compagnons', emoji: '🐾', key: 'companions', color: '#7FC85C' },
  { href: '/monde/collection', emoji: '💎', key: 'collection', color: '#FBBF24' },
  { href: '/monde/parents', emoji: '👨‍👩‍👧', key: 'parents', color: '#4FC9C0' },
] as const;

function QuickLinks({ locale }: { locale: string }) {
  return (
    <nav aria-label={wt('title', locale)} className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
      {LINKS.map((l, i) => (
        <motion.div key={l.href} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.04 }}>
          <Link
            href={l.href}
            className="group flex h-full flex-col items-center gap-1 rounded-3xl border border-border/70 bg-bg-card/80 px-2 py-4 text-center text-sm font-bold text-text-body shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-4"
            style={{ outlineColor: `${l.color}66` }}
          >
            <span className="text-3xl transition group-hover:scale-110" aria-hidden="true">
              {l.emoji}
            </span>
            {wt(l.key, locale)}
          </Link>
        </motion.div>
      ))}
    </nav>
  );
}

function MapBoard({ memory, locale, current }: { memory: WorldMemory; locale: string; current?: string }) {
  const stars = totalStars(memory);
  const path = WORLDS.map((w) => `${w.map.x},${w.map.y}`).join(' ');
  return (
    <>
      {/* Wide screens: the illustrated map. */}
      <div className="relative mt-6 hidden aspect-[16/10] overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-to-br from-sky/15 via-leaf/10 to-peach/25 shadow-inner md:block">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={path} fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="1.4 1.2" className="text-text-muted/40" vectorEffect="non-scaling-stroke" />
        </svg>
        <ol className="absolute inset-0">
          {WORLDS.map((w, i) => (
            <li key={w.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${w.map.x}%`, top: `${w.map.y}%` }}>
              <MapNode world={w} index={i} memory={memory} stars={stars} locale={locale} current={current === w.id} />
            </li>
          ))}
        </ol>
      </div>
      {/* Phones: the same journey as a winding path. */}
      <ol className="mt-6 grid gap-3 md:hidden">
        {WORLDS.map((w, i) => (
          <li key={w.id} className={i % 2 ? 'ps-10' : 'pe-10'}>
            <MapNode world={w} index={i} memory={memory} stars={stars} locale={locale} current={current === w.id} row />
          </li>
        ))}
      </ol>
    </>
  );
}

function MapNode({ world, index, memory, stars, locale, current, row }: { world: WorldDefinition; index: number; memory: WorldMemory; stars: number; locale: string; current: boolean; row?: boolean }) {
  const unlocked = isWorldUnlocked(world, memory);
  const p = worldProgress(world, memory);
  const done = p.done === p.total;
  const label = `${tr(world.name, locale)} — ${unlocked ? `${p.done}/${p.total} · ⭐ ${p.stars}` : wt('locked', locale, { n: world.unlockStars - stars })}`;
  const bubble = (
    <motion.span
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.03 * index, type: 'spring', stiffness: 220, damping: 16 }}
      className={`relative grid shrink-0 place-items-center rounded-full border-4 shadow-lg transition ${row ? 'h-14 w-14 text-3xl' : 'h-16 w-16 text-3xl lg:h-20 lg:w-20 lg:text-4xl'} ${
        unlocked ? 'group-hover:scale-110' : 'grayscale'
      }`}
      style={{ background: `linear-gradient(135deg, ${world.colors.from}, ${world.colors.to})`, borderColor: unlocked ? world.colors.accent : '#cbd5e1' }}
    >
      <span aria-hidden="true">{unlocked ? world.icon : '🔒'}</span>
      {current ? (
        <motion.span className="absolute -inset-2 rounded-full border-4" style={{ borderColor: world.colors.accent }} animate={{ scale: [1, 1.15, 1], opacity: [0.9, 0.3, 0.9] }} transition={{ duration: 1.8, repeat: Infinity }} aria-hidden="true" />
      ) : null}
      {done ? <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-green text-xs text-white" aria-hidden="true">✓</span> : null}
    </motion.span>
  );
  const text = (
    <span className={row ? 'min-w-0 text-start' : 'mt-1 block max-w-[7.5rem] text-center'}>
      <span className={`block font-display font-bold leading-tight text-text-body ${row ? 'text-base' : 'text-xs lg:text-sm'}`}>{tr(world.name, locale)}</span>
      <span className="block text-xs font-semibold text-text-muted">{unlocked ? `${p.done}/${p.total} · ⭐ ${p.stars}` : `🔒 ${world.unlockStars} ⭐`}</span>
    </span>
  );
  const cls = `group flex items-center rounded-3xl focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky/50 ${row ? 'gap-3 border border-border/60 bg-bg-card/80 p-2 pe-4' : 'flex-col'}`;
  return unlocked ? (
    <Link href={`/monde/${world.id}`} className={cls} aria-label={label}>
      {bubble}
      {text}
    </Link>
  ) : (
    <div className={`${cls} cursor-not-allowed opacity-70`} aria-label={label} role="img">
      {bubble}
      {text}
    </div>
  );
}

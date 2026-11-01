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
import { StatusBar } from './StatusBar';
import { CompanionBuddy } from './CompanionBuddy';
import { wt } from './text';
import { Games3DShowcase } from '@/components/games3d/Games3DShowcase';
import { AgePicker, AGE_CHOICES } from './AgePicker';
import { SayButton } from '@/components/arcade/read-aloud';
import { GameScene } from '@/components/arcade/stage/GameScene';
import { scenePalette } from '@/components/arcade/stage/themes';
import { Title3D } from '@/components/arcade/stage/Showpieces';
import { ZiggyHost } from '@/components/arcade/stage/ZiggyHost';
import { darken, lighten, rgba, strong } from '@/components/arcade/stage/color';
import css from '@/components/arcade/stage/stage.module.css';

const HOME_COLOR = '#5FB6EA';
const HELLO = { kind: 'wave' as const, id: 0 };

export function WorldMapHome() {
  const locale = useLocale();
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [askAge, setAskAge] = useState(false);

  useEffect(() => {
    void accessToken().then((t) => {
      setSignedIn(Boolean(t));
      if (t) void syncWorld();
    });
  }, []);

  const today = dayKey();
  const plan = useMemo(() => (hydrated ? nextAdventure(memory, WORLDS, today) : null), [hydrated, memory, today]);

  const palette = useMemo(() => scenePalette(HOME_COLOR, { from: '#E8F6FF', to: '#BDE6FF' }), []);

  return (
    <div className="relative min-h-screen overflow-clip px-4 pb-24 pt-24 sm:px-6 lg:px-8" style={{ backgroundColor: palette.groundDeep }}>
      <GameScene palette={palette} motifs={['🏰', '🚀', '🧚', '🏴‍☠️', '🦕', '🦄']} horizon="46vh" />
      <div className="relative mx-auto max-w-6xl">
        <header className="text-center">
          <motion.p
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            className="inline-flex items-center gap-2 rounded-full border-2 border-white bg-white/85 px-4 py-1.5 font-display text-sm font-bold text-purple shadow-[0_3px_0_rgba(40,30,80,0.08)] dark:bg-bg-card/85"
          >
            🌍 Hyper Engine · ZIGGY WORLD
          </motion.p>
          <div className="mt-4 flex justify-center">
            <Title3D text={wt('title', locale)} color="#7C6CF0" className="text-5xl sm:text-7xl" delay={0.05} />
          </div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mx-auto mt-4 max-w-2xl rounded-full bg-white/70 px-5 py-2 text-lg font-semibold text-text-body dark:bg-bg-card/70" dir="auto">
            {wt('tagline', locale)}
          </motion.p>
        </header>

        <div className="mt-8 min-h-[4.5rem]">{hydrated ? <StatusBar memory={memory} locale={locale} /> : null}</div>

        {hydrated && plan ? <ContinueCard plan={plan} memory={memory} locale={locale} /> : <div className="mt-6 h-48 animate-pulse rounded-[2rem] bg-bg-card/60" aria-hidden="true" />}

        <QuickLinks locale={locale} />

        <Games3DShowcase locale={locale} />

        <section className="mt-12" aria-labelledby="map-title">
          <h2 id="map-title" className="font-display text-3xl font-bold text-text-body">
            🗺️ {wt('map', locale)}
          </h2>
          {hydrated ? <MapBoard memory={memory} locale={locale} current={plan?.worldId} /> : <div className="mt-6 aspect-[16/10] animate-pulse rounded-[2rem] bg-bg-card/60" aria-hidden="true" />}
        </section>

        {signedIn !== null ? <p className="mt-8 text-center text-sm text-text-muted">{signedIn ? wt('syncedNote', locale) : wt('guestNote', locale)}</p> : null}
        {hydrated && memory.age ? (
          <p className="mt-2 text-center text-sm">
            <button type="button" onClick={() => setAskAge(true)} className="font-semibold text-text-muted underline">
              {AGE_CHOICES.find((a) => a.id === memory.age)?.emoji} {tr(AGE_CHOICES.find((a) => a.id === memory.age)!.title, locale)} · {locale === 'fr' ? 'changer' : 'change'}
            </button>
          </p>
        ) : null}
        {hydrated && (!memory.age || askAge) ? <AgePicker locale={locale} onChosen={() => setAskAge(false)} /> : null}
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
  const a = world.colors.accent;
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 160, damping: 20 }}
      className="relative mt-8 rounded-[2.4rem] p-2"
      style={{
        background: `linear-gradient(170deg, ${lighten(a, 0.4)}, ${a})`,
        boxShadow: `0 10px 0 ${darken(a, 0.3)}, 0 40px 60px -30px ${rgba(darken(a, 0.55), 0.6)}, inset 0 3px 0 rgba(255,255,255,0.5)`,
      }}
      aria-labelledby="continue-title"
    >
      <div className="relative overflow-hidden rounded-[2rem] p-6 sm:p-8" style={{ background: `linear-gradient(135deg, ${world.colors.from}, ${world.colors.to})`, color: world.colors.ink }}>
        <div className="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
          <svg className="absolute inset-x-0 bottom-0 h-1/3 w-full" viewBox="0 0 400 80" preserveAspectRatio="none">
            <path d="M0 40 C60 14 130 18 190 36 C250 54 320 22 400 30 V80 H0Z" fill={rgba('#FFFFFF', 0.35)} />
            <path d="M0 62 C90 46 170 50 240 62 C310 74 360 58 400 60 V80 H0Z" fill={rgba(a, 0.18)} />
          </svg>
          {world.background.slice(0, 6).map((e, i) => (
            <span
              key={i}
              className={`absolute text-4xl opacity-40 ${css.bob}`}
              style={{ left: `${6 + i * 15}%`, top: `${i % 2 ? 64 : 10}%`, '--dur': `${4 + i}s`, '--delay': `${-i}s` } as React.CSSProperties}
            >
              {e}
            </span>
          ))}
        </div>
        <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="inline-flex flex-wrap items-center gap-2 rounded-2xl bg-white/75 px-3 py-1 text-sm font-bold uppercase tracking-wider">
              {world.icon} {tr(world.name, locale)} · {wt('chapter', locale)} {plan.chapter}
              {plan.isDaily ? <span className="rounded-full bg-yellow/40 px-2 py-0.5 normal-case tracking-normal">☀️ {wt('dailyBonus', locale)}</span> : null}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Title3D as="h2" id="continue-title" text={tr(quest.title, locale)} color={a} className="text-3xl sm:text-5xl" />
              <SayButton texts={[tr(quest.title, locale), tr(quest.intro, locale)]} locale={locale} />
            </div>
            <p className="mt-3 max-w-xl text-lg font-semibold opacity-90" dir="auto">
              {tr(quest.intro, locale)}
            </p>
            <p className="mt-3 text-sm font-bold opacity-80">
              {game.emoji} {tr(game.name, locale)} · {wt('difficulty', locale)} {plan.difficulty}/5 · +{plan.reward.xp} XP
            </p>
            <Link
              href={{ pathname: '/monde/jouer', query: { world: plan.worldId, quest: plan.questId } }}
              className="relative mt-6 inline-flex min-h-[64px] items-center gap-3 overflow-hidden rounded-[1.6rem] px-7 text-xl font-extrabold text-white outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-white/70 active:translate-y-[6px]"
              style={{
                background: `linear-gradient(180deg, ${lighten(strong(a), 0.22)}, ${strong(a)} 55%, ${darken(strong(a), 0.08)})`,
                boxShadow: `0 7px 0 ${darken(strong(a), 0.36)}, 0 20px 30px -14px ${rgba(darken(a, 0.5), 0.6)}, inset 0 2px 0 rgba(255,255,255,0.45)`,
                textShadow: `0 2px 0 ${rgba(darken(strong(a), 0.4), 0.45)}`,
              }}
            >
              <span className={css.shine} aria-hidden="true" />
              <span className="relative grid h-10 w-10 place-items-center rounded-full bg-white text-lg" style={{ color: strong(a) }} aria-hidden="true">
                <span className="ms-0.5">▶</span>
              </span>
              <span className="relative">{fresh ? wt('start', locale) : wt('continue', locale)}</span>
            </Link>
          </div>
          <div className="relative mx-auto flex items-end gap-2">
            <ZiggyHost className="h-[220px] w-[170px] sm:h-[260px] sm:w-[200px]" idle="wave" reaction={HELLO} pose="wave" color={a} label={locale === 'fr' ? 'Ziggy t’attend pour l’aventure' : 'Ziggy is waiting for your adventure'} />
            <div className="absolute -bottom-1 -start-6 sm:-start-10">
              <CompanionBuddy profile={companion} mood="HAPPY" locale={locale} size={58} />
            </div>
          </div>
        </div>
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
  { href: '/dodo', emoji: '🌙', key: 'dodo', color: '#7C6CF0' },
  { href: '/monde/parents', emoji: '👨‍👩‍👧', key: 'parents', color: '#4FC9C0' },
] as const;

function QuickLinks({ locale }: { locale: string }) {
  return (
    <nav aria-label={wt('title', locale)} className="mt-10 grid grid-cols-4 gap-3 sm:grid-cols-7">
      {LINKS.map((l, i) => (
        <motion.div key={l.href} initial={{ opacity: 0, y: 20, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.15 + i * 0.05 }}>
          <Link
            href={l.href}
            className="group flex h-full flex-col items-center gap-2 rounded-[1.6rem] border-[3px] bg-bg-card px-1.5 pb-3 pt-3 text-center text-xs font-extrabold text-text-body outline-none transition-transform hover:-translate-y-1 focus-visible:ring-4 active:translate-y-1 sm:text-sm"
            style={{ borderColor: lighten(l.color, 0.6), boxShadow: `0 6px 0 ${lighten(l.color, 0.3)}, 0 18px 26px -18px ${rgba(darken(l.color, 0.5), 0.5)}`, ['--tw-ring-color' as string]: rgba(l.color, 0.5) }}
          >
            <span
              className="grid h-12 w-12 place-items-center rounded-full text-2xl transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110 group-hover:-rotate-6 sm:h-14 sm:w-14 sm:text-3xl"
              style={{
                background: `radial-gradient(circle at 34% 28%, #fff 0%, ${lighten(l.color, 0.6)} 45%, ${l.color} 100%)`,
                boxShadow: `inset 0 -4px 8px ${rgba(darken(l.color, 0.3), 0.3)}, inset 0 2px 0 rgba(255,255,255,0.9), 0 4px 0 ${darken(l.color, 0.15)}`,
              }}
              aria-hidden="true"
            >
              {l.emoji}
            </span>
            {l.key === 'dodo' ? (locale === 'fr' ? 'Mode dodo' : 'Bedtime') : wt(l.key, locale)}
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
      {/* Wide screens: the map as a 3D board — worlds stand on it like toys. */}
      <Board3D>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={path} fill="none" stroke="rgba(120,90,50,0.25)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" transform="translate(0 0.6)" />
          <polyline points={path} fill="none" stroke="#FFF7E6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <polyline points={path} fill="none" stroke="rgba(200,160,100,0.7)" strokeWidth="0.8" strokeDasharray="1.2 1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <ol className="absolute inset-0 [transform-style:preserve-3d]">
          {WORLDS.map((w, i) => (
            <li key={w.id} className="absolute [transform-style:preserve-3d]" style={{ left: `${w.map.x}%`, top: `${w.map.y}%` }}>
              {/* Shadow on the board, then the world standing up. */}
              <span className="absolute left-0 top-0 h-5 w-16 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-black/20 blur-[3px]" aria-hidden="true" />
              <div className="-translate-x-1/2 -translate-y-[85%] [transform-origin:50%_100%] [transform:rotateX(-26deg)_translateZ(2px)]">
                <MapNode world={w} index={i} memory={memory} stars={stars} locale={locale} current={current === w.id} />
              </div>
            </li>
          ))}
        </ol>
      </Board3D>
      {/* Phones: the same journey as a winding path. */}
      <ol className="relative mt-6 grid gap-3 md:hidden">
        {WORLDS.map((w, i) => (
          <li key={w.id} className={i % 2 ? 'ps-10' : 'pe-10'}>
            <MapNode world={w} index={i} memory={memory} stars={stars} locale={locale} current={current === w.id} row />
          </li>
        ))}
      </ol>
    </>
  );
}

/** Painted terrain on the board: meadows, a lake, little forests. */
function Terrain() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 160 120" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient id="zw-lake" cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#BFE8FF" />
          <stop offset="1" stopColor="#7FC8F0" />
        </radialGradient>
      </defs>
      <path d="M0 0 H160 V120 H0Z" fill="#CFEFC0" />
      <path d="M0 70 C30 60 50 80 80 74 C110 68 130 86 160 80 V120 H0Z" fill="#BFE6AE" />
      <path d="M0 0 H160 V26 C130 34 110 18 80 24 C50 30 30 16 0 22Z" fill="#DDF4CF" />
      <ellipse cx="118" cy="52" rx="18" ry="9" fill="url(#zw-lake)" stroke="#E8F7FF" strokeWidth="1.2" />
      <ellipse cx="34" cy="96" rx="14" ry="6" fill="url(#zw-lake)" stroke="#E8F7FF" strokeWidth="1.2" />
      {[
        [20, 44],
        [26, 48],
        [64, 60],
        [70, 57],
        [140, 104],
        [146, 99],
        [96, 100],
        [12, 108],
      ].map(([x, y], k) => (
        <g key={k}>
          {[
            [0, 0, 1.7],
            [2.6, 0.8, 1.3],
            [-2.2, 1, 1.2],
          ].map(([dx, dy, r], j) => (
            <g key={j}>
              <ellipse cx={x + dx} cy={y + dy + r * 0.9} rx={r * 1.1} ry={r * 0.4} fill="rgba(60,90,40,0.2)" />
              <rect x={x + dx - 0.25} y={y + dy} width="0.5" height={r * 0.9} fill="#9A6B44" />
              <circle cx={x + dx} cy={y + dy - r * 0.2} r={r} fill={j === 1 ? '#7CC66B' : '#6DBB5E'} />
              <circle cx={x + dx - r * 0.35} cy={y + dy - r * 0.55} r={r * 0.35} fill="rgba(255,255,255,0.4)" />
            </g>
          ))}
        </g>
      ))}
      {[
        [50, 12],
        [104, 30],
        [150, 64],
        [80, 112],
      ].map(([x, y], k) => (
        <g key={`f${k}`}>
          <circle cx={x} cy={y} r="0.9" fill="#F472B6" />
          <circle cx={x + 2.5} cy={y + 1} r="0.9" fill="#FBBF24" />
          <circle cx={x + 1} cy={y + 2.6} r="0.9" fill="#FFFFFF" />
        </g>
      ))}
    </svg>
  );
}

/** A tilted game board with thickness; leans a little towards the pointer. */
function Board3D({ children }: { children: React.ReactNode }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  return (
    <div
      className="relative mt-6 hidden md:block"
      style={{ perspective: 1600 }}
      onPointerMove={(e) => {
        if (e.pointerType === 'touch') return;
        const r = e.currentTarget.getBoundingClientRect();
        setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 6, y: ((e.clientY - r.top) / r.height - 0.5) * 4 });
      }}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <motion.div
        className="relative mx-auto aspect-[16/12] w-[94%] rounded-[2rem] [transform-style:preserve-3d]"
        initial={{ rotateX: 0, y: 40, opacity: 0 }}
        animate={{ rotateX: 26 + tilt.y, rotateZ: tilt.x * 0.3, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 60, damping: 16 }}
        style={{ transformOrigin: '50% 60%' }}
      >
        {/* Board thickness and drop shadow */}
        <div className="absolute inset-0 translate-y-4 rounded-[2rem] bg-[#8a6440] [transform:translateZ(-22px)]" aria-hidden="true" />
        <div className="absolute inset-0 translate-y-2 rounded-[2rem] bg-[#b48655] [transform:translateZ(-10px)]" aria-hidden="true" />
        <div className="absolute inset-0 overflow-hidden rounded-[2rem] border-[6px] border-[#F3D9A4] shadow-[0_50px_90px_-30px_rgba(40,30,80,0.55)] [transform-style:preserve-3d] dark:brightness-75">
          <Terrain />
        </div>
        <div className="absolute inset-0 [transform-style:preserve-3d]">{children}</div>
      </motion.div>
    </div>
  );
}

function MapNode({ world, index, memory, stars, locale, current, row }: { world: WorldDefinition; index: number; memory: WorldMemory; stars: number; locale: string; current: boolean; row?: boolean }) {
  const unlocked = isWorldUnlocked(world, memory);
  const p = worldProgress(world, memory);
  const done = p.done === p.total;
  const a = world.colors.accent;
  const label = `${tr(world.name, locale)} — ${unlocked ? `${p.done}/${p.total} · ⭐ ${p.stars}` : wt('locked', locale, { n: world.unlockStars - stars })}`;
  const bubble = (
    <motion.span
      initial={{ scale: 0, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * index, type: 'spring', stiffness: 220, damping: 14 }}
      className={`relative grid shrink-0 place-items-center rounded-full transition-transform duration-300 ${row ? 'h-14 w-14 text-3xl' : 'h-16 w-16 text-3xl lg:h-20 lg:w-20 lg:text-4xl'} ${unlocked ? 'group-hover:-translate-y-1.5 group-hover:scale-110' : ''}`}
      style={
        unlocked
          ? {
              background: `radial-gradient(circle at 34% 26%, #fff 0%, ${world.colors.from} 30%, ${world.colors.to} 62%, ${a} 100%)`,
              boxShadow: `inset 0 -5px 10px ${rgba(darken(a, 0.3), 0.35)}, inset 0 3px 0 rgba(255,255,255,0.9), 0 0 0 3px #fff, 0 6px 0 3px ${darken(a, 0.15)}, 0 16px 20px -6px ${rgba(darken(a, 0.5), 0.5)}`,
            }
          : {
              background: 'radial-gradient(circle at 34% 26%, #fff 0%, #E5E7EB 50%, #CBD5E1 100%)',
              boxShadow: 'inset 0 -5px 10px rgba(100,116,139,0.3), inset 0 3px 0 rgba(255,255,255,0.9), 0 0 0 3px #fff, 0 6px 0 3px #94A3B8',
            }
      }
    >
      <span aria-hidden="true" className={unlocked ? 'drop-shadow-[0_3px_2px_rgba(0,0,0,0.2)]' : 'opacity-70 grayscale'}>
        {unlocked ? world.icon : '🔒'}
      </span>
      {current ? (
        <motion.span className="absolute -inset-3 rounded-full border-4" style={{ borderColor: a }} animate={{ scale: [1, 1.18, 1], opacity: [0.9, 0.2, 0.9] }} transition={{ duration: 1.8, repeat: Infinity }} aria-hidden="true" />
      ) : null}
      {done ? (
        <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full text-xs font-black text-white shadow-[0_2px_0_#15803D]" style={{ background: 'linear-gradient(160deg,#4ADE80,#16A34A)' }} aria-hidden="true">
          ✓
        </span>
      ) : null}
    </motion.span>
  );
  const text = (
    <span className={row ? 'min-w-0 text-start' : 'mt-2 block max-w-[7.5rem] rounded-xl bg-white/90 px-2 py-1 text-center shadow-[0_2px_0_rgba(40,30,80,0.08)] dark:bg-bg-card/90'}>
      <span className={`block font-display font-bold leading-tight text-text-body ${row ? 'text-base' : 'text-xs lg:text-sm'}`}>{tr(world.name, locale)}</span>
      <span className="block text-xs font-semibold text-text-muted">{unlocked ? `${p.done}/${p.total} · ⭐ ${p.stars}` : `🔒 ${world.unlockStars} ⭐`}</span>
    </span>
  );
  const cls = `group flex items-center rounded-3xl outline-none focus-visible:ring-4 focus-visible:ring-sky/50 ${row ? 'gap-3 border-[3px] bg-bg-card p-2 pe-4 shadow-[0_5px_0_rgba(40,30,80,0.08)]' : 'flex-col'}`;
  const rowStyle = row ? { borderColor: unlocked ? lighten(a, 0.6) : '#E5E7EB' } : undefined;
  return unlocked ? (
    <Link href={`/monde/${world.id}`} className={cls} style={rowStyle} aria-label={label}>
      {bubble}
      {text}
    </Link>
  ) : (
    <div className={`${cls} cursor-not-allowed opacity-75`} style={rowStyle} aria-label={label} role="img">
      {bubble}
      {text}
    </div>
  );
}

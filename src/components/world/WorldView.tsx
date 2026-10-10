'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { WORLDS } from '@/data/worlds';
import { COMPANIONS } from '@/data/companions';
import { buildStory } from '@/lib/story/engine';
import { nextAdventure } from '@/lib/world/engine';
import { dayKey, isWorldUnlocked, worldProgress } from '@/lib/world/gamification';
import { totalStars } from '@/lib/world/memory';
import { useHydrated, useWorldMemory } from '@/lib/world/store';
import { getGame } from '@/lib/arcade/registry';
import { SKILL_NAMES } from '@/lib/learning/skills';
import { tr } from '@/lib/i18n-text';
import { EASE_OUT } from '@/lib/motion';
import { StatusBar } from './StatusBar';
import { wt } from './text';
import { SayButton } from '@/components/arcade/read-aloud';

/** One world: its story in 3 chapters, quests as scenes, inhabitants, treasures found. */
export function WorldView({ worldId }: { worldId: string }) {
  const locale = useLocale();
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const world = WORLDS.find((w) => w.id === worldId)!;
  const story = useMemo(() => buildStory(world, memory, locale), [world, memory, locale]);
  const plan = useMemo(() => (hydrated ? nextAdventure(memory, WORLDS, dayKey(), world.id) : null), [hydrated, memory, world.id]);
  const unlocked = isWorldUnlocked(world, memory);
  const p = worldProgress(world, memory);
  const c = world.colors;

  return (
    <div className="relative min-h-screen overflow-clip pb-24" style={{ background: `linear-gradient(180deg, ${c.from} 0%, ${c.to} 45%, transparent 100%)` }}>
      <div className="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
        {world.background.map((e, i) => (
          <motion.span
            key={i}
            className="absolute text-5xl opacity-25"
            style={{ left: `${(i * 37) % 92}%`, top: `${8 + ((i * 23) % 40)}%` }}
            animate={{ y: [0, -14, 0], rotate: [0, i % 2 ? 6 : -6, 0] }}
            transition={{ duration: 5 + (i % 4), repeat: Infinity, ease: 'easeInOut' }}
          >
            {e}
          </motion.span>
        ))}
      </div>
      <div className="relative mx-auto max-w-5xl px-4 pt-28 sm:px-6">
        <Link href="/monde" className="inline-flex items-center gap-1 rounded-full bg-white/70 px-4 py-2 text-sm font-bold shadow-sm hover:bg-white" style={{ color: c.ink }}>
          ← {wt('backMap', locale)}
        </Link>
        <header className="mt-6 text-center" style={{ color: c.ink }}>
          <motion.div className="text-8xl" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 14 }} aria-hidden="true">
            {world.icon}
          </motion.div>
          <div className="mt-2 flex items-center justify-center gap-3">
            <h1 className="font-display text-4xl font-bold sm:text-6xl">{tr(world.name, locale)}</h1>
            <SayButton texts={[tr(world.name, locale), tr(world.description, locale)]} locale={locale} />
          </div>
          <p className="mx-auto mt-3 max-w-2xl text-lg font-medium opacity-90">{tr(world.description, locale)}</p>
          {hydrated ? (
            <p className="mt-3 text-sm font-bold opacity-80">
              {p.done}/{p.total} · ⭐ {p.stars}/{p.maxStars}
              {story.world.complete ? ` · 🏆 ${wt('complete', locale)}` : ''}
            </p>
          ) : null}
        </header>

        {hydrated ? (
          <>
            <div className="mt-8">
              <StatusBar memory={memory} locale={locale} />
            </div>

            {!unlocked ? (
              <p className="mt-8 rounded-3xl bg-bg-card p-6 text-center text-lg font-bold text-text-body shadow">
                🔒 {wt('locked', locale, { n: world.unlockStars - totalStars(memory) })}
              </p>
            ) : (
              <div className="mt-10 grid gap-8">
                {story.chapters.map((ch, ci) => (
                  <motion.section
                    key={ch.number}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * ci, ease: EASE_OUT }}
                    className={`rounded-[2rem] border bg-bg-card/90 p-5 shadow-sm backdrop-blur sm:p-7 ${ch.status === 'locked' ? 'opacity-60' : ''}`}
                    style={{ borderColor: `${c.accent}44` }}
                    aria-labelledby={`ch-${ch.number}`}
                  >
                    <h2 id={`ch-${ch.number}`} className="font-display text-2xl font-bold text-text-body">
                      {ch.status === 'done' ? '✅ ' : ch.status === 'locked' ? '🔒 ' : '📖 '}
                      {ch.title}
                    </h2>
                    <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                      {ch.scenes.map((s) => {
                        const q = world.quests.find((x) => x.id === s.questId)!;
                        const game = getGame(q.gameId);
                        const isNext = plan?.questId === s.questId;
                        return (
                          <li key={s.questId} className={`relative flex flex-col rounded-3xl border p-4 ${isNext ? 'ring-4' : ''}`} style={{ borderColor: `${c.accent}33`, ['--tw-ring-color' as string]: `${c.accent}66` }}>
                            <div className="flex items-start gap-3">
                              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ backgroundColor: `${c.accent}1f` }} aria-hidden="true">
                                {s.status === 'done' ? s.emoji : game.emoji}
                              </span>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-display text-lg font-bold leading-tight text-text-body">{s.title}</h3>
                                <p className="mt-1 text-sm text-text-muted">{s.text}</p>
                              </div>
                              <SayButton texts={[s.title, s.text]} locale={locale} size="sm" />
                            </div>
                            <p className="mt-3 text-xs font-semibold text-text-muted">
                              {game.emoji} {tr(game.name, locale)} · {tr(SKILL_NAMES[q.skill], locale)} · +{q.reward.xp} XP
                            </p>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <span className="text-lg" aria-label={`${s.stars} ${wt('stars', locale)}`}>
                                {[1, 2, 3].map((n) => (
                                  <span key={n} className={n <= s.stars ? '' : 'opacity-25 grayscale'} aria-hidden="true">
                                    ⭐
                                  </span>
                                ))}
                              </span>
                              {s.status === 'locked' ? (
                                <span className="text-xs font-bold text-text-muted">{wt('lockedQuest', locale)}</span>
                              ) : (
                                <Link
                                  href={{ pathname: '/monde/jouer', query: { world: world.id, quest: s.questId } }}
                                  className="rounded-full px-5 py-2 text-sm font-bold text-white shadow transition hover:scale-105 focus-visible:outline focus-visible:outline-4"
                                  style={{ backgroundColor: c.accent, outlineColor: `${c.accent}66` }}
                                >
                                  {s.status === 'done' ? `↻ ${wt('replay', locale)}` : `▶ ${wt('play', locale)}`}
                                </Link>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </motion.section>
                ))}

                <section className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-[2rem] bg-bg-card/90 p-6 shadow-sm">
                    <h2 className="font-display text-xl font-bold text-text-body">{wt('characters', locale)}</h2>
                    <ul className="mt-4 grid gap-3">
                      {story.characters.map((ch) => (
                        <li key={ch.id} className={`flex items-center gap-3 ${ch.met ? '' : 'opacity-50'}`}>
                          <span className="text-3xl" aria-hidden="true">
                            {ch.met ? ch.emoji : '❔'}
                          </span>
                          <span>
                            <span className="block font-bold text-text-body">{ch.met ? ch.name : '???'}</span>
                            <span className="block text-sm text-text-muted">{ch.role}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-sm text-text-muted">
                      {wt('companions', locale)} :{' '}
                      {world.companions.map((id) => {
                        const cp = COMPANIONS.find((x) => x.id === id);
                        return cp ? <span key={id} className="me-2">{cp.emoji} {tr(cp.name, locale)}</span> : null;
                      })}
                    </p>
                  </div>
                  <div className="rounded-[2rem] bg-bg-card/90 p-6 shadow-sm">
                    <h2 className="font-display text-xl font-bold text-text-body">{wt('found', locale)}</h2>
                    {story.world.found.length ? (
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {story.world.found.map((f) => (
                          <li key={f.id} className="flex items-center gap-2 rounded-full border border-border/70 px-3 py-1.5 text-sm font-semibold text-text-body">
                            <span aria-hidden="true">{f.emoji}</span>
                            {f.label}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 text-sm text-text-muted">{wt('empty', locale)}</p>
                    )}
                  </div>
                </section>
              </div>
            )}
          </>
        ) : (
          <div className="mt-10 h-96 animate-pulse rounded-[2rem] bg-bg-card/60" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

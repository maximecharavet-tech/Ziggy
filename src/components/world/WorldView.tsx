'use client';

import { useMemo, type CSSProperties, type ReactNode } from 'react';
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
import { StatusBar } from './StatusBar';
import { wt } from './text';
import { SayButton } from '@/components/arcade/read-aloud';
import { ZiggyAvatar } from '@/components/ziggy/Mascot';
import { GameScene } from '@/components/arcade/stage/GameScene';
import { scenePalette } from '@/components/arcade/stage/themes';
import { GameToken, SpeechBubble, Title3D } from '@/components/arcade/stage/Showpieces';
import { ZiggyHost } from '@/components/arcade/stage/ZiggyHost';
import { darken, lighten, rgba, strong } from '@/components/arcade/stage/color';
import css from '@/components/arcade/stage/stage.module.css';

const NIGHT_WORLDS = new Set(['space', 'stars']);
const HELLO = { kind: 'wave' as const, id: 0 };
const STAR = 'M12 1.8l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17l-6.1 3.4 1.4-6.8L2.2 8.9l6.9-.8z';

function MiniStar({ on, size = 22 }: { on: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={STAR} transform="translate(0 1)" fill={on ? '#C2410C' : 'transparent'} opacity="0.45" />
      <path d={STAR} fill={on ? '#FCD34D' : 'rgba(255,255,255,0.5)'} stroke={on ? '#D97706' : 'rgba(120,110,150,0.4)'} strokeWidth="1.3" strokeDasharray={on ? undefined : '2 1.8'} strokeLinejoin="round" />
    </svg>
  );
}

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
  const palette = useMemo(() => scenePalette(c.accent, { from: c.from, to: c.to, night: NIGHT_WORLDS.has(world.id) }), [c, world.id]);

  return (
    <div className="relative min-h-screen overflow-clip pb-24" style={{ backgroundColor: palette.groundDeep }}>
      <GameScene palette={palette} motifs={world.background} horizon="50vh" />
      <div className="relative mx-auto max-w-5xl px-4 pt-24 sm:px-6">
        <Link
          href="/monde"
          className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-white/90 px-4 py-2 text-sm font-bold shadow-[0_4px_0_rgba(40,30,80,0.12)] transition-transform active:translate-y-[3px] dark:bg-bg-card/90"
          style={{ color: c.ink }}
        >
          <span aria-hidden="true" className="rtl:rotate-180">
            ←
          </span>{' '}
          {wt('backMap', locale)}
        </Link>

        {/* Hero: the world as a floating toy island, Ziggy presenting it */}
        <header className="relative mt-4 grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-start">
            <motion.div initial={{ scale: 0.4, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 13 }}>
              <GameToken emoji={world.icon} color={c.accent} size={118} />
            </motion.div>
            <div className="mt-2 flex items-center justify-center gap-3 lg:justify-start">
              <Title3D text={tr(world.name, locale)} color={c.accent} className="text-4xl sm:text-6xl" delay={0.1} />
              <SayButton texts={[tr(world.name, locale), tr(world.description, locale)]} locale={locale} />
            </div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-4 w-full max-w-2xl">
              <SpeechBubble color={c.accent} tail="none">
                <p className="text-lg font-semibold text-text-body" dir="auto">
                  {tr(world.description, locale)}
                </p>
                {hydrated ? (
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-text-muted">
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5" style={{ background: rgba(c.accent, 0.12), color: darken(strong(c.accent), 0.15) }}>
                      🗺️ {p.done}/{p.total}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow/20 px-2.5 py-0.5 text-[#92400E]">
                      ⭐ {p.stars}/{p.maxStars}
                    </span>
                    {story.world.complete ? <span className="rounded-full bg-green/15 px-2.5 py-0.5 text-green-dark">🏆 {wt('complete', locale)}</span> : null}
                  </p>
                ) : null}
              </SpeechBubble>
            </motion.div>
          </div>
          {/* Phones: Ziggy stands beside the world's token; wide screens: beside the whole header. */}
          <div className="absolute -top-3 end-0 h-[150px] w-[112px] sm:end-6 lg:relative lg:top-auto lg:end-auto lg:mx-auto lg:h-[300px] lg:w-[230px]">
            <ZiggyHost className="h-full w-full" idle="wave" reaction={HELLO} pose="wave" color={c.accent} label={locale === 'fr' ? 'Ziggy te présente ce monde' : 'Ziggy shows you this world'} />
          </div>
        </header>

        {hydrated ? (
          <>
            <div className="mt-8">
              <StatusBar memory={memory} locale={locale} />
            </div>

            {!unlocked ? (
              <p className="mt-8 rounded-[1.8rem] border-[3px] bg-bg-card p-6 text-center text-lg font-bold text-text-body shadow-[0_6px_0_rgba(40,30,80,0.08)]" style={{ borderColor: lighten(c.accent, 0.55) }}>
                🔒 {wt('locked', locale, { n: world.unlockStars - totalStars(memory) })}
              </p>
            ) : (
              <div className="mt-10 grid gap-10">
                {story.chapters.map((ch, ci) => (
                  <motion.section
                    key={ch.number}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 160, damping: 20, delay: 0.15 + 0.1 * ci }}
                    className={`relative rounded-[2.2rem] p-2 ${ch.status === 'locked' ? 'opacity-70 saturate-[0.6]' : ''}`}
                    style={{
                      background: `linear-gradient(170deg, ${lighten(c.accent, 0.55)}, ${lighten(c.accent, 0.2)})`,
                      boxShadow: `0 8px 0 ${darken(c.accent, 0.2)}, 0 30px 50px -26px ${rgba(darken(c.accent, 0.5), 0.55)}`,
                    }}
                    aria-labelledby={`ch-${ch.number}`}
                  >
                    {/* Chapter ribbon */}
                    <div className="absolute -top-5 left-1/2 z-10 -translate-x-1/2">
                      <h2
                        id={`ch-${ch.number}`}
                        className="whitespace-nowrap rounded-full px-5 py-2 font-display text-lg font-bold text-white sm:text-xl"
                        style={{ background: `linear-gradient(180deg, ${lighten(strong(c.accent), 0.15)}, ${strong(c.accent)})`, boxShadow: `0 4px 0 ${darken(strong(c.accent), 0.35)}`, textShadow: `0 2px 0 ${rgba(darken(strong(c.accent), 0.4), 0.5)}` }}
                        dir="auto"
                      >
                        {ch.status === 'done' ? '✅ ' : ch.status === 'locked' ? '🔒 ' : '📖 '}
                        {ch.title}
                      </h2>
                    </div>
                    <ul className="grid gap-4 rounded-[1.8rem] bg-bg-card p-4 pt-9 sm:grid-cols-2 sm:p-6 sm:pt-10" style={{ boxShadow: `inset 0 6px 14px ${rgba(darken(c.accent, 0.4), 0.14)}` }}>
                      {ch.scenes.map((s, si) => {
                        const q = world.quests.find((x) => x.id === s.questId)!;
                        const game = getGame(q.gameId);
                        const isNext = plan?.questId === s.questId;
                        return (
                          <QuestCard key={s.questId} accent={c.accent} next={isNext} index={si}>
                            <div className="flex items-start gap-3">
                              <span
                                className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-2xl"
                                style={{
                                  background: `radial-gradient(circle at 34% 28%, ${lighten(c.accent, 0.75)}, ${lighten(c.accent, 0.35)} 70%, ${c.accent})`,
                                  boxShadow: `inset 0 -4px 8px ${rgba(darken(c.accent, 0.3), 0.3)}, inset 0 2px 0 rgba(255,255,255,0.8), 0 4px 0 ${lighten(c.accent, 0.1)}`,
                                }}
                                aria-hidden="true"
                              >
                                {s.status === 'done' ? s.emoji : game.emoji}
                              </span>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-display text-lg font-bold leading-tight text-text-body" dir="auto">
                                  {s.title}
                                </h3>
                                <p className="mt-1 text-sm text-text-muted" dir="auto">
                                  {s.text}
                                </p>
                              </div>
                              <SayButton texts={[s.title, s.text]} locale={locale} size="sm" />
                            </div>
                            <p className="mt-3 text-xs font-semibold text-text-muted">
                              {game.emoji} {tr(game.name, locale)} · {tr(SKILL_NAMES[q.skill], locale)} · +{q.reward.xp} XP
                            </p>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <span className="flex items-center gap-0.5" role="img" aria-label={`${s.stars} ${wt('stars', locale)}`}>
                                {[1, 2, 3].map((n) => (
                                  <MiniStar key={n} on={n <= s.stars} />
                                ))}
                              </span>
                              {s.status === 'locked' ? (
                                <span className="rounded-full bg-text-body/5 px-3 py-1 text-xs font-bold text-text-muted">🔒 {wt('lockedQuest', locale)}</span>
                              ) : (
                                <Link
                                  href={{ pathname: '/monde/jouer', query: { world: world.id, quest: s.questId } }}
                                  className="relative inline-flex min-h-[48px] items-center gap-1.5 overflow-hidden rounded-[1.1rem] px-5 text-sm font-extrabold text-white outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-4 active:translate-y-[4px] sm:text-base"
                                  style={{
                                    background: `linear-gradient(180deg, ${lighten(strong(c.accent), 0.22)}, ${strong(c.accent)} 55%, ${darken(strong(c.accent), 0.08)})`,
                                    boxShadow: `0 5px 0 ${darken(strong(c.accent), 0.34)}, inset 0 2px 0 rgba(255,255,255,0.45)`,
                                    textShadow: `0 2px 0 ${rgba(darken(strong(c.accent), 0.4), 0.45)}`,
                                    ['--tw-ring-color' as string]: rgba(c.accent, 0.5),
                                  }}
                                >
                                  {isNext ? <span className={css.shine} aria-hidden="true" /> : null}
                                  <span className="relative">{s.status === 'done' ? `↻ ${wt('replay', locale)}` : `▶ ${wt('play', locale)}`}</span>
                                </Link>
                              )}
                            </div>
                          </QuestCard>
                        );
                      })}
                    </ul>
                  </motion.section>
                ))}

                <section className="grid gap-6 md:grid-cols-2">
                  <Panel accent={c.accent} title={wt('characters', locale)}>
                    <ul className="mt-4 grid gap-3">
                      {story.characters.map((ch) => (
                        <li key={ch.id} className="flex items-center gap-3">
                          <span
                            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-2xl"
                            style={
                              ch.met
                                ? { background: `radial-gradient(circle at 34% 28%, #fff, ${lighten(c.accent, 0.6)})`, boxShadow: `0 3px 0 ${lighten(c.accent, 0.3)}` }
                                : { background: 'rgba(120,110,150,0.12)', boxShadow: 'inset 0 3px 6px rgba(40,30,80,0.12)' }
                            }
                            aria-hidden="true"
                          >
                            {ch.met ? ch.emoji : <span className="font-display text-xl font-bold text-text-muted">?</span>}
                          </span>
                          <span className={ch.met ? '' : 'opacity-60'}>
                            <span className="block font-bold text-text-body">{ch.met ? ch.name : '???'}</span>
                            <span className="block text-sm text-text-muted">{ch.role}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-text-muted">
                      {wt('companions', locale)} :
                      {world.companions.map((id) => {
                        const cp = COMPANIONS.find((x) => x.id === id);
                        return cp ? (
                          <span key={id} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold text-text-body" style={{ background: rgba(cp.color, 0.16) }}>
                            {cp.emoji} {tr(cp.name, locale)}
                          </span>
                        ) : null;
                      })}
                    </p>
                  </Panel>
                  <Panel accent={c.accent} title={wt('found', locale)}>
                    {story.world.found.length ? (
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {story.world.found.map((f, i) => (
                          <motion.li
                            key={f.id}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 15, delay: i * 0.05 }}
                            className="flex items-center gap-2 rounded-2xl border-2 bg-bg-card px-3 py-1.5 text-sm font-semibold text-text-body shadow-[0_3px_0_rgba(40,30,80,0.07)]"
                            style={{ borderColor: lighten(c.accent, 0.6) }}
                          >
                            <span className="text-lg" aria-hidden="true">
                              {f.emoji}
                            </span>
                            {f.label}
                          </motion.li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 flex items-center gap-3 text-sm text-text-muted">
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border-2 border-dashed text-xl" style={{ borderColor: lighten(c.accent, 0.5) }} aria-hidden="true">
                          🎁
                        </span>
                        {wt('empty', locale)}
                      </p>
                    )}
                  </Panel>
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

/** A quest as a toy card; the next one to play glows and carries Ziggy's little face. */
function QuestCard({ accent, next, index, children }: { accent: string; next: boolean; index: number; children: ReactNode }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 16, rotate: index % 2 ? 1.5 : -1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.3 + 0.08 * index }}
      className="relative flex flex-col rounded-[1.5rem] border-[3px] bg-bg-card p-4"
      style={
        {
          borderColor: next ? accent : lighten(accent, 0.7),
          boxShadow: next ? `0 6px 0 ${lighten(accent, 0.2)}, 0 0 0 6px ${rgba(accent, 0.18)}` : `0 5px 0 ${lighten(accent, 0.6)}`,
        } as CSSProperties
      }
    >
      {next ? (
        <span className={`absolute -top-5 end-4 ${css.bob}`} style={{ '--lift': '-5px', '--dur': '2.4s' } as CSSProperties} aria-hidden="true">
          <ZiggyAvatar size={44} />
        </span>
      ) : null}
      {children}
    </motion.li>
  );
}

function Panel({ accent, title, children }: { accent: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-[1.8rem] border-[3px] bg-bg-card p-6" style={{ borderColor: lighten(accent, 0.65), boxShadow: `0 6px 0 ${lighten(accent, 0.5)}, 0 24px 36px -24px ${rgba(darken(accent, 0.5), 0.45)}` }}>
      <h2 className="font-display text-xl font-bold text-text-body">{title}</h2>
      {children}
    </div>
  );
}

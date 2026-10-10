'use client';

import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { WORLDS } from '@/data/worlds';
import { WORLD_BADGES, levelFor } from '@/lib/world/gamification';
import { masteryBand } from '@/lib/learning/adaptive';
import { LEARNING_SKILLS, SKILL_NAMES } from '@/lib/learning/skills';
import { useHydrated, useWorldMemory } from '@/lib/world/store';
import { totalStars } from '@/lib/world/memory';
import { tr } from '@/lib/i18n-text';
import { AppPage } from '@/components/learn/AppPage';
import { MASTERY_TEXT, wt } from './text';

const BAND_COLOR = { discovering: '#5FB6EA', practising: '#A78BFA', confident: '#22C55E', expert: '#FBBF24' } as const;

/** Treasures, places and friends found; badges; skills as friendly bands — never grades. */
export function CollectionPage() {
  const locale = useLocale();
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const found = new Set(memory.collection);
  const byWorld = WORLDS.map((w) => ({ world: w, items: w.quests.filter((q) => found.has(q.outcome.id)).map((q) => q.outcome) })).filter((x) => x.items.length);
  const practised = LEARNING_SKILLS.filter((s) => memory.skills[s]);

  return (
    <AppPage
      eyebrow={<>💎 {wt('collection', locale)}</>}
      title={locale === 'fr' ? 'Mon trésor d’aventurier' : 'My explorer’s treasure'}
      subtitle={locale === 'fr' ? 'Tout ce que tu as trouvé dans les mondes, tes badges et ce que tu apprends.' : 'Everything you found in the worlds, your badges and what you are learning.'}
      color="#FBBF24"
    >
      {!hydrated ? (
        <div className="h-96 animate-pulse rounded-[2rem] bg-bg-card/60" aria-hidden="true" />
      ) : (
        <div className="grid gap-8">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { v: levelFor(memory.xp).level, l: wt('level', locale), e: '🚀' },
              { v: totalStars(memory), l: wt('stars', locale), e: '⭐' },
              { v: memory.collection.length, l: wt('collection', locale), e: '💎' },
            ].map((s) => (
              <div key={s.l} className="rounded-3xl bg-bg-card p-4 shadow-sm">
                <div className="text-3xl" aria-hidden="true">
                  {s.e}
                </div>
                <div className="font-display text-3xl font-bold text-text-body">{s.v}</div>
                <div className="text-sm font-semibold text-text-muted">{s.l}</div>
              </div>
            ))}
          </div>

          <section aria-labelledby="treasures" className="rounded-[2rem] bg-bg-card p-6 shadow-sm">
            <h2 id="treasures" className="font-display text-2xl font-bold text-text-body">
              🧭 {wt('found', locale)}
            </h2>
            {byWorld.length ? (
              <div className="mt-4 grid gap-5">
                {byWorld.map(({ world, items }) => (
                  <div key={world.id}>
                    <Link href={`/monde/${world.id}`} className="text-sm font-bold hover:underline" style={{ color: world.colors.accent }}>
                      {world.icon} {tr(world.name, locale)}
                    </Link>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {items.map((o, i) => (
                        <motion.li key={o.id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.04 }} className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-text-body" style={{ backgroundColor: `${world.colors.accent}14` }}>
                          <span className="text-xl" aria-hidden="true">
                            {o.emoji}
                          </span>
                          {tr(o.label, locale)}
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-text-muted">{wt('empty', locale)}</p>
            )}
          </section>

          <section aria-labelledby="badges" className="rounded-[2rem] bg-bg-card p-6 shadow-sm">
            <h2 id="badges" className="font-display text-2xl font-bold text-text-body">
              🏅 {wt('badges', locale)}
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {WORLD_BADGES.map((b) => {
                const has = memory.badges.includes(b.id);
                return (
                  <li key={b.id} className={`flex flex-col items-center rounded-2xl border border-border/60 p-3 text-center ${has ? '' : 'opacity-40 grayscale'}`}>
                    <span className="text-3xl" aria-hidden="true">
                      {b.emoji}
                    </span>
                    <span className="mt-1 text-xs font-bold text-text-body">{tr(b.name, locale)}</span>
                    <span className="sr-only">{has ? '✓' : '—'}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="skills" className="rounded-[2rem] bg-bg-card p-6 shadow-sm">
            <h2 id="skills" className="font-display text-2xl font-bold text-text-body">
              🌱 {locale === 'fr' ? 'Ce que j’apprends' : 'What I’m learning'}
            </h2>
            {practised.length ? (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {practised.map((s) => {
                  const band = masteryBand(memory.skills[s]!.masteryEstimate);
                  return (
                    <li key={s} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 px-4 py-3">
                      <span className="font-semibold text-text-body">{tr(SKILL_NAMES[s], locale)}</span>
                      <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: BAND_COLOR[band] }}>
                        {tr(MASTERY_TEXT[band], locale)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-text-muted">{wt('empty', locale)}</p>
            )}
          </section>
        </div>
      )}
    </AppPage>
  );
}

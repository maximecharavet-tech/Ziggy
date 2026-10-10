'use client';

import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { ARCADE_GAMES } from '@/lib/arcade/registry';
import { SKILL_FAMILY, SKILL_NAMES } from '@/lib/learning/skills';
import { useHydrated, useWorldMemory } from '@/lib/world/store';
import { tr } from '@/lib/i18n-text';
import { AppPage } from '@/components/learn/AppPage';
import { wt } from './text';

const FAMILIES = ['all', 'math', 'language', 'logic', 'discovery', 'creativity'] as const;
const FAMILY_TEXT: Record<(typeof FAMILIES)[number], { fr: string; en: string }> = {
  all: { fr: 'Tous', en: 'All' },
  math: { fr: 'Nombres', en: 'Numbers' },
  language: { fr: 'Lettres & mots', en: 'Letters & words' },
  logic: { fr: 'Logique & mémoire', en: 'Logic & memory' },
  discovery: { fr: 'Découverte', en: 'Discovery' },
  creativity: { fr: 'Créativité', en: 'Creativity' },
};

/** The 20 arcade games, free play. Each one adapts its level to the child's skill. */
export function ArcadeHome() {
  const locale = useLocale();
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const [family, setFamily] = useState<(typeof FAMILIES)[number]>('all');
  const games = useMemo(() => Object.values(ARCADE_GAMES).filter((g) => family === 'all' || g.skills.some((s) => SKILL_FAMILY[s] === family)), [family]);

  return (
    <AppPage
      eyebrow={<>🕹️ Ziggy Arcade</>}
      title={locale === 'fr' ? '20 jeux qui grandissent avec toi' : '20 games that grow with you'}
      subtitle={locale === 'fr' ? 'Chaque jeu s’adapte à ton niveau : jamais trop facile, jamais trop dur. Et aucune partie n’est perdue !' : 'Every game adapts to your level: never too easy, never too hard. And no game is ever lost!'}
      color="#FF8A65"
    >
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label={wt('skill', locale)}>
        {FAMILIES.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={family === f}
            onClick={() => setFamily(f)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${family === f ? 'bg-text-body text-bg' : 'border border-border bg-bg-card text-text-body hover:border-text-muted'}`}
          >
            {tr(FAMILY_TEXT[f], locale)}
          </button>
        ))}
      </div>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {games.map((g, i) => {
          const level = hydrated ? (memory.skills[g.skills[0]]?.difficulty ?? 1) : 1;
          const plays = hydrated ? (memory.gamesPlayed[g.id] ?? 0) : 0;
          return (
            <motion.li key={g.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}>
              <Link
                href={`/monde/arcade/${g.id}`}
                className="group flex h-full flex-col rounded-3xl border border-border/70 bg-bg-card p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline focus-visible:outline-4"
                style={{ outlineColor: `${g.color}66` }}
              >
                <span className="grid h-14 w-14 place-items-center rounded-2xl text-3xl transition group-hover:scale-110 group-hover:-rotate-6" style={{ backgroundColor: `${g.color}22` }} aria-hidden="true">
                  {g.emoji}
                </span>
                <span className="mt-3 font-display text-lg font-bold text-text-body">{tr(g.name, locale)}</span>
                <span className="mt-1 flex-1 text-sm text-text-muted">{tr(g.description, locale)}</span>
                <span className="mt-3 flex flex-wrap gap-1">
                  {g.skills.slice(0, 3).map((s) => (
                    <span key={s} className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: `${g.color}18`, color: g.color }}>
                      {tr(SKILL_NAMES[s], locale)}
                    </span>
                  ))}
                </span>
                <span className="mt-3 text-xs font-semibold text-text-muted">
                  {wt('difficulty', locale)} {level}/5{plays ? ` · ${plays}×` : ''}
                  {g.aiContent ? ' · ✨ Hyper Engine' : ''}
                </span>
              </Link>
            </motion.li>
          );
        })}
      </ul>
    </AppPage>
  );
}

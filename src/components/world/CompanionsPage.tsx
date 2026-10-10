'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { COMPANIONS } from '@/data/companions';
import type { CompanionId, CompanionMood } from '@/data/types';
import { unlockedCompanions } from '@/lib/world/engine';
import { totalStars } from '@/lib/world/memory';
import { setMemory, syncWorld, useHydrated, useWorldMemory, getMemory } from '@/lib/world/store';
import { companionLine } from '@/lib/world/companion';
import { tr } from '@/lib/i18n-text';
import { playSound } from '@/lib/sound';
import { readAloudOn } from '@/lib/world/memory';
import { speakSequence } from '@/lib/voice';
import { AppPage } from '@/components/learn/AppPage';
import { CompanionBuddy } from './CompanionBuddy';
import { wt } from './text';

const MOODS: { mood: CompanionMood; reaction: 'success' | 'hint' | 'failure' | 'levelUp' | 'questComplete' }[] = [
  { mood: 'HAPPY', reaction: 'success' },
  { mood: 'THINKING', reaction: 'hint' },
  { mood: 'EXCITED', reaction: 'levelUp' },
  { mood: 'SAD', reaction: 'failure' },
  { mood: 'CELEBRATE', reaction: 'questComplete' },
];

/** Choose the companion who plays alongside you. New friends join as you earn stars. */
export function CompanionsPage() {
  const locale = useLocale();
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const unlocked = hydrated ? unlockedCompanions(memory, COMPANIONS) : [];
  const stars = hydrated ? totalStars(memory) : 0;
  const active = COMPANIONS.find((c) => c.id === memory.companion) ?? COMPANIONS[0];
  const [tick, setTick] = useState(0);
  const preview = MOODS[tick % MOODS.length];

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 3500);
    return () => clearInterval(t);
  }, []);

  function choose(id: CompanionId) {
    if (!unlocked.includes(id)) return;
    setMemory({ ...getMemory(), companion: id, updatedAt: new Date().toISOString() });
    playSound('pop');
    const c = COMPANIONS.find((x) => x.id === id)!;
    if (readAloudOn(getMemory())) void speakSequence('companion-pick', [tr(c.name, locale), tr(c.personality, locale)], locale);
    void syncWorld();
  }

  return (
    <AppPage
      eyebrow={<>🐾 {wt('companions', locale)}</>}
      title={locale === 'fr' ? 'Choisis ton compagnon d’aventure' : 'Choose your adventure buddy'}
      subtitle={locale === 'fr' ? 'Il t’encourage, te donne des indices et fait la fête avec toi. De nouveaux amis arrivent avec tes étoiles !' : 'They cheer you on, give hints and celebrate with you. New friends arrive as you earn stars!'}
      color={active.color}
    >
      {hydrated ? (
        <>
          <button type="button" onClick={() => setTick((n) => n + 1)} className="mx-auto flex justify-center rounded-3xl p-4" aria-label={locale === 'fr' ? 'Voir une autre réaction' : 'See another reaction'}>
            <CompanionBuddy profile={active} mood={preview.mood} locale={locale} size={110} line={companionLine(active, preview.reaction, tick, locale)} />
          </button>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {COMPANIONS.map((c, i) => {
              const open = unlocked.includes(c.id);
              const chosen = memory.companion === c.id;
              return (
                <motion.li key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <button
                    type="button"
                    disabled={!open}
                    aria-pressed={chosen}
                    onClick={() => choose(c.id)}
                    className={`flex h-full w-full flex-col items-center rounded-3xl border-2 bg-bg-card p-5 text-center shadow-sm transition focus-visible:outline focus-visible:outline-4 ${open ? 'hover:-translate-y-1 hover:shadow-lg' : 'cursor-not-allowed opacity-60'}`}
                    style={{ borderColor: chosen ? c.color : 'transparent', outlineColor: `${c.color}66` }}
                  >
                    <span className={`grid h-20 w-20 place-items-center rounded-full text-5xl ${open ? '' : 'grayscale'}`} style={{ background: `radial-gradient(circle at 30% 30%, #fff, ${c.color}55)` }} aria-hidden="true">
                      {open ? c.emoji : '🔒'}
                    </span>
                    <span className="mt-3 font-display text-lg font-bold text-text-body">{tr(c.name, locale)}</span>
                    <span className="mt-1 flex-1 text-sm text-text-muted">{tr(c.personality, locale)}</span>
                    <span className="mt-3 rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: `${c.color}1f`, color: c.color }}>
                      {chosen ? `✓ ${wt('chosen', locale)}` : open ? wt('choose', locale) : wt('unlockAt', locale, { n: c.unlockStars })}
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </ul>
          <p className="mt-6 text-center text-sm text-text-muted">⭐ {stars}</p>
        </>
      ) : (
        <div className="h-96 animate-pulse rounded-[2rem] bg-bg-card/60" aria-hidden="true" />
      )}
    </AppPage>
  );
}

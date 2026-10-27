'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MagicMoment } from '@/lib/world/engine';
import { WORLDS } from '@/data/worlds';
import { COMPANIONS } from '@/data/companions';
import { WORLD_BADGES } from '@/lib/world/gamification';
import { SKILL_NAMES, type LearningSkill } from '@/lib/learning/skills';
import { tr } from '@/lib/i18n-text';
import { playSound } from '@/lib/sound';
import { speakSequence } from '@/lib/voice';
import { getMemory } from '@/lib/world/store';
import { readAloudOn } from '@/lib/world/memory';
import { Confetti } from '@/components/ui/Confetti';
import { MAGIC_TEXT } from './text';
import { GameToken, Sunburst, Title3D } from '@/components/arcade/stage/Showpieces';
import { ToyButton } from '@/components/arcade/stage/Toy';

/** Details for a moment: the world, companion, badge or treasure it is about. */
function detail(m: MagicMoment, locale: string): { emoji: string; label: string | null } {
  switch (m.kind) {
    case 'NEW_WORLD':
    case 'WORLD_COMPLETE': {
      const w = WORLDS.find((x) => x.id === m.ref);
      return { emoji: w?.icon ?? '🌍', label: w ? tr(w.name, locale) : null };
    }
    case 'NEW_COMPANION': {
      const c = COMPANIONS.find((x) => x.id === m.ref);
      return { emoji: c?.emoji ?? '🐾', label: c ? tr(c.name, locale) : null };
    }
    case 'NEW_BADGE': {
      const b = WORLD_BADGES.find((x) => x.id === m.ref);
      return { emoji: b?.emoji ?? '🏅', label: b ? tr(b.name, locale) : null };
    }
    case 'NEW_ITEM': {
      const q = WORLDS.flatMap((w) => w.quests).find((x) => x.id === m.ref);
      return { emoji: q?.outcome.emoji ?? '✨', label: q ? tr(q.outcome.label, locale) : null };
    }
    case 'CHAPTER_COMPLETE':
      return { emoji: '📖', label: null };
    case 'LEVEL_UP':
      return { emoji: '🚀', label: `${locale === 'fr' ? 'Niveau' : 'Level'} ${m.ref}` };
    case 'GREAT_STREAK':
      return { emoji: '🔥', label: m.ref ? tr(SKILL_NAMES[m.ref as LearningSkill], locale) : null };
    case 'DAILY_DONE':
      return { emoji: '☀️', label: null };
    default:
      return { emoji: '🌟', label: null };
  }
}

const BIG: MagicMoment['kind'][] = ['FIRST_QUEST', 'WORLD_COMPLETE', 'NEW_WORLD', 'NEW_COMPANION', 'LEVEL_UP', 'CHAPTER_COMPLETE'];

/**
 * Magic Moments: the big firsts get a full-screen celebration, one after the
 * other (tap to continue); smaller ones are shown as a list by the caller.
 */
export function MagicMoments({ moments, locale, onDone }: { moments: MagicMoment[]; locale: string; onDone?: () => void }) {
  const big = moments.filter((m) => BIG.includes(m.kind));
  const [i, setI] = useState(0);
  const current = big[i];

  useEffect(() => {
    if (!current) return;
    playSound('win');
    // Children who can't read hear the celebration too.
    if (readAloudOn(getMemory())) {
      const d = detail(current, locale);
      void speakSequence(`magic-${current.kind}`, [tr(MAGIC_TEXT[current.kind], locale), d.label ?? ''].filter(Boolean), locale);
    }
  }, [current, locale]);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') setI((n) => n + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current]);

  useEffect(() => {
    if (big.length && i >= big.length) onDone?.();
  }, [i, big.length, onDone]);

  return (
    <AnimatePresence>
      {current ? (
        <motion.div
          key={i}
          role="dialog"
          aria-modal="true"
          aria-label={tr(MAGIC_TEXT[current.kind], locale)}
          className="fixed inset-0 z-[80] grid place-items-center p-6"
          style={{ background: 'radial-gradient(circle at 50% 45%, rgba(60,40,120,0.55), rgba(10,10,26,0.82) 70%)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setI((n) => n + 1)}
        >
          <Confetti trigger count={28} />
          <Sunburst color="#FBBF24" className="left-1/2 top-1/2 w-[min(900px,160vw)] -translate-x-1/2 -translate-y-1/2 opacity-60" />
          <motion.div
            initial={{ scale: 0.5, rotate: -8, opacity: 0, y: 40 }}
            animate={{ scale: 1, rotate: 0, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 170, damping: 13 }}
            className="relative w-full max-w-sm rounded-[2.4rem] p-2"
            style={{ background: 'linear-gradient(170deg, #FDE68A, #F59E0B)', boxShadow: '0 10px 0 #B45309, 0 40px 80px -20px rgba(0,0,0,0.6), inset 0 3px 0 rgba(255,255,255,0.6)' }}
          >
            <div className="relative rounded-[2rem] bg-bg-card px-6 pb-8 pt-4 text-center" style={{ boxShadow: 'inset 0 6px 14px rgba(146,64,14,0.18)' }}>
              <motion.div initial={{ y: 30, scale: 0.4 }} animate={{ y: -40, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.15 }} className="-mb-6 flex justify-center">
                <GameToken emoji={detail(current, locale).emoji} color="#F59E0B" size={128} />
              </motion.div>
              <div className="flex justify-center">
                <Title3D as="h2" text={tr(MAGIC_TEXT[current.kind], locale)} color="#F59E0B" className="text-3xl" delay={0.25} />
              </div>
              {detail(current, locale).label ? <p className="mt-3 text-lg font-bold text-text-muted">{detail(current, locale).label}</p> : null}
              <div className="mt-6 flex justify-center">
                <ToyButton color="#22C55E" size="lg" shine halo autoFocus>
                  {locale === 'fr' ? 'Youpi !' : 'Yay!'}
                </ToyButton>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Small moments as chips (new treasure, badge, daily bonus…). */
export function MomentChips({ moments, locale }: { moments: MagicMoment[]; locale: string }) {
  const small = moments.filter((m) => !BIG.includes(m.kind) || m.kind === 'CHAPTER_COMPLETE');
  if (!small.length) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {small.map((m, i) => {
        const d = detail(m, locale);
        return (
          <motion.li
            key={`${m.kind}-${m.ref ?? i}`}
            initial={{ opacity: 0, y: 12, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 1.8 + i * 0.12 }}
            className="flex items-center gap-2 rounded-full border-2 border-[#FDE68A] bg-bg-card py-1 pe-3.5 ps-1 text-sm font-bold text-text-body shadow-[0_3px_0_rgba(217,119,6,0.2)]"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#FEF3C7]" aria-hidden="true">
              {d.emoji}
            </span>
            {tr(MAGIC_TEXT[m.kind], locale)}
            {d.label ? <span className="text-text-muted">· {d.label}</span> : null}
          </motion.li>
        );
      })}
    </ul>
  );
}

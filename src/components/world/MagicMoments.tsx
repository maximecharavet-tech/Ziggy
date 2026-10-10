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
import { Confetti } from '@/components/ui/Confetti';
import { MAGIC_TEXT } from './text';

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
    if (current) playSound('win');
  }, [current]);

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
          className="fixed inset-0 z-[80] grid place-items-center bg-bg-dark/70 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setI((n) => n + 1)}
        >
          <Confetti trigger />
          <motion.div
            initial={{ scale: 0.6, rotate: -6, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 160, damping: 14 }}
            className="relative w-full max-w-sm rounded-[2rem] bg-bg-card p-8 text-center shadow-2xl"
          >
            <motion.div className="text-8xl" animate={{ y: [0, -10, 0] }} transition={{ duration: 1.6, repeat: Infinity }} aria-hidden="true">
              {detail(current, locale).emoji}
            </motion.div>
            <h2 className="mt-4 font-display text-3xl font-bold text-text-body">{tr(MAGIC_TEXT[current.kind], locale)}</h2>
            {detail(current, locale).label ? <p className="mt-2 text-lg font-semibold text-text-muted">{detail(current, locale).label}</p> : null}
            <button type="button" autoFocus className="mt-6 rounded-full bg-green px-6 py-3 font-bold text-white shadow hover:bg-green-dark focus-visible:outline focus-visible:outline-4 focus-visible:outline-green/40">
              {locale === 'fr' ? 'Youpi !' : 'Yay!'}
            </button>
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.12 }}
            className="flex items-center gap-2 rounded-full border border-border/70 bg-bg-card px-3 py-1.5 text-sm font-semibold text-text-body"
          >
            <span aria-hidden="true">{d.emoji}</span>
            {tr(MAGIC_TEXT[m.kind], locale)}
            {d.label ? <span className="text-text-muted">· {d.label}</span> : null}
          </motion.li>
        );
      })}
    </ul>
  );
}

'use client';

import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { COMPANIONS } from '@/data/companions';
import { levelFor } from '@/lib/world/gamification';
import { totalStars, type WorldMemory } from '@/lib/world/memory';
import { tr } from '@/lib/i18n-text';
import { wt } from './text';

/** Level, XP towards the next level, stars, and the companion — calm, no timers, no ranking. */
export function StatusBar({ memory, locale }: { memory: WorldMemory; locale: string }) {
  const lv = levelFor(memory.xp);
  const companion = COMPANIONS.find((c) => c.id === memory.companion) ?? COMPANIONS[0];
  const ratio = lv.next ? lv.into / lv.next : 1;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-border/70 bg-bg-card/80 px-4 py-3 shadow-sm backdrop-blur">
      <div className="flex min-w-[10rem] flex-1 items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-yellow to-apricot font-display text-lg font-bold text-white shadow" aria-hidden="true">
          {lv.level}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
            {wt('level', locale)} {lv.level} · {memory.xp} {wt('xp', locale)}
          </p>
          <div
            className="mt-1 h-2.5 overflow-hidden rounded-full bg-border/70"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={lv.next}
            aria-valuenow={lv.into}
            aria-label={`${wt('level', locale)} ${lv.level + 1}`}
          >
            <motion.div className="h-full rounded-full bg-gradient-to-r from-green to-teal" initial={false} animate={{ width: `${Math.round(ratio * 100)}%` }} transition={{ type: 'spring', stiffness: 80, damping: 18 }} />
          </div>
        </div>
      </div>
      <span className="rounded-full bg-yellow/15 px-3 py-1.5 text-sm font-bold text-text-body">
        ⭐ {totalStars(memory)} <span className="sr-only">{wt('stars', locale)}</span>
      </span>
      <Link
        href="/monde/compagnons"
        className="flex items-center gap-2 rounded-full border border-border/70 px-3 py-1.5 text-sm font-bold text-text-body transition hover:border-green/60 hover:bg-green/5"
      >
        <span aria-hidden="true">{companion.emoji}</span>
        {tr(companion.name, locale)}
      </Link>
    </div>
  );
}

'use client';

import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { COMPANIONS } from '@/data/companions';
import { levelFor } from '@/lib/world/gamification';
import { totalStars, type WorldMemory } from '@/lib/world/memory';
import { tr } from '@/lib/i18n-text';
import { lighten, rgba } from '@/components/arcade/stage/color';
import { wt } from './text';

/** Level, XP towards the next level, stars, and the companion — calm, no timers, no ranking. */
export function StatusBar({ memory, locale }: { memory: WorldMemory; locale: string }) {
  const lv = levelFor(memory.xp);
  const companion = COMPANIONS.find((c) => c.id === memory.companion) ?? COMPANIONS[0];
  const ratio = lv.next ? lv.into / lv.next : 1;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[1.8rem] border-[3px] border-white/80 bg-bg-card px-4 py-3 shadow-[0_6px_0_rgba(40,30,80,0.08),0_20px_34px_-22px_rgba(40,30,80,0.45)] dark:border-white/10">
      <div className="flex min-w-[10rem] flex-1 items-center gap-3">
        {/* Level coin */}
        <span
          className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-xl font-bold text-white"
          style={{
            background: 'radial-gradient(circle at 34% 28%, #FFF3B0 0%, #FCD34D 38%, #F59E0B 78%, #D97706 100%)',
            boxShadow: 'inset 0 -4px 6px rgba(180,83,9,0.45), inset 0 2px 0 rgba(255,255,255,0.7), 0 4px 0 #B45309',
            textShadow: '0 2px 0 rgba(146,64,14,0.6)',
          }}
          aria-hidden="true"
        >
          <span className="absolute inset-[5px] rounded-full border-2 border-white/40" />
          <span className="relative">{lv.level}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wide text-text-muted">
            {wt('level', locale)} {lv.level} · {memory.xp} {wt('xp', locale)}
          </p>
          <div
            className="relative mt-1.5 h-4 overflow-hidden rounded-full bg-text-body/[0.07] shadow-[inset_0_2px_4px_rgba(40,30,80,0.15)] dark:bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={lv.next}
            aria-valuenow={lv.into}
            aria-label={`${wt('level', locale)} ${lv.level + 1}`}
          >
            <motion.div
              className="relative h-full rounded-full"
              style={{
                boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5)',
                backgroundImage: 'repeating-linear-gradient(120deg, rgba(255,255,255,0.18) 0 8px, transparent 8px 16px), linear-gradient(180deg, #86EFAC 0%, #22C55E 55%, #16A34A 100%)',
              }}
              initial={false}
              animate={{ width: `${Math.max(6, Math.round(ratio * 100))}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 18 }}
            />
          </div>
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-extrabold text-[#92400E] shadow-[0_3px_0_rgba(217,119,6,0.25)]" style={{ background: 'linear-gradient(180deg, #FEF3C7, #FDE68A)' }}>
        ⭐ {totalStars(memory)} <span className="sr-only">{wt('stars', locale)}</span>
      </span>
      <Link
        href="/monde/compagnons"
        className="flex min-h-[40px] items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-bold text-text-body shadow-[0_3px_0_rgba(40,30,80,0.07)] transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
        style={{ borderColor: lighten(companion.color, 0.5), background: rgba(companion.color, 0.1) }}
      >
        <span aria-hidden="true">{companion.emoji}</span>
        {tr(companion.name, locale)}
      </Link>
    </div>
  );
}

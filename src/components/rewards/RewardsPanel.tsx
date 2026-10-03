'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { computeRewards, BADGES } from '@/lib/rewards';
import type { ProgressMap } from '@/lib/progress';
import { SpringNumber } from '@/components/ui/motion-primitives';
import { ZiggyAvatar } from '@/components/ziggy/Mascot';
import { EASE_OUT } from '@/lib/motion';

/** The child's level, XP bar and badge shelf, from the same progress as the trophies. */
export function RewardsPanel({ progress }: { progress: ProgressMap }) {
  const t = useTranslations('rewards');
  const r = computeRewards(progress);

  return (
    <section className="mt-10">
      {/* Level */}
      <div className="relative overflow-hidden rounded-3xl border border-border/50 p-6 sm:p-7 bg-gradient-to-br from-[#FFF4E2] via-peach/60 to-blush/60 dark:from-[#2a1f12] dark:via-[#3a2a17] dark:to-[#3a2222]">
        <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-sheen" aria-hidden="true" />
        <div className="relative flex items-center gap-4">
          <div className="relative">
            <ZiggyAvatar size={64} />
            <span className="absolute -bottom-1 -end-1 rounded-full gold-plate border border-[#E9C46A]/50 px-2 py-0.5 text-xs font-bold text-[#F3D27A]">
              {r.level}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a5a2b] dark:text-[#F3D3A8]">
              {t('level_short', { level: r.level })}
            </p>
            <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#3B2410] dark:text-[#FFE7C2] truncate">
              {t(`levels.${r.levelId}`)}
            </h3>
          </div>
          <div className="text-end">
            <SpringNumber value={r.xp} className="font-display text-3xl font-bold text-[#3B2410] dark:text-[#FFE7C2] tabular-nums" />
            <p className="text-xs font-semibold text-[#8a5a2b] dark:text-[#F3D3A8]">XP</p>
          </div>
        </div>
        <div className="relative mt-5">
          <div className="h-3.5 rounded-full bg-white/70 dark:bg-black/30 overflow-hidden shadow-inner">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #F2647B, #FBBF24, #7FC85C, #5FB6EA)' }}
              initial={{ width: 0 }}
              whileInView={{ width: `${Math.max(4, r.ratio * 100)}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: EASE_OUT }}
            />
          </div>
          <p className="mt-2 text-xs font-semibold text-[#6B4A2B] dark:text-[#F3D3A8]">
            {r.next === null ? t('max_level') : t('to_next', { xp: r.next - r.xp })}
          </p>
        </div>
      </div>

      {/* Badges */}
      <h2 className="font-display text-xl font-bold text-text-body mt-10 mb-4">
        {t('badges_title')} <span className="text-text-dim text-base">· {r.earnedCount}/{BADGES.length}</span>
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BADGES.map((b, i) => {
          const earned = r.badges[b.id];
          return (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 14, rotateX: 25 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.055, duration: 0.35, ease: EASE_OUT }}
              style={{ transformPerspective: 800 }}
              className={`relative rounded-2xl border p-4 text-center lift ${earned ? 'glass-strong' : 'bg-border/20 border-border/40'}`}
              title={t(`badges.${b.id}.desc`)}
            >
              <div
                className="mx-auto w-14 h-14 rounded-full flex items-center justify-center text-3xl"
                style={
                  earned
                    ? {
                        background: `radial-gradient(circle at 35% 30%, #fff, color-mix(in srgb, ${b.color} 45%, #fff7e6))`,
                        boxShadow: `0 10px 22px -10px ${b.color}`,
                      }
                    : undefined
                }
              >
                {earned ? b.emoji : <Lock size={20} className="text-text-dim" />}
              </div>
              <p className={`mt-2 text-sm font-bold ${earned ? 'text-text-body' : 'text-text-dim'}`}>{t(`badges.${b.id}.name`)}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-text-dim">{t(`badges.${b.id}.desc`)}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

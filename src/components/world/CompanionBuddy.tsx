'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { CompanionMood, CompanionProfile } from '@/data/types';
import { MOOD_STYLE } from '@/lib/world/companion';
import { tr } from '@/lib/i18n-text';

const ANIM = {
  float: { y: [0, -6, 0], rotate: 0, transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' as const } },
  bounce: { y: [0, -16, 0], rotate: 0, transition: { duration: 0.5, repeat: 2, ease: 'easeOut' as const } },
  tilt: { rotate: [0, -8, 0], y: 0, transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' as const } },
  spin: { rotate: [0, 360], y: [0, -12, 0], transition: { duration: 0.9, ease: 'easeOut' as const } },
  droop: { y: [0, 4, 0], rotate: [0, 4, 0], transition: { duration: 1, ease: 'easeInOut' as const } },
};

/** The companion: an animated character with a mood and a speech bubble. */
export function CompanionBuddy({
  profile,
  mood,
  line,
  locale,
  size = 64,
  side = 'right',
}: {
  profile: CompanionProfile;
  mood: CompanionMood;
  line?: string | null;
  locale: string;
  size?: number;
  side?: 'left' | 'right';
}) {
  const style = MOOD_STYLE[mood];
  return (
    <div className={`flex items-end gap-3 ${side === 'left' ? 'flex-row-reverse' : ''}`}>
      <AnimatePresence mode="wait">
        {line ? (
          <motion.p
            key={line}
            role="status"
            initial={{ opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-[16rem] rounded-2xl border bg-bg-card px-4 py-2 text-sm font-semibold text-text-body shadow-sm"
            style={{ borderColor: `${profile.color}55` }}
          >
            {line}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <motion.div
        key={mood}
        animate={ANIM[style.anim]}
        className="relative grid shrink-0 place-items-center rounded-full shadow-lg"
        style={{ width: size, height: size, background: `radial-gradient(circle at 30% 30%, #fff, ${profile.color}55)` }}
        aria-label={tr(profile.name, locale)}
        role="img"
      >
        <span style={{ fontSize: size * 0.58 }} aria-hidden="true">
          {profile.emoji}
        </span>
        {style.badge ? (
          <span className="absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-full bg-bg-card text-sm shadow" aria-hidden="true">
            {style.badge}
          </span>
        ) : null}
      </motion.div>
    </div>
  );
}

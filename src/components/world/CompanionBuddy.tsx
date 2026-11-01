'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { CompanionMood, CompanionProfile } from '@/data/types';
import { MOOD_STYLE } from '@/lib/world/companion';
import { tr } from '@/lib/i18n-text';
import { darken, lighten, rgba } from '@/components/arcade/stage/color';

const ANIM = {
  float: { y: [0, -6, 0], rotate: 0, transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' as const } },
  bounce: { y: [0, -16, 0], rotate: 0, transition: { duration: 0.5, repeat: 2, ease: 'easeOut' as const } },
  tilt: { rotate: [0, -8, 0], y: 0, transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' as const } },
  spin: { rotate: [0, 360], y: [0, -12, 0], transition: { duration: 0.9, ease: 'easeOut' as const } },
  droop: { y: [0, 4, 0], rotate: [0, 4, 0], transition: { duration: 1, ease: 'easeInOut' as const } },
};

/** The companion: a glossy toy bubble with its friend inside, a mood badge and a speech bubble. */
export function CompanionBuddy({
  profile,
  mood,
  line,
  locale,
  size = 64,
  side = 'right',
  stack = false,
}: {
  profile: CompanionProfile;
  mood: CompanionMood;
  line?: string | null;
  locale: string;
  size?: number;
  side?: 'left' | 'right';
  /** Speech bubble above the companion instead of beside it. */
  stack?: boolean;
}) {
  const style = MOOD_STYLE[mood];
  const c = profile.color;
  return (
    <div className={`flex gap-3 ${stack ? 'flex-col items-center' : `items-end ${side === 'left' ? 'flex-row-reverse' : ''}`}`}>
      <AnimatePresence mode="wait">
        {line ? (
          <motion.p
            key={line}
            role="status"
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 20 }}
            className="relative max-w-[16rem] rounded-[1.3rem] border-[3px] bg-bg-card px-4 py-2 text-sm font-bold text-text-body shadow-[0_4px_0_rgba(40,30,80,0.06),0_14px_26px_-16px_rgba(40,30,80,0.4)]"
            style={{ borderColor: lighten(c, 0.35) }}
          >
            {line}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <motion.div
        key={mood}
        animate={ANIM[style.anim]}
        className="relative grid shrink-0 place-items-center rounded-full"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 32% 26%, #FFFFFF 0%, ${lighten(c, 0.72)} 34%, ${lighten(c, 0.38)} 78%, ${c} 100%)`,
          boxShadow: `inset 0 -${size * 0.08}px ${size * 0.14}px ${rgba(darken(c, 0.3), 0.35)}, inset 0 3px 0 rgba(255,255,255,0.9), 0 ${Math.max(3, size * 0.06)}px 0 ${lighten(c, 0.1)}, 0 ${size * 0.22}px ${size * 0.3}px -${size * 0.14}px ${rgba(darken(c, 0.5), 0.55)}`,
        }}
        aria-label={tr(profile.name, locale)}
        role="img"
      >
        <span className="drop-shadow-[0_3px_2px_rgba(0,0,0,0.18)]" style={{ fontSize: size * 0.56 }} aria-hidden="true">
          {profile.emoji}
        </span>
        <span className="pointer-events-none absolute left-[20%] top-[12%] h-[20%] w-[32%] -rotate-[24deg] rounded-full bg-white/70" aria-hidden="true" />
        {style.badge ? (
          <span className="absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-full bg-bg-card text-sm shadow-[0_2px_0_rgba(0,0,0,0.08),0_4px_10px_rgba(0,0,0,0.12)]" aria-hidden="true">
            {style.badge}
          </span>
        ) : null}
      </motion.div>
    </div>
  );
}

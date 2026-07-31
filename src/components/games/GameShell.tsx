'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { RotateCcw, Star, Play } from 'lucide-react';

/* ═══════════════════════════════════════
   Shared stat pill
   ═══════════════════════════════════════ */

export interface GameStat {
  label: string;
  value: string | number;
  /** Pops/scales when the value changes. */
  pop?: boolean;
}

function StatPill({ stat, color }: { stat: GameStat; color: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl px-3 py-1.5 min-w-[64px]"
      style={{ backgroundColor: `${color}12` }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-dim leading-none mb-1">
        {stat.label}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={String(stat.value)}
          initial={stat.pop ? { scale: 0.5, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.4, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className="text-base font-extrabold leading-none tabular-nums"
          style={{ color }}
        >
          {stat.value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════
   GameShell — header + themed container
   ═══════════════════════════════════════ */

interface GameShellProps {
  title: string;
  color: string;
  icon?: ReactNode;
  stats?: GameStat[];
  onRestart?: () => void;
  children: ReactNode;
  className?: string;
}

export function GameShell({
  title,
  color,
  icon,
  stats = [],
  onRestart,
  children,
  className = '',
}: GameShellProps) {
  const t = useTranslations('games');

  return (
    <div
      className={`relative w-full rounded-3xl p-[1.5px] ${className}`}
      style={{
        background: `linear-gradient(160deg, ${color}40, transparent 45%, transparent 55%, ${color}25)`,
      }}
    >
      <div className="relative rounded-3xl glass-strong border border-border/50 overflow-hidden">
        {/* ambient glow */}
        <div
          className="absolute -top-24 -right-16 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${color}22 0%, transparent 70%)` }}
          aria-hidden="true"
        />

        {/* Header */}
        <div className="relative flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-border/50">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${color}15`, color }}
              >
                {icon}
              </div>
            )}
            <h2
              className="text-sm sm:text-base font-extrabold tracking-tight truncate"
              style={{ color }}
            >
              {title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {stats.map((s) => (
              <StatPill key={s.label} stat={s} color={color} />
            ))}
            {onRestart && (
              <button
                type="button"
                onClick={onRestart}
                aria-label={t('playAgain')}
                className="w-12 h-12 min-w-[48px] rounded-xl flex items-center justify-center text-text-muted hover:text-text-body transition-colors active:scale-95"
                style={{ backgroundColor: `${color}10` }}
              >
                <RotateCcw size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="relative p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Stars (1-3)
   ═══════════════════════════════════════ */

export function GameStars({ stars, color, size = 40 }: { stars: number; color: string; size?: number }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-label={`${stars}/3`}>
      {[0, 1, 2].map((i) => {
        const earned = i < stars;
        return (
          <motion.div
            key={i}
            initial={{ scale: 0, rotate: -60 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15 + i * 0.14, type: 'spring', stiffness: 320, damping: 14 }}
          >
            <Star
              size={size}
              strokeWidth={2}
              className={earned ? '' : 'opacity-25'}
              style={{ color: earned ? '#FBBF24' : color, fill: earned ? '#FBBF24' : 'transparent' }}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════
   Big themed action button (48px+ target)
   ═══════════════════════════════════════ */

export function GameButton({
  children,
  onClick,
  color,
  variant = 'solid',
  className = '',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  color: string;
  variant?: 'solid' | 'ghost';
  className?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`min-h-[52px] px-7 rounded-2xl font-extrabold text-base inline-flex items-center justify-center gap-2 transition-shadow ${className}`}
      style={
        variant === 'solid'
          ? { backgroundColor: color, color: '#fff', boxShadow: `0 8px 24px ${color}45` }
          : { backgroundColor: `${color}14`, color }
      }
    >
      {children}
    </motion.button>
  );
}

/* ═══════════════════════════════════════
   Start screen
   ═══════════════════════════════════════ */

export function GameStartScreen({
  color,
  emoji,
  name,
  description,
  howTo,
  onStart,
}: {
  color: string;
  emoji: string;
  name: string;
  description: string;
  howTo: string;
  onStart: () => void;
}) {
  const t = useTranslations('games');

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center text-center py-6 sm:py-10 px-2"
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl mb-5"
        style={{ backgroundColor: `${color}14`, boxShadow: `0 10px 40px ${color}25` }}
      >
        <span role="img" aria-hidden="true">
          {emoji}
        </span>
      </motion.div>

      <h3 className="text-2xl sm:text-3xl font-extrabold mb-2" style={{ color }}>
        {name}
      </h3>
      <p className="text-sm sm:text-base text-text-muted max-w-md mb-4 leading-relaxed">{description}</p>
      <p className="text-xs sm:text-sm text-text-dim max-w-sm mb-8 leading-relaxed">{howTo}</p>

      <GameButton color={color} onClick={onStart} className="w-full sm:w-auto">
        <Play size={18} fill="currentColor" />
        {t('start')}
      </GameButton>
    </motion.div>
  );
}

/* ═══════════════════════════════════════
   Result screen
   ═══════════════════════════════════════ */

export function GameResultScreen({
  color,
  stars,
  scoreLabel,
  scoreValue,
  extras = [],
  onRestart,
}: {
  color: string;
  stars: number;
  scoreLabel?: string;
  scoreValue: string | number;
  extras?: GameStat[];
  onRestart: () => void;
}) {
  const t = useTranslations('games');
  const title = stars >= 2 ? t('wellDone') : t('tryAgain');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="flex flex-col items-center text-center py-8 px-2"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1, rotate: [0, -8, 8, 0] }}
        transition={{ delay: 0.05, duration: 0.6 }}
        className="text-6xl mb-4"
        role="img"
        aria-hidden="true"
      >
        {stars >= 3 ? '🏆' : stars === 2 ? '🎉' : '💪'}
      </motion.div>

      <GameStars stars={stars} color={color} />

      <h3 className="text-2xl sm:text-3xl font-extrabold mt-5 mb-2 text-text-body">{title}</h3>

      <p className="text-sm text-text-muted mb-1">{scoreLabel ?? t('yourScore')}</p>
      <motion.p
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 400, damping: 16 }}
        className="text-5xl font-extrabold tabular-nums mb-6"
        style={{ color }}
      >
        {scoreValue}
      </motion.p>

      {extras.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          {extras.map((e) => (
            <div
              key={e.label}
              className="rounded-2xl px-4 py-2.5 glass border border-border/50 text-center min-w-[88px]"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim mb-0.5">
                {e.label}
              </div>
              <div className="text-lg font-extrabold text-text-body tabular-nums">{e.value}</div>
            </div>
          ))}
        </div>
      )}

      <GameButton color={color} onClick={onRestart} className="w-full sm:w-auto">
        <RotateCcw size={18} />
        {t('playAgain')}
      </GameButton>
    </motion.div>
  );
}

/* ═══════════════════════════════════════
   Shared feedback animation variants
   ═══════════════════════════════════════ */

export const shakeAnimation = {
  x: [0, -10, 10, -8, 8, -4, 4, 0],
  transition: { duration: 0.45 },
};

export const popAnimation = {
  scale: [1, 1.12, 1],
  transition: { duration: 0.35 },
};

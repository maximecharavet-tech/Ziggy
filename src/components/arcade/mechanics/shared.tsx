'use client';

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import { playSound } from '@/lib/sound';
import { ui } from '../ui-text';
import { SayButton, useAutoSay, useReadAloud } from '../read-aloud';

/** Spring used for every micro-interaction in the arcade. */
export const POP = { type: 'spring', stiffness: 420, damping: 24 } as const;
/** Gentle "not quite" wiggle — soft, never alarming. */
export const SOFT_SHAKE = { x: [0, -7, 7, -4, 4, 0], transition: { duration: 0.4 } };

/** Hex with alpha suffix (expects #RRGGBB). */
export function alpha(color: string, hex2: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${hex2}` : color;
}

/**
 * Keeps the running score and guarantees `onFinish` fires exactly once,
 * whatever re-renders or strict-mode double effects happen.
 */
export function useGameRun(total: number, onFinish: MechanicProps['onFinish'], onAnswer?: MechanicProps['onAnswer']) {
  const stats = useRef({ correct: 0, mistakes: 0 });
  const done = useRef(false);
  const finishRef = useRef(onFinish);
  const answerRef = useRef(onAnswer);
  useEffect(() => {
    finishRef.current = onFinish;
    answerRef.current = onAnswer;
  });

  /** Report one final answer for a round. */
  const answer = useCallback((right: boolean) => {
    if (right) stats.current.correct += 1;
    else stats.current.mistakes += 1;
    playSound(right ? 'correct' : 'wrong');
    answerRef.current?.(right);
  }, []);

  /** A mistake that is not the end of the round (a retry is coming). */
  const slip = useCallback(() => {
    stats.current.mistakes += 1;
    playSound('wrong');
    answerRef.current?.(false);
  }, []);

  const addMistakes = useCallback((n: number) => {
    stats.current.mistakes += Math.max(0, n);
  }, []);

  const finish = useCallback(
    (override?: Partial<{ correct: number; mistakes: number }>) => {
      if (done.current) return;
      done.current = true;
      const correct = Math.min(total, override?.correct ?? stats.current.correct);
      const mistakes = override?.mistakes ?? stats.current.mistakes;
      finishRef.current({ correct, mistakes, total });
    },
    [total],
  );

  return useMemo(() => ({ answer, slip, addMistakes, finish, stats }), [answer, slip, addMistakes, finish]);
}

/** "Round 2 / 5" + a row of soft progress dots. */
export function RoundProgress({ index, total, color, locale }: { index: number; total: number; color: string; locale: string }) {
  const shown = Math.min(index + 1, total);
  return (
    <div className="flex flex-col items-center gap-2 mb-4" dir="ltr">
      <div
        className="text-xs font-extrabold uppercase tracking-wide tabular-nums"
        style={{ color }}
        aria-live="polite"
      >
        {ui('round', locale)} {shown} / {total}
      </div>
      <div
        role="progressbar"
        aria-label={ui('progress', locale)}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.min(index, total)}
        className="flex items-center gap-1.5 flex-wrap justify-center max-w-full"
      >
        {Array.from({ length: total }, (_, i) => (
          <motion.span
            key={i}
            initial={false}
            animate={{ scale: i === index ? 1.25 : 1, opacity: i <= index ? 1 : 0.35 }}
            transition={POP}
            className="block h-2.5 rounded-full"
            style={{
              width: total > 12 ? 8 : 18,
              backgroundColor: i < index ? color : i === index ? alpha(color, 'AA') : alpha(color, '33'),
            }}
          />
        ))}
      </div>
    </div>
  );
}

export type FeedbackTone = 'right' | 'almost' | 'info';

/** The little speech bubble under the play area. Never red. */
export function Feedback({
  tone,
  title,
  children,
  color,
  say,
}: {
  tone: FeedbackTone | null;
  title?: string;
  children?: ReactNode;
  color: string;
  /** What Ziggy says after the title, for children who can't read it. */
  say?: string;
}) {
  useAutoSay(`fb-${tone ?? ''}-${title ?? ''}-${say ?? ''}`, tone ? [title, say] : []);
  const bg = tone === 'right' ? '#22C55E1A' : tone === 'almost' ? '#FBBF2422' : alpha(color, '14');
  const fg = tone === 'right' ? '#16A34A' : tone === 'almost' ? '#B45309' : color;
  return (
    <div className="min-h-[64px] flex items-center justify-center" aria-live="polite" role="status">
      <AnimatePresence mode="wait">
        {tone && (
          <motion.div
            key={`${tone}-${title ?? ''}`}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={POP}
            className="rounded-2xl px-5 py-3 text-center max-w-md"
            style={{ backgroundColor: bg }}
          >
            {title && (
              <div className="text-lg font-extrabold" style={{ color: fg }}>
                {tone === 'right' ? '✨ ' : tone === 'almost' ? '🌱 ' : ''}
                {title}
              </div>
            )}
            {children && <div className="text-sm font-semibold text-text-body mt-0.5">{children}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Big primary button (56px+). */
export function ArcadeButton({
  children,
  onClick,
  color,
  variant = 'solid',
  disabled,
  autoFocus,
  className = '',
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  color: string;
  variant?: 'solid' | 'soft';
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={POP}
      className={`min-h-[56px] min-w-[56px] px-6 rounded-2xl font-extrabold text-base inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      style={
        variant === 'solid'
          ? {
              background: `linear-gradient(135deg, ${color}, ${alpha(color, 'CC')})`,
              color: '#fff',
              boxShadow: `0 8px 22px ${alpha(color, '40')}`,
            }
          : { backgroundColor: alpha(color, '16'), color }
      }
    >
      {children}
    </motion.button>
  );
}

/** Soft gradient card that frames each mechanic. */
export function Stage({ color, children, className = '' }: { color: string; children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative w-full rounded-3xl p-4 sm:p-6 border border-border/60 bg-bg-card overflow-hidden ${className}`}
      style={{ backgroundImage: `linear-gradient(170deg, ${alpha(color, '14')}, transparent 55%)` }}
    >
      {children}
    </div>
  );
}

/**
 * Big emoji + prompt heading, with a 🔊 button. In read-aloud mode Ziggy says
 * the prompt, then `say` (e.g. each answer, with `onSpeak` lighting it up).
 */
export function Prompt({
  visual,
  text,
  color,
  say = [],
  onSpeak,
}: {
  visual?: string;
  text: string;
  color: string;
  say?: string[];
  onSpeak?: (i: number | null) => void;
}) {
  const { locale } = useReadAloud();
  const lines = [text, ...say];
  useAutoSay(`prompt-${lines.join('|')}`, lines, onSpeak);
  return (
    <div className="flex flex-col items-center text-center gap-3 mb-5">
      {visual && (
        <motion.div
          key={visual}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={POP}
          className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl flex items-center justify-center text-5xl sm:text-6xl"
          style={{ backgroundColor: alpha(color, '14'), boxShadow: `0 10px 30px ${alpha(color, '22')}` }}
          role="img"
          aria-hidden="true"
        >
          {visual}
        </motion.div>
      )}
      <div className="flex items-center justify-center gap-3">
        <h3 className="text-xl sm:text-2xl font-extrabold text-text-body text-balance">{text}</h3>
        <SayButton texts={lines} locale={locale} onIndex={onSpeak} />
      </div>
    </div>
  );
}

/** Hint line under the prompt. With `say`, Ziggy reads it aloud (when there is no prompt to read). */
export function Hint({ children, say }: { children: ReactNode; say?: string }) {
  const { locale } = useReadAloud();
  useAutoSay(`hint-${say ?? ''}`, say ? [say] : []);
  return (
    <p className="mb-4 flex items-center justify-center gap-2 text-center text-sm text-text-muted">
      {children}
      {say ? <SayButton texts={[say]} locale={locale} size="sm" /> : null}
    </p>
  );
}

/** Content with nothing to play still has to end the game (once). */
export function useFinishIfEmpty(total: number, finish: () => void) {
  useEffect(() => {
    if (total <= 0) finish();
  }, [total, finish]);
}

/** setTimeout that is cleared on unmount. */
export function useTimers() {
  const ids = useRef<number[]>([]);
  useEffect(() => {
    const list = ids.current;
    return () => list.forEach((id) => window.clearTimeout(id));
  }, []);
  return useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    ids.current.push(id);
    return id;
  }, []);
}

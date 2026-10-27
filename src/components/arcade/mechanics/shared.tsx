'use client';

import { useCallback, useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { motion, AnimatePresence, type TargetAndTransition } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import { playSound } from '@/lib/sound';
import { ui } from '../ui-text';
import { SayButton, useAutoSay, useReadAloud } from '../read-aloud';
import { ToyButton } from '../stage/Toy';
import { SparkleIcon } from '../stage/Burst';
import { darken, lighten, rgba, strong } from '../stage/color';
import css from '../stage/stage.module.css';

/** Spring used for every micro-interaction in the arcade. */
export const POP = { type: 'spring', stiffness: 420, damping: 24 } as const;
/** Gentle "not quite" wiggle — soft, never alarming. */
export const SOFT_SHAKE: TargetAndTransition = { x: [0, -7, 7, -4, 4, 0], rotate: [0, -1.5, 1.5, -1, 1, 0], transition: { duration: 0.45, ease: 'easeInOut' } };
/** A tile's own "not quite" wobble (tween keyframes: springs only take two). */
export const WOBBLE: TargetAndTransition = { rotate: [0, -6, 5, -3, 2, 0], y: [0, -4, 0, -2, 0, 0], transition: { duration: 0.55, ease: 'easeInOut' } };

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

/** "Round 2 / 5" + a little path of stars: done ones golden, the current one glowing. */
export function RoundProgress({ index, total, color, locale }: { index: number; total: number; color: string; locale: string }) {
  const shown = Math.min(index + 1, total);
  const small = total > 10;
  const node = small ? 16 : 22;
  return (
    <div className="mb-4 flex flex-col items-center gap-2" dir="ltr">
      <div
        className="rounded-full px-3 py-1 font-display text-xs font-bold uppercase tracking-wider tabular-nums"
        style={{ color: darken(strong(color), 0.1), backgroundColor: alpha(color, '1A') }}
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
        className="relative flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-1.5"
      >
        {Array.from({ length: total }, (_, i) => {
          const done = i < index;
          const now = i === index;
          return (
            <span key={i} className="relative grid place-items-center" style={{ width: node, height: node }}>
              {i > 0 ? <span className="absolute right-full top-1/2 h-1 w-1 -translate-y-1/2 rounded-full" style={{ backgroundColor: done || now ? lighten(color, 0.35) : alpha(color, '26') }} aria-hidden="true" /> : null}
              <AnimatePresence mode="popLayout" initial={false}>
                {done ? (
                  <motion.span key="star" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }} className="grid place-items-center">
                    <SparkleIcon size={node} color="#FBBF24" className="drop-shadow-[0_2px_0_rgba(217,119,6,0.55)]" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="dot"
                    initial={false}
                    animate={{ scale: now ? 1 : 0.55 }}
                    transition={POP}
                    className="block rounded-full"
                    style={{
                      width: node - 4,
                      height: node - 4,
                      background: now ? `radial-gradient(circle at 35% 30%, ${lighten(color, 0.5)}, ${strong(color)})` : alpha(color, '33'),
                      boxShadow: now ? `0 0 0 4px ${alpha(color, '33')}, 0 3px 0 ${darken(strong(color), 0.3)}` : undefined,
                    }}
                  />
                )}
              </AnimatePresence>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export type FeedbackTone = 'right' | 'almost' | 'info';

/** Ziggy's little speech bubble under the play area. Never red, never a "fail". */
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
  const look =
    tone === 'right'
      ? { bg: 'linear-gradient(180deg, #F0FDF4, #DCFCE7)', rim: '#86EFAC', fg: '#15803D', icon: '✨', coin: 'linear-gradient(160deg, #4ADE80, #16A34A)' }
      : tone === 'almost'
        ? { bg: 'linear-gradient(180deg, #FFFBEB, #FEF3C7)', rim: '#FCD34D', fg: '#B45309', icon: '🌱', coin: 'linear-gradient(160deg, #FDE68A, #F59E0B)' }
        : { bg: `linear-gradient(180deg, ${lighten(color, 0.92)}, ${lighten(color, 0.82)})`, rim: lighten(color, 0.5), fg: darken(strong(color), 0.15), icon: '💡', coin: `linear-gradient(160deg, ${lighten(color, 0.4)}, ${strong(color)})` };
  return (
    <div className="flex min-h-[64px] items-center justify-center" aria-live="polite" role="status">
      <AnimatePresence mode="wait">
        {tone && (
          <motion.div
            key={`${tone}-${title ?? ''}`}
            initial={{ opacity: 0, y: 14, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 18 }}
            className="relative flex max-w-md items-center gap-3 rounded-[1.4rem] border-2 py-2.5 pe-5 ps-2.5 text-start shadow-[0_10px_24px_-14px_rgba(40,30,80,0.45)] dark:brightness-90"
            style={{ background: look.bg, borderColor: look.rim }}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl shadow-[inset_0_2px_0_rgba(255,255,255,0.5),0_3px_0_rgba(0,0,0,0.12)]" style={{ background: look.coin }} aria-hidden="true">
              {look.icon}
            </span>
            <span className="min-w-0">
              {title && (
                <span className="block font-display text-lg font-bold leading-tight" style={{ color: look.fg }}>
                  {title}
                </span>
              )}
              {children && <span className="mt-0.5 block text-sm font-semibold text-[#3b3350]">{children}</span>}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Big primary button (56px+), a chunky glossy toy. */
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
    <ToyButton color={color} variant={variant} onClick={onClick} disabled={disabled} autoFocus={autoFocus} ariaLabel={ariaLabel} faceClassName={className} shine={variant === 'solid' && !disabled}>
      {children}
    </ToyButton>
  );
}

/**
 * The game board: a cream play surface set in a chunky frame of the game's
 * colour, with real thickness — a toy tray resting in the scene.
 */
export function Stage({ color, children, className = '' }: { color: string; children: ReactNode; className?: string }) {
  const frame = lighten(color, 0.18);
  return (
    <div className="relative w-full pb-3">
      <div
        className="relative rounded-[2.4rem] p-2 sm:p-2.5"
        style={{
          background: `linear-gradient(170deg, ${lighten(frame, 0.35)} 0%, ${frame} 45%, ${darken(color, 0.06)} 100%)`,
          boxShadow: `0 10px 0 ${darken(color, 0.3)}, 0 36px 60px -24px ${rgba(darken(color, 0.55), 0.55)}, inset 0 3px 0 rgba(255,255,255,0.55)`,
        }}
      >
        <div
          className={`relative w-full overflow-hidden rounded-[1.95rem] bg-bg-card p-4 sm:p-6 ${className}`}
          style={{
            backgroundImage: `radial-gradient(120% 70% at 50% -10%, ${rgba(color, 0.16)}, transparent 62%), radial-gradient(${rgba(color, 0.1)} 1.2px, transparent 1.6px)`,
            backgroundSize: 'auto, 18px 18px',
            boxShadow: `inset 0 6px 14px ${rgba(darken(color, 0.4), 0.16)}, inset 0 -2px 0 ${rgba(color, 0.12)}`,
          }}
        >
          {children}
        </div>
      </div>
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
  const long = visual ? [...visual].length > 3 : false;
  return (
    <div className="mb-5 flex flex-col items-center gap-3 text-center">
      {visual && (
        <motion.div
          key={visual}
          initial={{ scale: 0.4, opacity: 0, rotateX: -50, y: 10 }}
          animate={{ scale: 1, opacity: 1, rotateX: 0, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 15 }}
          className="relative"
          style={{ transformPerspective: 600 }}
          role="img"
          aria-hidden="true"
        >
          <span className={`relative flex items-center justify-center text-center ${long ? 'min-h-20 max-w-full rounded-[1.75rem] px-5 py-3 text-3xl leading-snug sm:text-4xl' : 'h-28 w-28 rounded-full text-6xl sm:h-32 sm:w-32 sm:text-7xl'} ${css.bob}`}
            style={{
              background: `radial-gradient(circle at 34% 26%, #FFFFFF 0%, ${lighten(color, 0.86)} 42%, ${lighten(color, 0.62)} 100%)`,
              boxShadow: `inset 0 -8px 16px ${rgba(color, 0.22)}, inset 0 4px 0 rgba(255,255,255,0.9), 0 6px 0 ${lighten(color, 0.35)}, 0 18px 30px -12px ${rgba(darken(color, 0.4), 0.45)}`,
              '--lift': '-6px', '--dur': '4.2s', '--r0': '-2deg', '--r1': '2deg',
            } as CSSProperties}
          >
            <span className="relative drop-shadow-[0_4px_4px_rgba(0,0,0,0.15)]">{visual}</span>
            <SparkleIcon size={18} color="#FFFFFF" className={`absolute right-[12%] top-[10%] ${css.twinkle}`} />
          </span>
        </motion.div>
      )}
      <div className="flex items-center justify-center gap-3">
        <h3 className="text-balance font-display text-2xl font-bold text-text-body sm:text-3xl" dir="auto">{text}</h3>
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
    <p className="mx-auto mb-4 flex w-fit max-w-full items-center justify-center gap-2 rounded-full bg-text-body/[0.04] py-1 pe-1.5 ps-4 text-center text-sm font-semibold text-text-muted dark:bg-white/5">
      <span className={say ? '' : 'pe-2.5'}>{children}</span>
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

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import { cleanSequence } from '../logic';
import { playPad } from './melody-audio';
import { ArcadeButton, Feedback, RoundProgress, Stage, alpha, useFinishIfEmpty, useGameRun } from './shared';
import { Burst } from '../stage/Burst';
import { darken, lighten, rgba } from '../stage/color';

/** Bar heights, like a real xylophone (scaled down on phones). */
const PAD_H = [150, 138, 126, 114, 102];
import { cheer, ui } from '../ui-text';

const PADS = [
  { color: '#F2647B', emoji: '🌷' },
  { color: '#F9BE7C', emoji: '🌻' },
  { color: '#7FC85C', emoji: '🌿' },
  { color: '#5FB6EA', emoji: '💧' },
  { color: '#A78BFA', emoji: '🪻' },
];

const STEP_MS = 620;

/** ready → listen → play → (again → listen → play) → right | demo → shown → next */
type Phase = 'ready' | 'listen' | 'play' | 'again' | 'right' | 'demo' | 'shown';

export function MelodyMechanic({ content, color, locale, onFinish, onAnswer }: MechanicProps) {
  const sequences = content.kind === 'melody' ? content.sequences.map(cleanSequence).filter((s) => s.length > 0) : [];
  const total = sequences.length;
  const run = useGameRun(total, onFinish, onAnswer);
  useFinishIfEmpty(total, run.finish);

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [lit, setLit] = useState<number | null>(null);
  const [pos, setPos] = useState(0);
  const [misses, setMisses] = useState(0);

  // Every scheduled timer belongs to a "show"; starting a new one cancels the old.
  const timers = useRef<number[]>([]);
  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);
  const at = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const seq = sequences[index];

  const flash = useCallback(
    (pad: number, ms = 320) => {
      setLit(pad);
      playPad(pad);
      at(ms, () => setLit((l) => (l === pad ? null : l)));
    },
    [at],
  );

  /** Play the sequence, then hand over to `then`. */
  const show = useCallback(
    (notes: number[], then: Phase) => {
      clearTimers();
      setPhase(then === 'play' ? 'listen' : 'demo');
      setPos(0);
      notes.forEach((n, i) => at(400 + i * STEP_MS, () => flash(n)));
      at(400 + notes.length * STEP_MS, () => {
        setLit(null);
        setPhase(then);
      });
    },
    [at, clearTimers, flash],
  );

  const goNext = () => {
    clearTimers();
    if (index + 1 >= total) {
      run.finish();
      return;
    }
    setIndex((i) => i + 1);
    setMisses(0);
    setPos(0);
    setLit(null);
    setPhase('listen');
  };

  // Each new round (after the first, which waits for a tap) plays itself.
  useEffect(() => {
    if (index > 0 && seq) show(seq, 'play');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const tapPad = (pad: number) => {
    if (!seq) return;
    if (phase !== 'play') {
      // Free play while not answering: still lovely to hear.
      if (phase === 'right' || phase === 'shown' || phase === 'ready') flash(pad, 220);
      return;
    }
    flash(pad, 260);
    if (pad === seq[pos]) {
      const nextPos = pos + 1;
      setPos(nextPos);
      if (nextPos >= seq.length) {
        run.answer(true);
        setPhase('right');
      }
      return;
    }
    // Not the right note: kindly replay (counts one mistake), or after a
    // second slip show how it goes and move on.
    if (misses === 0) {
      run.slip();
      setMisses(1);
      setPhase('again');
      clearTimers();
      at(900, () => show(seq, 'play'));
    } else {
      run.answer(false);
      setMisses(2);
      setPhase('demo');
      at(700, () => show(seq, 'shown'));
    }
  };

  // Keys 1–5 play the pads, Enter/Space starts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= 5) {
        e.preventDefault();
        tapPad(n - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (content.kind !== 'melody' || !seq) return null;

  const listening = phase === 'listen' || phase === 'demo';
  const title =
    phase === 'listen'
      ? ui('listen', locale)
      : phase === 'play'
        ? ui('yourTurn', locale)
        : phase === 'again'
          ? ui('listenAgain', locale)
          : phase === 'right'
            ? cheer(index, locale)
            : phase === 'shown' || phase === 'demo'
              ? ui('almost', locale)
              : undefined;
  const tone = phase === 'right' ? 'right' : phase === 'again' || phase === 'shown' || phase === 'demo' ? 'almost' : phase === 'ready' ? null : 'info';

  return (
    <Stage color={color} className="[--k:0.82] sm:[--k:1]">
      <RoundProgress index={index} total={total} color={color} locale={locale} />

      {/* Progress through the current tune */}
      <div className="mb-6 flex justify-center gap-2" dir="ltr" aria-hidden="true">
        {seq.map((n, i) => {
          const on = i < pos || phase === 'right';
          return (
            <motion.span
              key={i}
              animate={{ scale: on ? 1 : 0.8, y: on ? [0, -6, 0] : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              className="grid h-8 w-8 place-items-center rounded-full text-sm font-black text-white"
              style={
                on
                  ? { background: `radial-gradient(circle at 35% 30%, ${lighten(PADS[n].color, 0.4)}, ${PADS[n].color})`, boxShadow: `0 3px 0 ${darken(PADS[n].color, 0.3)}` }
                  : { background: alpha(color, '1F'), color: alpha(color, '88') }
              }
            >
              ♪
            </motion.span>
          );
        })}
      </div>

      {/* The flower xylophone */}
      <div className="relative mx-auto mb-6 w-fit px-2 pb-4 pt-2 sm:px-3" dir="ltr">
        <span className="absolute inset-x-0 bottom-0 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #B07A4A, #7A4E2A)', boxShadow: '0 5px 0 #5B3A1E, inset 0 2px 0 rgba(255,255,255,0.3)' }} aria-hidden="true" />
        <div className="relative flex items-end justify-center gap-1.5 sm:gap-3" role="group" aria-label={ui('yourTurn', locale)}>
          {PADS.map((pad, i) => {
            const on = lit === i;
            const depth = 8;
            return (
              <motion.button
                key={i}
                type="button"
                onClick={() => tapPad(i)}
                aria-label={`${ui('pad', locale)} ${i + 1}`}
                disabled={listening}
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.05 * i }}
                whileTap={listening ? undefined : 'press'}
                className="relative w-[50px] rounded-[1.4rem] outline-none focus-visible:ring-4 disabled:cursor-default sm:w-[76px]"
                style={{ height: `calc(${PAD_H[i]}px * var(--k, 1))`, paddingBottom: depth, ['--tw-ring-color' as string]: rgba(pad.color, 0.6) }}
              >
                <span className="absolute inset-x-0 bottom-0 rounded-[1.4rem]" style={{ top: depth, background: darken(pad.color, 0.32) }} aria-hidden="true" />
                <motion.span
                  variants={{ press: { y: depth - 1 } }}
                  animate={{ y: on ? depth - 2 : 0 }}
                  transition={{ type: 'spring', stiffness: 700, damping: 22 }}
                  className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-[1.4rem] py-2"
                  style={{
                    background: `linear-gradient(180deg, ${lighten(pad.color, on ? 0.45 : 0.25)} 0%, ${pad.color} 60%, ${darken(pad.color, 0.08)} 100%)`,
                    boxShadow: `inset 0 3px 0 rgba(255,255,255,0.55), inset 0 -4px 0 ${rgba(darken(pad.color, 0.3), 0.3)}${on ? `, 0 0 0 4px ${rgba(pad.color, 0.35)}, 0 0 30px ${rgba(pad.color, 0.8)}` : ''}`,
                  }}
                >
                  <span className="absolute inset-x-2 top-1 h-[30%] rounded-[1rem] bg-gradient-to-b from-white/50 to-white/0" aria-hidden="true" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-white/70 shadow-[inset_0_1px_1px_rgba(0,0,0,0.25)]" aria-hidden="true" />
                  <span className="relative grid h-9 w-9 place-items-center rounded-full bg-white/90 text-xl shadow-[0_2px_0_rgba(0,0,0,0.12)] sm:h-12 sm:w-12 sm:text-3xl" aria-hidden="true">
                    {pad.emoji}
                  </span>
                  <span className="relative h-2.5 w-2.5 rounded-full bg-white/70 shadow-[inset_0_1px_1px_rgba(0,0,0,0.25)]" aria-hidden="true" />
                </motion.span>
                {/* A note flies up from the bar */}
                <AnimatePresence>
                  {on ? (
                    <motion.span
                      key={`n-${i}-${pos}-${phase}`}
                      className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 text-2xl font-black"
                      style={{ color: darken(pad.color, 0.2) }}
                      initial={{ y: 0, opacity: 0, scale: 0.6 }}
                      animate={{ y: -54, opacity: [0, 1, 0], scale: 1.2, rotate: i % 2 ? 15 : -15 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      aria-hidden="true"
                    >
                      {i % 2 ? '♫' : '♪'}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
        {phase === 'right' ? <Burst fire={index + 1} color={color} count={16} spread={150} /> : null}
      </div>

      <div className="mt-5 flex min-h-[72px] flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Feedback tone={tone} title={title} color={color}>
          {phase === 'demo' || phase === 'shown' ? ui('showAnswer', locale) : undefined}
        </Feedback>
        {phase === 'ready' && (
          <ArcadeButton color={color} onClick={() => show(seq, 'play')} autoFocus>
            ▶ {ui('listen', locale)}
          </ArcadeButton>
        )}
        {phase === 'play' && (
          <ArcadeButton color={color} variant="soft" onClick={() => show(seq, 'play')}>
            🔁 {ui('replay', locale)}
          </ArcadeButton>
        )}
        {(phase === 'right' || phase === 'shown') && (
          <ArcadeButton color={color} onClick={goNext} autoFocus>
            {index + 1 >= total ? ui('finish', locale) : ui('next', locale)} →
          </ArcadeButton>
        )}
      </div>
    </Stage>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import { cleanSequence } from '../logic';
import { playPad } from './melody-audio';
import { ArcadeButton, Feedback, POP, RoundProgress, Stage, alpha, useFinishIfEmpty, useGameRun } from './shared';
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
    <Stage color={color}>
      <RoundProgress index={index} total={total} color={color} locale={locale} />

      {/* Progress through the current tune */}
      <div className="flex justify-center gap-2 mb-5" dir="ltr" aria-hidden="true">
        {seq.map((n, i) => (
          <motion.span
            key={i}
            animate={{ scale: i < pos || phase === 'right' ? 1.15 : 1 }}
            transition={POP}
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: i < pos || phase === 'right' ? PADS[n].color : alpha(color, '26') }}
          />
        ))}
      </div>

      <div className="flex justify-center gap-2 sm:gap-4 mb-5" dir="ltr" role="group" aria-label={ui('yourTurn', locale)}>
        {PADS.map((pad, i) => {
          const on = lit === i;
          return (
            <motion.button
              key={i}
              type="button"
              onClick={() => tapPad(i)}
              aria-label={`${ui('pad', locale)} ${i + 1}`}
              disabled={listening}
              animate={{ scale: on ? 1.12 : 1, y: on ? -8 : 0 }}
              whileTap={listening ? undefined : { scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 520, damping: 18 }}
              className="relative w-14 h-24 sm:w-20 sm:h-32 rounded-3xl flex items-end justify-center pb-3 text-2xl sm:text-3xl disabled:cursor-default"
              style={{
                background: `linear-gradient(180deg, ${pad.color}${on ? 'FF' : 'CC'}, ${pad.color}${on ? 'DD' : '88'})`,
                boxShadow: on ? `0 0 0 4px ${pad.color}55, 0 14px 34px ${pad.color}88` : `0 6px 16px ${pad.color}44`,
              }}
            >
              <span aria-hidden="true">{pad.emoji}</span>
            </motion.button>
          );
        })}
      </div>

      <Feedback tone={tone} title={title} color={color}>
        {phase === 'demo' || phase === 'shown' ? ui('showAnswer', locale) : undefined}
      </Feedback>

      <div className="flex justify-center gap-3 mt-3 min-h-[56px]">
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

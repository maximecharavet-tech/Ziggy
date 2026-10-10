'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import { playSound } from '@/lib/sound';
import { isOrderCorrect, orderCorrectPositions, shuffleNotIdentity, swap } from '../logic';
import { ArcadeButton, Feedback, Hint, POP, Prompt, RoundProgress, SOFT_SHAKE, Stage, alpha, useFinishIfEmpty, useGameRun } from './shared';
import { cheer, ui } from '../ui-text';

type Phase = 'play' | 'retry' | 'right' | 'shown';

function OrderRound({
  prompt,
  steps,
  color,
  locale,
  round,
  isLast,
  onSlip,
  onDone,
  onNext,
}: {
  prompt: string;
  steps: string[];
  color: string;
  locale: string;
  round: number;
  isLast: boolean;
  onSlip: () => void;
  onDone: (right: boolean) => void;
  onNext: () => void;
}) {
  // `order[i]` is the index (into steps) of the card shown at position i.
  const [order, setOrder] = useState<number[]>(() =>
    shuffleNotIdentity(steps.map((_, i) => i), Math.random, (a, b) => steps[a] === steps[b]),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('play');
  const [checked, setChecked] = useState<boolean[] | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  const locked = phase === 'right' || phase === 'shown';
  const current = order.map((i) => steps[i]);

  const tapCard = (pos: number) => {
    if (locked) return;
    playSound('tap');
    setChecked(null);
    if (selected === null) setSelected(pos);
    else if (selected === pos) setSelected(null);
    else {
      setOrder((o) => swap(o, selected, pos));
      setSelected(null);
    }
  };

  // Arrow keys move the selected card; Escape lets go.
  useEffect(() => {
    if (selected === null || locked) return;
    const onKey = (e: KeyboardEvent) => {
      const dir = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : 0;
      if (e.key === 'Escape') setSelected(null);
      if (!dir) return;
      e.preventDefault();
      const to = selected + dir;
      if (to < 0 || to >= order.length) return;
      setOrder((o) => swap(o, selected, to));
      setSelected(to);
      setChecked(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, locked, order.length]);

  // Keep keyboard focus on the moving card.
  useEffect(() => {
    if (selected === null) return;
    document.getElementById(`order-card-${round}-${selected}`)?.focus();
  }, [selected, round]);

  const check = () => {
    setSelected(null);
    if (isOrderCorrect(current, steps)) {
      setPhase('right');
      setChecked(current.map(() => true));
      onDone(true);
      return;
    }
    setChecked(orderCorrectPositions(current, steps));
    setShakeKey((k) => k + 1);
    if (phase === 'play') {
      setPhase('retry');
      onSlip();
    } else {
      setPhase('shown');
      onDone(false);
      setOrder(steps.map((_, i) => i));
      setChecked(steps.map(() => true));
    }
  };

  return (
    <div>
      <Prompt text={prompt} color={color} />
      {!locked && <Hint>{ui('orderHint', locale)}</Hint>}

      <motion.ol key={shakeKey} animate={shakeKey ? SOFT_SHAKE : undefined} className="flex flex-col gap-2.5 max-w-lg mx-auto" dir="ltr">
        {order.map((stepIndex, pos) => {
          const isSel = selected === pos;
          const ok = checked?.[pos];
          return (
            <motion.li key={stepIndex} layout transition={POP}>
              <motion.button
                id={`order-card-${round}-${pos}`}
                type="button"
                onClick={() => tapCard(pos)}
                disabled={locked}
                aria-pressed={isSel}
                aria-label={`${ui('step', locale)} ${pos + 1}: ${steps[stepIndex]}${isSel ? `, ${ui('selected', locale)}` : ''}`}
                whileTap={locked ? undefined : { scale: 0.97 }}
                animate={{ scale: isSel ? 1.03 : 1, y: isSel ? -2 : 0 }}
                transition={POP}
                className="w-full min-h-[60px] rounded-3xl px-3 py-2.5 flex items-center gap-3 text-left border-2 bg-bg-card disabled:cursor-default"
                style={{
                  borderColor: ok === true ? '#22C55E' : ok === false ? '#FBBF24' : isSel ? color : alpha(color, '2E'),
                  boxShadow: isSel ? `0 10px 24px ${alpha(color, '33')}` : 'none',
                  background: isSel ? `linear-gradient(135deg, ${alpha(color, '1C')}, transparent)` : undefined,
                }}
              >
                <span
                  className="w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center font-extrabold text-white"
                  style={{ backgroundColor: ok === true ? '#22C55E' : color }}
                  aria-hidden="true"
                >
                  {ok === true ? '✓' : pos + 1}
                </span>
                <span className="text-base sm:text-lg font-bold text-text-body">{steps[stepIndex]}</span>
                {isSel && (
                  <span className="ml-auto text-xl" aria-hidden="true">
                    ↕
                  </span>
                )}
              </motion.button>
            </motion.li>
          );
        })}
      </motion.ol>

      <div className="mt-4">
        <Feedback
          tone={phase === 'right' ? 'right' : phase === 'retry' || phase === 'shown' ? 'almost' : null}
          title={phase === 'right' ? cheer(round, locale) : phase === 'shown' ? ui('almost', locale) : phase === 'retry' ? ui('tryAgain', locale) : undefined}
          color={color}
        >
          {phase === 'shown' ? ui('showAnswer', locale) : undefined}
        </Feedback>
      </div>

      <div className="flex justify-center mt-3 min-h-[56px]">
        <AnimatePresence mode="wait">
          {locked ? (
            <motion.div key="next" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <ArcadeButton color={color} onClick={onNext} autoFocus>
                {isLast ? ui('finish', locale) : ui('next', locale)} →
              </ArcadeButton>
            </motion.div>
          ) : (
            <motion.div key="check" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ArcadeButton color={color} onClick={check}>
                {ui('check', locale)} ✓
              </ArcadeButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function OrderMechanic({ content, color, locale, onFinish, onAnswer }: MechanicProps) {
  const sets = content.kind === 'order' ? content.sets : [];
  const total = sets.length;
  const run = useGameRun(total, onFinish, onAnswer);
  const [index, setIndex] = useState(0);
  useFinishIfEmpty(total, run.finish);

  const set = sets[index];
  if (content.kind !== 'order' || !set) return null;

  const next = () => {
    if (index + 1 >= total) run.finish();
    else setIndex((i) => i + 1);
  };

  return (
    <Stage color={color}>
      <RoundProgress index={index} total={total} color={color} locale={locale} />
      <AnimatePresence mode="wait">
        <motion.div key={index} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
          <OrderRound
            prompt={set.prompt}
            steps={set.steps}
            color={color}
            locale={locale}
            round={index}
            isLast={index + 1 >= total}
            onSlip={run.slip}
            onDone={run.answer}
            onNext={next}
          />
        </motion.div>
      </AnimatePresence>
    </Stage>
  );
}

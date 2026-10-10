'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import { playSound } from '@/lib/sound';
import { mixHex, readableOn, sameMultiset } from '../logic';
import { ArcadeButton, Feedback, Hint, POP, RoundProgress, SOFT_SHAKE, Stage, useFinishIfEmpty, useGameRun } from './shared';
import { cheer, ui } from '../ui-text';

type Phase = 'play' | 'retry' | 'right' | 'shown';
type Paint = { id: string; name: string; hex: string };
type Target = { name: string; hex: string; recipe: string[] };

function MixRound({
  target,
  palette,
  color,
  locale,
  round,
  isLast,
  onSlip,
  onDone,
  onNext,
}: {
  target: Target;
  palette: Paint[];
  color: string;
  locale: string;
  round: number;
  isLast: boolean;
  onSlip: () => void;
  onDone: (right: boolean) => void;
  onNext: () => void;
}) {
  const max = Math.max(3, target.recipe.length);
  const [chosen, setChosen] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>('play');
  const [shake, setShake] = useState(0);
  const locked = phase === 'right' || phase === 'shown';

  const paint = (id: string) => palette.find((p) => p.id === id);
  const mixed = mixHex(chosen.map((id) => paint(id)?.hex ?? '#FFFFFF'));

  const add = (p: Paint) => {
    if (locked || chosen.length >= max) return;
    playSound('pop');
    setChosen((c) => [...c, p.id]);
  };
  const removeAt = (i: number) => {
    if (locked) return;
    playSound('tap');
    setChosen((c) => c.filter((_, k) => k !== i));
  };

  const doMix = () => {
    if (locked || chosen.length === 0) return;
    if (sameMultiset(chosen, target.recipe)) {
      setPhase('right');
      onDone(true);
      return;
    }
    setShake((n) => n + 1);
    if (phase === 'play') {
      setPhase('retry');
      onSlip();
    } else {
      setPhase('shown');
      onDone(false);
      setChosen(target.recipe);
    }
  };

  const recipePaints = target.recipe.map(paint).filter((p): p is Paint => !!p);

  return (
    <div>
      <div className="flex items-center justify-center gap-4 sm:gap-8 mb-5" dir="ltr">
        {/* Target */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wide text-text-muted">{ui('target', locale)}</span>
          <motion.div
            initial={{ scale: 0.7 }}
            animate={{ scale: 1 }}
            transition={POP}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-bg-card"
            style={{ backgroundColor: target.hex, boxShadow: `0 12px 30px ${target.hex}55` }}
            role="img"
            aria-label={`${ui('target', locale)}: ${target.name}`}
          />
          <span className="text-lg font-extrabold text-text-body">{target.name}</span>
        </div>

        <span className="text-2xl text-text-muted" aria-hidden="true">
          ⟵
        </span>

        {/* Cauldron */}
        <motion.div key={shake} animate={shake ? SOFT_SHAKE : undefined} className="flex flex-col items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wide text-text-muted">{ui('yourMix', locale)}</span>
          <div
            className="relative w-28 h-24 sm:w-32 sm:h-28 rounded-b-[48px] rounded-t-2xl overflow-hidden border-4"
            style={{ borderColor: '#4B5563', backgroundColor: '#374151' }}
            role="img"
            aria-label={ui('cauldron', locale)}
          >
            <motion.div
              className="absolute inset-x-0 bottom-0"
              initial={false}
              animate={{ height: `${(chosen.length / max) * 85 + (chosen.length ? 15 : 0)}%`, backgroundColor: mixed ?? '#374151' }}
              transition={{ type: 'spring', stiffness: 160, damping: 20 }}
            />
            {chosen.length > 0 && (
              <motion.span
                key={chosen.length}
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 2.2, opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/50"
                aria-hidden="true"
              />
            )}
          </div>
          <div className="flex gap-1.5 min-h-[44px]">
            <AnimatePresence>
              {chosen.map((id, i) => {
                const p = paint(id);
                return (
                  <motion.button
                    key={`${id}-${i}`}
                    type="button"
                    onClick={() => removeAt(i)}
                    disabled={locked}
                    aria-label={`${ui('remove', locale)} ${p?.name ?? id}`}
                    initial={{ scale: 0, y: -20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0 }}
                    transition={POP}
                    className="w-11 h-11 rounded-full border-2 border-bg-card shadow disabled:cursor-default"
                    style={{ backgroundColor: p?.hex ?? '#ccc' }}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {!locked && (
        <>
          <Hint>{ui('mixHint', locale)}</Hint>
          <div className="flex flex-wrap justify-center gap-3 mb-4" role="group" aria-label={ui('mixHint', locale)}>
            {palette.map((p) => (
              <motion.button
                key={p.id}
                type="button"
                onClick={() => add(p)}
                disabled={chosen.length >= max}
                aria-label={`${ui('add', locale)} ${p.name}`}
                whileTap={{ scale: 0.9 }}
                whileHover={{ y: -3 }}
                transition={POP}
                className="flex flex-col items-center gap-1 disabled:opacity-50"
              >
                <span
                  className="w-16 h-16 rounded-full border-4 border-bg-card flex items-center justify-center text-lg font-extrabold"
                  style={{ backgroundColor: p.hex, color: readableOn(p.hex), boxShadow: `0 8px 20px ${p.hex}55` }}
                  aria-hidden="true"
                >
                  +
                </span>
                <span className="text-xs font-bold text-text-body">{p.name}</span>
              </motion.button>
            ))}
          </div>
          <div className="flex justify-center gap-3">
            <ArcadeButton color={color} variant="soft" onClick={() => setChosen([])} disabled={chosen.length === 0}>
              {ui('empty', locale)}
            </ArcadeButton>
            <ArcadeButton color={color} onClick={doMix} disabled={chosen.length === 0}>
              🪄 {ui('mix', locale)}
            </ArcadeButton>
          </div>
        </>
      )}

      <div className="mt-4">
        <Feedback
          tone={phase === 'right' ? 'right' : phase === 'retry' || phase === 'shown' ? 'almost' : null}
          title={phase === 'right' ? cheer(round, locale) : phase === 'retry' ? ui('tryAgain', locale) : phase === 'shown' ? ui('almost', locale) : undefined}
          color={color}
        >
          {phase === 'shown' && (
            <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
              {ui('recipe', locale)}
              {recipePaints.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  {i > 0 && <span aria-hidden="true">+</span>}
                  <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: p.hex }} aria-hidden="true" />
                  <strong>{p.name}</strong>
                </span>
              ))}
            </span>
          )}
        </Feedback>
      </div>

      <div className="flex justify-center mt-3 min-h-[56px]">
        {locked && (
          <ArcadeButton color={color} onClick={onNext} autoFocus>
            {isLast ? ui('finish', locale) : ui('next', locale)} →
          </ArcadeButton>
        )}
      </div>
    </div>
  );
}

export function MixMechanic({ content, color, locale, onFinish, onAnswer }: MechanicProps) {
  const targets = content.kind === 'mix' ? content.targets : [];
  const palette = content.kind === 'mix' ? content.palette : [];
  const total = targets.length;
  const run = useGameRun(total, onFinish, onAnswer);
  const [index, setIndex] = useState(0);
  useFinishIfEmpty(total, run.finish);

  const target = targets[index];
  if (content.kind !== 'mix' || !target) return null;

  const next = () => {
    if (index + 1 >= total) run.finish();
    else setIndex((i) => i + 1);
  };

  return (
    <Stage color={color}>
      <RoundProgress index={index} total={total} color={color} locale={locale} />
      <AnimatePresence mode="wait">
        <motion.div key={index} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
          <MixRound
            target={target}
            palette={palette}
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

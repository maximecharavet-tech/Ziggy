'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import { playSound } from '@/lib/sound';
import { normWord, shuffleNotIdentity, spellLetters } from '../logic';
import { ArcadeButton, Feedback, POP, Prompt, RoundProgress, SOFT_SHAKE, Stage, alpha, useFinishIfEmpty, useGameRun, useTimers } from './shared';
import { cheer, ui } from '../ui-text';

type Phase = 'play' | 'retry' | 'right' | 'shown';
type Tile = { id: number; ch: string };

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function SpellRound({
  word,
  hint,
  color,
  locale,
  round,
  isLast,
  onSlip,
  onDone,
  onNext,
}: {
  word: string;
  hint: string;
  color: string;
  locale: string;
  round: number;
  isLast: boolean;
  onSlip: () => void;
  onDone: (right: boolean) => void;
  onNext: () => void;
}) {
  const later = useTimers();
  const letters = spellLetters(word);
  const chars = Array.from(normWord(word));
  const [tiles] = useState<Tile[]>(() =>
    shuffleNotIdentity(
      letters.map((ch, id) => ({ id, ch })),
      Math.random,
      (a, b) => a.ch === b.ch,
    ),
  );
  const [slots, setSlots] = useState<(number | null)[]>(() => letters.map(() => null));
  const [phase, setPhase] = useState<Phase>('play');
  const [shake, setShake] = useState(0);
  const [checking, setChecking] = useState(false);

  const locked = phase === 'right' || phase === 'shown' || checking;
  const used = new Set(slots.filter((s): s is number => s !== null));

  const evaluate = (filled: number[]) => {
    const guess = filled.map((id) => tiles.find((t) => t.id === id)!.ch).join('');
    if (guess === letters.join('')) {
      setPhase('right');
      onDone(true);
      return;
    }
    setShake((n) => n + 1);
    setChecking(true);
    if (phase === 'play') {
      onSlip();
      setPhase('retry');
      later(() => {
        setSlots(letters.map(() => null));
        setChecking(false);
      }, 900);
    } else {
      onDone(false);
      later(() => {
        // Show the word, built letter by letter in the right order.
        const pool = [...tiles];
        const solved = letters.map((ch) => {
          const k = pool.findIndex((t) => t.ch === ch);
          return pool.splice(k, 1)[0].id;
        });
        setSlots(solved);
        setPhase('shown');
        setChecking(false);
      }, 700);
    }
  };

  const place = (tile: Tile) => {
    if (locked || used.has(tile.id)) return;
    const k = slots.indexOf(null);
    if (k < 0) return;
    playSound('tap');
    const next = [...slots];
    next[k] = tile.id;
    setSlots(next);
    if (next.every((s) => s !== null)) evaluate(next as number[]);
  };

  const unplace = (slotIndex: number) => {
    if (locked || slots[slotIndex] === null) return;
    playSound('tap');
    setSlots((s) => s.map((v, i) => (i === slotIndex ? null : v)));
  };

  const eraseLast = () => {
    for (let i = slots.length - 1; i >= 0; i--) {
      if (slots[i] !== null) return unplace(i);
    }
  };

  // Physical keyboard: type the letters, Backspace to erase.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        eraseLast();
        return;
      }
      if (e.key.length !== 1) return;
      const key = e.key.toLocaleUpperCase();
      const free = tiles.filter((t) => !used.has(t.id));
      const tile = free.find((t) => t.ch === key) ?? free.find((t) => stripAccents(t.ch) === stripAccents(key));
      if (tile) {
        e.preventDefault();
        place(tile);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Map visible characters to slots (spaces are fixed gaps).
  let slotCursor = 0;
  const cells = chars.map((ch) => (ch === ' ' ? null : slotCursor++));

  return (
    <div>
      <Prompt visual={hint} text={ui('spellHint', locale)} color={color} />

      <motion.div
        key={shake}
        animate={shake ? SOFT_SHAKE : undefined}
        className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mb-6"
        dir="ltr"
        aria-live="polite"
      >
        {cells.map((slotIndex, ci) => {
          if (slotIndex === null) return <span key={`gap-${ci}`} className="w-4" aria-hidden="true" />;
          const tileId = slots[slotIndex];
          const tile = tileId === null ? null : tiles.find((t) => t.id === tileId);
          const good = phase === 'right' || phase === 'shown';
          return (
            <button
              key={`slot-${ci}`}
              type="button"
              onClick={() => unplace(slotIndex)}
              disabled={locked || !tile}
              aria-label={tile ? `${ui('letter', locale)} ${tile.ch}` : ui('emptySlot', locale)}
              className="w-12 h-14 sm:w-14 sm:h-16 rounded-2xl border-2 flex items-center justify-center text-2xl sm:text-3xl font-extrabold text-text-body disabled:cursor-default"
              style={{
                borderColor: good ? '#22C55E' : tile ? color : alpha(color, '40'),
                borderStyle: tile ? 'solid' : 'dashed',
                backgroundColor: good ? '#22C55E14' : tile ? alpha(color, '14') : 'transparent',
              }}
            >
              <AnimatePresence mode="popLayout">
                {tile && (
                  <motion.span key={tile.id} initial={{ scale: 0.3, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.3, opacity: 0 }} transition={POP}>
                    {tile.ch}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </motion.div>

      {phase !== 'right' && phase !== 'shown' && (
        <>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5" dir="ltr" role="group" aria-label={ui('spellHint', locale)}>
            {tiles.map((tile, i) => {
              const isUsed = used.has(tile.id);
              return (
                <motion.button
                  key={tile.id}
                  type="button"
                  onClick={() => place(tile)}
                  disabled={isUsed || locked}
                  aria-label={`${ui('letter', locale)} ${tile.ch}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: isUsed ? 0.18 : 1, y: 0, scale: isUsed ? 0.85 : 1 }}
                  whileTap={isUsed ? undefined : { scale: 0.9 }}
                  transition={{ ...POP, delay: i * 0.025 }}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl text-2xl sm:text-3xl font-extrabold text-white"
                  style={{
                    background: `linear-gradient(140deg, ${color}, ${alpha(color, 'BB')})`,
                    boxShadow: isUsed ? 'none' : `0 6px 16px ${alpha(color, '40')}`,
                  }}
                >
                  {tile.ch}
                </motion.button>
              );
            })}
          </div>
          <div className="flex justify-center mt-3">
            <ArcadeButton color={color} variant="soft" onClick={eraseLast} disabled={used.size === 0 || locked} ariaLabel={ui('erase', locale)}>
              ⌫
            </ArcadeButton>
          </div>
        </>
      )}

      <div className="mt-4">
        <Feedback
          tone={phase === 'right' ? 'right' : phase === 'retry' || phase === 'shown' ? 'almost' : null}
          title={
            phase === 'right' ? cheer(round, locale) : phase === 'retry' ? ui('tryAgain', locale) : phase === 'shown' ? ui('almost', locale) : undefined
          }
          color={color}
        >
          {phase === 'shown' && (
            <>
              {ui('answerWas', locale)} <strong>{word}</strong>
            </>
          )}
        </Feedback>
      </div>

      <div className="flex justify-center mt-3 min-h-[56px]">
        {(phase === 'right' || phase === 'shown') && (
          <ArcadeButton color={color} onClick={onNext} autoFocus>
            {isLast ? ui('finish', locale) : ui('next', locale)} →
          </ArcadeButton>
        )}
      </div>
    </div>
  );
}

export function SpellMechanic({ content, color, locale, onFinish, onAnswer }: MechanicProps) {
  const words = content.kind === 'spell' ? content.words.filter((w) => spellLetters(w.word).length > 0) : [];
  const total = words.length;
  const run = useGameRun(total, onFinish, onAnswer);
  const [index, setIndex] = useState(0);
  useFinishIfEmpty(total, run.finish);

  const w = words[index];
  if (content.kind !== 'spell' || !w) return null;

  const next = () => {
    if (index + 1 >= total) run.finish();
    else setIndex((i) => i + 1);
  };

  return (
    <Stage color={color}>
      <RoundProgress index={index} total={total} color={color} locale={locale} />
      <AnimatePresence mode="wait">
        <motion.div key={index} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
          <SpellRound
            word={w.word}
            hint={w.hint}
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

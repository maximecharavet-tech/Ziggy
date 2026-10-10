'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import { playSound } from '@/lib/sound';
import { Confetti } from '@/components/ui/Confetti';
import { helpMove, isSolved, moveTile, neighbours, shuffleBoard, slideMistakes, slideShuffleMoves, stepTrail } from '../logic';
import { ArcadeButton, Feedback, Hint, Stage, alpha, useGameRun } from './shared';
import { ui } from '../ui-text';

export function SlideMechanic({ content, color, locale, onFinish, onAnswer }: MechanicProps) {
  const size = content.kind === 'slide' ? content.size : 3;
  const run = useGameRun(1, onFinish, onAnswer);

  const [{ board, trail }, setState] = useState(() => shuffleBoard(size, slideShuffleMoves(size)));
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);
  const [hinted, setHinted] = useState<number | null>(null);

  const hole = board.indexOf(0);

  const slide = (index: number, viaHelp = false) => {
    if (done) return;
    const next = moveTile(board, size, index);
    if (!next) return;
    playSound('tap');
    const nextMoves = moves + 1;
    setState({ board: next, trail: stepTrail(trail, index) });
    setMoves(nextMoves);
    setHinted(viaHelp ? index : null);
    if (isSolved(next)) {
      setDone(true);
      run.addMistakes(slideMistakes(nextMoves, size));
      run.answer(true);
      playSound('win');
    }
  };

  const help = () => {
    const target = helpMove(trail);
    if (target !== null) slide(target, true);
  };

  // Arrow keys slide the tile next to the hole into it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      const r = Math.floor(hole / size);
      const c = hole % size;
      let from = -1;
      // "ArrowUp" pushes the tile below the hole upward, etc.
      if (e.key === 'ArrowUp' && r < size - 1) from = hole + size;
      if (e.key === 'ArrowDown' && r > 0) from = hole - size;
      if (e.key === 'ArrowLeft' && c < size - 1) from = hole + 1;
      if (e.key === 'ArrowRight' && c > 0) from = hole - 1;
      if (from >= 0) {
        e.preventDefault();
        slide(from);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (content.kind !== 'slide') return null;
  const movable = new Set(neighbours(hole, size));

  return (
    <Stage color={color}>
      <Confetti trigger={done} />
      <div className="flex items-center justify-between gap-3 mb-4" dir="ltr">
        <div
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl flex items-center justify-center text-4xl sm:text-5xl"
          style={{ backgroundColor: alpha(color, '14') }}
          role="img"
          aria-label={`${ui('picture', locale)}: ${content.picture}`}
        >
          {content.picture}
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs font-extrabold uppercase tracking-wide text-text-muted">{ui('moves', locale)}</span>
          <span className="text-2xl font-extrabold tabular-nums" style={{ color }} aria-live="polite">
            {moves}
          </span>
        </div>
        <ArcadeButton color={color} variant="soft" onClick={help} disabled={done} ariaLabel={ui('help', locale)}>
          💡 <span className="hidden sm:inline">{ui('help', locale)}</span>
        </ArcadeButton>
      </div>
      {!done && <Hint say={ui('slideHint', locale)}>{ui('slideHint', locale)}</Hint>}

      <div
        className="relative mx-auto w-full max-w-[360px] aspect-square rounded-3xl p-2"
        style={{ background: `linear-gradient(160deg, ${alpha(color, '22')}, ${alpha(color, '0A')})` }}
        dir="ltr"
        role="group"
        aria-label={ui('slideHint', locale)}
      >
        {board.map((tile, i) => {
          if (tile === 0) return null;
          const home = tile - 1;
          const r = Math.floor(i / size);
          const c = i % size;
          const inPlace = home === i;
          const canMove = movable.has(i) && !done;
          const pct = 100 / size;
          return (
            <motion.button
              key={tile}
              type="button"
              onClick={() => slide(i)}
              disabled={!canMove}
              aria-label={`${ui('tile', locale)} ${tile}`}
              initial={false}
              animate={{ left: `${c * pct}%`, top: `${r * pct}%`, scale: hinted === i ? [1, 1.08, 1] : 1 }}
              transition={{ type: 'spring', stiffness: 520, damping: 34 }}
              whileTap={canMove ? { scale: 0.94 } : undefined}
              className="absolute p-1 disabled:cursor-default"
              style={{ width: `${pct}%`, height: `${pct}%` }}
            >
              <span
                className="w-full h-full rounded-2xl flex flex-col items-center justify-center font-extrabold text-white text-2xl sm:text-3xl"
                style={{
                  background: done || inPlace ? `linear-gradient(140deg, ${color}, ${alpha(color, 'BB')})` : `linear-gradient(140deg, ${alpha(color, 'CC')}, ${alpha(color, '88')})`,
                  boxShadow: canMove ? `0 0 0 3px ${alpha(color, '55')}, 0 6px 14px ${alpha(color, '40')}` : `0 4px 10px ${alpha(color, '30')}`,
                }}
              >
                {done ? <span className="text-3xl sm:text-4xl">{content.picture}</span> : tile}
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-4">
        <Feedback tone={done ? 'right' : null} title={done ? ui('solved', locale) : undefined} color={color} />
      </div>
      <div className="flex justify-center mt-2 min-h-[56px]">
        {done && (
          <ArcadeButton color={color} onClick={() => run.finish()} autoFocus>
            {ui('continue', locale)} →
          </ArcadeButton>
        )}
      </div>
    </Stage>
  );
}

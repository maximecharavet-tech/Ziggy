'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import { playSound } from '@/lib/sound';
import { Confetti } from '@/components/ui/Confetti';
import { helpMove, isSolved, moveTile, neighbours, shuffleBoard, slideMistakes, slideShuffleMoves, stepTrail } from '../logic';
import { ArcadeButton, Feedback, Hint, Stage, useGameRun } from './shared';
import { chunkyFace } from '../stage/Toy';
import { Burst } from '../stage/Burst';
import { darken, lighten, mix, rgba, strong } from '../stage/color';
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
      <Confetti trigger={done} count={28} />
      <div className="mb-4 flex items-center justify-between gap-3" dir="ltr">
        <div
          className="grid h-16 w-16 place-items-center rounded-[1.4rem] text-4xl sm:h-20 sm:w-20 sm:text-5xl"
          style={{ background: `radial-gradient(circle at 35% 28%, #fff, ${lighten(color, 0.75)})`, boxShadow: `0 5px 0 ${lighten(color, 0.4)}, inset 0 -4px 8px ${rgba(color, 0.18)}` }}
          role="img"
          aria-label={`${ui('picture', locale)}: ${content.picture}`}
        >
          {content.picture}
        </div>
        <div className="flex flex-col items-center rounded-2xl bg-white/70 px-4 py-1.5 shadow-[0_3px_0_rgba(40,30,80,0.06)] dark:bg-white/5">
          <span className="text-xs font-extrabold uppercase tracking-wide text-text-muted">{ui('moves', locale)}</span>
          <motion.span key={moves} initial={{ scale: 1.4, y: -4 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }} className="font-display text-2xl font-bold tabular-nums" style={{ color: strong(color) }} aria-live="polite">
            {moves}
          </motion.span>
        </div>
        <ArcadeButton color={color} variant="soft" onClick={help} disabled={done} ariaLabel={ui('help', locale)}>
          💡 <span className="hidden sm:inline">{ui('help', locale)}</span>
        </ArcadeButton>
      </div>
      {!done && <Hint say={ui('slideHint', locale)}>{ui('slideHint', locale)}</Hint>}

      <div
        className="relative mx-auto aspect-square w-full max-w-[380px] rounded-[2rem] p-2.5"
        style={{
          background: `linear-gradient(160deg, ${darken(color, 0.15)}, ${darken(color, 0.35)})`,
          boxShadow: `0 8px 0 ${darken(color, 0.5)}, 0 26px 40px -18px ${rgba(darken(color, 0.5), 0.6)}, inset 0 3px 0 rgba(255,255,255,0.3)`,
        }}
        dir="ltr"
        role="group"
        aria-label={ui('slideHint', locale)}
      >
        <div className="relative h-full w-full rounded-[1.5rem]" style={{ background: darken(color, 0.45), boxShadow: 'inset 0 6px 14px rgba(0,0,0,0.4)' }}>
          {board.map((tile, i) => {
            if (tile === 0) return null;
            const home = tile - 1;
            const r = Math.floor(i / size);
            const c = i % size;
            const inPlace = home === i;
            const canMove = movable.has(i) && !done;
            const pct = 100 / size;
            const tone = done || inPlace ? color : mix(color, '#9CA3AF', 0.35);
            return (
              <motion.button
                key={tile}
                type="button"
                onClick={() => slide(i)}
                disabled={!canMove}
                aria-label={`${ui('tile', locale)} ${tile}`}
                initial={false}
                animate={{ left: `${c * pct}%`, top: `${r * pct}%`, scale: hinted === i ? [1, 1.1, 1] : 1 }}
                transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                whileTap={canMove ? { scale: 0.92 } : undefined}
                whileHover={canMove ? { y: -3 } : undefined}
                className="absolute p-1 outline-none focus-visible:z-10 focus-visible:ring-4 disabled:cursor-default"
                style={{ width: `${pct}%`, height: `${pct}%`, ['--tw-ring-color' as string]: rgba('#FFFFFF', 0.8) }}
              >
                <span
                  className="relative flex h-full w-full flex-col items-center justify-center rounded-[1rem] font-display text-3xl font-bold sm:text-4xl"
                  style={{ ...chunkyFace(tone), boxShadow: `${chunkyFace(tone).boxShadow}, 0 5px 0 ${darken(strong(tone), 0.4)}${canMove ? `, 0 0 0 3px ${rgba('#FFFFFF', 0.75)}` : ''}` }}
                >
                  <span className="absolute inset-x-2 top-1 h-[30%] rounded-[0.8rem] bg-gradient-to-b from-white/40 to-white/0" aria-hidden="true" />
                  <span className="relative">{done ? <span className="text-3xl sm:text-4xl">{content.picture}</span> : tile}</span>
                  {inPlace && !done ? <span className="absolute bottom-1 right-1.5 text-[10px] text-white/90" aria-hidden="true">★</span> : null}
                </span>
              </motion.button>
            );
          })}
          {done ? <Burst fire={1} color={color} count={22} spread={190} /> : null}
        </div>
      </div>

      <div className="mt-5 flex min-h-[72px] flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Feedback tone={done ? 'right' : null} title={done ? ui('solved', locale) : undefined} color={color} />
        {done && (
          <ArcadeButton color={color} onClick={() => run.finish()} autoFocus>
            {ui('continue', locale)} →
          </ArcadeButton>
        )}
      </div>
    </Stage>
  );
}

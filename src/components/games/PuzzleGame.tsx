'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Grid3x3 } from 'lucide-react';
import { GameShell, GameStartScreen, GameResultScreen } from './GameShell';

type Phase = 'start' | 'playing' | 'done';

const SIZE = 3;
const TILES = SIZE * SIZE;
const SOLVED = [1, 2, 3, 4, 5, 6, 7, 8, 0];
const SCRAMBLE_MOVES = 90;

function neighbours(index: number): number[] {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const out: number[] = [];
  if (row > 0) out.push(index - SIZE);
  if (row < SIZE - 1) out.push(index + SIZE);
  if (col > 0) out.push(index - 1);
  if (col < SIZE - 1) out.push(index + 1);
  return out;
}

function isSolved(board: number[]) {
  return board.every((v, i) => v === SOLVED[i]);
}

/**
 * Scramble by playing random *legal* moves backwards from the solved state,
 * so the puzzle is always solvable (a blind shuffle would not be).
 */
function scramble(): number[] {
  const board = [...SOLVED];
  let gap = board.indexOf(0);
  let previous = -1;

  for (let i = 0; i < SCRAMBLE_MOVES; i++) {
    const options = neighbours(gap).filter((n) => n !== previous);
    const pick = options[Math.floor(Math.random() * options.length)];
    [board[gap], board[pick]] = [board[pick], board[gap]];
    previous = gap;
    gap = pick;
  }

  return isSolved(board) ? scramble() : board;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function PuzzleGame({ color }: { color: string }) {
  const t = useTranslations('games');

  const [phase, setPhase] = useState<Phase>('start');
  const [board, setBoard] = useState<number[]>(SOLVED);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [lastMoved, setLastMoved] = useState<number | null>(null);
  const [bumped, setBumped] = useState<number | null>(null);

  /* Timer */
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  /* Win detection */
  useEffect(() => {
    if (phase !== 'playing' || !isSolved(board)) return;
    const id = window.setTimeout(() => setPhase('done'), 800);
    return () => window.clearTimeout(id);
  }, [phase, board]);

  const start = useCallback(() => {
    setBoard(scramble());
    setMoves(0);
    setSeconds(0);
    setLastMoved(null);
    setBumped(null);
    setPhase('playing');
  }, []);

  const slide = useCallback(
    (index: number) => {
      if (phase !== 'playing' || isSolved(board)) return;

      const gap = board.indexOf(0);
      if (!neighbours(gap).includes(index)) {
        // Not next to the gap — a gentle nudge instead of a move.
        setBumped(board[index]);
        window.setTimeout(() => setBumped(null), 420);
        return;
      }

      const next = [...board];
      [next[gap], next[index]] = [next[index], next[gap]];
      setBoard(next);
      setMoves((m) => m + 1);
      setLastMoved(board[index]);
    },
    [phase, board]
  );

  const solved = isSolved(board);
  const stars = moves <= 30 ? 3 : moves <= 60 ? 2 : 1;

  return (
    <GameShell
      title={t('puzzle.name')}
      color={color}
      icon={<Grid3x3 size={20} />}
      stats={
        phase === 'playing'
          ? [
              { label: t('puzzle.moves'), value: moves, pop: true },
              { label: t('time'), value: formatTime(seconds) },
            ]
          : []
      }
      onRestart={phase === 'playing' ? start : undefined}
    >
      <AnimatePresence mode="wait">
        {phase === 'start' && (
          <GameStartScreen
            key="start"
            color={color}
            emoji="🔢"
            name={t('puzzle.name')}
            description={t('puzzle.description')}
            howTo={t('puzzle.howTo')}
            onStart={start}
          />
        )}

        {phase === 'playing' && (
          <motion.div
            key="play"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto w-full max-w-xs sm:max-w-sm"
          >
            <div
              dir="ltr"
              className="grid grid-cols-3 gap-2 sm:gap-3 rounded-3xl p-2 sm:p-3"
              style={{ backgroundColor: `${color}0D` }}
            >
              {board.map((value, i) =>
                value === 0 ? (
                  <div
                    key="gap"
                    className="aspect-square min-h-[72px] rounded-2xl border-2 border-dashed"
                    style={{ borderColor: `${color}26` }}
                    aria-hidden="true"
                  />
                ) : (
                  <motion.button
                    key={value}
                    layout
                    type="button"
                    onClick={() => slide(i)}
                    aria-label={String(value)}
                    transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                    whileTap={{ scale: 0.94 }}
                    animate={{
                      scale: lastMoved === value ? [1, 1.07, 1] : 1,
                      x: bumped === value ? [0, -7, 7, -5, 5, 0] : 0,
                    }}
                    className="aspect-square min-h-[72px] rounded-2xl border-2 flex items-center justify-center font-extrabold text-2xl sm:text-3xl tabular-nums"
                    style={{
                      backgroundColor: solved ? 'rgba(34,197,94,0.16)' : `${color}1A`,
                      borderColor: solved ? 'rgba(34,197,94,0.6)' : `${color}40`,
                      color: solved ? '#16A34A' : color,
                    }}
                  >
                    {value}
                  </motion.button>
                )
              )}
            </div>

            <p className="text-center text-xs text-text-dim mt-5">
              {solved ? `🎉 ${t('puzzle.solved')}` : t('puzzle.goal')}
            </p>
          </motion.div>
        )}

        {phase === 'done' && (
          <GameResultScreen
            key="done"
            gameId="puzzle"
            color={color}
            stars={stars}
            scoreLabel={t('puzzle.moves')}
            scoreValue={moves}
            extras={[{ label: t('time'), value: formatTime(seconds) }]}
            onRestart={start}
          />
        )}
      </AnimatePresence>
    </GameShell>
  );
}

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Bot, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Play, Trash2, X, Heart } from 'lucide-react';
import { GameShell, GameStartScreen, GameResultScreen, GameButton } from './GameShell';

type Phase = 'start' | 'playing' | 'done';
type Dir = 'up' | 'down' | 'left' | 'right';

interface Cell {
  x: number;
  y: number;
}

interface Level {
  start: Cell;
  goal: Cell;
  obstacles: Cell[];
}

const GRID = 5;
const MAX_QUEUE = 12;
const LIVES = 3;
const STEP_MS = 420;

const c = (x: number, y: number): Cell => ({ x, y });

/** Six hand-built levels — always solvable, obstacles ramp up. */
const LEVELS: Level[] = [
  { start: c(0, 4), goal: c(4, 4), obstacles: [c(2, 2)] },
  { start: c(0, 4), goal: c(4, 0), obstacles: [c(2, 2)] },
  { start: c(0, 0), goal: c(4, 4), obstacles: [c(2, 1), c(2, 3)] },
  { start: c(4, 4), goal: c(0, 0), obstacles: [c(1, 1), c(3, 3)] },
  { start: c(0, 4), goal: c(4, 0), obstacles: [c(1, 3), c(2, 2), c(3, 1)] },
  { start: c(0, 0), goal: c(4, 4), obstacles: [c(1, 1), c(2, 3), c(3, 2)] },
];

const DELTAS: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const DIR_ICON: Record<Dir, typeof ArrowUp> = {
  up: ArrowUp,
  down: ArrowDown,
  left: ArrowLeft,
  right: ArrowRight,
};

const DIR_ORDER: Dir[] = ['up', 'left', 'right', 'down'];

function same(a: Cell, b: Cell) {
  return a.x === b.x && a.y === b.y;
}

export function CodingGame({ color }: { color: string }) {
  const t = useTranslations('games');

  const [phase, setPhase] = useState<Phase>('start');
  const [levelIndex, setLevelIndex] = useState(0);
  const [queue, setQueue] = useState<Dir[]>([]);
  const [robot, setRobot] = useState<Cell>(LEVELS[0].start);
  const [running, setRunning] = useState(false);
  const [crashed, setCrashed] = useState(false);
  const [won, setWon] = useState(false);
  const [lives, setLives] = useState(LIVES);
  const [cleared, setCleared] = useState(0);

  const timersRef = useRef<number[]>([]);
  const livesRef = useRef(LIVES);
  const clearedRef = useRef(0);

  const level = LEVELS[Math.min(levelIndex, LEVELS.length - 1)];

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    livesRef.current = LIVES;
    clearedRef.current = 0;
    setLevelIndex(0);
    setQueue([]);
    setRobot(LEVELS[0].start);
    setRunning(false);
    setCrashed(false);
    setWon(false);
    setLives(LIVES);
    setCleared(0);
    setPhase('playing');
  }, [clearTimers]);

  const push = useCallback(
    (dir: Dir) => {
      if (running) return;
      setQueue((q) => (q.length >= MAX_QUEUE ? q : [...q, dir]));
    },
    [running]
  );

  const removeAt = useCallback(
    (index: number) => {
      if (running) return;
      setQueue((q) => q.filter((_, i) => i !== index));
    },
    [running]
  );

  const resetQueue = useCallback(() => {
    if (running) return;
    setQueue([]);
    setRobot(level.start);
  }, [running, level]);

  const run = useCallback(() => {
    if (running || queue.length === 0 || phase !== 'playing') return;
    setRunning(true);
    setCrashed(false);
    setWon(false);
    setRobot(level.start);

    const fail = () => {
      setCrashed(true);
      livesRef.current -= 1;
      setLives(livesRef.current);
      later(() => {
        setCrashed(false);
        setRunning(false);
        setQueue([]);
        setRobot(level.start);
        if (livesRef.current <= 0) setPhase('done');
      }, 950);
    };

    const succeed = () => {
      setWon(true);
      clearedRef.current += 1;
      setCleared(clearedRef.current);
      later(() => {
        setWon(false);
        setRunning(false);
        setQueue([]);
        if (clearedRef.current >= LEVELS.length) {
          setPhase('done');
          return;
        }
        const nextIndex = clearedRef.current;
        setLevelIndex(nextIndex);
        setRobot(LEVELS[nextIndex].start);
      }, 1000);
    };

    const step = (i: number, pos: Cell) => {
      if (i >= queue.length) {
        fail(); // ran out of instructions before the star
        return;
      }
      const d = DELTAS[queue[i]];
      const next = { x: pos.x + d.x, y: pos.y + d.y };

      const outside = next.x < 0 || next.y < 0 || next.x >= GRID || next.y >= GRID;
      const blocked = level.obstacles.some((o) => same(o, next));
      if (outside || blocked) {
        fail();
        return;
      }

      setRobot(next);

      if (same(next, level.goal)) {
        later(() => succeed(), 240);
        return;
      }

      later(() => step(i + 1, next), STEP_MS);
    };

    later(() => step(0, level.start), 220);
  }, [running, queue, phase, level, later]);

  const stars = cleared >= LEVELS.length ? 3 : cleared >= 4 ? 2 : 1;

  return (
    <GameShell
      title={t('coding.name')}
      color={color}
      icon={<Bot size={20} />}
      stats={
        phase === 'playing'
          ? [
              { label: t('coding.level'), value: `${levelIndex + 1}/${LEVELS.length}`, pop: true },
              { label: t('coding.tries'), value: lives },
            ]
          : []
      }
      onRestart={phase === 'playing' && !running ? start : undefined}
    >
      <AnimatePresence mode="wait">
        {phase === 'start' && (
          <GameStartScreen
            key="start"
            color={color}
            emoji="🤖"
            name={t('coding.name')}
            description={t('coding.description')}
            howTo={t('coding.howTo')}
            onStart={start}
          />
        )}

        {phase === 'playing' && (
          <motion.div
            key="play"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto w-full max-w-md"
          >
            {/* Lives */}
            <div className="flex items-center justify-center gap-1.5 mb-4" aria-label={`${lives}/${LIVES}`}>
              {Array.from({ length: LIVES }, (_, i) => (
                <Heart
                  key={i}
                  size={18}
                  style={{ color: i < lives ? '#EF4444' : `${color}33` }}
                  fill={i < lives ? '#EF4444' : 'transparent'}
                />
              ))}
            </div>

            {/* Board */}
            <motion.div
              dir="ltr"
              animate={{ x: crashed ? [0, -10, 10, -8, 8, -4, 4, 0] : 0 }}
              transition={{ duration: 0.45 }}
              className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-5"
            >
              {Array.from({ length: GRID * GRID }, (_, i) => {
                const cell = { x: i % GRID, y: Math.floor(i / GRID) };
                const isGoal = same(cell, level.goal);
                const isObstacle = level.obstacles.some((o) => same(o, cell));
                const hasRobot = same(cell, robot);

                return (
                  <div
                    key={i}
                    className="relative aspect-square rounded-xl border flex items-center justify-center"
                    style={{
                      backgroundColor: isObstacle
                        ? 'rgba(239,68,68,0.10)'
                        : isGoal
                          ? 'rgba(250,204,21,0.16)'
                          : `${color}0A`,
                      borderColor: isObstacle
                        ? 'rgba(239,68,68,0.35)'
                        : isGoal
                          ? 'rgba(250,204,21,0.5)'
                          : `${color}24`,
                    }}
                  >
                    {isObstacle && (
                      <span className="text-lg sm:text-2xl" aria-hidden="true">
                        🧱
                      </span>
                    )}
                    {isGoal && !isObstacle && (
                      <motion.span
                        className="text-lg sm:text-2xl"
                        aria-hidden="true"
                        animate={won ? { scale: [1, 1.35, 1] } : { scale: [1, 1.1, 1] }}
                        transition={{ duration: won ? 0.5 : 2, repeat: won ? 0 : Infinity }}
                      >
                        ⭐
                      </motion.span>
                    )}
                    {hasRobot && (
                      <motion.span
                        layoutId="ziggy-robot"
                        transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                        className="absolute inset-0 flex items-center justify-center text-xl sm:text-3xl"
                        aria-label="Ziggy"
                      >
                        {crashed ? '💥' : '🤖'}
                      </motion.span>
                    )}
                  </div>
                );
              })}
            </motion.div>

            {/* Queue */}
            <div
              dir="ltr"
              className="min-h-[56px] rounded-2xl border-2 border-dashed p-2 mb-4 flex flex-wrap items-center gap-2"
              style={{ borderColor: `${color}33`, backgroundColor: `${color}08` }}
            >
              {queue.length === 0 ? (
                <span className="text-xs text-text-dim px-2 py-1.5">{t('coding.emptyQueue')}</span>
              ) : (
                queue.map((dir, i) => {
                  const Icon = DIR_ICON[dir];
                  return (
                    <motion.button
                      key={`${dir}-${i}`}
                      type="button"
                      onClick={() => removeAt(i)}
                      disabled={running}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      whileTap={running ? undefined : { scale: 0.92 }}
                      className="relative min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center border"
                      style={{
                        backgroundColor: `${color}18`,
                        borderColor: `${color}40`,
                        color,
                        opacity: running && i > 0 ? 0.6 : 1,
                      }}
                      aria-label={`${dir} — ${t('coding.reset')}`}
                    >
                      <Icon size={18} strokeWidth={3} />
                      {!running && (
                        <span
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: color, color: '#fff' }}
                        >
                          <X size={10} strokeWidth={4} />
                        </span>
                      )}
                    </motion.button>
                  );
                })
              )}
            </div>

            {/* Direction pad */}
            <div dir="ltr" className="grid grid-cols-4 gap-2 mb-4">
              {DIR_ORDER.map((dir) => {
                const Icon = DIR_ICON[dir];
                return (
                  <motion.button
                    key={dir}
                    type="button"
                    onClick={() => push(dir)}
                    disabled={running || queue.length >= MAX_QUEUE}
                    whileTap={{ scale: 0.94 }}
                    className="min-h-[56px] rounded-2xl flex items-center justify-center border-2 disabled:opacity-40"
                    style={{ backgroundColor: `${color}12`, borderColor: `${color}33`, color }}
                    aria-label={dir}
                  >
                    <Icon size={24} strokeWidth={3} />
                  </motion.button>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-3">
              <GameButton color={color} onClick={run} className="flex-1 sm:flex-none">
                <Play size={18} fill="currentColor" />
                {t('coding.run')}
              </GameButton>
              <GameButton color={color} variant="ghost" onClick={resetQueue}>
                <Trash2 size={18} />
                {t('coding.reset')}
              </GameButton>
            </div>

            <AnimatePresence>
              {(crashed || won) && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-sm font-extrabold mt-4"
                  style={{ color: won ? '#16A34A' : '#F59E0B' }}
                >
                  {won ? `⭐ ${t('coding.cleared')}` : `💪 ${t('coding.crashed')}`}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {phase === 'done' && (
          <GameResultScreen
            key="done"
            gameId="coding"
            color={color}
            stars={stars}
            scoreLabel={t('coding.level')}
            scoreValue={`${cleared}/${LEVELS.length}`}
            onRestart={start}
          />
        )}
      </AnimatePresence>
    </GameShell>
  );
}

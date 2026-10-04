'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Bot, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Play, Trash2, X, Lightbulb, Bug } from 'lucide-react';
import { runProgram, shortestPath, robotStars, same, GRID, type Cell, type Dir, type Level } from '@/lib/games/robot';
import { GameShell, GameStartScreen, GameResultScreen, GameButton } from './GameShell';

type Phase = 'start' | 'playing' | 'done';

const MAX_QUEUE = 12;
const STEP_MS = 420;
/** Failed runs on a level before Ziggy offers a hint, then the whole path. */
const HINT_AFTER = 2;
const FULL_HINT_AFTER = 4;

const c = (x: number, y: number): Cell => ({ x, y });

/** Six hand-built levels — always solvable, obstacles ramp up. */
export const LEVELS: Level[] = [
  { start: c(0, 4), goal: c(4, 4), obstacles: [c(2, 2)] },
  { start: c(0, 4), goal: c(4, 0), obstacles: [c(2, 2)] },
  { start: c(0, 0), goal: c(4, 4), obstacles: [c(2, 1), c(2, 3)] },
  { start: c(4, 4), goal: c(0, 0), obstacles: [c(1, 1), c(3, 3)] },
  { start: c(0, 4), goal: c(4, 0), obstacles: [c(1, 3), c(2, 2), c(3, 1)] },
  { start: c(0, 0), goal: c(4, 4), obstacles: [c(1, 1), c(2, 3), c(3, 2)] },
];

const DIR_ICON: Record<Dir, typeof ArrowUp> = {
  up: ArrowUp,
  down: ArrowDown,
  left: ArrowLeft,
  right: ArrowRight,
};

const DIR_ORDER: Dir[] = ['up', 'left', 'right', 'down'];

/**
 * Program Ziggy across the grid. No lives and no game over: a run that fails
 * keeps the program, shows the exact instruction that went wrong (debugging,
 * like a real coder) and, after a couple of tries, footprints show the way.
 */
export function CodingGame({ color }: { color: string }) {
  const t = useTranslations('games');

  const [phase, setPhase] = useState<Phase>('start');
  const [levelIndex, setLevelIndex] = useState(0);
  const [queue, setQueue] = useState<Dir[]>([]);
  const [robot, setRobot] = useState<Cell>(LEVELS[0].start);
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState<'bump' | 'short' | 'won' | null>(null);
  const [bugAt, setBugAt] = useState<number | null>(null);
  const [tries, setTries] = useState(0); // failed runs on this level
  const [bumps, setBumps] = useState(0); // failed runs in the whole game
  const [hint, setHint] = useState(0); // footprints shown

  const timersRef = useRef<number[]>([]);
  const level = LEVELS[Math.min(levelIndex, LEVELS.length - 1)];
  const footprints = hint ? (pathCells(level, hint)) : [];

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const goToLevel = useCallback((index: number) => {
    setLevelIndex(index);
    setRobot(LEVELS[index].start);
    setQueue([]);
    setTries(0);
    setHint(0);
    setBugAt(null);
    setFeedback(null);
  }, []);

  const start = useCallback(() => {
    clearTimers();
    setRunning(false);
    setBumps(0);
    goToLevel(0);
    setPhase('playing');
  }, [clearTimers, goToLevel]);

  // Any edit of the program clears the bug marker: the child is fixing it.
  const edit = useCallback((next: (q: Dir[]) => Dir[]) => {
    if (running) return;
    setBugAt(null);
    setFeedback(null);
    setRobot(level.start);
    setQueue(next);
  }, [running, level]);

  const run = useCallback(() => {
    if (running || queue.length === 0 || phase !== 'playing') return;
    const result = runProgram(level, queue);
    setRunning(true);
    setFeedback(null);
    setBugAt(null);
    setRobot(level.start);

    // Walk the path cell by cell, then tell what happened.
    result.path.slice(1).forEach((cell, i) => later(() => setRobot(cell), 220 + i * STEP_MS));
    const end = 220 + Math.max(0, result.path.length - 1) * STEP_MS + 80;

    later(() => {
      if (result.outcome === 'goal') {
        setFeedback('won');
        later(() => {
          setRunning(false);
          if (levelIndex + 1 >= LEVELS.length) setPhase('done');
          else goToLevel(levelIndex + 1);
        }, 1000);
        return;
      }
      setFeedback(result.outcome);
      if (result.outcome === 'bump') setBugAt(result.bugAt);
      const nextTries = tries + 1;
      setTries(nextTries);
      setBumps((b) => b + 1);
      if (nextTries >= FULL_HINT_AFTER) setHint(99);
      setRunning(false);
    }, end);
  }, [running, queue, phase, level, later, levelIndex, tries, goToLevel]);

  const stars = robotStars(bumps);
  const canHint = tries >= HINT_AFTER && hint < 2 && phase === 'playing';

  return (
    <GameShell
      title={t('coding.name')}
      color={color}
      icon={<Bot size={20} />}
      stats={
        phase === 'playing'
          ? [
              { label: t('coding.level'), value: `${levelIndex + 1}/${LEVELS.length}`, pop: true },
              { label: t('coding.tries'), value: tries },
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
          <motion.div key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto w-full max-w-md">
            {/* Board */}
            <motion.div
              dir="ltr"
              animate={{ x: feedback === 'bump' ? [0, -8, 8, -6, 6, -3, 3, 0] : 0 }}
              transition={{ duration: 0.45 }}
              className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-5"
            >
              {Array.from({ length: GRID * GRID }, (_, i) => {
                const cell = { x: i % GRID, y: Math.floor(i / GRID) };
                const isGoal = same(cell, level.goal);
                const isObstacle = level.obstacles.some((o) => same(o, cell));
                const hasRobot = same(cell, robot);
                const step = footprints.findIndex((f) => same(f, cell));
                return (
                  <div
                    key={i}
                    className="relative aspect-square rounded-xl border flex items-center justify-center"
                    style={{
                      backgroundColor: isObstacle ? 'rgba(239,68,68,0.10)' : isGoal ? 'rgba(250,204,21,0.16)' : `${color}0A`,
                      borderColor: isObstacle ? 'rgba(239,68,68,0.35)' : isGoal ? 'rgba(250,204,21,0.5)' : `${color}24`,
                    }}
                  >
                    {isObstacle && <span className="text-lg sm:text-2xl" aria-hidden="true">🧱</span>}
                    {isGoal && !isObstacle && (
                      <motion.span
                        className="text-lg sm:text-2xl"
                        aria-hidden="true"
                        animate={feedback === 'won' ? { scale: [1, 1.35, 1] } : { scale: [1, 1.1, 1] }}
                        transition={{ duration: feedback === 'won' ? 0.5 : 2, repeat: feedback === 'won' ? 0 : Infinity }}
                      >
                        ⭐
                      </motion.span>
                    )}
                    {step >= 0 && !hasRobot && !isGoal && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.4 }}
                        animate={{ opacity: 0.85, scale: 1 }}
                        transition={{ delay: step * 0.12 }}
                        className="text-base sm:text-xl"
                        aria-hidden="true"
                      >
                        👣
                      </motion.span>
                    )}
                    {hasRobot && (
                      <motion.span
                        layoutId="ziggy-robot"
                        transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                        className="absolute inset-0 flex items-center justify-center text-xl sm:text-3xl"
                        aria-label="Ziggy"
                      >
                        {feedback === 'bump' ? '😵' : '🤖'}
                      </motion.span>
                    )}
                  </div>
                );
              })}
            </motion.div>

            {/* Program, with the bug marked */}
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
                  const isBug = bugAt === i;
                  return (
                    <motion.button
                      key={`${dir}-${i}`}
                      type="button"
                      onClick={() => edit((q) => q.filter((_, j) => j !== i))}
                      disabled={running}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={isBug ? { scale: [1, 1.15, 1], opacity: 1 } : { scale: 1, opacity: 1 }}
                      transition={isBug ? { duration: 0.6, repeat: Infinity, repeatDelay: 0.6 } : undefined}
                      whileTap={running ? undefined : { scale: 0.92 }}
                      className="relative min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center border-2"
                      style={{
                        backgroundColor: isBug ? 'rgba(245,158,11,0.18)' : `${color}18`,
                        borderColor: isBug ? '#F59E0B' : `${color}40`,
                        color: isBug ? '#B45309' : color,
                      }}
                      aria-label={`${dir}${isBug ? ' — bug' : ''} — ${t('coding.reset')}`}
                    >
                      <Icon size={18} strokeWidth={3} />
                      {isBug && (
                        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#F59E0B] text-white">
                          <Bug size={12} />
                        </span>
                      )}
                      {!running && !isBug && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: color, color: '#fff' }}>
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
                    onClick={() => edit((q) => (q.length >= MAX_QUEUE ? q : [...q, dir]))}
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

            <div className="flex flex-wrap items-center justify-center gap-3">
              <GameButton color={color} onClick={run} className="flex-1 sm:flex-none">
                <Play size={18} fill="currentColor" />
                {t('coding.run')}
              </GameButton>
              <GameButton color={color} variant="ghost" onClick={() => edit(() => [])}>
                <Trash2 size={18} />
                {t('coding.reset')}
              </GameButton>
              {canHint && (
                <GameButton color="#F59E0B" variant="ghost" onClick={() => setHint((h) => (h ? 99 : 2))}>
                  <Lightbulb size={18} />
                  {t('coding.hint')}
                </GameButton>
              )}
            </div>

            <AnimatePresence mode="wait">
              {feedback && (
                <motion.p
                  key={feedback}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-sm font-extrabold mt-4"
                  style={{ color: feedback === 'won' ? '#16A34A' : '#B45309' }}
                >
                  {feedback === 'won' ? `⭐ ${t('coding.cleared')}` : feedback === 'bump' ? `🐞 ${t('coding.bug')}` : `🌱 ${t('coding.short')}`}
                </motion.p>
              )}
              {!feedback && hint > 0 && (
                <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-sm font-bold mt-4 text-[#B45309]">
                  👣 {t('coding.hintText')}
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
            scoreLabel={t('coding.tries')}
            scoreValue={bumps}
            onRestart={start}
          />
        )}
      </AnimatePresence>
    </GameShell>
  );
}

/** The first `count` cells of the shortest path, for the footprint hint. */
function pathCells(level: Level, count: number): Cell[] {
  const dirs = shortestPath(level) ?? [];
  const cells: Cell[] = [];
  let pos = level.start;
  for (const d of dirs.slice(0, count)) {
    pos = { x: pos.x + (d === 'right' ? 1 : d === 'left' ? -1 : 0), y: pos.y + (d === 'down' ? 1 : d === 'up' ? -1 : 0) };
    cells.push(pos);
  }
  return cells;
}

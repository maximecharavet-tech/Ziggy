'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Zap, Eye, Hand } from 'lucide-react';
import { GameShell, GameStartScreen, GameResultScreen } from './GameShell';

type Phase = 'start' | 'playing' | 'done';
type Mode = 'watch' | 'input';

interface Pad {
  emoji: string;
  color: string;
}

const PADS: Pad[] = [
  { emoji: '🍓', color: '#EF4444' },
  { emoji: '💧', color: '#3B82F6' },
  { emoji: '🍀', color: '#22C55E' },
  { emoji: '⭐', color: '#EAB308' },
];

/** Playback gets a little quicker as the sequence grows. */
function stepDelay(length: number) {
  return Math.max(340, 640 - length * 22);
}

export function SimonGame({ color }: { color: string }) {
  const t = useTranslations('games');

  const [phase, setPhase] = useState<Phase>('start');
  const [mode, setMode] = useState<Mode>('watch');
  const [sequence, setSequence] = useState<number[]>([]);
  const [inputIndex, setInputIndex] = useState(0);
  const [activePad, setActivePad] = useState<number | null>(null);
  const [wrongPad, setWrongPad] = useState<number | null>(null);
  const [completed, setCompleted] = useState(0);

  const timersRef = useRef<number[]>([]);

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
    setSequence([Math.floor(Math.random() * PADS.length)]);
    setInputIndex(0);
    setActivePad(null);
    setWrongPad(null);
    setCompleted(0);
    setMode('watch');
    setPhase('playing');
  }, [clearTimers]);

  /* Ziggy plays the sequence back, then hands over. */
  useEffect(() => {
    if (phase !== 'playing' || mode !== 'watch' || sequence.length === 0) return;

    let cancelled = false;
    const ids: number[] = [];
    const gap = stepDelay(sequence.length);
    const lead = 620;

    sequence.forEach((pad, i) => {
      ids.push(
        window.setTimeout(() => {
          if (!cancelled) setActivePad(pad);
        }, lead + i * gap)
      );
      ids.push(
        window.setTimeout(() => {
          if (!cancelled) setActivePad(null);
        }, lead + i * gap + gap * 0.6)
      );
    });

    ids.push(
      window.setTimeout(() => {
        if (cancelled) return;
        setActivePad(null);
        setInputIndex(0);
        setMode('input');
      }, lead + sequence.length * gap)
    );

    return () => {
      cancelled = true;
      ids.forEach((id) => window.clearTimeout(id));
    };
  }, [phase, mode, sequence]);

  const handleTap = useCallback(
    (pad: number) => {
      if (phase !== 'playing' || mode !== 'input') return;

      setActivePad(pad);
      later(() => setActivePad(null), 220);

      if (pad !== sequence[inputIndex]) {
        setMode('watch'); // freeze input
        setWrongPad(pad);
        later(() => {
          setWrongPad(null);
          setPhase('done');
        }, 900);
        return;
      }

      if (inputIndex + 1 >= sequence.length) {
        // Round cleared — grow the sequence.
        setCompleted(sequence.length);
        setMode('watch');
        later(() => {
          setSequence((s) => [...s, Math.floor(Math.random() * PADS.length)]);
        }, 780);
        return;
      }

      setInputIndex((i) => i + 1);
    },
    [phase, mode, sequence, inputIndex, later]
  );

  const stars = completed >= 8 ? 3 : completed >= 5 ? 2 : 1;

  return (
    <GameShell
      title={t('simon.name')}
      color={color}
      icon={<Zap size={20} />}
      stats={
        phase === 'playing'
          ? [
              { label: t('score'), value: completed, pop: true },
              { label: t('simon.round'), value: sequence.length },
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
            emoji="🎵"
            name={t('simon.name')}
            description={t('simon.description')}
            howTo={t('simon.howTo')}
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
            {/* Watch / your turn banner */}
            <div className="flex justify-center mb-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.22 }}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold"
                  style={{
                    backgroundColor: mode === 'input' ? 'rgba(34,197,94,0.14)' : `${color}14`,
                    color: mode === 'input' ? '#16A34A' : color,
                  }}
                >
                  {mode === 'input' ? <Hand size={16} /> : <Eye size={16} />}
                  {mode === 'input' ? t('simon.yourTurn') : t('simon.watch')}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Pads */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {PADS.map((pad, i) => {
                const lit = activePad === i;
                const isWrong = wrongPad === i;

                return (
                  <motion.button
                    key={pad.color}
                    type="button"
                    onClick={() => handleTap(i)}
                    aria-label={`${t('simon.name')} ${i + 1}`}
                    disabled={mode !== 'input'}
                    whileTap={mode === 'input' ? { scale: 0.95 } : undefined}
                    animate={{
                      scale: lit ? 1.05 : 1,
                      x: isWrong ? [0, -10, 10, -8, 8, -4, 4, 0] : 0,
                    }}
                    transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                    className="relative aspect-square min-h-[96px] sm:min-h-[124px] rounded-3xl border-2 flex items-center justify-center overflow-hidden"
                    style={{
                      backgroundColor: isWrong
                        ? 'rgba(239,68,68,0.2)'
                        : lit
                          ? pad.color
                          : `${pad.color}1F`,
                      borderColor: isWrong
                        ? 'rgba(239,68,68,0.7)'
                        : lit
                          ? pad.color
                          : `${pad.color}59`,
                      boxShadow: lit ? `0 0 34px ${pad.color}99` : 'none',
                      opacity: mode === 'input' || lit ? 1 : 0.85,
                    }}
                  >
                    <motion.span
                      className="text-4xl sm:text-5xl"
                      aria-hidden="true"
                      animate={{ scale: lit ? 1.25 : 1, opacity: lit ? 1 : 0.55 }}
                      transition={{ duration: 0.18 }}
                    >
                      {pad.emoji}
                    </motion.span>
                  </motion.button>
                );
              })}
            </div>

            {/* Progress dots for the current round */}
            <div className="flex items-center justify-center gap-1.5 mt-6 flex-wrap" aria-hidden="true">
              {sequence.map((_, i) => (
                <motion.span
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: mode === 'input' && i < inputIndex ? color : `${color}33`,
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {phase === 'done' && (
          <GameResultScreen
            key="done"
            gameId="simon"
            color={color}
            stars={stars}
            scoreLabel={t('simon.round')}
            scoreValue={completed}
            onRestart={start}
          />
        )}
      </AnimatePresence>
    </GameShell>
  );
}

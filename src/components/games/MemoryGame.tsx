'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Brain } from 'lucide-react';
import {
  GameShell,
  GameStartScreen,
  GameResultScreen,
} from './GameShell';

const EMOJIS = ['🤖', '⭐', '🚀', '🎨', '🧩', '💡'];

interface Card {
  id: number;
  emoji: string;
  matched: boolean;
}

type Phase = 'start' | 'playing' | 'done';

function buildDeck(): Card[] {
  const deck: Card[] = [...EMOJIS, ...EMOJIS].map((emoji, i) => ({
    id: i,
    emoji,
    matched: false,
  }));
  // Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.map((c, i) => ({ ...c, id: i }));
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function MemoryGame({ color }: { color: string }) {
  const t = useTranslations('games');

  const [phase, setPhase] = useState<Phase>('start');
  const [deck, setDeck] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [wrongPair, setWrongPair] = useState<number[]>([]);
  const [justMatched, setJustMatched] = useState<number[]>([]);
  const lockRef = useRef(false);

  const matchedCount = deck.filter((c) => c.matched).length;

  /* Timer */
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  /* Win detection */
  useEffect(() => {
    if (phase === 'playing' && deck.length > 0 && matchedCount === deck.length) {
      const id = window.setTimeout(() => setPhase('done'), 700);
      return () => window.clearTimeout(id);
    }
  }, [phase, matchedCount, deck.length]);

  const start = useCallback(() => {
    setDeck(buildDeck());
    setFlipped([]);
    setMoves(0);
    setSeconds(0);
    setWrongPair([]);
    setJustMatched([]);
    lockRef.current = false;
    setPhase('playing');
  }, []);

  const handleFlip = useCallback(
    (index: number) => {
      if (lockRef.current) return;
      if (flipped.length >= 2) return;
      if (flipped.includes(index)) return;
      if (deck[index]?.matched) return;

      const next = [...flipped, index];
      setFlipped(next);

      if (next.length < 2) return;

      setMoves((m) => m + 1);
      const [a, b] = next;

      if (deck[a].emoji === deck[b].emoji) {
        setJustMatched([a, b]);
        setDeck((d) => d.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c)));
        window.setTimeout(() => {
          setFlipped([]);
          setJustMatched([]);
        }, 420);
      } else {
        lockRef.current = true;
        setWrongPair([a, b]);
        window.setTimeout(() => {
          setFlipped([]);
          setWrongPair([]);
          lockRef.current = false;
        }, 850);
      }
    },
    [flipped, deck]
  );

  /* Stars: fewer moves is better. Perfect run = 6 moves. */
  const stars = moves <= 10 ? 3 : moves <= 16 ? 2 : 1;

  return (
    <GameShell
      title={t('memory.name')}
      color={color}
      icon={<Brain size={20} />}
      stats={
        phase === 'playing'
          ? [
              { label: t('moves'), value: moves, pop: true },
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
            emoji="🧠"
            name={t('memory.name')}
            description={t('memory.description')}
            howTo={t('memory.howTo')}
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
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {deck.map((card, i) => {
                const isUp = flipped.includes(i) || card.matched;
                const isWrong = wrongPair.includes(i);
                const isNewMatch = justMatched.includes(i);

                return (
                  <motion.button
                    key={card.id}
                    type="button"
                    onClick={() => handleFlip(i)}
                    aria-label={isUp ? card.emoji : t('memory.name')}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{
                      opacity: 1,
                      scale: isNewMatch ? [1, 1.14, 1] : 1,
                      x: isWrong ? [0, -8, 8, -6, 6, 0] : 0,
                    }}
                    transition={{ delay: i * 0.02, duration: 0.35 }}
                    className="relative aspect-square min-h-[72px] sm:min-h-[84px] rounded-2xl focus-visible:outline-2"
                    style={{ perspective: 800 }}
                    disabled={card.matched}
                  >
                    <motion.div
                      className="relative w-full h-full"
                      style={{ transformStyle: 'preserve-3d' }}
                      animate={{ rotateY: isUp ? 180 : 0 }}
                      transition={{ duration: 0.45, ease: 'easeInOut' }}
                    >
                      {/* Back (face down) */}
                      <div
                        className="absolute inset-0 rounded-2xl flex items-center justify-center border"
                        style={{
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          background: `linear-gradient(150deg, ${color}22, ${color}0D)`,
                          borderColor: `${color}33`,
                        }}
                      >
                        <span className="text-2xl opacity-40" aria-hidden="true">
                          ❔
                        </span>
                      </div>

                      {/* Front (face up) */}
                      <div
                        className="absolute inset-0 rounded-2xl flex items-center justify-center border-2"
                        style={{
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                          backgroundColor: card.matched
                            ? 'rgba(34,197,94,0.14)'
                            : isWrong
                              ? 'rgba(239,68,68,0.12)'
                              : `${color}12`,
                          borderColor: card.matched
                            ? 'rgba(34,197,94,0.55)'
                            : isWrong
                              ? 'rgba(239,68,68,0.5)'
                              : `${color}40`,
                        }}
                      >
                        <span className="text-3xl sm:text-4xl" aria-hidden="true">
                          {card.emoji}
                        </span>
                      </div>
                    </motion.div>
                  </motion.button>
                );
              })}
            </div>

            <p className="text-center text-xs text-text-dim mt-5">
              {matchedCount / 2} / {EMOJIS.length}
            </p>
          </motion.div>
        )}

        {phase === 'done' && (
          <GameResultScreen
            key="done"
            color={color}
            stars={stars}
            scoreLabel={t('moves')}
            scoreValue={moves}
            extras={[{ label: t('time'), value: formatTime(seconds) }]}
            onRestart={start}
          />
        )}
      </AnimatePresence>
    </GameShell>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import { playSound } from '@/lib/sound';
import { buildPairDeck, type PairCard } from '../logic';
import Image from 'next/image';
import { FACE } from '@/lib/mascot';
import { Feedback, Hint, Stage, WOBBLE, alpha, useFinishIfEmpty, useGameRun, useTimers } from './shared';
import { useTilt } from '../stage/Toy';
import { Burst, SparkleIcon } from '../stage/Burst';
import { darken, lighten, rgba, strong } from '../stage/color';
import { cheer, ui } from '../ui-text';

function isShort(text: string) {
  return Array.from(text).length <= 3;
}

export function PairsMechanic({ content, color, locale, onFinish, onAnswer }: MechanicProps) {
  const pairs = content.kind === 'pairs' ? content.pairs : [];
  const total = pairs.length;
  const run = useGameRun(total, onFinish, onAnswer);
  const later = useTimers();
  useFinishIfEmpty(total, run.finish);

  const [deck, setDeck] = useState<PairCard[]>([]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(() => new Set());
  const [tone, setTone] = useState<'right' | 'almost' | null>(null);
  const [miss, setMiss] = useState<number[]>([]);

  // Shuffle on the client only, so server and client markup agree.
  useEffect(() => {
    setDeck(buildPairDeck(pairs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const found = matched.size;

  useEffect(() => {
    if (total > 0 && found === total) {
      playSound('win');
      later(() => run.finish(), 1100);
    }
  }, [found, total, later, run]);

  if (content.kind !== 'pairs') return null;

  const flip = (card: PairCard) => {
    if (open.length >= 2 || open.includes(card.id) || matched.has(card.pairId)) return;
    playSound('tap');
    const next = [...open, card.id];
    setOpen(next);
    if (next.length < 2) return;
    const [a, b] = next.map((id) => deck.find((c) => c.id === id)!);
    if (a.pairId === b.pairId) {
      run.answer(true);
      setTone('right');
      later(() => {
        setMatched((m) => new Set(m).add(a.pairId));
        setOpen([]);
      }, 380);
    } else {
      run.slip();
      setTone('almost');
      setMiss(next);
      later(() => {
        setOpen([]);
        setMiss([]);
      }, 1000);
    }
  };

  const n = deck.length;
  const cols = n <= 6 ? 'grid-cols-3' : n <= 16 ? 'grid-cols-4' : 'grid-cols-4 sm:grid-cols-5';

  return (
    <Stage color={color}>
      <div className="mb-2 flex items-center justify-center gap-2" dir="ltr">
        <span className="font-display text-xs font-bold uppercase tracking-wider" style={{ color: darken(strong(color), 0.1) }}>
          {ui('pairsFound', locale)}
        </span>
        <span className="flex items-center gap-1" aria-live="polite">
          <span className="sr-only">
            {found} / {total}
          </span>
          {Array.from({ length: total }, (_, i) => (
            <motion.span key={i} initial={false} animate={{ scale: i < found ? 1 : 0.7, rotate: i < found ? 0 : -30 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }} aria-hidden="true">
              <SparkleIcon size={18} color={i < found ? '#FBBF24' : alpha(color, '40')} />
            </motion.span>
          ))}
        </span>
      </div>
      <Hint say={ui('pairsHint', locale)}>{ui('pairsHint', locale)}</Hint>

      <div className={`mx-auto grid max-w-xl ${cols} gap-3 sm:gap-4`} dir="ltr" style={{ perspective: 1100 }}>
        {deck.map((card, i) => (
          <PairCardView
            key={card.id}
            card={card}
            index={i}
            color={color}
            locale={locale}
            faceUp={matched.has(card.pairId) || open.includes(card.id)}
            matched={matched.has(card.pairId)}
            wobble={miss.includes(card.id)}
            onFlip={() => flip(card)}
          />
        ))}
      </div>

      <div className="mt-4">
        <Feedback
          tone={tone}
          title={tone === 'right' ? cheer(found, locale) : tone === 'almost' ? ui('almost', locale) : undefined}
          color={color}
        />
      </div>
    </Stage>
  );
}

/** One memory card: a patterned back with Ziggy's medallion, flipping in 3D onto a paper face. */
function PairCardView({
  card,
  index,
  color,
  locale,
  faceUp,
  matched,
  wobble,
  onFlip,
}: {
  card: PairCard;
  index: number;
  color: string;
  locale: string;
  faceUp: boolean;
  matched: boolean;
  wobble: boolean;
  onFlip: () => void;
}) {
  const tilt = useTilt(faceUp ? 0 : 12);
  const base = strong(color);
  const depth = 6;
  return (
    <motion.button
      type="button"
      onClick={onFlip}
      disabled={matched}
      aria-label={faceUp ? card.text : `${ui('hiddenCard', locale)} ${index + 1}`}
      aria-pressed={faceUp}
      initial={{ opacity: 0, y: -60, rotateZ: index % 2 ? 8 : -8, scale: 0.7 }}
      animate={wobble ? { opacity: 1, y: 0, rotateZ: 0, scale: 1, ...WOBBLE } : { opacity: 1, y: matched ? 4 : 0, rotateZ: 0, scale: matched ? 0.95 : 1 }}
      transition={wobble ? undefined : { type: 'spring', stiffness: 260, damping: 18, delay: matched ? 0 : 0.05 + index * 0.045 }}
      whileTap={faceUp ? undefined : { scale: 0.92, y: 3 }}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      className="relative aspect-[4/5] min-h-[72px] rounded-[1.4rem] outline-none focus-visible:ring-4 focus-visible:ring-offset-2 disabled:cursor-default"
      style={{ ...tilt.style, transformStyle: 'preserve-3d', ['--tw-ring-color' as string]: alpha(color, '80') }}
    >
      {/* Shadow on the table */}
      <span className="pointer-events-none absolute inset-x-2 -bottom-2 h-4 rounded-full blur-[6px]" style={{ background: rgba(darken(color, 0.5), matched ? 0.15 : 0.32) }} aria-hidden="true" />
      <motion.span
        className="absolute inset-0 rounded-[1.4rem] [transform-style:preserve-3d]"
        initial={false}
        animate={{ rotateY: faceUp ? 180 : 0, scale: faceUp ? [1, 1.12, 1] : [1, 1.08, 1.0001] }}
        transition={{ rotateY: { type: 'spring', stiffness: 220, damping: 20 }, scale: { duration: 0.45, ease: 'easeOut' } }}
      >
        {/* Back */}
        <span
          className="absolute inset-0 grid place-items-center overflow-hidden rounded-[1.4rem] [backface-visibility:hidden]"
          style={{
            background: `radial-gradient(circle at 50% 38%, ${lighten(base, 0.25)} 0%, ${base} 60%, ${darken(base, 0.12)} 100%)`,
            boxShadow: `0 ${depth}px 0 ${darken(base, 0.35)}, inset 0 3px 0 rgba(255,255,255,0.45), inset 0 0 0 4px ${rgba('#FFFFFF', 0.85)}, inset 0 0 0 7px ${rgba(base, 1)}, inset 0 0 0 8px ${rgba('#FFFFFF', 0.35)}`,
          }}
          aria-hidden="true"
        >
          <span
            className="absolute inset-[9px] rounded-[1rem] opacity-40"
            style={{
              backgroundImage: `radial-gradient(${rgba('#FFFFFF', 0.9)} 1.4px, transparent 1.8px), radial-gradient(${rgba('#FFFFFF', 0.5)} 1px, transparent 1.4px)`,
              backgroundSize: '14px 14px, 14px 14px',
              backgroundPosition: '0 0, 7px 7px',
            }}
          />
          <span className="relative grid aspect-square w-[46%] place-items-center rounded-full bg-white/95 shadow-[0_3px_0_rgba(0,0,0,0.15),inset_0_-3px_0_rgba(0,0,0,0.06)]">
            <span className="relative block h-[86%] w-[86%] overflow-hidden rounded-full">
              <Image src={FACE} alt="" fill sizes="64px" className="object-cover" draggable={false} />
            </span>
          </span>
          <span className="absolute left-[10%] top-[6%] h-[18%] w-[40%] -rotate-12 rounded-full bg-white/25 blur-[2px]" />
        </span>
        {/* Face */}
        <span
          className="absolute inset-0 flex items-center justify-center rounded-[1.4rem] bg-[#FFFDF7] p-1.5 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{
            boxShadow: `0 ${depth}px 0 ${matched ? '#16A34A' : lighten(color, 0.3)}, inset 0 0 0 3px ${matched ? '#4ADE80' : lighten(color, 0.55)}, inset 0 -8px 16px ${rgba(color, 0.12)}`,
            backgroundImage: matched ? 'radial-gradient(circle at 50% 40%, #DCFCE7, #FFFDF7 70%)' : undefined,
          }}
          aria-hidden="true"
        >
          <span className={`font-extrabold leading-tight text-[#2A2340] break-words ${isShort(card.text) ? 'text-4xl drop-shadow-[0_3px_2px_rgba(0,0,0,0.12)] sm:text-5xl' : 'text-sm sm:text-base'}`}>{card.text}</span>
          {matched ? (
            <span className="absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full text-sm font-black text-white shadow-[0_2px_0_#15803D]" style={{ background: 'linear-gradient(160deg,#4ADE80,#16A34A)' }}>
              ✓
            </span>
          ) : null}
        </span>
      </motion.span>
      {matched ? <Burst fire={1} color={color} count={10} spread={80} /> : null}
    </motion.button>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { ChoiceItem } from '@/lib/arcade/types';
import { playSound } from '@/lib/sound';
import { ArcadeButton, Feedback, Prompt, WOBBLE } from './shared';
import { ToyTile, chunkyFace, type TileTone } from '../stage/Toy';
import { Burst } from '../stage/Burst';

const ENTER = { type: 'spring', stiffness: 260, damping: 19 } as const;
import { cheer, ui } from '../ui-text';
import { CountDots, useReadAloud } from '../read-aloud';

/** Split "🐑 mouton" into its leading picture and its word. */
function pictured(opt: string): [string, string] | null {
  const m = /^(\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic}|\ufe0f|\p{Emoji_Modifier})*)\s*(.*)$/u.exec(opt.trim());
  return m ? [m[1], m[2]] : null;
}

/**
 * One multiple-choice question (used by Choice and Dig). The parent keys it
 * per item, so its state resets each round.
 */
export function ChoiceQuestion({
  item,
  color,
  locale,
  round,
  isLast,
  onAnswer,
  onNext,
}: {
  item: ChoiceItem;
  color: string;
  locale: string;
  round: number;
  isLast: boolean;
  onAnswer: (right: boolean) => void;
  onNext: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  // Which answer Ziggy is reading aloud right now (lit up for pre-readers).
  const [reading, setReading] = useState<number | null>(null);
  const { little } = useReadAloud();
  const answered = picked !== null;
  const right = picked === item.answer;

  const pick = (i: number) => {
    if (answered) return;
    playSound('tap');
    setPicked(i);
    onAnswer(i === item.answer);
  };

  // Number keys 1–4 pick an answer; Enter goes on once answered.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      const n = Number.parseInt(e.key, 10);
      if (!answered && n >= 1 && n <= item.options.length) {
        e.preventDefault();
        pick(n - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const cols = item.options.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';

  return (
    <div>
      <Prompt visual={item.visual} text={item.prompt} color={color} say={item.options} onSpeak={(i) => setReading(i && i > 0 ? i - 1 : null)} />

      <div className={`grid grid-cols-1 ${cols} gap-x-3 gap-y-4`} role="group" aria-label={item.prompt}>
        {item.options.map((opt, i) => {
          const isAnswer = i === item.answer;
          const isPicked = i === picked;
          const showRight = answered && isAnswer;
          const dim = answered && !isAnswer && !isPicked;
          const lit = !answered && reading === i;
          const tone: TileTone = showRight ? 'right' : answered && isPicked ? 'oops' : lit ? 'lit' : 'idle';
          const pic = little ? pictured(opt) : null;
          return (
            <motion.div
              key={`${i}-${opt}`}
              className="relative"
              initial={{ opacity: 0, y: 26, rotateX: -35 }}
              animate={
                answered && isPicked && !isAnswer
                  ? { opacity: 1, y: 0, rotateX: 0, ...WOBBLE }
                  : { opacity: dim ? 0.5 : 1, y: 0, rotateX: 0, scale: showRight ? [1, 1.08, 1.03] : lit ? 1.04 : dim ? 0.97 : 1 }
              }
              transition={showRight ? { duration: 0.45, ease: 'easeOut' } : { ...ENTER, delay: answered ? 0 : 0.08 + i * 0.07 }}
              style={{ transformPerspective: 700 }}
            >
              <ToyTile
                color={color}
                tone={tone}
                onClick={() => pick(i)}
                disabled={answered}
                data-tv-autofocus={i === 0 && !answered ? '' : undefined}
                aria-label={`${ui('option', locale)} ${i + 1}: ${opt}`}
                aria-pressed={isPicked}
                className="w-full"
                faceClassName={`min-h-[68px] px-4 py-3 text-lg sm:text-xl font-extrabold text-center gap-2 ${pic ? 'min-h-[104px]' : ''}`}
              >
                <span
                  className="absolute start-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-sm font-extrabold"
                  style={showRight ? { background: 'linear-gradient(160deg,#4ADE80,#16A34A)', color: '#fff', boxShadow: '0 2px 0 #15803D' } : { ...chunkyFace(color), fontSize: 13 }}
                  aria-hidden="true"
                >
                  {showRight ? '✓' : i + 1}
                </span>
                <span className="relative flex flex-col items-center px-8" dir="auto">
                  {pic ? (
                    // Pre-readers: the picture is the answer, the word is just a caption.
                    <>
                      <span className="text-5xl leading-none drop-shadow-[0_3px_2px_rgba(0,0,0,0.15)]" aria-hidden="true">
                        {pic[0]}
                      </span>
                      <span className="mt-1 text-base font-bold text-[#6B6480]">{pic[1]}</span>
                    </>
                  ) : (
                    <span>{opt}</span>
                  )}
                  {little ? <CountDots text={opt} color={color} /> : null}
                </span>
              </ToyTile>
              {showRight ? <Burst fire={1} color={color} count={14} spread={120} /> : null}
            </motion.div>
          );
        })}
      </div>

      {/* Ziggy's word and the way on, side by side (stacked on phones) */}
      <div className="mt-5 flex min-h-[72px] flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Feedback
          tone={answered ? (right ? 'right' : 'almost') : null}
          title={answered ? (right ? cheer(round, locale) : ui('almost', locale)) : undefined}
          color={color}
          say={answered ? [right ? '' : `${ui('answerWas', locale)} ${item.options[item.answer]}.`, item.explain ?? ''].join(' ').trim() : undefined}
        >
          {answered && !right && (
            <>
              {ui('answerWas', locale)} <strong>{item.options[item.answer]}</strong>
            </>
          )}
          {answered && item.explain && <span className="mt-1 block font-medium text-[#5b5470]">{item.explain}</span>}
        </Feedback>
        {answered && (
          <motion.div initial={{ opacity: 0, scale: 0.7, x: -10 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 16, delay: 0.15 }}>
            <ArcadeButton color={color} onClick={onNext} autoFocus>
              {isLast ? ui('finish', locale) : ui('next', locale)} <span className="rtl:rotate-180" aria-hidden="true">→</span>
            </ArcadeButton>
          </motion.div>
        )}
      </div>
    </div>
  );
}

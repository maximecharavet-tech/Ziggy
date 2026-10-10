'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { ChoiceItem } from '@/lib/arcade/types';
import { playSound } from '@/lib/sound';
import { ArcadeButton, Feedback, POP, Prompt, SOFT_SHAKE, alpha } from './shared';
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

      <div className={`grid grid-cols-1 ${cols} gap-3`} role="group" aria-label={item.prompt}>
        {item.options.map((opt, i) => {
          const isAnswer = i === item.answer;
          const isPicked = i === picked;
          const showRight = answered && isAnswer;
          const dim = answered && !isAnswer && !isPicked;
          const lit = !answered && reading === i;
          return (
            <motion.button
              key={`${i}-${opt}`}
              type="button"
              onClick={() => pick(i)}
              disabled={answered}
              aria-label={`${ui('option', locale)} ${i + 1}: ${opt}`}
              aria-pressed={isPicked}
              initial={{ opacity: 0, y: 12 }}
              animate={
                answered && isPicked && !isAnswer
                  ? { opacity: 1, y: 0, ...SOFT_SHAKE }
                  : { opacity: dim ? 0.45 : 1, y: 0, scale: showRight || lit ? 1.05 : 1 }
              }
              whileTap={answered ? undefined : { scale: 0.96 }}
              transition={{ ...POP, delay: answered ? 0 : i * 0.04 }}
              className="relative min-h-[64px] rounded-3xl px-4 py-3 text-lg sm:text-xl font-extrabold text-text-body border-2 flex items-center justify-center gap-2 text-center disabled:cursor-default"
              style={{
                borderColor: showRight ? '#22C55E' : isPicked ? '#FBBF24' : lit ? color : alpha(color, '30'),
                boxShadow: lit ? `0 0 0 4px ${alpha(color, '40')}` : undefined,
                background: showRight
                  ? 'linear-gradient(135deg, #22C55E22, #22C55E0A)'
                  : `linear-gradient(135deg, ${alpha(color, '12')}, transparent)`,
              }}
            >
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-xs flex items-center justify-center font-bold"
                style={{ backgroundColor: alpha(color, '1A'), color }}
                aria-hidden="true"
              >
                {showRight ? '✓' : i + 1}
              </span>
              <span className="flex flex-col items-center px-8">
                {little && pictured(opt) ? (
                  // Pre-readers: the picture is the answer, the word is just a caption.
                  <>
                    <span className="text-5xl leading-none" aria-hidden="true">
                      {pictured(opt)![0]}
                    </span>
                    <span className="mt-1 text-base font-bold text-text-muted">{pictured(opt)![1]}</span>
                  </>
                ) : (
                  <span>{opt}</span>
                )}
                {little ? <CountDots text={opt} color={color} /> : null}
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-4">
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
          {answered && item.explain && <span className="block mt-1 font-medium text-text-muted">{item.explain}</span>}
        </Feedback>
      </div>

      <div className="flex justify-center mt-3 min-h-[56px]">
        {answered && (
          <ArcadeButton color={color} onClick={onNext} autoFocus>
            {isLast ? ui('finish', locale) : ui('next', locale)} →
          </ArcadeButton>
        )}
      </div>
    </div>
  );
}

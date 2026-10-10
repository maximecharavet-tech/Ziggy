'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import type { RunnerScene } from './runner/RunnerScene';
import { runnerLanes } from '../logic';
import { ArcadeButton, Feedback, Prompt, RoundProgress, Stage, alpha, useFinishIfEmpty, useGameRun, useTimers } from './shared';
import { cheer, ui } from '../ui-text';

type Verdict = { right: boolean; answer: string } | null;

/**
 * Lane runner. Phaser is imported lazily inside the effect, so this module is
 * safe to import anywhere; MechanicPlayer also loads it with ssr:false.
 */
export function RunnerMechanic({ content, color, locale, onFinish, onAnswer }: MechanicProps) {
  const items = content.kind === 'runner' ? content.items : [];
  const total = items.length;
  const run = useGameRun(total, onFinish, onAnswer);
  const later = useTimers();
  useFinishIfEmpty(total, run.finish);

  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RunnerScene | null>(null);
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [lane, setLane] = useState(1);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [failed, setFailed] = useState(false);

  const round = items[index] ? runnerLanes(items[index].options, items[index].answer) : null;

  // Latest values for Phaser's callbacks, which are bound once.
  const live = useRef({ index, round, total });
  useEffect(() => {
    live.current = { index, round, total };
  });

  const onGate = (laneTaken: number) => {
    const { index: i, round: r, total: t } = live.current;
    if (!r) return;
    const right = laneTaken === r.answer;
    run.answer(right);
    sceneRef.current?.feedback(right, r.answer);
    setVerdict({ right, answer: r.options[r.answer] });
    later(
      () => {
        setVerdict(null);
        if (i + 1 >= t) run.finish();
        else setIndex(i + 1);
      },
      right ? 1500 : 2600,
    );
  };
  const onGateRef = useRef(onGate);
  useEffect(() => {
    onGateRef.current = onGate;
  });

  // Boot Phaser once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || total === 0) return;
    let cancelled = false;
    let game: { destroy: (removeCanvas: boolean) => void } | null = null;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    import('./runner/RunnerScene')
      .then(({ createRunnerGame }) => {
        if (cancelled) return;
        const made = createRunnerGame(
          host,
          {
            onReady: () => setReady(true),
            onGate: (l) => onGateRef.current(l),
            onLane: (l) => setLane(l),
          },
          { color, calm },
        );
        game = made.game;
        sceneRef.current = made.scene;
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      sceneRef.current = null;
      game?.destroy(true);
    };
    // The game is created once; colour changes are not live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // Each round: send the gate labels to the scene.
  useEffect(() => {
    if (!ready || !round) return;
    sceneRef.current?.startRound(round.options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, index]);

  if (content.kind !== 'runner' || !round) return null;
  const item = items[index];

  // Fallback if Phaser could not start (very old browser): plain buttons.
  const pickDirect = (l: number) => {
    if (verdict) return;
    onGate(l);
  };

  return (
    <Stage color={color} className="!p-3 sm:!p-5">
      <RoundProgress index={index} total={total} color={color} locale={locale} />
      <Prompt visual={item.visual} text={item.prompt} color={color} />

      <div
        className="relative w-full h-[380px] sm:h-[440px] rounded-3xl overflow-hidden border-2 touch-none select-none"
        style={{ borderColor: alpha(color, '30') }}
      >
        <div ref={hostRef} className="absolute inset-0" role="img" aria-label={ui('runnerCanvas', locale)} />
        {!ready && !failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg-card/80">
            <motion.span
              className="text-5xl"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              aria-hidden="true"
            >
              👟
            </motion.span>
            <span className="text-sm font-bold text-text-muted">{ui('runnerLoading', locale)}</span>
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-3 p-4 bg-bg-card">
            {round.options.map((o, i) => (
              <ArcadeButton key={i} color={color} variant="soft" onClick={() => pickDirect(i)}>
                {o}
              </ArcadeButton>
            ))}
          </div>
        )}
      </div>

      {/* Lane controls (touch, mouse, keyboard) + screen-reader view of the gates */}
      <ul className="sr-only">
        {round.options.map((o, i) => (
          <li key={i}>
            {i + 1}. {o}
            {i === lane ? ` (${ui('selected', locale)})` : ''}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-center gap-4 mt-4" dir="ltr">
        <ArcadeButton color={color} variant="soft" ariaLabel={ui('left', locale)} onClick={() => sceneRef.current?.moveLane(-1)} className="!px-8 text-2xl">
          ◀
        </ArcadeButton>
        <div className="flex gap-1.5" aria-hidden="true">
          {round.options.map((_, i) => (
            <span key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: i === lane ? color : alpha(color, '33') }} />
          ))}
        </div>
        <ArcadeButton color={color} variant="soft" ariaLabel={ui('right', locale)} onClick={() => sceneRef.current?.moveLane(1)} className="!px-8 text-2xl">
          ▶
        </ArcadeButton>
      </div>

      <div className="mt-3">
        <Feedback
          tone={verdict ? (verdict.right ? 'right' : 'almost') : 'info'}
          title={verdict ? (verdict.right ? cheer(index, locale) : ui('almost', locale)) : undefined}
          color={color}
        >
          {verdict && !verdict.right ? (
            <>
              {ui('answerWas', locale)} <strong>{verdict.answer}</strong>
            </>
          ) : verdict ? (
            item.explain
          ) : (
            ui('runnerHint', locale)
          )}
        </Feedback>
      </div>
    </Stage>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import type { RunnerScene } from './runner/RunnerScene';
import { runnerLanes } from '../logic';
import { ArcadeButton, Feedback, Prompt, RoundProgress, Stage, useFinishIfEmpty, useGameRun, useTimers } from './shared';
import { cheer, ui } from '../ui-text';
import { MascotCutout } from '@/components/ziggy/Mascot';
import { ToyButton } from '../stage/Toy';
import { useStageTheme } from '../stage/StageTheme';
import { darken, lighten, rgba } from '../stage/color';

/** Same lane colours as the arches in the scene. */
const LANE_COLORS = ['#5FB6EA', '#F9A86B', '#A78BFA', '#4FC9C0'];

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
  const [reading, setReading] = useState<number | null>(null);
  const theme = useStageTheme(color);

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
          { color, calm, night: theme.night, sky: { top: theme.skyTop, bottom: theme.skyBottom } },
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
      <Prompt visual={item.visual} text={item.prompt} color={color} say={round.options} onSpeak={(i) => setReading(i && i > 0 ? i - 1 : null)} />
      <div className="relative w-full rounded-[1.8rem] p-1.5" style={{ background: `linear-gradient(180deg, ${lighten(color, 0.3)}, ${darken(color, 0.1)})`, boxShadow: `0 6px 0 ${darken(color, 0.35)}, 0 22px 36px -18px ${rgba(darken(color, 0.5), 0.6)}` }}>
        <div className="relative h-[clamp(340px,54vh,470px)] w-full touch-none select-none overflow-hidden rounded-[1.4rem]" style={{ background: `linear-gradient(180deg, ${theme.skyTop}, ${theme.skyBottom} 30%, ${theme.night ? '#211A55' : '#A8E392'} 30%)` }}>
          <div ref={hostRef} className="absolute inset-0" role="img" aria-label={ui('runnerCanvas', locale)} />
          {/* The arches' answers, in lane order, lit up while Ziggy reads them. */}
          <div className="pointer-events-none absolute inset-x-2 top-2 z-10 grid gap-2 sm:inset-x-3 sm:top-3" style={{ gridTemplateColumns: `repeat(${round.options.length}, minmax(0, 1fr))` }} dir="ltr" aria-hidden="true">
            {round.options.map((o, i) => {
              const tint = LANE_COLORS[i % LANE_COLORS.length];
              const on = reading === i || lane === i;
              return (
                <motion.span
                  key={`${index}-${i}`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: on ? -3 : 0, scale: reading === i ? 1.08 : 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 20, delay: i * 0.05 }}
                  className="flex min-h-[44px] items-center justify-center gap-1 rounded-2xl border-[3px] bg-white/95 px-2 py-1 text-center text-base font-extrabold text-[#2A2340] sm:text-lg"
                  style={{ borderColor: on ? tint : lighten(tint, 0.5), boxShadow: `0 ${on ? 5 : 3}px 0 ${on ? darken(tint, 0.2) : lighten(tint, 0.3)}` }}
                >
                  {lane === i ? <span className="text-xs" aria-hidden="true">🏃</span> : null}
                  <span className="truncate">{o}</span>
                </motion.span>
              );
            })}
          </div>
          {!ready && !failed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <motion.span className="block h-36 w-24" animate={{ y: [0, -16, 0], scaleY: [1, 1.05, 0.96, 1] }} transition={{ duration: 0.7, repeat: Infinity }} aria-hidden="true">
                <MascotCutout pose="stand" width={96} glow={false} />
              </motion.span>
              <span className="rounded-full bg-white/85 px-4 py-1.5 text-sm font-bold text-[#2A2340]">{ui('runnerLoading', locale)}</span>
            </div>
          )}
          {failed && (
            <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-3 bg-bg-card p-4">
              {round.options.map((o, i) => (
                <ArcadeButton key={i} color={color} variant="soft" onClick={() => pickDirect(i)}>
                  {o}
                </ArcadeButton>
              ))}
            </div>
          )}
        </div>
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
      <div className="mt-5 flex items-center justify-center gap-4" dir="ltr">
        <ToyButton color={color} variant="soft" size="lg" ariaLabel={ui('left', locale)} onClick={() => sceneRef.current?.moveLane(-1)} faceClassName="!px-9 text-2xl">
          ◀
        </ToyButton>
        <div className="flex gap-2" aria-hidden="true">
          {round.options.map((_, i) => (
            <motion.span key={i} animate={{ scale: i === lane ? 1.3 : 1 }} className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: i === lane ? LANE_COLORS[i % LANE_COLORS.length] : rgba(color, 0.2), boxShadow: i === lane ? `0 2px 0 ${darken(LANE_COLORS[i % LANE_COLORS.length], 0.3)}` : undefined }} />
          ))}
        </div>
        <ToyButton color={color} variant="soft" size="lg" ariaLabel={ui('right', locale)} onClick={() => sceneRef.current?.moveLane(1)} faceClassName="!px-9 text-2xl">
          ▶
        </ToyButton>
      </div>

      <div className="mt-3">
        <Feedback
          tone={verdict ? (verdict.right ? 'right' : 'almost') : 'info'}
          title={verdict ? (verdict.right ? cheer(index, locale) : ui('almost', locale)) : undefined}
          color={color}
          say={verdict && !verdict.right ? `${ui('answerWas', locale)} ${verdict.answer}` : undefined}
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

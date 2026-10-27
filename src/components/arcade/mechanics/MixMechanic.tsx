'use client';

import { useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import { playSound } from '@/lib/sound';
import { mixHex, readableOn, sameMultiset } from '../logic';
import { ArcadeButton, Feedback, Hint, POP, RoundProgress, SOFT_SHAKE, Stage, useFinishIfEmpty, useGameRun } from './shared';
import { Burst, SparkleIcon } from '../stage/Burst';
import { darken, lighten, rgba } from '../stage/color';
import css from '../stage/stage.module.css';

/** A glossy round blob of paint with a little thickness. */
function paintBlob(hex: string, depth: number): CSSProperties {
  return {
    background: `radial-gradient(circle at 34% 28%, ${lighten(hex, 0.55)} 0%, ${hex} 45%, ${darken(hex, 0.15)} 100%)`,
    boxShadow: `inset 0 -4px 8px ${rgba(darken(hex, 0.35), 0.35)}, inset 0 3px 0 rgba(255,255,255,0.45), 0 0 0 3px #FFFFFF, 0 ${depth}px 0 3px ${darken(hex, 0.25)}, 0 ${depth + 10}px 18px -6px ${rgba(darken(hex, 0.5), 0.45)}`,
  };
}
import { cheer, ui } from '../ui-text';
import { useSay } from '../read-aloud';

type Phase = 'play' | 'retry' | 'right' | 'shown';
type Paint = { id: string; name: string; hex: string };
type Target = { name: string; hex: string; recipe: string[] };

function MixRound({
  target,
  palette,
  color,
  locale,
  round,
  isLast,
  onSlip,
  onDone,
  onNext,
}: {
  target: Target;
  palette: Paint[];
  color: string;
  locale: string;
  round: number;
  isLast: boolean;
  onSlip: () => void;
  onDone: (right: boolean) => void;
  onNext: () => void;
}) {
  const max = Math.max(3, target.recipe.length);
  const [chosen, setChosen] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>('play');
  const [shake, setShake] = useState(0);
  const locked = phase === 'right' || phase === 'shown';

  const paint = (id: string) => palette.find((p) => p.id === id);
  const mixed = mixHex(chosen.map((id) => paint(id)?.hex ?? '#FFFFFF'));

  const say = useSay();
  const add = (p: Paint) => {
    say('mix-paint', p.name);
    if (locked || chosen.length >= max) return;
    playSound('pop');
    setChosen((c) => [...c, p.id]);
  };
  const removeAt = (i: number) => {
    if (locked) return;
    playSound('tap');
    setChosen((c) => c.filter((_, k) => k !== i));
  };

  const doMix = () => {
    if (locked || chosen.length === 0) return;
    if (sameMultiset(chosen, target.recipe)) {
      setPhase('right');
      onDone(true);
      return;
    }
    setShake((n) => n + 1);
    if (phase === 'play') {
      setPhase('retry');
      onSlip();
    } else {
      setPhase('shown');
      onDone(false);
      setChosen(target.recipe);
    }
  };

  const recipePaints = target.recipe.map(paint).filter((p): p is Paint => !!p);

  return (
    <div>
      <div className="mb-6 flex items-end justify-center gap-3 sm:gap-10" dir="ltr">
        {/* Target: a glossy blob of the colour to make */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wide text-text-muted">{ui('target', locale)}</span>
          <motion.div
            initial={{ scale: 0.4, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 13 }}
            className="relative"
            role="img"
            aria-label={`${ui('target', locale)}: ${target.name}`}
          >
            <span className={`block h-20 w-20 rounded-full sm:h-28 sm:w-28 ${css.bob}`} style={{ ...paintBlob(target.hex, 7), '--lift': '-5px', '--dur': '3.6s', '--r0': '-3deg', '--r1': '3deg' } as CSSProperties} />
            <SparkleIcon size={22} color="#FFFFFF" className={`absolute right-1 top-0 ${css.twinkle}`} />
          </motion.div>
          <span className="rounded-full bg-white/90 px-3 py-0.5 text-base font-extrabold text-[#2A2340] shadow-[0_2px_0_rgba(0,0,0,0.06)] dark:bg-bg-card dark:text-text-body">{target.name}</span>
        </div>

        <span className="mb-14 text-2xl text-text-muted/60 sm:mb-16 sm:text-3xl" aria-hidden="true">
          ⟵
        </span>

        {/* The cauldron */}
        <motion.div key={shake} animate={shake ? SOFT_SHAKE : undefined} className="flex flex-col items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wide text-text-muted">{ui('yourMix', locale)}</span>
          <div className="relative h-[112px] w-[136px] sm:h-[136px] sm:w-[168px]" role="img" aria-label={ui('cauldron', locale)}>
            {/* glow of the brew */}
            {mixed ? <span className={`absolute -inset-4 rounded-full ${css.breathe}`} style={{ background: `radial-gradient(closest-side, ${rgba(mixed, 0.45)}, transparent)` }} aria-hidden="true" /> : null}
            {/* feet */}
            <span className="absolute bottom-0 left-[22%] h-4 w-5 rounded-b-lg bg-[#2B2F3A]" aria-hidden="true" />
            <span className="absolute bottom-0 right-[22%] h-4 w-5 rounded-b-lg bg-[#2B2F3A]" aria-hidden="true" />
            {/* pot */}
            <div
              className="absolute inset-x-[4%] bottom-2 top-4 overflow-hidden rounded-b-[46%] rounded-t-[30%]"
              style={{ background: 'radial-gradient(120% 90% at 30% 20%, #6B7280 0%, #374151 45%, #1F2430 100%)', boxShadow: 'inset -10px -10px 20px rgba(0,0,0,0.35), inset 8px 6px 14px rgba(255,255,255,0.12)' }}
            >
              <motion.div
                className="absolute inset-x-0 bottom-0"
                initial={false}
                animate={{ height: `${chosen.length ? 18 + (chosen.length / max) * 66 : 0}%` }}
                transition={{ type: 'spring', stiffness: 140, damping: 16 }}
              >
                <motion.div className="absolute inset-0" initial={false} animate={{ backgroundColor: mixed ?? '#374151' }} transition={{ duration: 0.5 }} />
                <span className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/25" aria-hidden="true" />
                {/* Wavy surface */}
                <span className="absolute -top-2 left-0 h-4 w-[200%] overflow-hidden" aria-hidden="true">
                  <svg className={`h-full w-full ${css.wave}`} viewBox="0 0 400 16" preserveAspectRatio="none">
                    <path d="M0 8 Q25 0 50 8 T100 8 T150 8 T200 8 T250 8 T300 8 T350 8 T400 8 V16 H0Z" fill={mixed ?? '#374151'} />
                    <path d="M0 8 Q25 0 50 8 T100 8 T150 8 T200 8 T250 8 T300 8 T350 8 T400 8" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
                  </svg>
                </span>
                {chosen.length > 0
                  ? [0, 1, 2].map((b) => (
                      <span
                        key={b}
                        className={`absolute bottom-2 h-2.5 w-2.5 rounded-full bg-white/60 ${css.rise}`}
                        style={{ left: `${28 + b * 20}%`, '--dur': `${1.8 + b * 0.5}s`, '--delay': `${b * 0.6}s`, '--h': '-46px' } as CSSProperties}
                        aria-hidden="true"
                      />
                    ))
                  : null}
              </motion.div>
            </div>
            {/* rim */}
            <span className="absolute inset-x-0 top-1 h-7 rounded-[50%]" style={{ background: 'linear-gradient(180deg, #9CA3AF, #4B5563 60%, #2B2F3A)', boxShadow: '0 3px 6px rgba(0,0,0,0.3), inset 0 2px 0 rgba(255,255,255,0.45)' }} aria-hidden="true" />
            <span className="absolute inset-x-[9%] top-2.5 h-4 rounded-[50%] bg-[#111827]/80" aria-hidden="true" />
            {/* Drops falling in */}
            <AnimatePresence>
              {chosen.length > 0 ? (
                <motion.span
                  key={chosen.length}
                  className="absolute left-1/2 top-0 h-5 w-4 -translate-x-1/2 rounded-[50%_50%_50%_50%/60%_60%_40%_40%]"
                  style={{ backgroundColor: paint(chosen[chosen.length - 1])?.hex ?? '#fff', boxShadow: 'inset -2px -3px 0 rgba(0,0,0,0.15), inset 2px 2px 0 rgba(255,255,255,0.5)' }}
                  initial={{ y: -70, opacity: 1, scale: 1 }}
                  animate={{ y: 18, opacity: [1, 1, 0], scale: [1, 1, 0.4] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, ease: 'easeIn' }}
                  aria-hidden="true"
                />
              ) : null}
            </AnimatePresence>
            {phase === 'right' ? <Burst fire={round + 1} color={mixed ?? color} count={18} spread={130} className="!top-[30%]" /> : null}
          </div>
          <div className="flex min-h-[44px] gap-1.5">
            <AnimatePresence>
              {chosen.map((id, i) => {
                const p = paint(id);
                return (
                  <motion.button
                    key={`${id}-${i}`}
                    type="button"
                    onClick={() => removeAt(i)}
                    disabled={locked}
                    aria-label={`${ui('remove', locale)} ${p?.name ?? id}`}
                    initial={{ scale: 0, y: -20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0 }}
                    whileTap={{ scale: 0.85 }}
                    transition={POP}
                    className="h-11 w-11 rounded-full disabled:cursor-default"
                    style={paintBlob(p?.hex ?? '#cccccc', 3)}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {!locked && (
        <>
          <Hint say={`${ui('target', locale)} : ${target.name}. ${ui('mixHint', locale)}`}>{ui('mixHint', locale)}</Hint>
          <div className="mb-5 flex flex-wrap justify-center gap-3 sm:gap-4" role="group" aria-label={ui('mixHint', locale)}>
            {palette.map((p, i) => (
              <motion.button
                key={p.id}
                type="button"
                onClick={() => add(p)}
                disabled={chosen.length >= max}
                aria-label={`${ui('add', locale)} ${p.name}`}
                initial={{ opacity: 0, y: 24, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                whileTap={{ scale: 0.88, y: 4 }}
                whileHover={{ y: -5, rotate: -4 }}
                transition={{ ...POP, delay: 0.05 * i }}
                className="flex flex-col items-center gap-1.5 rounded-2xl outline-none focus-visible:ring-4 disabled:opacity-50"
              >
                <span className="relative grid h-16 w-16 place-items-center rounded-full text-xl font-black" style={{ ...paintBlob(p.hex, 6), color: readableOn(p.hex) }} aria-hidden="true">
                  <span className="relative grid h-7 w-7 place-items-center rounded-full bg-white/35">+</span>
                </span>
                <span className="mt-2 text-xs font-bold text-text-body">{p.name}</span>
              </motion.button>
            ))}
          </div>
          <div className="flex items-end justify-center gap-3">
            <ArcadeButton color={color} variant="soft" onClick={() => setChosen([])} disabled={chosen.length === 0}>
              {ui('empty', locale)}
            </ArcadeButton>
            <ArcadeButton color={color} onClick={doMix} disabled={chosen.length === 0}>
              🪄 {ui('mix', locale)}
            </ArcadeButton>
          </div>
        </>
      )}

      <div className="mt-5 flex min-h-[72px] flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Feedback
          tone={phase === 'right' ? 'right' : phase === 'retry' || phase === 'shown' ? 'almost' : null}
          title={phase === 'right' ? cheer(round, locale) : phase === 'retry' ? ui('tryAgain', locale) : phase === 'shown' ? ui('almost', locale) : undefined}
          color={color}
        >
          {phase === 'shown' && (
            <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
              {ui('recipe', locale)}
              {recipePaints.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  {i > 0 && <span aria-hidden="true">+</span>}
                  <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: p.hex }} aria-hidden="true" />
                  <strong>{p.name}</strong>
                </span>
              ))}
            </span>
          )}
        </Feedback>
        {locked && (
          <ArcadeButton color={color} onClick={onNext} autoFocus>
            {isLast ? ui('finish', locale) : ui('next', locale)} →
          </ArcadeButton>
        )}
      </div>
    </div>
  );
}

export function MixMechanic({ content, color, locale, onFinish, onAnswer }: MechanicProps) {
  const targets = content.kind === 'mix' ? content.targets : [];
  const palette = content.kind === 'mix' ? content.palette : [];
  const total = targets.length;
  const run = useGameRun(total, onFinish, onAnswer);
  const [index, setIndex] = useState(0);
  useFinishIfEmpty(total, run.finish);

  const target = targets[index];
  if (content.kind !== 'mix' || !target) return null;

  const next = () => {
    if (index + 1 >= total) run.finish();
    else setIndex((i) => i + 1);
  };

  return (
    <Stage color={color}>
      <RoundProgress index={index} total={total} color={color} locale={locale} />
      <AnimatePresence mode="wait">
        <motion.div key={index} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
          <MixRound
            target={target}
            palette={palette}
            color={color}
            locale={locale}
            round={index}
            isLast={index + 1 >= total}
            onSlip={run.slip}
            onDone={run.answer}
            onNext={next}
          />
        </motion.div>
      </AnimatePresence>
    </Stage>
  );
}

'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import { playSound } from '@/lib/sound';
import { shuffle } from '../logic';
import { Feedback, Hint, POP, RoundProgress, Stage, WOBBLE, useFinishIfEmpty, useGameRun, useTimers } from './shared';
import { ToyTile } from '../stage/Toy';
import { Burst } from '../stage/Burst';
import { darken, lighten, mix, rgba } from '../stage/color';
import css from '../stage/stage.module.css';

const BIN_TINTS = ['#5FB6EA', '#F9A86B', '#A78BFA', '#4FC9C0', '#F472B6', '#7FC85C'];
import { cheer, ui } from '../ui-text';
import { useSay } from '../read-aloud';

type SortItem = { label: string; emoji: string; bin: string; id: number };

export function SortMechanic({ content, color, locale, onFinish, onAnswer }: MechanicProps) {
  const bins = content.kind === 'sort' ? content.bins : [];
  const rawItems = content.kind === 'sort' ? content.items : [];
  const total = rawItems.length;
  const run = useGameRun(total, onFinish, onAnswer);
  const later = useTimers();
  useFinishIfEmpty(total, run.finish);

  const [items] = useState<SortItem[]>(() => shuffle(rawItems.map((it, id) => ({ ...it, id }))));
  const [placed, setPlaced] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const say = useSay();
  const [feedback, setFeedback] = useState<{ tone: 'right' | 'almost'; item: SortItem } | null>(null);
  const [wiggleBin, setWiggleBin] = useState<{ id: string; n: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pop, setPop] = useState<{ id: string; n: number } | null>(null);

  const remaining = items.filter((it) => placed[it.id] === undefined);
  const doneCount = total - remaining.length;
  const active = remaining.find((it) => it.id === selected) ?? remaining[0];

  useEffect(() => {
    if (total > 0 && doneCount === total) {
      playSound('win');
      later(() => run.finish(), 1200);
    }
  }, [doneCount, total, later, run]);

  const drop = (binId: string) => {
    if (!active || busy) return;
    const right = active.bin === binId;
    run.answer(right);
    setFeedback({ tone: right ? 'right' : 'almost', item: active });
    if (!right) {
      setWiggleBin((w) => ({ id: binId, n: (w?.n ?? 0) + 1 }));
      later(() => setWiggleBin(null), 450);
      setBusy(true);
      // Let the child see where it really goes, then tidy it away.
      later(() => {
        setPlaced((p) => ({ ...p, [active.id]: active.bin }));
        setBusy(false);
      }, 900);
    } else {
      setPlaced((p) => ({ ...p, [active.id]: active.bin }));
      setPop((q) => ({ id: binId, n: (q?.n ?? 0) + 1 }));
    }
    setSelected(null);
  };

  // 1–9 drop into a bin.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= bins.length) {
        e.preventDefault();
        drop(bins[n - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (content.kind !== 'sort') return null;

  const binOf = (id: string) => bins.find((b) => b.id === id);
  const fbBin = feedback ? binOf(feedback.item.bin) : undefined;

  return (
    <Stage color={color}>
      <RoundProgress index={doneCount} total={total} color={color} locale={locale} />
      <Hint say={ui('sortHint', locale)}>{ui('sortHint', locale)}</Hint>

      {/* Item tray: the chosen item floats up, ready to be dropped */}
      <div className="mb-6 flex min-h-[112px] flex-wrap items-end justify-center gap-3" role="group" aria-label={ui('sortHint', locale)}>
        <AnimatePresence>
          {remaining.map((it) => {
            const isActive = active?.id === it.id;
            return (
              <motion.div
                key={it.id}
                layout
                initial={{ opacity: 0, scale: 0.5, y: -30 }}
                animate={{ opacity: isActive ? 1 : 0.8, scale: isActive ? 1.1 : 0.88, y: isActive ? -8 : 0 }}
                exit={{ opacity: 0, scale: 0.3, y: 90, rotate: 25, transition: { duration: 0.35, ease: 'easeIn' } }}
                transition={POP}
                className="relative"
              >
                {isActive ? <span className={`pointer-events-none absolute -inset-2 rounded-[1.8rem] ${css.breathe}`} style={{ background: `radial-gradient(closest-side, ${rgba(color, 0.35)}, transparent)` }} aria-hidden="true" /> : null}
                <ToyTile
                  color={color}
                  tone={isActive ? 'picked' : 'idle'}
                  onClick={() => {
                    playSound('tap');
                    say('sort-item', it.label);
                    setSelected(it.id);
                  }}
                  aria-pressed={isActive}
                  aria-label={`${it.label}${isActive ? `, ${ui('selected', locale)}` : ''}`}
                  faceClassName="min-h-[80px] min-w-[80px] flex-col gap-0.5 px-3 py-2"
                >
                  <span className={`relative text-4xl leading-none drop-shadow-[0_3px_2px_rgba(0,0,0,0.15)] ${isActive ? css.bob : ''}`} style={{ '--lift': '-4px', '--dur': '1.6s' } as CSSProperties} aria-hidden="true">
                    {it.emoji}
                  </span>
                  <span className="relative max-w-[96px] truncate text-xs font-bold">{it.label}</span>
                </ToyTile>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Boxes: open toy crates with real depth */}
      <div className={`grid gap-x-3 gap-y-5 ${bins.length >= 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`} dir="ltr">
        {bins.map((bin, bi) => {
          const inside = items.filter((it) => placed[it.id] === bin.id);
          const wiggle = wiggleBin?.id === bin.id;
          const highlight = feedback?.tone === 'almost' && busy && feedback.item.bin === bin.id;
          const tint = mix(BIN_TINTS[bi % BIN_TINTS.length], color, 0.25);
          const deep = darken(tint, 0.3);
          return (
            <motion.button
              key={bin.id}
              type="button"
              onClick={() => drop(bin.id)}
              disabled={!active || busy}
              aria-label={`${ui('bin', locale)} ${bi + 1}: ${bin.label}${active ? ` — ${active.label}` : ''}`}
              initial={{ opacity: 0, y: 30 }}
              animate={wiggle ? { opacity: 1, y: 0, ...WOBBLE } : { opacity: 1, y: 0, scale: highlight ? 1.06 : 1 }}
              whileHover={!active || busy ? undefined : { y: -4 }}
              whileTap={{ scale: 0.95, y: 3 }}
              transition={{ ...POP, delay: wiggle ? 0 : 0.1 + bi * 0.06 }}
              className="group relative flex min-h-[150px] flex-col justify-end rounded-[1.6rem] pt-8 outline-none focus-visible:ring-4 disabled:cursor-default"
              style={{ ['--tw-ring-color' as string]: rgba(tint, 0.6) }}
            >
              {/* Inside of the box */}
              <span className="absolute inset-x-2 top-3 h-14 rounded-t-[1.2rem]" style={{ background: `linear-gradient(180deg, ${darken(tint, 0.42)}, ${darken(tint, 0.2)})` }} aria-hidden="true" />
              {/* What is already in it, peeking over the front */}
              <span className="absolute inset-x-3 top-1 flex flex-wrap justify-center gap-0.5 text-2xl" aria-hidden="true">
                <AnimatePresence>
                  {inside.slice(-6).map((it) => (
                    <motion.span key={it.id} initial={{ y: -70, scale: 0.6, rotate: -20, opacity: 0 }} animate={{ y: 0, scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 13 }} className="drop-shadow-[0_2px_1px_rgba(0,0,0,0.25)]">
                      {it.emoji}
                    </motion.span>
                  ))}
                </AnimatePresence>
              </span>
              {/* Front of the box */}
              <span
                className="relative flex min-h-[96px] flex-col items-center justify-center gap-1 rounded-b-[1.6rem] rounded-t-[0.9rem] px-2 pb-2 pt-3"
                style={{
                  background: `linear-gradient(180deg, ${lighten(tint, 0.2)} 0%, ${tint} 60%, ${darken(tint, 0.08)} 100%)`,
                  boxShadow: `0 7px 0 ${deep}, inset 0 3px 0 rgba(255,255,255,0.5), 0 0 0 ${highlight ? 4 : 0}px #4ADE80, 0 18px 26px -14px ${rgba(deep, 0.6)}`,
                }}
              >
                <span className="absolute inset-x-3 top-1.5 h-2 rounded-full bg-white/30" aria-hidden="true" />
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-3xl shadow-[0_3px_0_rgba(0,0,0,0.12),inset_0_-3px_0_rgba(0,0,0,0.05)]" aria-hidden="true">
                  {bin.emoji}
                </span>
                <span className="rounded-full bg-white/90 px-3 py-0.5 text-sm font-extrabold text-[#2A2340] sm:text-base">{bin.label}</span>
              </span>
              {pop?.id === bin.id ? <Burst fire={pop.n} color={tint} count={12} spread={100} className="!top-[30%]" /> : null}
            </motion.button>
          );
        })}
      </div>

      <div className="mt-4">
        <Feedback
          tone={feedback?.tone ?? null}
          title={feedback ? (feedback.tone === 'right' ? cheer(doneCount, locale) : ui('almost', locale)) : undefined}
          color={color}
        >
          {feedback?.tone === 'almost' && fbBin && (
            <>
              {feedback.item.emoji} {feedback.item.label} {ui('goesIn', locale)} {fbBin.emoji} <strong>{fbBin.label}</strong>
            </>
          )}
        </Feedback>
      </div>
    </Stage>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MechanicProps } from '@/lib/arcade/types';
import { playSound } from '@/lib/sound';
import { shuffle } from '../logic';
import { Feedback, Hint, POP, RoundProgress, SOFT_SHAKE, Stage, alpha, useFinishIfEmpty, useGameRun, useTimers } from './shared';
import { cheer, ui } from '../ui-text';

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
  const [feedback, setFeedback] = useState<{ tone: 'right' | 'almost'; item: SortItem } | null>(null);
  const [wiggleBin, setWiggleBin] = useState<{ id: string; n: number } | null>(null);
  const [busy, setBusy] = useState(false);

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
      <Hint>{ui('sortHint', locale)}</Hint>

      {/* Item tray */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 min-h-[96px] mb-5" role="group" aria-label={ui('sortHint', locale)}>
        <AnimatePresence>
          {remaining.map((it) => {
            const isActive = active?.id === it.id;
            return (
              <motion.button
                key={it.id}
                type="button"
                layout
                onClick={() => {
                  playSound('tap');
                  setSelected(it.id);
                }}
                aria-pressed={isActive}
                aria-label={`${it.label}${isActive ? `, ${ui('selected', locale)}` : ''}`}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: isActive ? 1 : 0.7, scale: isActive ? 1.08 : 0.92, y: isActive ? -4 : 0 }}
                exit={{ opacity: 0, scale: 0.4, y: 40 }}
                whileTap={{ scale: 0.95 }}
                transition={POP}
                className="min-w-[72px] min-h-[72px] rounded-3xl px-3 py-2 flex flex-col items-center justify-center gap-0.5 border-2 bg-bg-card"
                style={{
                  borderColor: isActive ? color : alpha(color, '2E'),
                  boxShadow: isActive ? `0 12px 26px ${alpha(color, '35')}` : 'none',
                }}
              >
                <span className="text-4xl leading-none" aria-hidden="true">
                  {it.emoji}
                </span>
                <span className="text-xs font-bold text-text-body max-w-[96px] truncate">{it.label}</span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Bins */}
      <div className={`grid gap-3 ${bins.length >= 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`} dir="ltr">
        {bins.map((bin, bi) => {
          const inside = items.filter((it) => placed[it.id] === bin.id);
          const wiggle = wiggleBin?.id === bin.id;
          const highlight = feedback?.tone === 'almost' && busy && feedback.item.bin === bin.id;
          return (
            <motion.button
              key={bin.id}
              type="button"
              onClick={() => drop(bin.id)}
              disabled={!active || busy}
              aria-label={`${ui('bin', locale)} ${bi + 1}: ${bin.label}${active ? ` — ${active.label}` : ''}`}
              animate={wiggle ? { ...SOFT_SHAKE } : { scale: highlight ? 1.05 : 1 }}
              whileTap={{ scale: 0.96 }}
              transition={POP}
              className="min-h-[120px] rounded-3xl p-3 flex flex-col items-center justify-start gap-1 border-2 border-dashed disabled:cursor-default"
              style={{
                borderColor: highlight ? '#22C55E' : alpha(color, '55'),
                background: `linear-gradient(170deg, ${alpha(color, '1A')}, ${alpha(color, '06')})`,
              }}
            >
              <span className="text-4xl" aria-hidden="true">
                {bin.emoji}
              </span>
              <span className="text-sm sm:text-base font-extrabold text-text-body">{bin.label}</span>
              <span className="flex flex-wrap justify-center gap-0.5 text-xl min-h-[28px]" aria-hidden="true">
                <AnimatePresence>
                  {inside.map((it) => (
                    <motion.span key={it.id} initial={{ scale: 0, y: -20 }} animate={{ scale: 1, y: 0 }} transition={POP}>
                      {it.emoji}
                    </motion.span>
                  ))}
                </AnimatePresence>
              </span>
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

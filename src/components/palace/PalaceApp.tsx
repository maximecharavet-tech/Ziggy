'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Footprints, Sparkles, RotateCcw, ArrowRight } from 'lucide-react';
import { makeRound, palaceStars, itemsFor, MAX_LEVEL, ROOMS, type Stop } from '@/lib/palace/palace';
import { recordGameResult } from '@/lib/progress';
import { playSound } from '@/lib/sound';
import { ZiggyAvatar } from '@/components/ziggy/Mascot';
import { EASE_OUT } from '@/lib/motion';

type Phase = 'intro' | 'place' | 'pause' | 'walk' | 'done';
const LEVEL_KEY = 'ziggy:palace-level';

/**
 * The memory palace: place things in the rooms of Ziggy's house, imagining
 * each one doing something silly there — then walk through again and find
 * them. Missed rooms are shown kindly; the next walk is a level up or down to
 * keep it just hard enough.
 */
export function PalaceApp() {
  const t = useTranslations('palace');
  const [phase, setPhase] = useState<Phase>('intro');
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState<Stop[]>([]);
  const [i, setI] = useState(0);
  const [found, setFound] = useState<boolean[]>([]);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(LEVEL_KEY));
      if (saved >= 1 && saved <= MAX_LEVEL) setLevel(saved);
    } catch {}
  }, []);

  const start = (lvl = level) => {
    playSound('tap');
    setRound(makeRound(lvl, Date.now() & 0xffffffff));
    setI(0);
    setFound([]);
    setPicked(null);
    setPhase('place');
  };

  const nextPlace = () => {
    playSound('pop');
    if (i + 1 < round.length) setI(i + 1);
    else {
      setI(0);
      setPhase('pause');
    }
  };

  const choose = (item: string) => {
    if (picked) return;
    const right = item === round[i].item;
    setPicked(item);
    playSound(right ? 'correct' : 'wrong');
    const nextFound = [...found, right];
    setFound(nextFound);
    setTimeout(
      () => {
        setPicked(null);
        if (i + 1 < round.length) setI(i + 1);
        else finish(nextFound);
      },
      right ? 700 : 1500
    );
  };

  const finish = (f: boolean[]) => {
    const hits = f.filter(Boolean).length;
    const stars = palaceStars(hits, f.length);
    recordGameResult('palace', hits, stars);
    // Just hard enough: up a level after a perfect walk, down after a hard one.
    const next = stars === 3 ? Math.min(MAX_LEVEL, level + 1) : hits / f.length < 0.5 ? Math.max(1, level - 1) : level;
    setLevel(next);
    try {
      window.localStorage.setItem(LEVEL_KEY, String(next));
    } catch {}
    playSound(stars >= 2 ? 'win' : 'star');
    setPhase('done');
  };

  const stop = round[i];

  return (
    <div className="mx-auto max-w-3xl">
      {/* The house: rooms light up as the walk goes */}
      {phase !== 'intro' && (
        <div className="mb-6 flex flex-wrap justify-center gap-2" dir="ltr">
          {round.map((s, k) => {
            const visited = phase === 'done' || (phase === 'walk' ? k < i : phase === 'pause' || k <= i);
            const current = (phase === 'place' || phase === 'walk') && k === i;
            const state = phase === 'walk' || phase === 'done' ? found[k] : undefined;
            return (
              <motion.div
                key={s.room.id}
                animate={{ scale: current ? 1.12 : 1, opacity: visited || current ? 1 : 0.45 }}
                transition={{ type: 'spring', duration: 0.4, bounce: 0.3 }}
                className="relative flex h-14 w-14 flex-col items-center justify-center rounded-2xl border-2 text-2xl"
                style={{
                  borderColor: current ? '#F59E0B' : state === true ? '#22C55E' : state === false ? '#F2647B' : 'var(--color-border)',
                  backgroundColor: current ? 'rgba(245,158,11,0.12)' : 'var(--color-bg-card)',
                }}
                title={t(`rooms.${s.room.id}`)}
              >
                {s.room.emoji}
                {k < round.length - 1 && <span className="absolute -right-2 top-1/2 h-0.5 w-2 bg-border" aria-hidden="true" />}
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence mode="wait">
        {phase === 'intro' && (
          <motion.div key="intro" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-3xl border border-border/50 glass-strong p-7 text-center">
            <div className="mx-auto flex max-w-md flex-wrap justify-center gap-2 text-3xl" aria-hidden="true">
              {ROOMS.map((r, k) => (
                <motion.span key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.06 }}>
                  {r.emoji}
                </motion.span>
              ))}
            </div>
            <p className="mx-auto mt-5 max-w-lg text-text-muted">{t('intro')}</p>
            <ol className="mx-auto mt-5 max-w-md space-y-2 text-start">
              {(['step1', 'step2', 'step3'] as const).map((k, n) => (
                <li key={k} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-apricot/20 text-sm font-bold text-[#B7862C]">{n + 1}</span>
                  <span className="text-text-body">{t(k)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm font-bold text-text-dim">{t('level', { level, count: itemsFor(level) })}</p>
            <button type="button" onClick={() => start()} className="press mt-5 inline-flex items-center gap-2 rounded-full gradient-green-cta px-7 py-4 text-lg font-bold text-white">
              <Footprints size={20} /> {t('start')}
            </button>
          </motion.div>
        )}

        {phase === 'place' && stop && (
          <motion.div key={`place-${i}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3, ease: EASE_OUT }} className="rounded-3xl border border-border/50 glass-strong p-7 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#B7862C]">{t('room_n', { n: i + 1, total: round.length })}</p>
            <h2 className="mt-1 font-display text-3xl font-bold text-text-body">
              {stop.room.emoji} {t(`rooms.${stop.room.id}`)}
            </h2>
            <div className="relative mx-auto mt-6 flex h-44 w-44 items-center justify-center rounded-[2rem] bg-gradient-to-br from-[#FFF4E2] to-blush/60 dark:from-[#2a1f12] dark:to-[#3a2222]">
              <span className="absolute text-[5.5rem] opacity-15" aria-hidden="true">{stop.room.emoji}</span>
              <motion.span
                className="relative text-[5.5rem]"
                initial={{ scale: 0, rotate: -30, y: -60 }}
                animate={{ scale: 1, rotate: [0, -12, 12, -6, 0], y: [0, -12, 0] }}
                transition={{ scale: { type: 'spring', bounce: 0.5, duration: 0.6 }, rotate: { delay: 0.5, duration: 1.2, repeat: Infinity, repeatDelay: 0.8 }, y: { delay: 0.5, duration: 1.2, repeat: Infinity, repeatDelay: 0.8 } }}
              >
                {stop.item}
              </motion.span>
            </div>
            <p className="mx-auto mt-6 max-w-sm text-lg font-semibold text-text-body">{t(`imagine.${i % 4}`)}</p>
            <button type="button" onClick={nextPlace} className="press mt-6 inline-flex items-center gap-2 rounded-full gradient-green-cta px-7 py-3.5 font-bold text-white">
              <Sparkles size={18} /> {t('imagined')}
            </button>
          </motion.div>
        )}

        {phase === 'pause' && (
          <motion.div key="pause" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="rounded-3xl border border-border/50 glass-strong p-8 text-center">
            <ZiggyAvatar size={72} className="mx-auto" />
            <h2 className="mt-4 font-display text-2xl font-bold text-text-body">{t('pause_title')}</h2>
            <p className="mx-auto mt-2 max-w-md text-text-muted">{t('pause_text')}</p>
            <button type="button" onClick={() => setPhase('walk')} className="press mt-6 inline-flex items-center gap-2 rounded-full gradient-green-cta px-7 py-3.5 font-bold text-white">
              <Footprints size={18} /> {t('walk')}
            </button>
          </motion.div>
        )}

        {phase === 'walk' && stop && (
          <motion.div key={`walk-${i}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3, ease: EASE_OUT }} className="rounded-3xl border border-border/50 glass-strong p-7 text-center">
            <h2 className="font-display text-3xl font-bold text-text-body">
              {stop.room.emoji} {t(`rooms.${stop.room.id}`)}
            </h2>
            <p className="mt-2 text-text-muted">{t('what_here')}</p>
            <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
              {stop.choices.map((c) => {
                const isPicked = picked === c;
                const isAnswer = picked && c === stop.item;
                return (
                  <motion.button
                    key={c}
                    type="button"
                    onClick={() => choose(c)}
                    animate={isPicked && c !== stop.item ? { x: [0, -6, 6, -3, 3, 0] } : isAnswer ? { scale: [1, 1.1, 1] } : {}}
                    className="press flex h-24 items-center justify-center rounded-3xl border-2 text-5xl"
                    style={{
                      borderColor: isAnswer ? '#22C55E' : isPicked ? '#F59E0B' : 'var(--color-border)',
                      backgroundColor: isAnswer ? 'rgba(34,197,94,0.12)' : 'var(--color-bg-card)',
                    }}
                  >
                    {c}
                  </motion.button>
                );
              })}
            </div>
            <p className="mt-4 h-6 font-bold">
              {picked && (picked === stop.item ? <span className="text-green">✨ {t('found')}</span> : <span className="text-[#B45309]">🌱 {t('not_yet', { item: stop.item })}</span>)}
            </p>
          </motion.div>
        )}

        {phase === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="rounded-3xl border border-border/50 glass-strong p-8 text-center">
            <p className="text-5xl">{found.every(Boolean) ? '🏆' : '🌱'}</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-text-body">{t('done_title')}</h2>
            <p className="mt-2 text-lg font-bold text-green">{t('score', { found: found.filter(Boolean).length, total: found.length })}</p>
            <div className="mx-auto mt-5 flex flex-wrap justify-center gap-2" dir="ltr">
              {round.map((s, k) => (
                <span key={s.room.id} className={`rounded-2xl border px-3 py-2 text-2xl ${found[k] ? 'border-green/40 bg-green/10' : 'border-apricot/50 bg-apricot/10'}`}>
                  {s.room.emoji}
                  {s.item}
                </span>
              ))}
            </div>
            <p className="mx-auto mt-5 max-w-md rounded-2xl bg-apricot/15 px-4 py-3 text-sm font-semibold text-[#8a5a2b] dark:text-[#F3D3A8]">💡 {t('tip')}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => start(level)} className="press inline-flex items-center gap-2 rounded-full gradient-green-cta px-6 py-3 font-bold text-white">
                <ArrowRight size={16} className="rtl:rotate-180" /> {t('next_walk', { count: itemsFor(level) })}
              </button>
              <button type="button" onClick={() => setPhase('intro')} className="press inline-flex items-center gap-2 rounded-full border border-border/60 bg-bg-card px-6 py-3 font-bold text-text-body">
                <RotateCcw size={16} /> {t('how')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

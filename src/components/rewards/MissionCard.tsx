'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Check, Star, ArrowRight, Target } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { missionFor, isDone, readToday, readStreak, currentStreak, dayKey, MISSION_EVENT, type Mission } from '@/lib/mission';
import { GAMES } from '@/lib/games';
import { EASE_OUT } from '@/lib/motion';

type State = { mission: Mission; done: boolean; streak: number };

/**
 * Today's mission and the streak of days in a row. Reads the device only, so
 * it renders after mount (the server cannot know the child's day).
 */
export function MissionCard({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('mission');
  const tg = useTranslations('games');
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    const read = () => {
      const day = dayKey();
      const mission = missionFor(day);
      setState({ mission, done: isDone(mission, readToday(), day), streak: currentStreak(readStreak(), day) });
    };
    read();
    window.addEventListener(MISSION_EVENT, read);
    window.addEventListener('focus', read);
    return () => {
      window.removeEventListener(MISSION_EVENT, read);
      window.removeEventListener('focus', read);
    };
  }, []);

  if (!state) return <div className={compact ? 'h-[92px]' : 'h-[148px]'} aria-hidden="true" />;

  const { mission, done, streak } = state;
  const game = GAMES.find((g) => g.id === mission.gameId);
  const color = game?.color ?? '#0EA5E9';
  // Activities that live outside the games catalogue have their own page.
  const APPS: Record<string, { name: string; href: '/lab' | '/palais' | '/memo' }> = {
    lab: { name: t('lab'), href: '/lab' },
    palace: { name: t('palace'), href: '/palais' },
    memo: { name: t('memo'), href: '/memo' },
  };
  const app = APPS[mission.gameId];
  const gameName = app ? app.name : tg(`${mission.gameId}.name`);
  const href = app ? app.href : (`/games/${mission.gameId}` as '/games/memory');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
      className="relative overflow-hidden rounded-3xl border p-5 sm:p-6"
      style={{
        borderColor: `${color}40`,
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 12%, var(--color-bg-card)), var(--color-bg-card))`,
      }}
    >
      <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-sheen" aria-hidden="true" />
      <div className="relative flex flex-wrap items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg" style={{ backgroundColor: color }}>
          <AnimatePresence mode="wait">
            {done ? (
              <motion.span key="done" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.5 }}>
                <Check size={24} strokeWidth={3} />
              </motion.span>
            ) : (
              <motion.span key="todo" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <Target size={22} />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color }}>
            {t('title')}
          </p>
          <p className="font-display text-lg sm:text-xl font-bold text-text-body">
            {done ? t('done') : t('goal', { stars: mission.stars, game: gameName })}
          </p>
          {!compact && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-text-muted">
              {Array.from({ length: mission.stars }, (_, i) => (
                <Star key={i} size={13} className="text-apricot fill-apricot" />
              ))}
              <span className="ms-1">{done ? t('come_back') : t('hint')}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold ${streak > 0 ? 'bg-[#FF7A1A]/15 text-[#E8590C]' : 'bg-border/40 text-text-dim'}`}
            title={t('streak_hint')}
          >
            <Flame size={16} className={streak > 0 ? 'fill-[#FF9A3C] animate-pulse' : ''} />
            {t('streak', { count: streak })}
          </span>
          {!done && (
            <Link
              href={href}
              className="press inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white shadow-md"
              style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 75%, #000))` }}
            >
              {t('go')} <ArrowRight size={15} className="rtl:rotate-180" />
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

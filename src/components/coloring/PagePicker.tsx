'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Printer } from 'lucide-react';
import { useSay } from '@/components/arcade/read-aloud';
import { tr } from '@/lib/i18n-text';
import { playSound } from '@/lib/sound';
import { PAGES, THEMES } from '@/coloring/pages';
import { T } from '@/coloring/text';
import type { ColoringPage, ThemeId } from '@/coloring/types';
import { PageArt } from './PageArt';
import { printBlank } from './PrintDialog';
import { TiltCard } from './TiltCard';

/** Theme chips + animated cards of every colouring page. */
export function PagePicker({ locale, onPick }: { locale: string; onPick: (page: ColoringPage) => void }) {
  const [theme, setTheme] = useState<ThemeId | 'all'>('all');
  const reduce = useReducedMotion();
  const say = useSay();
  const pages = theme === 'all' ? PAGES : PAGES.filter((p) => p.theme === theme);

  const chip = (id: ThemeId | 'all', emoji: string, name: string, color: string) => {
    const on = theme === id;
    return (
      <motion.button
        key={id}
        type="button"
        aria-pressed={on}
        whileTap={reduce ? undefined : { scale: 0.92 }}
        onClick={() => {
          setTheme(id);
          playSound('tap');
          say('theme', name);
        }}
        className={`flex min-h-14 shrink-0 items-center gap-2 rounded-full px-4 font-display text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky sm:px-5 sm:text-lg ${
          on ? 'text-white shadow-lg' : 'bg-white/80 text-text-body ring-1 ring-black/5 hover:bg-white dark:bg-white/10 dark:ring-white/10'
        }`}
        style={on ? { backgroundColor: color, boxShadow: `0 10px 24px -12px ${color}` } : undefined}
      >
        <span className="text-2xl" aria-hidden="true">
          {emoji}
        </span>
        {name}
      </motion.button>
    );
  };

  return (
    <div>
      <div role="group" aria-label="Thèmes" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 pt-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
        {chip('all', '🎨', tr(T.all, locale), '#8B5CF6')}
        {THEMES.map((t) => chip(t.id, t.emoji, tr(t.name, locale), t.color))}
      </div>

      <motion.ul layout={!reduce} className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
        {pages.map((p, i) => {
          const th = THEMES.find((t) => t.id === p.theme)!;
          const title = tr(p.title, locale);
          return (
            <motion.li key={p.id} layout={!reduce} className="list-none">
              <TiltCard delay={Math.min(i, 10) * 0.04} className="h-full">
                <div className="relative h-full overflow-hidden rounded-[1.75rem] bg-white shadow-[0_18px_40px_-24px_rgba(76,52,160,0.6)] ring-1 ring-black/5 dark:bg-[#17142f] dark:ring-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      playSound('pop');
                      onPick(p);
                    }}
                    aria-label={`${tr(T.open, locale)} : ${title}`}
                    className="block w-full text-start focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sky"
                  >
                    <span className="relative block aspect-square overflow-hidden bg-white p-2.5">
                      <PageArt page={p} className="h-full w-full overflow-hidden rounded-2xl" />
                      <PageArt page={p} model className="absolute inset-2.5 overflow-hidden rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    </span>
                    <span className="flex items-center gap-2 px-3 pb-3 pt-1">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl" style={{ backgroundColor: `${th.color}1f` }} aria-hidden="true">
                        {p.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 font-display text-[0.95rem] font-semibold leading-tight text-text-body sm:text-base">{title}</span>
                        <span className="mt-0.5 block text-xs tracking-wider text-[#F59E0B]" aria-label={`${tr(T.level, locale)} ${p.level}`}>
                          {'★'.repeat(p.level)}
                          <span className="text-black/15 dark:text-white/20">{'★'.repeat(3 - p.level)}</span>
                        </span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void printBlank(p, locale)}
                    aria-label={`${tr(T.printBlank, locale)} : ${title}`}
                    title={tr(T.printBlank, locale)}
                    className="absolute end-2 top-2 hidden h-14 w-14 place-items-center rounded-full bg-white/90 text-[#5B3FA8] opacity-0 shadow-md ring-1 ring-black/5 transition hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky group-hover:opacity-100 [@media(hover:hover)]:grid"
                  >
                    <Printer size={22} aria-hidden="true" />
                  </button>
                </div>
              </TiltCard>
            </motion.li>
          );
        })}
      </motion.ul>
    </div>
  );
}

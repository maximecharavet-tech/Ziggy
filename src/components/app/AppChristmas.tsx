'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { Snow } from '@/components/santa/Snow';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/** Christmas is shown in the app until Epiphany. */
export const CHRISTMAS_END = Date.parse('2027-01-07T00:00:00+01:00');

const T = {
  title: { fr: 'C’est bientôt Noël !', en: 'Christmas is coming!' },
  text: { fr: 'Le Père Noël, ses lutins farceurs et leur atelier t’attendent.', en: 'Santa, his prankster elves and their workshop are waiting for you.' },
} satisfies Record<string, L>;

const DOORS: { href: '/pere-noel' | '/lutins' | '/lutins/jeux'; emoji: string; label: L; from: string; to: string }[] = [
  { href: '/pere-noel', emoji: '🎅', label: { fr: 'Le village du Père Noël', en: 'Santa’s village' }, from: '#c92a2a', to: '#ff6b6b' },
  { href: '/lutins', emoji: '🧝', label: { fr: 'Les Lutins Farceurs', en: 'The Prankster Elves' }, from: '#2b8a3e', to: '#69db7c' },
  { href: '/lutins/jeux', emoji: '🧸', label: { fr: 'Les jeux des lutins', en: 'The elves’ games' }, from: '#5f3dc4', to: '#9775fa' },
];

/** The app home's Christmas corner: Santa's space, the elves and their games (seasonal). */
export function AppChristmas() {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [on, setOn] = useState(false);
  useEffect(() => setOn(Date.now() < CHRISTMAS_END), []);
  if (!on) return null;
  return (
    <section aria-labelledby="app-noel" className="relative mt-7 overflow-hidden rounded-[2rem] bg-[radial-gradient(120%_120%_at_20%_0%,#3b2385_0%,#17124a_55%,#0b0a26_100%)] p-5 text-white shadow-[0_24px_60px_-24px_rgba(20,10,60,0.8)] ring-1 ring-white/10 md:mt-10 md:p-8">
      <Snow count={reduced ? 0 : 24} />
      <div className="relative flex items-center gap-3">
        <h2 id="app-noel" className="font-display text-2xl font-bold md:text-4xl">
          🎄 {tr(T.title, locale)}
        </h2>
        <SayButton texts={[tr(T.title, locale), tr(T.text, locale), ...DOORS.map((d) => tr(d.label, locale))]} locale={locale} size="md" className="shrink-0" />
      </div>
      <p className="relative mt-1 text-white/85 md:text-xl">{tr(T.text, locale)}</p>
      <ul className="relative mt-4 grid gap-3 sm:grid-cols-3 md:mt-6 md:gap-5">
        {DOORS.map((d) => (
          <li key={d.href}>
            <Link
              href={d.href}
              className="flex min-h-20 items-center gap-3 rounded-[1.5rem] px-4 py-3 font-display text-xl font-bold shadow-[0_6px_0_rgba(0,0,0,0.25)] ring-1 ring-white/15 transition-transform active:translate-y-1 active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/70 md:min-h-28 md:text-2xl"
              style={{ background: `linear-gradient(150deg, ${d.from}, ${d.to})` }}
            >
              <span aria-hidden="true" className="text-4xl drop-shadow md:text-5xl">
                {d.emoji}
              </span>
              <span className="leading-tight">{tr(d.label, locale)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

'use client';

import type { CSSProperties } from 'react';
import { Link } from '@/i18n/navigation';
import { tr } from '@/lib/i18n-text';
import { haptic } from '@/lib/app-bridge';
import { fx, toy } from '@/components/create/fx/toy';
import { ALBUM_TEXT } from '@/lib/journal/lines';

/** Two big doors on the app home: the album, and Ziggy's story of the day. */
export function JournalShortcuts({ locale }: { locale: string }) {
  const doors = [
    { href: '/mon-carnet' as const, emoji: '📒', label: ALBUM_TEXT.title, color: '#E8A65A' },
    { href: { pathname: '/mon-carnet' as const, query: { raconte: '1' } }, emoji: '🌙', label: ALBUM_TEXT.tellMyDay, color: '#5B4FD0' },
  ];
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2 md:mt-8 md:gap-5" data-tv-row="">
      {doors.map((d) => (
        <li key={d.emoji}>
          <Link
            href={d.href}
            onClick={() => haptic('light')}
            className={`${fx.toy} ${fx.sheen} flex min-h-16 items-center gap-3 rounded-[1.6rem] px-5 font-display text-xl font-bold md:min-h-20 md:text-2xl`}
            style={toy(d.color, { depth: 7 }) as CSSProperties}
          >
            <span aria-hidden="true" className="text-3xl md:text-4xl">
              {d.emoji}
            </span>
            {tr(d.label, locale)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

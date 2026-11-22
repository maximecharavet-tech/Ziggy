'use client';

import type { MouseEvent } from 'react';
import { tr } from '@/lib/i18n-text';
import { StickerPop } from '@/components/ui/fx';
import { WORLD_INFO, type JournalEntry } from '@/lib/journal/types';
import { ALBUM_TEXT } from '@/lib/journal/lines';

/** "Aujourd’hui", "Hier", or a short date. */
export function dayLabel(at: number, locale: string, now = Date.now()): string {
  const d = new Date(at);
  const today = new Date(now);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(today) - start(d)) / 86_400_000);
  if (days === 0) return tr(ALBUM_TEXT.today, locale);
  if (days === 1) return tr(ALBUM_TEXT.yesterday, locale);
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/** A stable little tilt per sticker (no flicker between renders). */
export function tiltOf(id: string): number {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return ((h % 9) - 4) * 1.2;
}

/** The picture of an entry: its own image when there is one, else its emoji on a soft tinted disc. */
export function StickerArt({ entry, size = 'md' }: { entry: Pick<JournalEntry, 'emoji' | 'thumb' | 'world' | 'color'>; size?: 'md' | 'lg' }) {
  const color = entry.color ?? WORLD_INFO[entry.world].color;
  const box = size === 'lg' ? 'h-40 w-40 sm:h-52 sm:w-52' : 'h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20';
  if (entry.thumb) {
    return (
      <span className={`relative block ${box}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- device-made picture (data: or blob: URL) */}
        <img src={entry.thumb} alt="" draggable={false} className="h-full w-full rounded-2xl border-[3px] border-white bg-white object-cover shadow-[0_4px_8px_rgba(60,40,20,0.22)]" />
        <span aria-hidden="true" className={`absolute -bottom-2 -end-2 grid place-items-center rounded-full bg-white shadow ${size === 'lg' ? 'h-14 w-14 text-3xl' : 'h-8 w-8 text-lg'}`}>
          {entry.emoji}
        </span>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center rounded-full border-[3px] border-white leading-none shadow-[0_4px_8px_rgba(60,40,20,0.22)] ${box} ${size === 'lg' ? 'text-[5.5rem] sm:text-[7rem]' : 'text-[2.6rem] sm:text-5xl'}`}
      style={{ background: `radial-gradient(circle at 35% 30%, #ffffff, ${color}55 70%, ${color}88)` }}
    >
      {entry.emoji}
    </span>
  );
}

/** One sticker on an album page: pops in, tilted, with its title and day. */
export function Sticker({ entry, locale, index, onTap }: { entry: JournalEntry; locale: string; index: number; onTap: (entry: JournalEntry, e: MouseEvent<HTMLButtonElement>) => void }) {
  const title = tr(entry.title, locale);
  const day = dayLabel(entry.at, locale);
  return (
    <button
      type="button"
      onClick={(e) => onTap(entry, e)}
      aria-label={`${title}. ${day}`}
      className="group relative flex min-h-[8.5rem] w-full flex-col items-center justify-start gap-1.5 rounded-2xl p-1.5 text-center outline-none transition-transform focus-visible:ring-4 focus-visible:ring-sky/60 active:scale-95"
    >
      <StickerPop delay={Math.min(index, 6) * 0.07} rotate={tiltOf(entry.id)} sound={index === 0 ? 'plop' : false}>
        <StickerArt entry={entry} />
      </StickerPop>
      <span dir="auto" className="line-clamp-2 max-w-full break-words font-display text-[0.95rem] font-bold leading-tight text-[#4a3423] sm:text-base">{title}</span>
      <span className="rounded-full bg-[#f3e6cf] px-2 py-0.5 text-[0.7rem] font-bold text-[#8a6a45]">{day}</span>
    </button>
  );
}

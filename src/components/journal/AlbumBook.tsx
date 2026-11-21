'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { tr } from '@/lib/i18n-text';
import { playSound } from '@/lib/sound';
import { useAppShell } from '@/lib/use-app-shell';
import { Link } from '@/i18n/navigation';
import { FlipBook } from '@/components/create/fx/FlipBook';
import { fx, toy } from '@/components/create/fx/toy';
import { MascotCutout } from '@/components/ziggy/Mascot';
import { SayButton } from '@/components/arcade/read-aloud';
import { ALBUM_TEXT, EXPLORE_LINKS } from '@/lib/journal/lines';
import type { JournalEntry } from '@/lib/journal/types';
import { Sticker } from './Sticker';

/** Stickers per album page. */
export const PER_PAGE = 6;

type Page = { kind: 'stickers'; entries: JournalEntry[] } | { kind: 'invite' } | { kind: 'blank' };

const PAPER = '#fffaf0';

/**
 * The album itself: pages of stickers that really turn (two side by side on
 * wide screens, one on phones), by swipe, the ◀ ▶ buttons, or the arrow keys
 * (the TV remote moves the focus instead, and OK presses the buttons). The
 * last page is always a gentle invitation to explore: never an empty slot.
 */
export function AlbumBook({ entries, locale, onTap, resetKey }: { entries: JournalEntry[]; locale: string; onTap: (e: JournalEntry, ev: MouseEvent<HTMLButtonElement>) => void; resetKey: string }) {
  const shell = useAppShell();
  const [spread, setSpread] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setSpread(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const pages = useMemo<Page[]>(() => {
    const out: Page[] = [];
    for (let k = 0; k < entries.length; k += PER_PAGE) out.push({ kind: 'stickers', entries: entries.slice(k, k + PER_PAGE) });
    out.push({ kind: 'invite' });
    return out;
  }, [entries]);
  const views = spread ? Math.ceil(pages.length / 2) : pages.length;

  // A new filter opens the book on its first page; a resize keeps the reader on the same stickers.
  useEffect(() => setI(0), [resetKey]);
  const wasSpread = useRef(spread);
  useEffect(() => {
    if (wasSpread.current === spread) return;
    wasSpread.current = spread;
    setI((n) => (spread ? Math.floor(n / 2) : n * 2));
  }, [spread]);
  const at = Math.min(i, views - 1);

  const go = (n: number) => {
    if (n < 0 || n >= views || n === at) return;
    setI(n);
    playSound('whoosh', { volume: 0.5 });
  };
  const goRef = useRef(go);
  goRef.current = go;
  const atRef = useRef(at);
  atRef.current = at;

  // Arrow keys turn the pages (not on TV, where the arrows move the focus).
  useEffect(() => {
    if (shell.tv) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || el?.closest('input, textarea, select, [contenteditable="true"], [aria-modal="true"]')) return;
      const rtl = document.documentElement.dir === 'rtl';
      if (e.key === 'ArrowRight') goRef.current(atRef.current + (rtl ? -1 : 1));
      else if (e.key === 'ArrowLeft') goRef.current(atRef.current + (rtl ? 1 : -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shell.tv]);

  // Swipe: a clear sideways move turns the page (a vertical move still scrolls the page).
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const swiped = useRef(false);
  const onDown = (e: PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    swiped.current = false;
  };
  const onUp = (e: PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    swiped.current = true;
    const rtl = document.documentElement.dir === 'rtl';
    go(at + ((dx < 0) !== rtl ? 1 : -1));
  };

  const render = (n: number) => <AlbumPage page={pages[n] ?? { kind: 'blank' }} n={n} locale={locale} onTap={onTap} />;

  return (
    <div>
      <div
        className="relative mx-auto max-w-5xl touch-pan-y select-none"
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => (swipe.current = null)}
        onClickCapture={(e) => {
          // The finger that just swiped must not also press a sticker.
          if (swiped.current) {
            e.stopPropagation();
            e.preventDefault();
            swiped.current = false;
          }
        }}
      >
        <div className="rounded-[2rem] bg-[linear-gradient(160deg,#e8a65a,#c9783a)] p-2.5 shadow-[0_10px_0_#9a5524,0_40px_60px_-30px_rgba(120,60,20,0.75)] sm:p-3">
          {/* the binding rings */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-3 z-20 flex justify-center gap-10 md:hidden">
            {[0, 1, 2].map((k) => (
              <span key={k} className="h-6 w-3 rounded-full border-[3px] border-[#b9b2a8] bg-[#ece6dc] shadow" />
            ))}
          </div>
          <div className="relative h-[31rem] overflow-hidden rounded-[1.5rem] shadow-[inset_0_0_0_1px_rgba(120,90,40,0.15)] sm:h-[33rem] md:h-[30rem]" style={{ background: PAPER }}>
            <FlipBook page={at} spread={spread} left={(n) => render(n * 2)} right={(n) => render(n * 2 + 1)} single={render} paper={PAPER} />
            {spread ? (
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-14 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(90,60,20,0.16)_45%,rgba(90,60,20,0.26)_50%,rgba(90,60,20,0.16)_55%,transparent)]" />
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4" data-tv-row="">
        <button
          type="button"
          disabled={at === 0}
          onClick={() => go(at - 1)}
          aria-label={tr(ALBUM_TEXT.prev, locale)}
          title={tr(ALBUM_TEXT.prev, locale)}
          className={`${fx.toy} ${fx.light} grid h-16 w-16 place-items-center rounded-full text-2xl font-black`}
        >
          <span aria-hidden="true" className="rtl:-scale-x-100">
            ◀
          </span>
        </button>
        <div className="flex max-w-[11rem] flex-wrap justify-center gap-1.5" role="img" aria-label={`${tr(ALBUM_TEXT.page, locale)} ${at + 1} / ${views}`}>
          {Array.from({ length: Math.min(views, 12) }, (_, n) => (
            <span key={n} className={`h-2.5 rounded-full transition-all duration-300 ${n === Math.min(at, 11) ? 'w-7 bg-[#c9783a]' : 'w-2.5 bg-[#c9783a]/30'}`} />
          ))}
        </div>
        <button
          type="button"
          disabled={at >= views - 1}
          onClick={() => go(at + 1)}
          aria-label={tr(ALBUM_TEXT.next, locale)}
          title={tr(ALBUM_TEXT.next, locale)}
          className={`${fx.toy} ${fx.sheen} grid h-16 w-16 place-items-center rounded-full text-2xl font-black`}
          style={toy('#E8A65A', { depth: 7 }) as CSSProperties}
        >
          <span aria-hidden="true" className="rtl:-scale-x-100">
            ▶
          </span>
        </button>
      </div>
    </div>
  );
}

function AlbumPage({ page, n, locale, onTap }: { page: Page; n: number; locale: string; onTap: (e: JournalEntry, ev: MouseEvent<HTMLButtonElement>) => void }) {
  const lines = 'repeating-linear-gradient(180deg, transparent 0 31px, rgba(150,120,80,0.10) 31px 32px)';
  if (page.kind === 'blank') {
    return <div className="h-full" style={{ background: `${lines}, ${PAPER}` }} />;
  }
  if (page.kind === 'invite') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-5 text-center sm:px-6" style={{ background: `${lines}, ${PAPER}` }}>
        <div className="h-24 w-20 sm:h-28 sm:w-24">
          <MascotCutout pose="wave" width={96} glow={false} className="h-full [&_img]:h-full [&_img]:w-auto" />
        </div>
        <div className="flex items-center gap-2">
          <p className="font-display text-2xl font-bold leading-tight text-[#4a3423] sm:text-[1.7rem]">{tr(ALBUM_TEXT.explore, locale)}</p>
          <SayButton texts={[tr(ALBUM_TEXT.explore, locale), tr(ALBUM_TEXT.exploreSub, locale)]} locale={locale} size="sm" />
        </div>
        <p className="text-sm text-[#8a6a45] sm:text-base">{tr(ALBUM_TEXT.exploreSub, locale)}</p>
        <ul className="mt-1 grid w-full max-w-sm grid-cols-2 gap-2.5">
          {EXPLORE_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`${fx.toy} flex min-h-14 items-center justify-center gap-1.5 rounded-2xl px-2 font-display text-[0.95rem] font-bold leading-tight`}
                style={toy(l.color, { depth: 5 }) as CSSProperties}
              >
                <span aria-hidden="true" className="text-xl">
                  {l.emoji}
                </span>
                {tr(l.label, locale)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="relative h-full px-3 pb-4 pt-5 sm:px-5" style={{ background: `${lines}, ${PAPER}` }}>
      <ul className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
        {page.entries.map((e, k) => (
          <li key={e.id}>
            <Sticker entry={e} locale={locale} index={k} onTap={onTap} />
          </li>
        ))}
      </ul>
      <span aria-hidden="true" className="absolute bottom-2 end-4 font-display text-xs font-bold text-[#b08a5a]">
        {n + 1}
      </span>
    </div>
  );
}

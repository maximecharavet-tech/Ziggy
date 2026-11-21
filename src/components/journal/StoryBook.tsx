'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { tr } from '@/lib/i18n-text';
import { playSound } from '@/lib/sound';
import { stopSpeaking } from '@/lib/voice';
import { markPersonal, registerPersonal } from '@/lib/privacy/personal';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { FlipBook } from '@/components/create/fx/FlipBook';
import { fx, loop, toy } from '@/components/create/fx/toy';
import { Twinkle } from '@/components/create/fx/Burst';
import { Moon } from '@/components/dodo/Scenery';
import { MascotCutout } from '@/components/ziggy/Mascot';
import { SayButton } from '@/components/arcade/read-aloud';
import { goodnightName, STORY_TEXT } from '@/lib/journal/lines';
import { pageText, storyTitle, templateById } from '@/lib/journal/story';
import type { JournalEntry, StoryPage, StorySpec } from '@/lib/journal/types';
import { StickerArt } from './Sticker';

const PAPER = '#fdf7ff';
const TINTS = ['#E7E3FF', '#DDF0FF', '#FFE9F3', '#FFF3D9'];

/** The child's first name, if the family gave one (L'appli du Père Noël): personal, spoken by the device only. */
function useFirstName(): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('ziggy:santa:v1');
      const fam = raw ? (JSON.parse(raw) as { children?: { id?: string; name?: unknown }[]; activeChildId?: string | null }) : null;
      const kids = Array.isArray(fam?.children) ? fam.children.filter((c) => typeof c?.name === 'string' && c.name.trim()) : [];
      const child = kids.find((c) => c.id === fam?.activeChildId) ?? (kids.length === 1 ? kids[0] : null);
      const n = typeof child?.name === 'string' ? child.name.trim().slice(0, 24) : '';
      if (n) {
        registerPersonal(n);
        setName(n);
      }
    } catch {
      /* no name: the story is just as nice */
    }
  }, []);
  return name;
}

/**
 * « Ziggy raconte ma journée », step 2: the picture book. Each page shows a
 * chosen memory (or the moon, or sleepy Ziggy) and a few calm sentences that
 * light up one by one while Ziggy reads them. Page turns by ◀ ▶ (or swipe /
 * arrow keys through the buttons' focus); the last page says good night.
 */
export function StoryBook({ story, entries, locale, saved, onClose }: { story: StorySpec; entries: JournalEntry[]; locale: string; saved: boolean; onClose: () => void }) {
  const reduce = useReducedMotion();
  const name = useFirstName();
  const [i, setI] = useState(0);
  const [spoken, setSpoken] = useState<number | null>(null);
  const [spread, setSpread] = useState(false);
  const total = story.pages.length;
  const last = i === total - 1;
  const thumbs = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setSpread(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  /** The page's lines: each sentence, and the chosen item's title (with its emoji) as a line of its own. */
  const linesOf = (n: number): { text: string; emoji?: string }[] => {
    const page = story.pages[n];
    if (!page) return [];
    const texts = pageText(story, page, locale);
    const out: { text: string; emoji?: string }[] = [];
    let k = 0;
    for (const line of page.lines) {
      if ('t' in line && !templateById(line.t)) continue;
      const text = texts[k++];
      if (text === undefined) break;
      out.push('item' in line ? { text, emoji: story.items[line.item]?.emoji } : { text });
    }
    if (n === total - 1 && name) out.push({ text: markPersonal(goodnightName(name, locale)) });
    return out;
  };
  const textOf = (n: number) => linesOf(n).map((l) => l.text);

  const go = (n: number) => {
    if (n < 0 || n >= total) return;
    stopSpeaking();
    setSpoken(null);
    setI(n);
    playSound('whoosh', { volume: 0.4 });
  };

  // Arrow keys turn the pages too (the focus stays on the buttons for the TV remote).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || document.documentElement.hasAttribute('data-tv')) return;
      if (e.key === 'ArrowRight') setI((n) => Math.min(total - 1, n + 1));
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
      else return;
      stopSpeaking();
      setSpoken(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total]);

  const art = (n: number, compact: boolean): ReactNode => {
    const page: StoryPage | undefined = story.pages[n];
    const tint = TINTS[n % TINTS.length];
    const item = page?.item !== undefined ? story.items[page.item] : undefined;
    const entry = item ? thumbs.get(item.ref) : undefined;
    return (
      <div className="relative h-full overflow-hidden" style={{ background: page?.scene === 'item' ? `radial-gradient(80% 70% at 50% 35%, #ffffff, ${tint})` : 'linear-gradient(180deg,#1b1650 0%,#2c2477 65%,#4a3a9a 100%)' }}>
        {[
          [12, 14, 14, 0],
          [84, 18, 11, 0.7],
          [70, 70, 9, 1.2],
          [20, 76, 10, 0.4],
        ].map(([x, y, s, d], k) => (
          <span key={k} aria-hidden="true" className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
            <Twinkle size={s} color={page?.scene === 'item' ? (k % 2 ? '#B07CFF' : '#FFB13B') : '#FFF4C8'} className={fx.twinkle} style={loop({ dur: 2.8, delay: d })} />
          </span>
        ))}
        {page?.scene !== 'item' ? (
          <span className="absolute end-[10%] top-[10%]">
            <Moon size={compact ? '3.5rem' : '5rem'} />
          </span>
        ) : null}
        <div className="absolute inset-0 grid place-items-center">
          {page?.scene === 'item' && item ? (
            <span className={`block ${fx.float}`} style={loop({ dur: 5, amp: -8 })}>
              <StickerArt entry={{ emoji: item.emoji, world: item.world, thumb: entry?.thumb, color: entry?.color }} size="lg" />
            </span>
          ) : (
            <div className={compact ? 'h-36 w-28' : 'h-56 w-44'}>
              <MascotCutout pose={page?.scene === 'end' ? 'heart' : 'wave'} width={compact ? 112 : 176} glow={page?.scene === 'end'} className="h-full [&_img]:h-full [&_img]:w-auto" />
            </div>
          )}
        </div>
        {page?.scene === 'item' ? (
          <span className="absolute bottom-[6%] start-[6%] h-20 w-16 sm:h-24 sm:w-20">
            <MascotCutout pose="stand" width={80} glow={false} className="h-full [&_img]:h-full [&_img]:w-auto" />
          </span>
        ) : null}
        {page?.scene === 'end' ? <Zzz reduce={reduce} /> : null}
      </div>
    );
  };

  const words = (n: number): ReactNode => {
    const lines = linesOf(n);
    const end = n === total - 1;
    const lit = (k: number) => (n === i && spoken === k ? 'bg-[#FFE7A3]' : '');
    return (
      <div className="flex h-full flex-col px-4 pb-3 pt-4 text-[#2c2477] sm:px-7 sm:pb-4 sm:pt-5">
        <div className="min-h-0 flex-1 overflow-y-auto text-[1.08rem] leading-normal sm:text-xl sm:leading-relaxed">
          {lines.map((l, k) =>
            l.emoji ? (
              <span key={k} className={`my-2 flex w-fit items-center gap-2 rounded-xl bg-[#fff1e0] px-3 py-1 font-display text-xl font-bold text-[#c2410c] transition-colors duration-300 sm:text-2xl ${lit(k)}`}>
                <span aria-hidden="true">{l.emoji}</span>
                {l.text}
              </span>
            ) : (
              <span key={k} className={`rounded-md transition-colors duration-300 ${lit(k)}`}>
                {l.text}{' '}
              </span>
            ),
          )}
        </div>
        <p className="mt-2 flex items-center justify-between pt-2 text-xs font-bold text-[#8f86c9]">
          <span>{end ? tr(STORY_TEXT.theEnd, locale) : ''}</span>
          <span>
            {n + 1} / {total}
          </span>
        </p>
      </div>
    );
  };

  const single = (n: number) => (
    <div className="flex h-full flex-col">
      <div className="h-[36%] shrink-0">{art(n, true)}</div>
      <div className="min-h-0 flex-1">{words(n)}</div>
    </div>
  );

  const title = tr(storyTitle(story), locale);
  return (
    <div className="mx-auto max-w-5xl">
      {saved ? <p className="text-center text-sm font-bold text-white/75">{tr(STORY_TEXT.saved, locale)}</p> : null}
      <motion.h2 initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-center font-display text-3xl font-bold text-white text-balance sm:text-4xl">
        {title}
      </motion.h2>

      <motion.div
        initial={reduce ? false : { rotateX: 50, y: 30, opacity: 0 }}
        animate={{ rotateX: 0, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 90, damping: 15 }}
        className="relative mt-6 [perspective:1600px]"
        aria-live="polite"
      >
        <div className="rounded-[1.8rem] bg-[linear-gradient(160deg,#8b84f0,#5b4fd0)] p-2.5 shadow-[0_10px_0_#3d3399,0_40px_60px_-30px_rgba(10,6,40,0.9)] sm:p-3">
          <div className="relative h-[36rem] overflow-hidden rounded-[1.3rem] shadow-[inset_0_0_0_1px_rgba(80,60,140,0.15)] md:h-[25rem]" style={{ background: PAPER }}>
            <FlipBook page={i} spread={spread} left={(n) => art(n, false)} right={words} single={single} paper={PAPER} />
            {spread ? (
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-14 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(60,40,120,0.16)_45%,rgba(60,40,120,0.26)_50%,rgba(60,40,120,0.16)_55%,transparent)]" />
            ) : null}
          </div>
        </div>
      </motion.div>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3 sm:gap-4" data-tv-row="">
        <button type="button" disabled={i === 0} onClick={() => go(i - 1)} aria-label={locale === 'fr' ? 'Page précédente' : 'Previous page'} className={`${fx.toy} ${fx.light} grid h-16 w-16 place-items-center rounded-full text-2xl font-black`}>
          <span aria-hidden="true" className="rtl:-scale-x-100">
            ◀
          </span>
        </button>
        <span className="inline-flex min-h-16 items-center gap-2 rounded-full bg-white/95 p-1 font-display text-lg font-bold text-[#2c2477] shadow-[0_6px_0_rgba(20,10,60,0.35)] sm:pe-5">
          <SayButton key={i} texts={textOf(i)} locale={locale} size="lg" onIndex={setSpoken} />
          <span className="max-sm:sr-only">{tr(STORY_TEXT.read, locale)}</span>
        </span>
        {last ? (
          <button type="button" onClick={onClose} className={`${fx.toy} ${fx.sheen} inline-flex min-h-16 items-center gap-2 rounded-full px-6 font-display text-lg font-bold`} style={toy('#FFD447', { depth: 7 }) as CSSProperties}>
            <span aria-hidden="true">📒</span> {tr(STORY_TEXT.back, locale)}
          </button>
        ) : (
          <button type="button" data-tv-autofocus="" onClick={() => go(i + 1)} aria-label={locale === 'fr' ? 'Page suivante' : 'Next page'} className={`${fx.toy} ${fx.sheen} grid h-16 w-16 place-items-center rounded-full text-2xl font-black`} style={toy('#8B84F0', { depth: 7 }) as CSSProperties}>
            <span aria-hidden="true" className="rtl:-scale-x-100">
              ▶
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

/** Three soft "z" drifting up above sleepy Ziggy (still under reduced motion). */
function Zzz({ reduce }: { reduce: boolean }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute start-[58%] top-[16%]">
      {[0, 1, 2].map((k) =>
        reduce ? (
          <span key={k} className="absolute font-display font-bold text-[#FFF4C8]" style={{ fontSize: 18 + k * 6, left: k * 16, top: -k * 18 }}>
            z
          </span>
        ) : (
          <motion.span
            key={k}
            className="absolute font-display font-bold text-[#FFF4C8]"
            style={{ fontSize: 18 + k * 6, left: 0, top: 0 }}
            initial={{ opacity: 0, x: 0, y: 0 }}
            animate={{ opacity: [0, 1, 1, 0], x: [0, 10, 4, 16], y: [0, -18, -36, -54] }}
            transition={{ duration: 3.4, delay: k * 1.1, repeat: Infinity, ease: 'easeOut' }}
          >
            z
          </motion.span>
        ),
      )}
    </span>
  );
}

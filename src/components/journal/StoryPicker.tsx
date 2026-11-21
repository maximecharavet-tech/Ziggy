'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { tr } from '@/lib/i18n-text';
import { playSound } from '@/lib/sound';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { useJuice } from '@/components/ui/fx';
import { fx, toy } from '@/components/create/fx/toy';
import { SayButton } from '@/components/arcade/read-aloud';
import { STORY_TEXT } from '@/lib/journal/lines';
import { dayOf, type JournalEntry } from '@/lib/journal/types';
import { StickerArt, dayLabel } from './Sticker';

/** How far back the picker looks, and how many it shows. */
const RECENT_DAYS = 14;
const MAX_SHOWN = 24;
export const MAX_PICK = 3;

/** Today's discoveries first, then the last days' (stories themselves are not picked). */
export function storyCandidates(entries: JournalEntry[], now = Date.now()): { today: JournalEntry[]; recent: JournalEntry[] } {
  const today = dayOf(now);
  const since = now - RECENT_DAYS * 86_400_000;
  const list = entries.filter((e) => e.kind !== 'story' && e.at >= since).slice(0, MAX_SHOWN);
  return { today: list.filter((e) => dayOf(e.at) === today), recent: list.filter((e) => dayOf(e.at) !== today) };
}

/**
 * « Ziggy raconte ma journée », step 1: the child picks up to three memories
 * (big cards, numbered in the order picked). None picked is fine too: Ziggy
 * then tells a gentle, quiet day.
 */
export function StoryPicker({ entries, locale, onTell, onBack }: { entries: JournalEntry[]; locale: string; onTell: (picked: JournalEntry[]) => void; onBack: () => void }) {
  const reduce = useReducedMotion();
  const juice = useJuice();
  const { today, recent } = useMemo(() => storyCandidates(entries), [entries]);
  const [picked, setPicked] = useState<string[]>(() => today.slice(0, MAX_PICK).map((e) => e.id));
  const [full, setFull] = useState(false);
  const byId = useMemo(() => new Map([...today, ...recent].map((e) => [e.id, e])), [today, recent]);

  const toggle = (e: JournalEntry, el: HTMLElement) => {
    setFull(false);
    if (picked.includes(e.id)) {
      setPicked(picked.filter((id) => id !== e.id));
      playSound('tap', { volume: 0.6 });
      return;
    }
    if (picked.length >= MAX_PICK) {
      setFull(true);
      juice.wiggle(el, 'boing');
      return;
    }
    setPicked([...picked, e.id]);
    juice.pop(el);
  };

  const card = (e: JournalEntry, k: number) => {
    const n = picked.indexOf(e.id);
    const on = n >= 0;
    const title = tr(e.title, locale);
    return (
      <motion.li key={e.id} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(k, 8) * 0.04 }}>
        <button
          type="button"
          aria-pressed={on}
          onClick={(ev) => toggle(e, ev.currentTarget)}
          aria-label={`${title}. ${dayLabel(e.at, locale)}`}
          className={`relative flex min-h-[9.5rem] w-full flex-col items-center gap-2 rounded-[1.6rem] border-4 bg-white/95 p-3 text-center shadow-[0_6px_0_rgba(40,30,80,0.12)] transition-[transform,border-color] active:scale-95 ${on ? 'border-[#FFD447]' : 'border-white/0'}`}
        >
          <StickerArt entry={e} />
          <span className="line-clamp-2 font-display text-base font-bold leading-tight text-[#2c2477]">{title}</span>
          <span className="text-xs font-bold text-[#6b63b5]">{dayLabel(e.at, locale)}</span>
          {on ? (
            <span aria-hidden="true" className="absolute -end-2 -top-2 grid h-10 w-10 place-items-center rounded-full bg-[#FFD447] font-display text-xl font-bold text-[#2c2477] shadow-[0_3px_0_#c99b10]">
              {n + 1}
            </span>
          ) : null}
        </button>
      </motion.li>
    );
  };

  const section = (label: string, list: JournalEntry[], offset: number) =>
    list.length ? (
      <section className="mt-6">
        <h3 className="font-display text-xl font-bold text-white/90">{label}</h3>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-tv-row="">
          {list.map((e, k) => card(e, k + offset))}
        </ul>
      </section>
    ) : null;

  const none = !today.length && !recent.length;
  const help = none ? tr(STORY_TEXT.pickQuiet, locale) : tr(STORY_TEXT.pickHelp, locale);

  return (
    <div className="mx-auto max-w-4xl">
      <button type="button" onClick={onBack} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/15 px-4 font-bold text-white ring-1 ring-white/25 transition hover:bg-white/25">
        <span aria-hidden="true" className="rtl:-scale-x-100">
          ←
        </span>
        {tr(STORY_TEXT.back, locale)}
      </button>
      <div className="mt-5 flex items-center gap-3">
        <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">{tr(none ? STORY_TEXT.tell : STORY_TEXT.pickTitle, locale)}</h2>
        <SayButton texts={[tr(none ? STORY_TEXT.tell : STORY_TEXT.pickTitle, locale), help]} locale={locale} size="md" className="!bg-white/90" />
      </div>
      <p className="mt-2 text-lg text-white/80">{help}</p>

      {section(tr(STORY_TEXT.pickToday, locale), today, 0)}
      {section(tr(STORY_TEXT.pickRecent, locale), recent, today.length)}

      <div className="sticky bottom-[calc(var(--tabbar-h,0px)+0.75rem)] z-10 mt-8 flex flex-col items-center gap-2">
        {full ? (
          <p role="status" className="rounded-full bg-white/90 px-4 py-2 text-center font-bold text-[#2c2477] shadow">
            {tr(STORY_TEXT.pickFull, locale)}
          </p>
        ) : null}
        <button
          type="button"
          data-tv-autofocus=""
          onClick={() => onTell(picked.map((id) => byId.get(id)).filter((e): e is JournalEntry => Boolean(e)))}
          className={`${fx.toy} ${fx.sheen} inline-flex min-h-[4.5rem] items-center gap-3 rounded-full px-8 font-display text-2xl font-bold`}
          style={toy('#FFD447', { depth: 8 }) as CSSProperties}
        >
          <span aria-hidden="true">🌙</span>
          {tr(STORY_TEXT.tell, locale)}
        </button>
      </div>
    </div>
  );
}

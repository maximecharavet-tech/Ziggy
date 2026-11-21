'use client';

import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import { tr } from '@/lib/i18n-text';
import { speakSequence, unlockAudio } from '@/lib/voice';
import { haptic } from '@/lib/app-bridge';
import { useBackLayer } from '@/lib/back-layer';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { useJuice } from '@/components/ui/fx';
import { fx, loop, toy } from '@/components/create/fx/toy';
import { Link } from '@/i18n/navigation';
import { MascotCutout } from '@/components/ziggy/Mascot';
import { SayButton } from '@/components/arcade/read-aloud';
import { NightSky } from '@/components/dodo/Scenery';
import { ZiggyWait } from '@/components/sections/magic/ZiggyWait';
import { useJournal } from '@/lib/journal/use-journal';
import { lastStoryTemplates, saveStory } from '@/lib/journal/store';
import { buildStory, storySeed, storyTitle, toStoryItem } from '@/lib/journal/story';
import { ALBUM_TEXT, EMPTY_LINES, EXPLORE_LINKS, HELLO_LINES, STICKER_LINES, lineFor } from '@/lib/journal/lines';
import { JOURNAL_WORLDS, WORLD_INFO, dayOf, type JournalEntry, type JournalWorld, type StorySpec } from '@/lib/journal/types';
import { AlbumBook } from './AlbumBook';
import { StoryPicker } from './StoryPicker';
import { StoryBook } from './StoryBook';

type View = { kind: 'album' } | { kind: 'pick' } | { kind: 'story'; story: StorySpec; saved: boolean };

/**
 * « Mon carnet de découvertes »: every discovery of every game as stickers
 * in one album, Ziggy saying kind things about them, and « Ziggy raconte ma
 * journée », a bedtime story made of the child's own memories. Read on the
 * device after mounting; nothing leaves it. `?raconte=1` opens the story.
 */
export function JournalApp() {
  const locale = useLocale();
  const reduce = useReducedMotion();
  const juice = useJuice();
  const { entries, ready } = useJournal();
  const [filter, setFilter] = useState<JournalWorld | 'all'>('all');
  const [view, setView] = useState<View>({ kind: 'album' });

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('raconte') === '1') setView({ kind: 'pick' });
    } catch {
      /* no query: the album */
    }
  }, []);
  useBackLayer(view.kind !== 'album', () => setView({ kind: 'album' }));
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [view.kind]);

  const worlds = useMemo(() => JOURNAL_WORLDS.filter((w) => entries.some((e) => e.world === w)), [entries]);
  const active = filter !== 'all' && worlds.includes(filter) ? filter : 'all';
  const shown = useMemo(() => (active === 'all' ? entries : entries.filter((e) => e.world === active)), [entries, active]);
  const hello = useMemo(() => lineFor(HELLO_LINES, dayOf(Date.now()) + entries.length), [entries.length]);
  const empty = ready && entries.length === 0;

  const tapSticker = (e: JournalEntry, ev: MouseEvent<HTMLButtonElement>) => {
    unlockAudio();
    haptic('light');
    if (e.kind === 'story' && e.story) {
      setView({ kind: 'story', story: e.story, saved: false });
      return;
    }
    juice.sparkle(ev.currentTarget);
    const line = lineFor(STICKER_LINES[e.world], e.id);
    void speakSequence(`journal-${e.id}`, [tr(e.title, locale), tr(line, locale)], locale);
  };

  const tell = (picked: JournalEntry[]) => {
    unlockAudio();
    haptic('success');
    const items = picked.slice(0, 3).map(toStoryItem);
    const count = entries.filter((e) => e.kind === 'story').length;
    const story = buildStory(items, storySeed(dayOf(Date.now()), items.map((x) => x.ref), count), lastStoryTemplates(entries));
    const saved = saveStory(story, storyTitle(story));
    setView({ kind: 'story', story, saved: Boolean(saved) });
  };

  return (
    <div className="relative isolate min-h-[calc(100dvh-var(--tabbar-h,0px))] overflow-clip px-4 pb-16 pt-[5.5rem] sm:px-6 lg:px-8">
      <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_45%_at_15%_0%,rgba(255,217,160,0.6),transparent_70%),radial-gradient(60%_40%_at_95%_25%,rgba(176,124,255,0.18),transparent_70%),radial-gradient(70%_40%_at_50%_100%,rgba(127,200,92,0.16),transparent_70%)] dark:bg-[radial-gradient(70%_45%_at_15%_0%,rgba(255,217,160,0.1),transparent_70%)]"
        />

      <AnimatePresence mode="wait" initial={false}>
        {!ready ? (
          <div key="wait" className="grid h-[60vh] place-items-center">
            <ZiggyWait late={450} />
          </div>
        ) : view.kind === 'pick' ? (
          <motion.div key="pick" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <NightPanel>
              <StoryPicker entries={entries} locale={locale} onTell={tell} onBack={() => setView({ kind: 'album' })} />
            </NightPanel>
          </motion.div>
        ) : view.kind === 'story' ? (
          <motion.div key={`story-${view.story.seed}`} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <NightPanel>
              <StoryBook story={view.story} entries={entries} locale={locale} saved={view.saved} onClose={() => setView({ kind: 'album' })} />
            </NightPanel>
          </motion.div>
        ) : (
          <motion.div key="album" className="mx-auto max-w-6xl" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <header className="flex items-end gap-3 sm:gap-5">
              <div className="relative h-32 w-24 shrink-0 sm:h-40 sm:w-32 md:h-48 md:w-36">
                <MascotCutout pose={empty ? 'wave' : 'heart'} width={144} priority className="h-full [&_img]:h-full [&_img]:w-auto" />
              </div>
              <div className="min-w-0 pb-2">
                <h1 className="font-display text-[1.9rem] font-bold leading-tight text-text-body sm:text-4xl md:text-5xl">{tr(ALBUM_TEXT.title, locale)}</h1>
                <div className="mt-2 flex items-center gap-2">
                  <p className="relative w-fit rounded-[1.3rem] rounded-es-md bg-bg-card px-4 py-2 font-display text-base font-semibold text-text-muted shadow-[0_10px_24px_-14px_rgba(107,74,43,0.5)] ring-1 ring-border/70 sm:text-xl">
                    {tr(empty ? EMPTY_LINES[0] : hello, locale)}
                  </p>
                  <SayButton texts={[tr(ALBUM_TEXT.title, locale), tr(empty ? EMPTY_LINES[0] : hello, locale), empty ? tr(EMPTY_LINES[1], locale) : null]} locale={locale} size="md" />
                </div>
              </div>
            </header>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  unlockAudio();
                  juice.press(e.currentTarget);
                  setView({ kind: 'pick' });
                }}
                className={`${fx.toy} ${fx.sheen} inline-flex min-h-16 items-center gap-3 rounded-full px-6 text-start font-display font-bold`}
                style={toy('#5B4FD0', { depth: 7 }) as CSSProperties}
              >
                <span aria-hidden="true" className="text-3xl">
                  🌙
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-xl">{tr(ALBUM_TEXT.tellMyDay, locale)}</span>
                  <span className="text-sm font-semibold opacity-85">{tr(ALBUM_TEXT.tellMyDaySub, locale)}</span>
                </span>
              </button>
            </div>

            {empty ? (
              <EmptyAlbum locale={locale} />
            ) : (
              <>
                {worlds.length > 1 ? (
                  <div role="group" aria-label={tr(ALBUM_TEXT.filters, locale)} className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" data-tv-row="">
                    {(['all', ...worlds] as const).map((w) => {
                      const on = active === w;
                      const info = w === 'all' ? { emoji: '📒', name: ALBUM_TEXT.all, color: '#C9783A' } : WORLD_INFO[w];
                      return (
                        <button
                          key={w}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            haptic('light');
                            setFilter(w);
                          }}
                          className={`inline-flex min-h-14 shrink-0 items-center gap-2 rounded-full border-[3px] px-4 font-display text-base font-bold transition-[transform,background-color] active:scale-95 ${on ? 'text-white shadow-[0_4px_0_rgba(0,0,0,0.15)]' : 'bg-bg-card text-text-body'}`}
                          style={{ borderColor: info.color, backgroundColor: on ? info.color : undefined }}
                        >
                          <span aria-hidden="true" className="text-2xl">
                            {info.emoji}
                          </span>
                          {tr(info.name, locale)}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <div className="mt-8">
                  <AlbumBook entries={shown} locale={locale} onTap={tapSticker} resetKey={active} />
                </div>
              </>
            )}
            <p className="mt-8 text-center text-sm text-text-muted">🔒 {tr(ALBUM_TEXT.privacy, locale)}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The bedtime corner: a calm night sky in a big rounded window (the site's top bar stays on its usual light page). */
function NightPanel({ children }: { children: ReactNode }) {
  return (
    <section className="relative mx-auto max-w-6xl overflow-clip rounded-[2rem] px-4 pb-8 pt-6 shadow-[0_30px_60px_-30px_rgba(20,10,60,0.7)] sm:px-8 sm:pt-8">
      <NightSky className="absolute inset-0" moon={false} stars={60} />
      <div className="relative">{children}</div>
    </section>
  );
}

/** A brand-new album: Ziggy invites, never counts what is not there. */
function EmptyAlbum({ locale }: { locale: string }) {
  return (
    <section className="mx-auto mt-8 max-w-3xl rounded-[2rem] bg-[#fffaf0] p-6 text-center shadow-[0_10px_0_#e8d5b5,0_30px_50px_-30px_rgba(120,60,20,0.5)] ring-1 ring-[#e8d5b5] sm:p-10">
      <div className="flex items-center justify-center gap-2">
        <h2 className="font-display text-3xl font-bold text-[#4a3423] sm:text-4xl">{tr(ALBUM_TEXT.emptyTitle, locale)}</h2>
        <SayButton texts={[tr(ALBUM_TEXT.emptyTitle, locale), tr(ALBUM_TEXT.emptyText, locale), tr(ALBUM_TEXT.explore, locale)]} locale={locale} size="md" />
      </div>
      <p className="mx-auto mt-3 max-w-xl text-lg text-[#8a6a45]">{tr(ALBUM_TEXT.emptyText, locale)}</p>
      <div aria-hidden="true" className="mt-5 flex justify-center gap-3 text-4xl sm:text-5xl">
        {['🌱', '👾', '🎨', '🗺️'].map((e, k) => (
          <span key={e} className={fx.float} style={loop({ dur: 3.5 + k * 0.4, delay: k * 0.3 })}>
            {e}
          </span>
        ))}
      </div>
      <p className="mt-6 font-display text-xl font-bold text-[#4a3423]">{tr(ALBUM_TEXT.explore, locale)}</p>
      <ul className="mx-auto mt-4 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2" data-tv-row="">
        {EXPLORE_LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className={`${fx.toy} flex min-h-16 items-center justify-center gap-2 rounded-2xl px-3 font-display text-lg font-bold`} style={toy(l.color, { depth: 6 }) as CSSProperties}>
              <span aria-hidden="true" className="text-2xl">
                {l.emoji}
              </span>
              {tr(l.label, locale)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, Palette as PaletteIcon, Volume2, VolumeX } from 'lucide-react';
import { useLocale } from 'next-intl';
import { ReadAloudProvider, SayButton, useAutoSay } from '@/components/arcade/read-aloud';
import { AppPage } from '@/components/learn/AppPage';
import { tr } from '@/lib/i18n-text';
import { playSound } from '@/lib/sound';
import { stopSpeaking } from '@/lib/voice';
import { readAloudOn } from '@/lib/world/memory';
import { getMemory, setMemory, useHydrated, useWorldMemory } from '@/lib/world/store';
import { pageById } from '@/coloring/pages';
import type { Artwork } from '@/coloring/storage';
import { T } from '@/coloring/text';
import type { ColoringPage, Drawing } from '@/coloring/types';
import { MyGallery } from './MyGallery';
import { PagePicker } from './PagePicker';
import { Studio } from './Studio';

type Open = { page: ColoringPage; artId?: string; initial?: Drawing; createdAt?: number; key: number };

/** "Colorie avec Ziggy": pick a page (or a saved drawing), colour it, bring it to life. */
export function ColoringApp() {
  const locale = useLocale();
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const reads = hydrated && readAloudOn(memory);
  const [tab, setTab] = useState<'pages' | 'gallery'>('pages');
  const [open, setOpen] = useState<Open | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [galleryKey, setGalleryKey] = useState(0);
  const pushed = useRef(false);

  // The browser's back button leaves the studio instead of the site.
  useEffect(() => {
    const onPop = () => {
      if (pushed.current) {
        pushed.current = false;
        setOpen(null);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const start = (o: Omit<Open, 'key'>) => {
    window.history.pushState({ coloring: o.page.id }, '');
    pushed.current = true;
    setOpen({ ...o, key: Date.now() });
  };

  const exit = useCallback(({ saved }: { saved: boolean }) => {
    stopSpeaking();
    if (saved) setGalleryKey((k) => k + 1);
    setOpen(null);
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    }
  }, []);

  const openArt = (a: Artwork) => {
    const page = pageById(a.pageId);
    if (page) start({ page, artId: a.id, initial: a.drawing, createdAt: a.createdAt });
  };

  const toggleRead = () => {
    const m = getMemory();
    const on = !readAloudOn(m);
    setMemory({ ...m, readAloud: on, updatedAt: new Date().toISOString() });
    if (!on) stopSpeaking();
    playSound('tap');
  };

  const tabBtn = (id: 'pages' | 'gallery', emoji: string, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => {
        setTab(id);
        playSound('tap');
      }}
      className={`relative flex min-h-14 items-center gap-2 rounded-full px-5 font-display text-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky sm:px-7 ${tab === id ? 'text-white' : 'text-text-body hover:bg-white/60 dark:hover:bg-white/10'}`}
    >
      {tab === id && <motion.span layoutId="coloring-tab" className="absolute inset-0 rounded-full bg-gradient-to-r from-[#FF7AB8] via-[#B07CFF] to-[#5FB6EA] shadow-lg" transition={{ type: 'spring', duration: 0.45, bounce: 0.25 }} />}
      <span className="relative text-2xl" aria-hidden="true">
        {emoji}
      </span>
      <span className="relative">{label}</span>
      {id === 'gallery' && count ? <span className="relative rounded-full bg-white/90 px-2 text-sm text-[#7C3AED]">{count}</span> : null}
    </button>
  );

  return (
    <ReadAloudProvider on={reads} little={hydrated && memory.age === 'little'} locale={locale}>
      <AppPage
        eyebrow={
          <>
            <PaletteIcon size={15} /> {tr(T.eyebrow, locale)}
          </>
        }
        title={tr(T.appName, locale)}
        subtitle={tr(T.subtitle, locale)}
        color="#B07CFF"
      >
        <HomeVoice locale={locale} quiet={!!open} />
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <SayButton texts={[tr(T.appName, locale), tr(T.homeSay, locale)]} locale={locale} size="lg" className="order-2 sm:order-1" />
            <div role="tablist" aria-label={tr(T.appName, locale)} className="order-1 flex gap-1 rounded-full bg-white/70 p-1.5 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-white/5 dark:ring-white/10 max-sm:basis-full max-sm:justify-center sm:order-2">
              {tabBtn('pages', '🖍️', tr(T.tabPages, locale))}
              {tabBtn('gallery', '🖼️', tr(T.tabGallery, locale))}
            </div>
            <button
              type="button"
              onClick={toggleRead}
              aria-pressed={reads}
              title={tr(T.readAloud, locale)}
              className={`order-3 flex min-h-16 items-center gap-2 rounded-full ps-3 pe-5 font-display text-base font-semibold shadow-sm ring-1 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky ${reads ? 'bg-[#22C55E] text-white ring-[#22C55E]' : 'bg-white/80 text-text-muted ring-black/5 dark:bg-white/10'}`}
            >
              <span className={`grid h-10 w-10 place-items-center rounded-full ${reads ? 'bg-white/25' : 'bg-black/5 dark:bg-white/10'}`}>
                {reads ? <Volume2 size={22} aria-hidden="true" /> : <VolumeX size={22} aria-hidden="true" />}
              </span>
              {tr(T.readAloud, locale)}
            </button>
          </div>
        </div>

        <div className="mt-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              {tab === 'pages' ? (
                <PagePicker locale={locale} onPick={(page) => start({ page })} />
              ) : (
                <MyGallery key={galleryKey} locale={locale} onOpen={openArt} onCount={setCount} />
              )}
            </motion.div>
          </AnimatePresence>
          {tab === 'pages' && <GalleryCounter key={galleryKey} onCount={setCount} />}
        </div>

        <p className="mx-auto mt-12 flex max-w-xl items-center justify-center gap-2 text-center text-sm text-text-muted">
          <Lock size={14} aria-hidden="true" /> {tr(T.privacy, locale)}
        </p>
      </AppPage>

      <AnimatePresence>
        {open && <Studio key={open.key} page={open.page} locale={locale} artId={open.artId} initial={open.initial} createdAt={open.createdAt} onExit={exit} />}
      </AnimatePresence>
    </ReadAloudProvider>
  );
}

/** Says the home instruction when read-aloud is on (and again after leaving the studio). */
function HomeVoice({ locale, quiet }: { locale: string; quiet: boolean }) {
  useAutoSay(quiet ? 'coloring-studio' : 'coloring-home', quiet ? [] : [tr(T.appName, locale), tr(T.homeSay, locale)]);
  return null;
}

/** Keeps the "My drawings" badge up to date without showing the gallery. */
function GalleryCounter({ onCount }: { onCount: (n: number) => void }) {
  useEffect(() => {
    let alive = true;
    void import('@/coloring/art-db').then(async ({ artStore }) => {
      try {
        const n = (await artStore().list()).length;
        if (alive) onCount(n);
      } catch {
        /* no storage: no badge */
      }
    });
    return () => {
      alive = false;
    };
  }, [onCount]);
  return null;
}

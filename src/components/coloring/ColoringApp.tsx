'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, Volume2, VolumeX } from 'lucide-react';
import { useLocale } from 'next-intl';
import { ReadAloudProvider, useAutoSay } from '@/components/arcade/read-aloud';
import { StudioFrame } from '@/components/create/fx/StudioFrame';
import { fx, toy } from '@/components/create/fx/toy';
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

  const tabBtn = (id: 'pages' | 'gallery', emoji: string, label: string) => {
    const on = tab === id;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={on}
        onClick={() => {
          setTab(id);
          playSound('tap');
        }}
        className={`${fx.toy} ${on ? '' : fx.light} flex min-h-14 items-center gap-2 rounded-full px-5 font-display text-lg font-semibold sm:px-7`}
        style={on ? { ...toy('#B07CFF', { depth: 5 }), '--face': 'linear-gradient(120deg, #FF7AB8, #B07CFF 50%, #5FB6EA)' } as React.CSSProperties : ({ '--depth': '5px' } as React.CSSProperties)}
      >
        <span className="text-2xl" aria-hidden="true">
          {emoji}
        </span>
        <span>{label}</span>
        {id === 'gallery' && count ? <span className="rounded-full bg-white/90 px-2 text-sm text-[#7C3AED] shadow-sm">{count}</span> : null}
      </button>
    );
  };

  return (
    <ReadAloudProvider on={reads} little={hydrated && memory.age === 'little'} locale={locale}>
      <StudioFrame
        eyebrow={tr(T.eyebrow, locale)}
        emoji="🖍️"
        title={tr(T.appName, locale)}
        subtitle={tr(T.subtitle, locale)}
        color="#B07CFF"
        locale={locale}
        props={['🖍️', '🎨', '🌈', '✏️']}
        say={[tr(T.appName, locale), tr(T.homeSay, locale)]}
        wide
      >
        <HomeVoice locale={locale} quiet={!!open} />
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div role="tablist" aria-label={tr(T.appName, locale)} className="flex gap-2 rounded-full bg-white/70 p-2 shadow-[inset_0_2px_6px_rgba(80,40,140,0.12)] ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10 max-sm:basis-full max-sm:justify-center">
              {tabBtn('pages', '🖍️', tr(T.tabPages, locale))}
              {tabBtn('gallery', '🖼️', tr(T.tabGallery, locale))}
            </div>
            <button
              type="button"
              onClick={toggleRead}
              aria-pressed={reads}
              title={tr(T.readAloud, locale)}
              className={`${fx.toy} ${reads ? '' : fx.light} flex min-h-16 items-center gap-2 rounded-full ps-3 pe-5 font-display text-base font-semibold`}
              style={reads ? toy('#22C55E', { depth: 5 }) : ({ '--depth': '5px' } as React.CSSProperties)}
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
      </StudioFrame>

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

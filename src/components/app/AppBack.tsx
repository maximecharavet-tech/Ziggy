'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import { locales } from '@/i18n/config';
import { tr, type L } from '@/lib/i18n-text';
import { homeOf, isAppHome, isSiteRoot, stripLocale } from '@/lib/app-shell';
import { appShellNow, useAppShell } from '@/lib/use-app-shell';
import { exitApp, onAppBack } from '@/lib/app-bridge';
import { useBackLayer, useFocusReturn } from '@/lib/back-layer';
import { MascotCutout } from '@/components/ziggy/Mascot';

const T = {
  title: { fr: 'Tu veux quitter Ziggy ?', en: 'Do you want to leave Ziggy?' },
  text: { fr: 'Ziggy t’attendra ici. À bientôt !', en: 'Ziggy will wait for you here. See you soon!' },
  stay: { fr: 'Je reste', en: 'I’ll stay' },
  leave: { fr: 'Quitter', en: 'Leave' },
} satisfies Record<string, L>;

/** Event a page can cancel to handle Back itself (e.g. the TV home goes back to its top first). */
export const PAGE_BACK_EVENT = 'ziggy:back';
/** Event asking for Back (the TV remote's Back key, see SpatialNavigation). */
export const BACK_REQUEST_EVENT = 'ziggy:back-request';

/** The open modal or sheet on top, if any. */
export function topLayer(): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>('[aria-modal="true"], [data-back-layer]')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  return all.at(-1) ?? null;
}

/** Close a layer the way its own UI does: its close button, else Escape. */
function closeLayer(layer: HTMLElement) {
  const close = layer.querySelector<HTMLElement>('[data-close]');
  if (close) {
    close.click();
    return;
  }
  const target = layer.contains(document.activeElement) ? (document.activeElement as HTMLElement) : layer;
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
}

/**
 * Back in the app, always predictable: a modal open → it closes; else the
 * page may handle it; else the previous screen; at the app's home →
 * "Leave Ziggy?". Driven by the Android back button (`ziggy://back` from
 * the native shell, at the WebView's history root) and the TV remote's Back.
 * Also sends the website's home page to the app's home.
 */
export function AppBack() {
  const shell = useAppShell();
  const router = useRouter();
  const pathname = usePathname();
  const [exitOpen, setExitOpen] = useState(false);
  const exitRef = useRef(false);
  exitRef.current = exitOpen;

  // The marketing home is not part of the app.
  useEffect(() => {
    if (shell.app && isSiteRoot(pathname, locales)) {
      const { prefix } = stripLocale(pathname, locales);
      router.replace(`${prefix}${homeOf(shell)}`);
    }
  }, [shell, pathname, router]);

  const back = useCallback(
    (atHistoryRoot: boolean) => {
      if (exitRef.current) return setExitOpen(false);
      const layer = topLayer();
      if (layer) return closeLayer(layer);
      if (!window.dispatchEvent(new CustomEvent(PAGE_BACK_EVENT, { cancelable: true }))) return;
      const path = window.location.pathname;
      if (isAppHome(path, locales)) return setExitOpen(true);
      const { prefix } = stripLocale(path, locales);
      if (!atHistoryRoot && window.history.length > 1) window.history.back();
      else router.replace(`${prefix}${homeOf(appShellNow())}`);
    },
    [router]
  );

  useEffect(() => {
    if (!shell.app) return;
    const off = onAppBack(() => back(true));
    const onRequest = () => back(false);
    window.addEventListener(BACK_REQUEST_EVENT, onRequest);
    return () => {
      off();
      window.removeEventListener(BACK_REQUEST_EVENT, onRequest);
    };
  }, [shell.app, back]);

  return <AnimatePresence>{exitOpen ? <ExitConfirm key="exit" onStay={() => setExitOpen(false)} /> : null}</AnimatePresence>;
}

function ExitConfirm({ onStay }: { onStay: () => void }) {
  const locale = useLocale();
  const stay = useRef<HTMLButtonElement>(null);
  // While it fades out it is no longer a layer (Back, the remote and screen readers skip it).
  const present = useIsPresent();
  useBackLayer(true, onStay);
  useFocusReturn(present);
  const stayRef = useRef(onStay);
  stayRef.current = onStay;
  useEffect(() => {
    stay.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack') {
        e.preventDefault();
        stayRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <motion.div
      role="dialog"
      aria-modal={present ? 'true' : undefined}
      inert={!present}
      aria-labelledby="exit-title"
      className="fixed inset-0 z-[125] grid place-items-center bg-[#140d05]/55 px-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className="relative w-full max-w-[24rem] overflow-hidden rounded-[2.25rem] bg-gradient-to-b from-[#FFF6E4] to-[#FCE3C8] px-6 pb-6 pt-4 text-center text-[#3B2410] shadow-2xl dark:from-[#241a3d] dark:to-[#151027] dark:text-[#FFF1DC]"
        initial={{ y: 30, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 20, scale: 0.97, transition: { duration: 0.18 } }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        <div className="mx-auto h-40 w-32">
          <MascotCutout pose="wave" width={128} className="h-full [&_img]:h-full [&_img]:w-auto" />
        </div>
        <h2 id="exit-title" className="mt-2 font-display text-2xl font-bold">
          {tr(T.title, locale)}
        </h2>
        <p className="mt-1 text-base opacity-75">{tr(T.text, locale)}</p>
        <div className="mt-5 grid gap-3">
          <button
            ref={stay}
            type="button"
            onClick={onStay}
            data-close=""
            className="min-h-16 rounded-full bg-gradient-to-b from-[#4ADE80] to-[#16A34A] px-6 font-display text-xl font-bold text-white shadow-[0_5px_0_#15803D] transition active:translate-y-[3px] active:shadow-[0_2px_0_#15803D]"
          >
            💚 {tr(T.stay, locale)}
          </button>
          <button
            type="button"
            onClick={() => {
              void exitApp().then((closed) => !closed && onStay());
            }}
            className="min-h-14 rounded-full bg-[#3B2410]/[0.07] px-6 font-bold text-[#6B4A2B] transition active:scale-[0.98] dark:bg-white/10 dark:text-white/80"
          >
            👋 {tr(T.leave, locale)}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

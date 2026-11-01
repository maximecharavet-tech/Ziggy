'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion, useAnimationControls, useIsPresent } from 'framer-motion';
import { locales } from '@/i18n/config';
import { tr, type L } from '@/lib/i18n-text';
import { GATE_GRACE_MS, checkGateAnswer, gateReasonFor, isParentsPath, makeGateQuestion, type GateQuestion, type GateReason } from '@/lib/grown-up-gate';
import { appShellNow, useAppShell } from '@/lib/use-app-shell';
import { haptic, openExternal } from '@/lib/app-bridge';
import { historySettled, useBackLayer, useFocusReturn } from '@/lib/back-layer';
import { homeOf } from '@/lib/app-shell';
import { ZiggyAvatar } from '@/components/ziggy/Mascot';
import { SayButton } from '@/components/arcade/read-aloud';

const T = {
  title: { fr: 'Demande à un grand', en: 'Ask a grown-up' },
  parents: {
    fr: 'Cette partie est pour les parents.',
    en: 'This part is for parents.',
  },
  external: {
    fr: 'Ce lien sort de Ziggy. Un parent peut l’ouvrir.',
    en: 'This link leaves Ziggy. A parent can open it.',
  },
  typed: { fr: 'Réponse', en: 'Answer' },
  ok: { fr: 'Valider', en: 'OK' },
  erase: { fr: 'Effacer', en: 'Delete' },
  cancel: { fr: 'Retour', en: 'Back' },
  again: {
    fr: 'Ce n’est pas ça. Voici une autre question.',
    en: 'Not quite. Here is another question.',
  },
  forKids: {
    fr: 'Tu veux continuer à jouer ? Touche Retour.',
    en: 'Want to keep playing? Tap Back.',
  },
} satisfies Record<string, L>;

const GRACE_KEY = 'ziggy:grownup';

function graceValid(): boolean {
  try {
    const t = Number(sessionStorage.getItem(GRACE_KEY));
    return Number.isFinite(t) && t > 0 && Date.now() - t < GATE_GRACE_MS;
  } catch {
    return false;
  }
}
function setGrace() {
  try {
    sessionStorage.setItem(GRACE_KEY, String(Date.now()));
  } catch {
    /* storage blocked: ask again next time */
  }
}

type Ask = (reason: GateReason) => Promise<boolean>;
const GateCtx = createContext<{ ask: Ask; open: (href: string) => void }>({
  ask: async () => true,
  open: () => {},
});

/**
 * In the app: `ask(reason)` shows the grown-up gate and resolves true once a
 * grown-up answered; `open(href)` follows a link through the gate when it
 * needs one. In a browser both just go ahead.
 */
export const useGrownUpGate = () => useContext(GateCtx);

type Pending = { reason: GateReason; resolve: (ok: boolean) => void };

/**
 * The grown-up gate for the whole app: a global click interceptor for links
 * that leave Ziggy or open the parents' area, a guard for those pages when
 * reached any other way, and the hook for explicit uses.
 */
export function GrownUpGateProvider({ children }: { children: ReactNode }) {
  const shell = useAppShell();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;

  const ask = useCallback<Ask>((reason) => {
    if (!appShellNow().app) return Promise.resolve(true);
    if (reason === 'parents' && graceValid()) return Promise.resolve(true);
    pendingRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => setPending({ reason, resolve }));
  }, []);

  const settle = useCallback(async (ok: boolean) => {
    const p = pendingRef.current;
    if (!p) return;
    if (ok) setGrace();
    const settled = historySettled();
    setPending(null);
    await settled;
    p.resolve(ok);
  }, []);

  const follow = useCallback(
    (href: string, reason: GateReason) => {
      if (reason === 'external') {
        void openExternal(href);
        return;
      }
      const url = new URL(href, window.location.href);
      router.push(`${url.pathname}${url.search}${url.hash}`);
    },
    [router]
  );

  const open = useCallback(
    (href: string) => {
      const reason = gateReasonFor(href, window.location.href, locales);
      if (!reason) {
        const url = new URL(href, window.location.href);
        router.push(`${url.pathname}${url.search}${url.hash}`);
        return;
      }
      void ask(reason).then((ok) => ok && follow(new URL(href, window.location.href).href, reason));
    },
    [ask, follow, router]
  );

  // Every link in the app: those leaving Ziggy or opening the parents' area wait for a grown-up.
  useEffect(() => {
    if (!shell.app) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.hasAttribute('data-gate-skip')) return;
      const reason = gateReasonFor(a.getAttribute('href') ?? '', window.location.href, locales);
      if (!reason || (reason === 'parents' && graceValid())) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const href = a.href;
      void ask(reason).then((ok) => ok && follow(href, reason));
    };
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  }, [shell.app, ask, follow]);

  // The parents' pages reached any other way (deep link, history) ask too.
  useEffect(() => {
    if (!shell.app || !isParentsPath(pathname, locales) || graceValid() || pendingRef.current) return;
    void ask('parents').then((ok) => {
      if (ok) return;
      if (window.history.length > 1) router.back();
      else router.replace(homeOf(appShellNow()));
    });
  }, [shell.app, pathname, ask, router]);

  const value = useMemo(() => ({ ask, open }), [ask, open]);
  return (
    <GateCtx.Provider value={value}>
      {children}
      <AnimatePresence>{pending ? <GateDialog key="gate" reason={pending.reason} onDone={(ok) => void settle(ok)} /> : null}</AnimatePresence>
    </GateCtx.Provider>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'erase', '0', 'ok'] as const;

function GateDialog({ reason, onDone }: { reason: GateReason; onDone: (ok: boolean) => void }) {
  const locale = useLocale();
  const [question, setQuestion] = useState<GateQuestion>(() => makeGateQuestion());
  const [typed, setTyped] = useState('');
  const [missed, setMissed] = useState(false);
  const shake = useAnimationControls();
  const box = useRef<HTMLDivElement>(null);
  const present = useIsPresent();
  useBackLayer(true, () => onDone(false));
  useFocusReturn(present);

  const press = useCallback(
    (k: (typeof KEYS)[number]) => {
      haptic('light');
      if (k === 'erase') return setTyped((t) => t.slice(0, -1));
      if (k === 'ok') {
        if (checkGateAnswer(question, typed)) {
          haptic('success');
          onDone(true);
        } else {
          void shake.start({
            x: [0, -8, 7, -4, 0],
            transition: { duration: 0.35 },
          });
          setMissed(true);
          setTyped('');
          setQuestion(makeGateQuestion());
        }
        return;
      }
      setMissed(false);
      setTyped((t) => (t.length >= 3 ? t : t + k));
    },
    [question, typed, onDone, shake]
  );

  // The keyboard (and a TV remote's number keys) work too; Escape is "back".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack') {
        e.preventDefault();
        onDone(false);
      } else if (/^\d$/.test(e.key)) {
        e.preventDefault();
        press(e.key as (typeof KEYS)[number]);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        press('erase');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, onDone]);

  // Focus stays inside the dialog while it is open (useFocusReturn gives it back when it closes).
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('[data-tv-autofocus]')?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!present) return;
    const trap = (e: FocusEvent) => {
      if (box.current && e.target instanceof Node && !box.current.contains(e.target)) box.current.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    };
    document.addEventListener('focusin', trap);
    return () => document.removeEventListener('focusin', trap);
  }, [present]);

  return (
    <motion.div
      ref={box}
      role="dialog"
      aria-modal={present ? 'true' : undefined}
      inert={!present}
      aria-labelledby="gate-title"
      aria-describedby="gate-question"
      data-back-layer={present ? '' : undefined}
      className="fixed inset-0 z-[130] grid place-items-center overflow-y-auto bg-[radial-gradient(circle_at_50%_30%,#FFF6E4_0%,#FCE9D6_45%,#F4DCCB_100%)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-[#3B2410] dark:bg-[radial-gradient(circle_at_50%_30%,#2a2140_0%,#17122b_60%,#0c0a1a_100%)] dark:text-[#FFF1DC]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className="relative w-full max-w-[26rem] rounded-[2.25rem] bg-white/80 p-6 text-center shadow-[0_30px_80px_-30px_rgba(107,74,43,0.55)] ring-1 ring-white/70 backdrop-blur dark:bg-white/[0.06] dark:ring-white/10 sm:p-7"
        initial={{ y: 24, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ duration: 0.35 }}
      >
        <button
          type="button"
          onClick={() => onDone(false)}
          data-close=""
          className="absolute start-4 top-4 inline-flex min-h-12 items-center gap-1.5 rounded-full bg-[#3B2410]/[0.06] px-4 text-sm font-bold text-[#6B4A2B] transition active:scale-95 dark:bg-white/10 dark:text-white/80"
        >
          <span aria-hidden="true" className="rtl:rotate-180">
            ←
          </span>
          {tr(T.cancel, locale)}
        </button>
        <div className="mx-auto mt-10 w-fit">
          <ZiggyAvatar size={72} />
        </div>
        <div className="mt-3 flex items-center justify-center gap-2">
          <h2 id="gate-title" className="font-display text-3xl font-bold">
            {tr(T.title, locale)}
          </h2>
          {/* Read aloud: only who this is for, never the question (a child could type what they hear). */}
          <SayButton texts={[tr(T.title, locale), tr(reason === 'external' ? T.external : T.parents, locale), tr(T.forKids, locale)]} locale={locale} size="sm" />
        </div>
        <p className="mt-1 text-sm font-semibold opacity-75">{tr(reason === 'external' ? T.external : T.parents, locale)}</p>

        <motion.div animate={shake}>
          <p id="gate-question" className="mt-5 rounded-2xl bg-[#FFF3DD] px-4 py-3 font-display text-xl font-bold leading-snug text-[#5A3A1A] dark:bg-white/10 dark:text-[#FFE6B0]" aria-live="polite">
            {tr(question.text, locale)}
          </p>
          <p className="mt-2 min-h-5 text-sm font-semibold text-[#B45309] dark:text-amber-200" aria-live="assertive">
            {missed ? tr(T.again, locale) : ''}
          </p>

          <div className="mt-2 flex justify-center gap-2" aria-label={tr(T.typed, locale)} role="status">
            {[0, 1].map((i) => (
              <span key={i} className="grid h-14 w-12 place-items-center rounded-2xl bg-white text-3xl font-bold tabular-nums shadow-inner ring-2 ring-[#F1D3AE] dark:bg-white/10 dark:ring-white/15">
                {typed[i] ?? ''}
              </span>
            ))}
            {typed.length > 2 ? (
              <span className="grid h-14 w-12 place-items-center rounded-2xl bg-white text-3xl font-bold tabular-nums ring-2 ring-[#F1D3AE] dark:bg-white/10">{typed[2]}</span>
            ) : null}
          </div>

          <div className="mx-auto mt-5 grid max-w-[18rem] grid-cols-3 gap-3" dir="ltr">
            {KEYS.map((k, i) => (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                data-tv-autofocus={i === 0 ? '' : undefined}
                aria-label={k === 'erase' ? tr(T.erase, locale) : k === 'ok' ? tr(T.ok, locale) : k}
                disabled={k === 'ok' && !typed}
                className={`grid h-16 place-items-center rounded-2xl font-display text-2xl font-bold transition active:scale-95 disabled:opacity-40 ${
                  k === 'ok'
                    ? 'bg-gradient-to-b from-[#4ADE80] to-[#16A34A] text-white shadow-[0_4px_0_#15803D]'
                    : k === 'erase'
                      ? 'bg-[#3B2410]/[0.07] text-xl dark:bg-white/10'
                      : 'bg-white shadow-[0_4px_0_#EBD3B5] dark:bg-white/[0.12] dark:shadow-[0_4px_0_rgba(0,0,0,0.4)]'
                }`}
              >
                {k === 'erase' ? '⌫' : k === 'ok' ? '✓' : k}
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocale } from 'next-intl';
import { motion } from 'motion/react';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { refreshSantaPass } from '@/lib/santa/pass-client';
import { SANTA_OFFERS, SANTA_VALID_UNTIL_TEXT } from '@/lib/santa/offer';
import type { SantaTier } from '@/lib/santa/types';

/**
 * Stripe's return page (/pere-noel/merci?session_id=…), and the restore link
 * of the pass: checks the session through /api/santa/pass (which sets the
 * cookie), then celebrates. A payment still on its way or a link we can't
 * find gets a calm message, never a failure screen.
 */

const T = {
  checking: { fr: 'Le Père Noël vérifie son grand livre…', en: 'Santa is checking his big book…' },
  ready: { fr: 'C’est prêt !', en: 'It’s ready!' },
  readyNote: { fr: '{pack} est actif sur cet appareil, jusqu’au {d}. Merci !', en: '{pack} is active on this device, until {d}. Thank you!' },
  keepTitle: { fr: 'Gardez ce lien', en: 'Keep this link' },
  keepNote: {
    fr: 'Ajoutez cette page à vos favoris ou copiez son lien : il permet de retrouver votre pass sur un autre appareil (tablette, téléphone…). Ne le partagez pas en dehors de la famille.',
    en: 'Bookmark this page or copy its link: it restores your pass on another device (tablet, phone…). Don’t share it outside the family.',
  },
  copy: { fr: 'Copier le lien', en: 'Copy the link' },
  copied: { fr: 'Lien copié !', en: 'Link copied!' },
  call: { fr: 'Appeler le Père Noël', en: 'Call Santa' },
  photo: { fr: 'Photo avec le Père Noël', en: 'Photo with Santa' },
  parents: { fr: 'Espace parents', en: 'Parents’ area' },
  pendingTitle: { fr: 'Encore un petit instant…', en: 'Just a moment more…' },
  pendingNote: {
    fr: 'Le paiement est en cours de confirmation par la banque. Cela peut prendre quelques minutes : gardez ce lien et revenez-y, le pass s’activera tout seul.',
    en: 'The bank is still confirming the payment. It can take a few minutes: keep this link and come back to it, the pass will switch on by itself.',
  },
  retry: { fr: 'Vérifier à nouveau', en: 'Check again' },
  unknownTitle: { fr: 'On n’a pas retrouvé ce paiement', en: 'We couldn’t find this payment' },
  unknownNote: {
    fr: 'Le lien est peut-être incomplet. Vous pouvez le coller dans l’espace parents, ou nous écrire à contact@ziggy-ai.fr : on vous aidera avec plaisir.',
    en: 'The link may be incomplete. You can paste it in the parents’ area, or write to contact@ziggy-ai.fr: we’ll gladly help.',
  },
  offlineTitle: { fr: 'Pas de réseau pour l’instant', en: 'No connection right now' },
  offlineNote: { fr: 'Votre paiement n’est pas perdu. Réessayez dans un instant.', en: 'Your payment isn’t lost. Try again in a moment.' },
  village: { fr: 'Retour au village du Père Noël', en: 'Back to Santa’s village' },
} satisfies Record<string, L>;

type State = { kind: 'checking' } | { kind: 'ready'; tier: SantaTier } | { kind: 'pending' } | { kind: 'unknown' } | { kind: 'offline' };

const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');

export function SantaThanks({ sessionId }: { sessionId: string | null }) {
  const locale = useLocale();
  const [state, setState] = useState<State>(sessionId ? { kind: 'checking' } : { kind: 'unknown' });
  const tries = useRef(0);

  const check = useCallback(async () => {
    if (!sessionId) return;
    setState({ kind: 'checking' });
    try {
      const res = await fetch(`/api/santa/pass?session_id=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as { tier?: SantaTier; pending?: boolean } | null;
      if (res.ok && (data?.tier === 'essentiel' || data?.tier === 'magique')) {
        setState({ kind: 'ready', tier: data.tier });
        void refreshSantaPass();
      } else if (res.status === 402 && data?.pending) setState({ kind: 'pending' });
      else if (res.status === 400 || res.status === 402 || res.status === 404) setState({ kind: 'unknown' });
      else setState({ kind: 'offline' });
    } catch {
      setState({ kind: 'offline' });
    }
  }, [sessionId]);

  useEffect(() => {
    void check();
  }, [check]);

  // A payment on its way: look again a few times on its own.
  useEffect(() => {
    if (state.kind !== 'pending' || tries.current >= 5) return;
    const t = window.setTimeout(() => {
      tries.current += 1;
      void check();
    }, 4000);
    return () => window.clearTimeout(t);
  }, [state.kind, check]);

  return (
    <div className="relative min-h-screen overflow-clip bg-[linear-gradient(180deg,#0E1B3D_0%,#1B2F5E_55%,#2B4580_100%)] px-4 pb-24 pt-28 text-white sm:px-6">
      <Snow />
      <div className="relative mx-auto max-w-2xl text-center">
        {state.kind === 'checking' ? (
          <div className="py-20" role="status">
            <motion.div className="mx-auto text-6xl" animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 1.6, repeat: Infinity }} aria-hidden="true">
              📖
            </motion.div>
            <p className="mt-6 font-display text-2xl font-bold">{tr(T.checking, locale)}</p>
          </div>
        ) : state.kind === 'ready' ? (
          <Ready tier={state.tier} />
        ) : (
          <Calm state={state.kind} onRetry={() => void check()} canRetry={Boolean(sessionId)} />
        )}
        <p className="mt-10 text-sm">
          <Link href="/pere-noel" className="font-semibold text-white/80 underline underline-offset-4">
            {tr(T.village, locale)}
          </Link>
        </p>
      </div>
    </div>
  );
}

function Ready({ tier }: { tier: SantaTier }) {
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => setLink(window.location.href), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      input.current?.select();
      document.execCommand?.('copy');
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div>
      <div className="relative mx-auto h-40 w-40">
        <Sparkles reduce={reduce} />
        <motion.div
          className="absolute inset-0 grid place-items-center text-8xl"
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14 }}
          aria-hidden="true"
        >
          🎅
        </motion.div>
      </div>
      <motion.h1
        className="mt-4 font-display text-5xl font-bold text-[#FFE08A] drop-shadow-[0_4px_20px_rgba(255,200,80,0.45)] sm:text-6xl"
        initial={reduce ? false : { y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        {tr(T.ready, locale)}
      </motion.h1>
      <p className="mx-auto mt-4 max-w-lg text-lg text-white/90">
        {fill(tr(T.readyNote, locale), { pack: tr(SANTA_OFFERS[tier].name, locale), d: tr(SANTA_VALID_UNTIL_TEXT, locale) })}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link href="/pere-noel/appel" className="grid min-h-16 place-items-center rounded-[1.5rem] bg-gradient-to-b from-[#E23A4B] to-[#B91C2E] px-5 font-display text-xl font-bold text-white shadow-[0_5px_0_#8E1422] transition active:scale-95">
          <span>
            <span aria-hidden="true">📞 </span>
            {tr(T.call, locale)}
          </span>
        </Link>
        <Link href="/pere-noel/photo" className="grid min-h-16 place-items-center rounded-[1.5rem] bg-gradient-to-b from-[#2A9862] to-[#1F7A4D] px-5 font-display text-xl font-bold text-white shadow-[0_5px_0_#155737] transition active:scale-95">
          <span>
            <span aria-hidden="true">📸 </span>
            {tr(T.photo, locale)}
          </span>
        </Link>
      </div>

      <section className="mt-10 rounded-[2rem] bg-white/10 p-5 text-start ring-1 ring-white/15 backdrop-blur sm:p-6" aria-labelledby="keep-title">
        <h2 id="keep-title" className="font-display text-xl font-bold text-[#FFE08A]">
          <span aria-hidden="true">🔖 </span>
          {tr(T.keepTitle, locale)}
        </h2>
        <p className="mt-2 text-sm text-white/85">{tr(T.keepNote, locale)}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            ref={input}
            readOnly
            value={link}
            aria-label={tr(T.keepTitle, locale)}
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-12 min-w-0 flex-1 rounded-2xl bg-white/90 px-4 text-sm text-[#1B2F5E]"
          />
          <button type="button" onClick={() => void copy()} disabled={!link} className="min-h-12 rounded-2xl bg-[#FFE08A] px-5 font-bold text-[#4A2A12] transition active:scale-95 disabled:opacity-60">
            {copied ? tr(T.copied, locale) : tr(T.copy, locale)}
          </button>
        </div>
        <p className="mt-4 text-sm">
          <Link href="/pere-noel/parents" className="font-semibold text-white underline underline-offset-4">
            {tr(T.parents, locale)}
          </Link>
        </p>
      </section>
    </div>
  );
}

function Calm({ state, onRetry, canRetry }: { state: 'pending' | 'unknown' | 'offline'; onRetry: () => void; canRetry: boolean }) {
  const locale = useLocale();
  const title = state === 'pending' ? T.pendingTitle : state === 'offline' ? T.offlineTitle : T.unknownTitle;
  const note = state === 'pending' ? T.pendingNote : state === 'offline' ? T.offlineNote : T.unknownNote;
  return (
    <div className="py-10">
      <div className="text-7xl" aria-hidden="true">
        {state === 'pending' ? '⏳' : state === 'offline' ? '❄️' : '🎄'}
      </div>
      <h1 className="mt-5 font-display text-4xl font-bold text-[#FFE08A]">{tr(title, locale)}</h1>
      <p className="mx-auto mt-3 max-w-lg text-lg text-white/90">{tr(note, locale)}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {canRetry && state !== 'unknown' ? (
          <button type="button" onClick={onRetry} className="min-h-14 rounded-2xl bg-[#FFE08A] px-6 font-display text-lg font-bold text-[#4A2A12] transition active:scale-95">
            {tr(T.retry, locale)}
          </button>
        ) : null}
        <Link href="/pere-noel/parents" className="grid min-h-14 place-items-center rounded-2xl bg-white/15 px-6 font-display text-lg font-bold text-white ring-1 ring-white/25 transition active:scale-95">
          {tr(T.parents, locale)}
        </Link>
      </div>
    </div>
  );
}

/* Deterministic "random" (same on the server and in the browser: no hydration mismatch). */
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return Math.round((x - Math.floor(x)) * 1000) / 1000;
};
const px = (v: number) => Math.round(v * 10) / 10;

const FLAKES = Array.from({ length: 36 }, (_, i) => ({
  left: rand(i, 1) * 100,
  size: 4 + rand(i, 2) * 7,
  duration: 9 + rand(i, 3) * 10,
  delay: -rand(i, 4) * 18,
  drift: (rand(i, 5) - 0.5) * 60,
  opacity: 0.45 + rand(i, 6) * 0.5,
}));

/** Falling snow: transform/opacity only, still (a light dusting) with reduced motion. */
function Snow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes santa-snow { from { transform: translate3d(0,-10vh,0); } to { transform: translate3d(var(--drift),110vh,0); } }
        .santa-flake { animation: santa-snow var(--dur) linear var(--delay) infinite; will-change: transform; }
        @media (prefers-reduced-motion: reduce) { .santa-flake { animation: none; transform: translate3d(0, var(--still), 0); } }
      `}</style>
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="santa-flake absolute top-0 rounded-full bg-white"
          style={
            {
              left: `${f.left}%`,
              width: f.size,
              height: f.size,
              opacity: f.opacity,
              '--dur': `${f.duration}s`,
              '--delay': `${f.delay}s`,
              '--drift': `${f.drift}px`,
              '--still': `${Math.round(rand(i, 7) * 90)}vh`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

const SPARKS = Array.from({ length: 10 }, (_, i) => ({
  angle: (i / 10) * Math.PI * 2,
  r: 62 + rand(i, 8) * 22,
  size: 10 + rand(i, 9) * 12,
  delay: rand(i, 10) * 1.2,
}));

/** Golden sparkles around Santa (still with reduced motion). */
function Sparkles({ reduce }: { reduce: boolean }) {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {SPARKS.map((s, i) => (
        <motion.span
          key={i}
          className="absolute select-none text-[#FFD34D]"
          style={{ left: `calc(50% + ${px(Math.cos(s.angle) * s.r)}px)`, top: `calc(50% + ${px(Math.sin(s.angle) * s.r)}px)`, fontSize: s.size, translateX: '-50%', translateY: '-50%' }}
          animate={reduce ? { opacity: 0.9 } : { opacity: [0, 1, 0], scale: [0.4, 1.2, 0.4] }}
          transition={reduce ? { duration: 0 } : { duration: 1.8, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          ✦
        </motion.span>
      ))}
    </div>
  );
}

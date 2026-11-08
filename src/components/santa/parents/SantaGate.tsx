'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { GATE_GRACE_MS, checkGateAnswer, makeGateQuestion, type GateQuestion } from '@/lib/grown-up-gate';
import { ZiggyAvatar } from '@/components/ziggy/Mascot';
import { SayButton } from '@/components/arcade/read-aloud';

/**
 * The grown-up gate in front of the Santa parents' area, on the website AND
 * in the app (buying needs a real gate everywhere; the shared provider only
 * asks inside the app). Same questions as the app gate (grown-up-gate.ts),
 * and the same 5-minute grace in sessionStorage, so a parent who just
 * answered in the app is not asked twice.
 */

const T = {
  title: { fr: 'Demande à un grand', en: 'Ask a grown-up' },
  forParents: { fr: 'Cette partie est pour les parents : on y achète et on y règle l’appli du Père Noël.', en: 'This part is for parents: it is where Santa’s app is bought and set up.' },
  forKids: { fr: 'Tu veux retourner au village du Père Noël ? Touche Retour.', en: 'Want to go back to Santa’s village? Tap Back.' },
  answer: { fr: 'Réponse', en: 'Answer' },
  ok: { fr: 'Valider', en: 'OK' },
  erase: { fr: 'Effacer', en: 'Delete' },
  back: { fr: 'Retour', en: 'Back' },
  again: { fr: 'Ce n’est pas ça. Voici une autre question.', en: 'Not quite. Here is another question.' },
} satisfies Record<string, L>;

const GRACE_KEY = 'ziggy:grownup';

export function gateGraceValid(): boolean {
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

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'erase', '0', 'ok'] as const;
type Key = (typeof KEYS)[number];

export function SantaGate({ onPass, backHref }: { onPass: () => void; backHref: string }) {
  const locale = useLocale();
  // Random question: made after mount only (the server and the first render must match).
  const [question, setQuestion] = useState<GateQuestion | null>(null);
  const [typed, setTyped] = useState('');
  const [missed, setMissed] = useState(false);

  useEffect(() => setQuestion(makeGateQuestion()), []);

  const press = useCallback(
    (k: Key) => {
      if (!question) return;
      if (k === 'erase') return setTyped((t) => t.slice(0, -1));
      if (k === 'ok') {
        if (checkGateAnswer(question, typed)) {
          setGrace();
          onPass();
        } else {
          setMissed(true);
          setTyped('');
          setQuestion(makeGateQuestion());
        }
        return;
      }
      setMissed(false);
      setTyped((t) => (t.length >= 3 ? t : t + k));
    },
    [question, typed, onPass]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        press(e.key as Key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        press('erase');
      } else if (e.key === 'Enter' && typed) {
        e.preventDefault();
        press('ok');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, typed]);

  return (
    <div role="group" aria-labelledby="santa-gate-title" aria-describedby="santa-gate-question" className="mx-auto w-full max-w-[26rem] rounded-[2.25rem] bg-white/85 p-6 text-center text-[#3B2410] shadow-[0_30px_80px_-30px_rgba(107,74,43,0.55)] ring-1 ring-white/70 dark:bg-white/[0.06] dark:text-[#FFF1DC] dark:ring-white/10 sm:p-7">
      <div className="flex items-center justify-between">
        <Link href={backHref} className="inline-flex min-h-12 items-center gap-1.5 rounded-full bg-[#3B2410]/[0.06] px-4 text-sm font-bold text-[#6B4A2B] transition active:scale-95 dark:bg-white/10 dark:text-white/80">
          <span aria-hidden="true" className="rtl:rotate-180">
            ←
          </span>
          {tr(T.back, locale)}
        </Link>
        <ZiggyAvatar size={56} />
      </div>
      <div className="mt-4 flex items-center justify-center gap-2">
        <h2 id="santa-gate-title" className="font-display text-3xl font-bold">
          {tr(T.title, locale)}
        </h2>
        {/* Read aloud: who this is for, never the question (a child could type what they hear). */}
        <SayButton texts={[tr(T.title, locale), tr(T.forParents, locale), tr(T.forKids, locale)]} locale={locale} size="sm" />
      </div>
      <p className="mt-1 text-sm font-semibold opacity-75">{tr(T.forParents, locale)}</p>

      <p id="santa-gate-question" className="mt-5 min-h-[3.5rem] rounded-2xl bg-[#FFF3DD] px-4 py-3 font-display text-xl font-bold leading-snug text-[#5A3A1A] dark:bg-white/10 dark:text-[#FFE6B0]" aria-live="polite">
        {question ? tr(question.text, locale) : ' '}
      </p>
      <p className="mt-2 min-h-5 text-sm font-semibold text-[#B45309] dark:text-amber-200" aria-live="assertive">
        {missed ? tr(T.again, locale) : ''}
      </p>

      <div className="mt-2 flex justify-center gap-2" aria-label={tr(T.answer, locale)} role="status">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`grid h-14 w-12 place-items-center rounded-2xl bg-white text-3xl font-bold tabular-nums shadow-inner ring-2 ring-[#F1D3AE] dark:bg-white/10 dark:ring-white/15 ${i === 2 && typed.length < 3 ? 'opacity-40' : ''}`}>
            {typed[i] ?? ''}
          </span>
        ))}
      </div>

      <div className="mx-auto mt-5 grid max-w-[18rem] grid-cols-3 gap-3" dir="ltr">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            aria-label={k === 'erase' ? tr(T.erase, locale) : k === 'ok' ? tr(T.ok, locale) : k}
            disabled={(k === 'ok' && !typed) || !question}
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
    </div>
  );
}

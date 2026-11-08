'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { api } from '@/lib/world/store';
import { useProfile } from '@/components/account/ProfileProvider';
import bible from '@/data/lutins/bible.json';

type Target = 'sheet' | 'pepin' | 'grelotte' | 'noisette';
type Entry = { approved: boolean; url: string | null; candidates: { path: string; url: string | null }[] };
type State = { targets: Record<Target, Entry>; agnes: boolean };

const T = {
  title: { fr: 'Les portraits des lutins', en: 'The elves’ portraits' },
  lead: {
    fr: 'Faites d’abord la planche des trois lutins, validez la meilleure : elle devient la référence de toutes les farces. Puis faites les trois portraits (ils copient la planche validée).',
    en: 'First make the sheet of the three elves and approve the best one: it becomes the reference for every prank. Then make the three portraits (they copy the approved sheet).',
  },
  owner: { fr: 'Réservé au propriétaire : connectez-vous avec le compte propriétaire.', en: 'Owner only: sign in with the owner account.' },
  login: { fr: 'Se connecter', en: 'Sign in' },
  noAgnes: { fr: 'Agnes n’est pas configuré sur ce serveur (AGNES_API_KEY).', en: 'Agnes is not configured on this server (AGNES_API_KEY).' },
  sheet: { fr: 'La planche (référence)', en: 'The sheet (reference)' },
  make: { fr: 'Générer une version', en: 'Generate a version' },
  making: { fr: 'Agnes dessine… (jusqu’à une minute)', en: 'Agnes is drawing… (up to a minute)' },
  approve: { fr: 'Valider celle-ci', en: 'Approve this one' },
  approved: { fr: 'Validée', en: 'Approved' },
  current: { fr: 'Version validée', en: 'Approved version' },
  none: { fr: 'Pas encore validée', en: 'Not approved yet' },
  sheetFirst: { fr: 'Validez d’abord la planche pour des portraits fidèles.', en: 'Approve the sheet first for faithful portraits.' },
  failed: { fr: 'La génération a échoué, réessayez.', en: 'Generation failed, try again.' },
} satisfies Record<string, L>;

const NAMES: Record<Target, L> = { sheet: T.sheet, ...Object.fromEntries(bible.elves.map((e) => [e.id, e.name])) } as Record<Target, L>;

export function LutinsPortraits() {
  const locale = useLocale();
  const { isOwner } = useProfile();
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<Target | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<State>('lutins/portraits');
    if (r.ok) setState(r.data);
  }, []);
  useEffect(() => {
    if (isOwner) void load();
  }, [isOwner, load]);

  const generate = async (target: Target) => {
    setBusy(target);
    setError(null);
    const r = await api<State & { path: string }>('lutins/portraits', { body: { generate: target } });
    setBusy(null);
    if (r.ok) setState((s) => ({ targets: r.data.targets, agnes: s?.agnes ?? true }));
    else setError(`${tr(T.failed, locale)} (${r.error})`);
  };
  const approve = async (target: Target, path: string) => {
    const r = await api<State>('lutins/portraits', { body: { approve: { target, path } } });
    if (r.ok) setState((s) => ({ targets: r.data.targets, agnes: s?.agnes ?? true }));
  };

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-xl px-4 pb-24 pt-32 text-center text-white">
        <h1 className="font-display text-4xl font-bold">{tr(T.title, locale)}</h1>
        <p className="mt-4 text-white/80">{tr(T.owner, locale)}</p>
        <Link href="/login" className="mt-6 inline-flex min-h-14 items-center rounded-full bg-white px-6 font-bold text-[#1b2150]">
          {tr(T.login, locale)}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-28 text-white sm:px-6">
      <h1 className="text-center font-display text-4xl font-bold">🎨 {tr(T.title, locale)}</h1>
      <p className="mx-auto mt-3 max-w-3xl text-center text-white/80">{tr(T.lead, locale)}</p>
      {state && !state.agnes && <p className="mx-auto mt-4 max-w-xl rounded-2xl bg-amber-300 px-4 py-3 text-center font-semibold text-[#3b1f00]">{tr(T.noAgnes, locale)}</p>}
      {error && <p className="mx-auto mt-4 max-w-xl rounded-2xl bg-amber-300 px-4 py-3 text-center font-semibold text-[#3b1f00]">{error}</p>}
      {(['sheet', 'pepin', 'grelotte', 'noisette'] as Target[]).map((t) => {
        const e = state?.targets[t];
        return (
          <section key={t} className="mt-10 rounded-[2rem] bg-white/10 p-5 ring-1 ring-white/15 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-bold">{tr(NAMES[t], locale)}</h2>
              <button type="button" disabled={busy !== null || state?.agnes === false} onClick={() => generate(t)} className="min-h-12 rounded-full bg-[#2fb344] px-5 font-bold disabled:opacity-50">
                {busy === t ? `⏳ ${tr(T.making, locale)}` : `✨ ${tr(T.make, locale)}`}
              </button>
            </div>
            {t !== 'sheet' && !state?.targets.sheet.approved && <p className="mt-2 text-sm text-amber-200">{tr(T.sheetFirst, locale)}</p>}
            <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div>
                <p className="mb-2 text-sm font-bold uppercase tracking-wider text-white/70">{tr(T.current, locale)}</p>
                {e?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.url} alt="" className="w-full rounded-2xl bg-white/5 ring-4 ring-[#2fb344]" />
                ) : (
                  <div className="grid aspect-square place-items-center rounded-2xl bg-white/5 text-sm text-white/60">{tr(T.none, locale)}</div>
                )}
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {e?.candidates.map((c) => (
                  <li key={c.path} className="overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/15">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.url && <img src={c.url} alt="" className="w-full" />}
                    <button type="button" onClick={() => approve(t, c.path)} className="min-h-11 w-full bg-white/10 text-sm font-bold hover:bg-white/20">
                      ✓ {tr(T.approve, locale)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}

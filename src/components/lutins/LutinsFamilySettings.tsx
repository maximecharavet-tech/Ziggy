'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useLocale } from 'next-intl';
import { tr, type L } from '@/lib/i18n-text';
import { cleanName } from '@/lib/santa/store';
import { buildLetter, type LetterKind } from '@/data/lutins/letters';
import { arrivalKey, lutinsStore, morningOf, seasonYear, setChildName, useChildName, useLutinsSettings } from '@/lib/lutins/family';
import { ElfLetterDialog, WaxSeal } from '@/components/lutins/ElfLetter';

/**
 * Parents' settings of the ritual: the child's first name (shared with the
 * Santa app, on this device only), the elves' arrival and departure days, and
 * the three kinds of letters to preview and print.
 */

const T = {
  title: { fr: 'Lettres & rituel', en: 'Letters & ritual' },
  nameTitle: { fr: 'Le prénom de votre enfant', en: 'Your child’s first name' },
  nameHelp: {
    fr: 'Les lutins l’écrivent dans leurs lettres. Il reste sur cet appareil (le même que pour l’appli du Père Noël).',
    en: 'The elves write it in their letters. It stays on this device (the same as for the Santa app).',
  },
  namePh: { fr: 'Prénom', en: 'First name' },
  save: { fr: 'Enregistrer', en: 'Save' },
  saved: { fr: 'Enregistré ✓', en: 'Saved ✓' },
  bad: { fr: 'Juste un prénom, avec des lettres.', en: 'Just a first name, with letters.' },
  arrivalTitle: { fr: 'Le jour d’arrivée des lutins', en: 'The elves’ arrival day' },
  arrivalHelp: {
    fr: 'Ce matin-là, la lettre d’arrivée attend votre enfant dans le journal (ou dès la première farce, si elle vient avant).',
    en: 'That morning, the arrival letter waits for your child in the journal (or with the first prank, if it comes earlier).',
  },
  departureTitle: { fr: 'Le jour du départ', en: 'The departure day' },
  departureHelp: { fr: 'Ce matin-là, une lettre d’au revoir toute joyeuse : « à l’année prochaine ! »', en: 'That morning, a cheerful goodbye letter: “see you next year!”' },
  d24: { fr: '24 décembre', en: 'December 24' },
  d25: { fr: '25 décembre', en: 'December 25' },
  letters: { fr: 'Les lettres des lutins', en: 'The elves’ letters' },
  lettersHelp: {
    fr: 'À lire à voix haute ou à imprimer. Astuce : posez la lettre d’arrivée imprimée près du sapin le premier matin.',
    en: 'To read aloud or print. Tip: leave the printed arrival letter by the tree on the first morning.',
  },
  arrival: { fr: 'Lettre d’arrivée', en: 'Arrival letter' },
  morning: { fr: 'Mot du matin (exemple)', en: 'Morning note (example)' },
  departure: { fr: 'Lettre de départ', en: 'Goodbye letter' },
  open: { fr: 'Voir & imprimer', en: 'View & print' },
} satisfies Record<string, L>;

export function LutinsFamilySettings() {
  const locale = useLocale();
  const s = useLutinsSettings();
  const childName = useChildName();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'saved' | 'bad'>('idle');
  const [year, setYear] = useState<number | null>(null);
  const [preview, setPreview] = useState<LetterKind | null>(null);
  useEffect(() => setYear(seasonYear(new Date())), []);
  useEffect(() => setName(childName ?? ''), [childName]);

  const save = () => {
    if (!cleanName(name)) return setStatus('bad');
    setChildName(name);
    setStatus('saved');
  };

  const arrival = year ? arrivalKey(s, year) : '';
  const arrivalLabel = year ? morningOf(arrival).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : '';

  return (
    <section className="mx-auto mt-8 grid max-w-4xl gap-5">
      <div className="rounded-[2rem] bg-white/10 p-5 ring-1 ring-white/15 sm:p-7">
        <h2 className="font-display text-2xl font-bold">✏️ {tr(T.nameTitle, locale)}</h2>
        <p className="mt-1 text-white/75">{tr(T.nameHelp, locale)}</p>
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input
            value={name}
            onChange={(e) => (setName(e.target.value.slice(0, 24)), setStatus('idle'))}
            placeholder={tr(T.namePh, locale)}
            autoComplete="off"
            aria-label={tr(T.nameTitle, locale)}
            className="min-h-14 min-w-0 flex-1 rounded-2xl bg-white px-4 text-xl font-bold text-[#1b2150] outline-none ring-4 ring-transparent focus:ring-amber-300"
          />
          <button type="submit" className="min-h-14 rounded-full bg-[#2fb344] px-6 font-display text-lg font-bold">
            {status === 'saved' ? tr(T.saved, locale) : tr(T.save, locale)}
          </button>
        </form>
        {status === 'bad' && <p className="mt-2 font-semibold text-amber-200">{tr(T.bad, locale)}</p>}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-[2rem] bg-white/10 p-5 ring-1 ring-white/15 sm:p-7">
          <h2 className="font-display text-2xl font-bold">🛷 {tr(T.arrivalTitle, locale)}</h2>
          <p className="mt-1 text-white/75">{tr(T.arrivalHelp, locale)}</p>
          {year && (
            <>
              <input
                type="date"
                value={arrival}
                min={`${year}-11-15`}
                max={`${year}-12-24`}
                onChange={(e) => lutinsStore.setArrival(e.target.value || null)}
                aria-label={tr(T.arrivalTitle, locale)}
                className="mt-4 min-h-14 w-full rounded-2xl bg-white px-4 text-lg font-bold text-[#1b2150] outline-none [color-scheme:light] focus:ring-4 focus:ring-amber-300"
              />
              <p className="mt-2 text-sm font-semibold text-amber-200 first-letter:uppercase">{arrivalLabel}</p>
            </>
          )}
        </div>
        <div className="rounded-[2rem] bg-white/10 p-5 ring-1 ring-white/15 sm:p-7">
          <h2 className="font-display text-2xl font-bold">🎄 {tr(T.departureTitle, locale)}</h2>
          <p className="mt-1 text-white/75">{tr(T.departureHelp, locale)}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {([24, 25] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={s.departure === d}
                onClick={() => lutinsStore.setDeparture(d)}
                className={`min-h-14 rounded-2xl font-display text-lg font-bold ${s.departure === d ? 'bg-white text-[#1b2150]' : 'bg-white/10 ring-1 ring-white/25'}`}
              >
                {tr(d === 24 ? T.d24 : T.d25, locale)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] bg-white/10 p-5 ring-1 ring-white/15 sm:p-7">
        <h2 className="font-display text-2xl font-bold">✉️ {tr(T.letters, locale)}</h2>
        <p className="mt-1 text-white/75">{tr(T.lettersHelp, locale)}</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {(['arrival', 'morning', 'departure'] as const).map((k) => {
            const l = buildLetter(k, locale, { name: childName, prankId: k === 'morning' ? 'chocolat-chaud' : null });
            return (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => setPreview(k)}
                  className="relative flex h-full min-h-40 w-full flex-col rounded-2xl bg-[linear-gradient(180deg,#fffaf0,#f3dfb6)] p-4 pb-14 text-start text-[#4a2c12] shadow-lg"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-[#a07a4a]">{tr(T[k], locale)}</span>
                  <span className="mt-1 font-display text-lg font-bold leading-tight text-[#b3261e]">{l.title}</span>
                  <span className="mt-1 line-clamp-2 text-sm">{l.paragraphs[0]}</span>
                  <span className="absolute bottom-3 left-4 rounded-full bg-[#4a2c12] px-3 py-1 text-sm font-bold text-white">{tr(T.open, locale)}</span>
                  <WaxSeal className="absolute -bottom-2 -right-2 h-14 w-14 rotate-12" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <AnimatePresence>
        {preview && (
          <ElfLetterDialog
            key={preview}
            kind={preview}
            prankId={preview === 'morning' ? 'chocolat-chaud' : null}
            dateIso={preview === 'arrival' && year ? morningOf(arrival).toISOString() : null}
            onClose={() => setPreview(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

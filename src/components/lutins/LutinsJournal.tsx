'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { journal, useJournal, type JournalEntry } from '@/lib/lutins/journal';
import { animateEntry, type AnimateState } from '@/lib/lutins/animate';
import { arrivalDue, departureDue, lettersReached, lutinsStore, seasonYear, useChildName, useLutinsSettings } from '@/lib/lutins/family';
import { RevealCeremony } from '@/components/lutins/RevealCeremony';
import { ElfLetterDialog, LetterEnvelope } from '@/components/lutins/ElfLetter';

const T = {
  title: { fr: 'Le journal des lutins', en: 'The elves’ journal' },
  surprise: { fr: 'Les lutins sont passés cette nuit !', en: 'The elves came by last night!' },
  nothing: { fr: 'Les lutins préparent leur prochaine farce… Reviens demain matin !', en: 'The elves are planning their next prank… Come back tomorrow morning!' },
  empty: { fr: 'Pas encore de farce. Les lutins arrivent bientôt !', en: 'No prank yet. The elves are coming soon!' },
  all: { fr: 'Toutes leurs farces', en: 'All their pranks' },
  animate: { fr: 'Les faire bouger', en: 'Make them move' },
  animating: { fr: 'Les lutins se mettent en mouvement…', en: 'The elves are getting moving…' },
  close: { fr: 'Fermer', en: 'Close' },
  parents: { fr: 'Atelier des parents', en: 'Parents’ workshop' },
  failed: { fr: 'Les lutins sont trop fatigués pour bouger aujourd’hui. On réessaiera !', en: 'The elves are too tired to move today. We’ll try again!' },
  note: { fr: 'Le mot des lutins', en: 'The elves’ note' },
  letters: { fr: 'Les lettres des lutins', en: 'The elves’ letters' },
  arrival: { fr: 'Lettre d’arrivée', en: 'Arrival letter' },
  departure: { fr: 'Lettre de départ', en: 'Goodbye letter' },
} satisfies Record<string, L>;

function useObjectUrl(blob: Blob | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return setUrl(null);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function Viewer({ entry, onClose }: { entry: JournalEntry; onClose: () => void }) {
  const locale = useLocale();
  const img = useObjectUrl(entry.image);
  const vid = useObjectUrl(entry.video);
  const [anim, setAnim] = useState<AnimateState | null>(null);
  const [note, setNote] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !note && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, note]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-[#0b0a26]/95 p-4 text-white backdrop-blur" role="dialog" aria-label={entry.caption}>
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[1.5rem] shadow-2xl ring-1 ring-white/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {vid ? <video src={vid} autoPlay loop playsInline controls className="block max-h-[70vh] w-full bg-black object-contain" /> : img && <img src={img} alt={entry.caption} className="block max-h-[70vh] w-full object-contain" />}
      </div>
      <div className="flex items-center gap-3">
        <p className="max-w-2xl text-center font-display text-2xl font-bold">« {entry.caption} »</p>
        <SayButton texts={[entry.caption]} locale={locale} size="md" className="shrink-0" />
      </div>
      {anim && anim.phase !== 'done' && (
        <div className="w-64">
          <p className="text-center text-sm font-bold">{anim.phase === 'failed' ? tr(T.failed, locale) : tr(T.animating, locale)}</p>
          {anim.phase !== 'failed' && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-amber-300 transition-[width] duration-500" style={{ width: `${Math.round(anim.progress * 100)}%` }} />
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => setNote(true)} className="min-h-14 rounded-full bg-[#fbefd4] px-6 font-display text-lg font-bold text-[#4a2c12]">
          📜 {tr(T.note, locale)}
        </button>
        {!entry.video && (!anim || anim.phase === 'failed') && (
          <button type="button" onClick={() => void animateEntry(entry, setAnim)} className="min-h-14 rounded-full bg-gradient-to-r from-amber-300 to-amber-400 px-6 font-display text-lg font-bold text-[#3b1f00]">
            🎬 {tr(T.animate, locale)}
          </button>
        )}
        <button type="button" onClick={onClose} className="min-h-14 rounded-full bg-white/15 px-6 font-display text-lg font-bold ring-1 ring-white/30">
          {tr(T.close, locale)}
        </button>
      </div>
      <AnimatePresence>{note && <ElfLetterDialog kind="morning" prankId={entry.prankId} elves={entry.elves} dateIso={entry.revealAt} onClose={() => setNote(false)} />}</AnimatePresence>
    </motion.div>
  );
}

function Thumb({ entry, onOpen }: { entry: JournalEntry; onOpen: () => void }) {
  const locale = useLocale();
  const url = useObjectUrl(entry.image);
  const d = new Date(entry.revealAt);
  return (
    <button type="button" onClick={onOpen} className="group block w-full overflow-hidden rounded-2xl bg-white/10 text-start ring-1 ring-white/15 transition-transform active:scale-[0.98]">
      <span className="relative block aspect-[4/3] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
        <span className="absolute left-2 top-2 rounded-full bg-[#c92a2a] px-2.5 py-0.5 text-xs font-black">{d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' })}</span>
        {entry.video && <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs">🎬</span>}
      </span>
      <span className="block p-3 text-sm font-semibold leading-snug">{entry.caption}</span>
    </button>
  );
}

export function LutinsJournal() {
  const locale = useLocale();
  const { entries, ready } = useJournal();
  const settings = useLutinsSettings();
  const childName = useChildName();
  const [now, setNow] = useState<number | null>(null);
  const [ceremony, setCeremony] = useState<JournalEntry | null>(null);
  const [viewing, setViewing] = useState<JournalEntry | null>(null);
  const [letter, setLetter] = useState<'arrival' | 'departure' | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const visible = useMemo(() => (now === null ? [] : entries.filter((e) => Date.parse(e.revealAt) <= now)), [entries, now]);
  const fresh = visible.find((e) => !e.seen) ?? null;
  const waiting = now !== null && entries.some((e) => Date.parse(e.revealAt) > now);
  const date = now === null ? null : new Date(now);
  const year = date ? seasonYear(date) : 0;
  // The ritual's order: the arrival letter first, then the night's prank, then the goodbye letter.
  const arrival = date !== null && arrivalDue(settings, date, visible.length > 0);
  const departure = date !== null && !arrival && !fresh && !ceremony && departureDue(settings, date);
  const shelf = date ? lettersReached(settings, date, visible.length > 0).filter((k) => !(k === 'arrival' && arrival) && !(k === 'departure' && departure)) : [];
  const live = ceremony ?? (!arrival ? fresh : null);

  const openLetter = (k: 'arrival' | 'departure') => {
    setLetter(k);
    lutinsStore.markOpened(`${k}-${year}`);
  };

  const greeting = arrival ? null : fresh ? tr(T.surprise, locale) : waiting ? tr(T.nothing, locale) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-24 text-white sm:px-6 sm:pt-28">
      <div className="flex items-center justify-center gap-3 text-center">
        <h1 className="font-display text-4xl font-bold text-balance drop-shadow-[0_3px_0_rgba(0,0,0,0.25)] sm:text-5xl">📖 {tr(T.title, locale)}</h1>
        <SayButton texts={[tr(T.title, locale), greeting]} locale={locale} size="md" className="shrink-0" />
      </div>

      {ready && now !== null && (
        <>
          {arrival ? (
            <LetterEnvelope kind="arrival" onOpen={() => openLetter('arrival')} />
          ) : live ? (
            <RevealCeremony
              key={live.id}
              entry={live}
              childName={childName}
              onOpen={() => {
                setCeremony(live);
                void journal.patch(live.id, { seen: true });
              }}
              onDone={() => setCeremony(null)}
            />
          ) : departure ? (
            <LetterEnvelope kind="departure" onOpen={() => openLetter('departure')} />
          ) : (
            <p className="mx-auto mt-10 max-w-xl rounded-[1.5rem] bg-white/10 p-6 text-center text-lg font-semibold ring-1 ring-white/15">✨ {visible.length || waiting ? tr(T.nothing, locale) : tr(T.empty, locale)}</p>
          )}

          {shelf.length > 0 && (
            <section className="mt-14">
              <h2 className="font-display text-2xl font-bold">✉️ {tr(T.letters, locale)}</h2>
              <ul className="mt-4 flex flex-wrap gap-3">
                {shelf.map((k) => (
                  <li key={k}>
                    <button type="button" onClick={() => setLetter(k)} className="flex min-h-16 items-center gap-3 rounded-2xl bg-[linear-gradient(180deg,#fffaf0,#f3dfb6)] px-5 font-display text-lg font-bold text-[#4a2c12] shadow-lg">
                      <span aria-hidden="true" className="text-2xl">
                        {k === 'arrival' ? '🛷' : '🎄'}
                      </span>
                      {tr(k === 'arrival' ? T.arrival : T.departure, locale)}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {visible.length > 0 && (
            <section className="mt-14">
              <h2 className="font-display text-2xl font-bold">{tr(T.all, locale)}</h2>
              <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {visible
                  .filter((e) => e.id !== ceremony?.id && (e.seen || e.id !== fresh?.id))
                  .map((e) => (
                    <li key={e.id}>
                      <Thumb entry={e} onOpen={() => setViewing(e)} />
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </>
      )}

      <p className="mt-16 text-center text-sm text-white/60">
        <Link href="/lutins/atelier" className="underline underline-offset-4">
          🧝 {tr(T.parents, locale)}
        </Link>
      </p>

      <AnimatePresence>{viewing && <Viewer key={viewing.id} entry={entries.find((e) => e.id === viewing.id) ?? viewing} onClose={() => setViewing(null)} />}</AnimatePresence>
      <AnimatePresence>{letter && <ElfLetterDialog key={letter} kind={letter} autoSay onClose={() => setLetter(null)} />}</AnimatePresence>
    </div>
  );
}

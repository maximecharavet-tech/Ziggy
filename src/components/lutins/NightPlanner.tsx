'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale } from 'next-intl';
import { tr, type L } from '@/lib/i18n-text';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { PRANKS, PRANK_CATEGORIES, prankById, type PrankCategory } from '@/data/lutins/pranks';
import { autoPlan, decemberNights, doneNights, favouritesFirst, lutinsStore, seasonYear, tonightNight, useLutinsSettings, type Night } from '@/lib/lutins/family';
import type { JournalEntry } from '@/lib/lutins/journal';
import { BodyPortal } from '@/components/lutins/BodyPortal';

/**
 * "Mon calendrier des lutins": the 24 nights of December. The parent gives
 * each night a prank (or lets the planner fill the empty ones); the nights
 * already in the journal are ticked; tonight's prank is preselected in the
 * studio.
 */

const T = {
  title: { fr: 'Mon calendrier des lutins', en: 'My elf calendar' },
  lead: {
    fr: 'Prévoyez une farce pour chaque soir. Le soir venu, celle du jour est déjà choisie dans l’atelier : plus qu’à prendre la photo.',
    en: 'Plan a prank for every evening. When the evening comes, tonight’s is already picked in the workshop: just take the photo.',
  },
  fill: { fr: 'Remplir les soirs vides', en: 'Fill the empty evenings' },
  clear: { fr: 'Vider le calendrier', en: 'Clear the calendar' },
  sure: { fr: 'Oui, tout vider', en: 'Yes, clear it all' },
  cancel: { fr: 'Annuler', en: 'Cancel' },
  planned: { fr: 'soirs prévus', en: 'evenings planned' },
  done: { fr: 'déjà faits', en: 'already done' },
  tonight: { fr: 'Ce soir', en: 'Tonight' },
  doneTag: { fr: 'Fait', en: 'Done' },
  add: { fr: 'Choisir', en: 'Pick' },
  night: { fr: 'Le soir du {d} décembre', en: 'The evening of December {d}' },
  none: { fr: 'Pas de farce prévue', en: 'No prank planned' },
  random: { fr: 'Au hasard', en: 'Surprise me' },
  remove: { fr: 'Retirer', en: 'Remove' },
  favs: { fr: 'Favoris', en: 'Favourites' },
  prepare: { fr: 'Préparer la farce de ce soir', en: 'Prepare tonight’s prank' },
  close: { fr: 'Fermer', en: 'Close' },
  forgot: { fr: 'Un soir sans farce ? Aucun souci : les lutins se reposent aussi, rien ne s’affiche pour l’enfant.', en: 'An evening without a prank? No problem: elves rest too, and nothing shows for the child.' },
} satisfies Record<string, L>;

export function NightPlanner({ entries, onPrepareTonight }: { entries: JournalEntry[]; onPrepareTonight: () => void }) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const s = useLutinsSettings();
  const [now, setNow] = useState<Date | null>(null);
  const [editing, setEditing] = useState<Night | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => setNow(new Date()), []);

  const year = now ? seasonYear(now) : null;
  const nights = useMemo(() => (year ? decemberNights(year) : []), [year]);
  const done = useMemo(() => doneNights(entries), [entries]);
  const tonight = now ? tonightNight(now) : null;
  const plannedCount = nights.filter((n) => s.plan[n.key]).length;
  const doneCount = nights.filter((n) => done.has(n.key)).length;

  if (!year) return <div className="mt-10 h-96" />;

  return (
    <section className="mx-auto mt-8 max-w-4xl">
      <div className="rounded-[2rem] bg-[linear-gradient(180deg,#fffaf0,#fbefd4)] p-4 text-[#2a1d12] shadow-2xl ring-1 ring-[#e8d2a6] sm:p-8">
        <h2 className="font-display text-3xl font-bold text-[#b3261e]">🗓️ {tr(T.title, locale)}</h2>
        <p className="mt-1 text-[#5a4430]">{tr(T.lead, locale)}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#2b8a3e] px-3 py-1 text-sm font-bold text-white">
            {plannedCount}/24 {tr(T.planned, locale)}
          </span>
          {doneCount > 0 && (
            <span className="rounded-full bg-[#fcc419] px-3 py-1 text-sm font-bold text-[#3b1f00]">
              ✓ {doneCount} {tr(T.done, locale)}
            </span>
          )}
        </div>
        <ol className="mt-5 grid grid-cols-3 gap-2 min-[400px]:grid-cols-4 sm:grid-cols-6 sm:gap-3 lg:grid-cols-8">
          {nights.map((n) => {
            const p = prankById(s.plan[n.key]);
            const isDone = done.has(n.key);
            const isTonight = tonight?.key === n.key;
            const past = !!tonight && n.n < tonight.n;
            return (
              <li key={n.key}>
                <button
                  type="button"
                  onClick={() => setEditing(n)}
                  aria-label={`${tr(T.night, locale).replace('{d}', String(n.n))} : ${p ? tr(p.title, locale) : tr(T.none, locale)}`}
                  className={`relative flex aspect-[4/5] w-full flex-col items-center justify-center rounded-2xl p-1.5 text-center shadow-sm transition-transform active:scale-95 ${
                    isTonight ? 'bg-[#c92a2a] text-white shadow-[0_0_0_4px_#fcc419,0_10px_24px_-8px_rgba(201,42,42,0.7)]' : p ? 'bg-white ring-1 ring-[#e8d2a6]' : 'border-2 border-dashed border-[#d9b97a] bg-white/40'
                  } ${past && !isDone ? 'opacity-55' : ''}`}
                >
                  <span className={`absolute left-2 top-1 font-display text-lg font-bold ${isTonight ? 'text-white' : 'text-[#b3261e]'}`}>{n.n}</span>
                  {isDone && (
                    <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#2fb344] text-xs font-black text-white" title={tr(T.doneTag, locale)}>
                      ✓
                    </span>
                  )}
                  {p ? (
                    <>
                      <span className="mt-3 text-3xl leading-none sm:text-4xl" aria-hidden="true">
                        {p.emoji}
                      </span>
                      <span className={`mt-1 line-clamp-2 text-[0.7rem] font-bold leading-tight sm:text-xs ${isTonight ? 'text-white' : 'text-[#5a4430]'}`}>{tr(p.title, locale)}</span>
                    </>
                  ) : (
                    <span className={`mt-3 text-sm font-bold ${isTonight ? 'text-white' : 'text-[#a07a4a]'}`}>＋ {tr(T.add, locale)}</span>
                  )}
                  {isTonight && (
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#fcc419] px-2 text-[0.65rem] font-black uppercase text-[#3b1f00]">{tr(T.tonight, locale)}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => lutinsStore.replacePlan(autoPlan(s.plan, PRANKS, s.favs, year, Math.floor(Math.random() * 1e9), tonight?.n ?? 1))}
            className="min-h-14 rounded-full bg-[#2b8a3e] px-6 font-display text-lg font-bold text-white shadow"
          >
            ✨ {tr(T.fill, locale)}
          </button>
          {tonight && (
            <button type="button" onClick={onPrepareTonight} className="min-h-14 rounded-full bg-gradient-to-r from-[#c92a2a] to-[#f03e3e] px-6 font-display text-lg font-bold text-white shadow">
              📷 {tr(T.prepare, locale)}
            </button>
          )}
          {plannedCount > 0 &&
            (confirmClear ? (
              <span className="flex gap-2">
                <button type="button" onClick={() => (lutinsStore.replacePlan({}), setConfirmClear(false))} className="min-h-12 rounded-full bg-[#c92a2a] px-5 font-bold text-white">
                  {tr(T.sure, locale)}
                </button>
                <button type="button" onClick={() => setConfirmClear(false)} className="min-h-12 rounded-full px-4 font-bold text-[#5a4430]">
                  {tr(T.cancel, locale)}
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmClear(true)} className="min-h-12 rounded-full px-4 font-bold text-[#7a5a36] underline underline-offset-4 sm:ms-auto">
                {tr(T.clear, locale)}
              </button>
            ))}
        </div>
        <p className="mt-4 text-sm text-[#7a5a36]">💤 {tr(T.forgot, locale)}</p>
      </div>

      <AnimatePresence>
        {editing && (
          <NightSheet
            key={editing.key}
            night={editing}
            current={s.plan[editing.key] ?? null}
            favs={s.favs}
            reduced={reduced}
            onPick={(id) => {
              lutinsStore.setPlan(editing.key, id);
              setEditing(null);
            }}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function NightSheet({ night, current, favs, reduced, onPick, onClose }: { night: Night; current: string | null; favs: string[]; reduced: boolean; onPick: (id: string | null) => void; onClose: () => void }) {
  const locale = useLocale();
  const [cat, setCat] = useState<PrankCategory | 'favs'>(favs.length ? 'favs' : 'partout');
  const list = favouritesFirst(cat === 'favs' ? PRANKS.filter((p) => favs.includes(p.id)) : PRANKS.filter((p) => cat === 'partout' || p.cat === cat), favs);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <BodyPortal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-end justify-center bg-[#0b0a26]/80 backdrop-blur-sm sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-label={tr(T.night, locale).replace('{d}', String(night.n))}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={reduced ? false : { y: 60 }}
          animate={{ y: 0 }}
          exit={reduced ? undefined : { y: 60 }}
          className="flex max-h-[88svh] w-full max-w-2xl flex-col rounded-t-[2rem] bg-[#16134a] p-4 text-white shadow-2xl ring-1 ring-white/15 sm:rounded-[2rem] sm:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-2xl font-bold">🌙 {tr(T.night, locale).replace('{d}', String(night.n))}</h3>
            <button type="button" onClick={onClose} aria-label={tr(T.close, locale)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15 text-xl">
              ✕
            </button>
          </div>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
            {favs.length > 0 && (
              <button
                type="button"
                aria-pressed={cat === 'favs'}
                onClick={() => setCat('favs')}
                className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold ${cat === 'favs' ? 'bg-white text-[#1b2150]' : 'bg-white/15 ring-1 ring-white/25'}`}
              >
                ❤️ {tr(T.favs, locale)}
              </button>
            )}
            {PRANK_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={cat === c.id}
                onClick={() => setCat(c.id)}
                className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold ${cat === c.id ? 'bg-white text-[#1b2150]' : 'bg-white/15 ring-1 ring-white/25'}`}
              >
                {c.emoji} {tr(c.label, locale)}
              </button>
            ))}
          </div>
          <ul className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto overscroll-contain pb-2 sm:grid-cols-2">
            {list.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPick(p.id)}
                  aria-pressed={current === p.id}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-start font-bold ${current === p.id ? 'bg-amber-300 text-[#3b1f00]' : 'bg-white/10 ring-1 ring-white/15'}`}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {p.emoji}
                  </span>
                  <span className="leading-tight">{tr(p.title, locale)}</span>
                  {favs.includes(p.id) && (
                    <span className="ms-auto text-sm" aria-hidden="true">
                      ❤️
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
            <button type="button" onClick={() => onPick(list[Math.floor(Math.random() * list.length)]?.id ?? null)} className="min-h-12 rounded-full bg-[#2fb344] px-5 font-bold">
              🎲 {tr(T.random, locale)}
            </button>
            {current && (
              <button type="button" onClick={() => onPick(null)} className="min-h-12 rounded-full bg-white/10 px-5 font-bold ring-1 ring-white/25">
                🗑️ {tr(T.remove, locale)}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </BodyPortal>
  );
}

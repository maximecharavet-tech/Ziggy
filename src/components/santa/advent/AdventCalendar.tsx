'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { tr } from '@/lib/i18n-text';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { SayButton } from '@/components/arcade/read-aloud';
import { useSantaPass } from '@/lib/santa/pass-client';
import { SANTA_ADVENT, adventNeedsPass, canOpenAdventDay, type AdventEntry } from '@/data/santa/advent';
import { santaArt } from '@/data/santa/art';
import { ArtSlot } from '@/components/santa/landing/ArtSlot';

const KEY = 'ziggy:santa:advent:v1';
const sizes = ['min-h-28','min-h-36','min-h-32','min-h-40','min-h-28','min-h-36'];

export function AdventCalendar() {
  const locale = useLocale(), reduced = useReducedMotion(), pass = useSantaPass();
  const [opened, setOpened] = useState<number[]>([]), [selected, setSelected] = useState<AdventEntry | null>(null);
  useEffect(() => { try { const saved = localStorage.getItem(KEY); if (saved) setOpened(JSON.parse(saved) as number[]); } catch { setOpened([]); } }, []);
  const markOpened = (day: number) => setOpened((current) => { const next = [...new Set([...current, day])]; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Keep progress in memory for this visit. */ } return next; });
  const title = locale === 'fr' ? 'La maison du Pôle Nord' : 'The North Pole house';
  const today = locale === 'fr' ? 'Une petite surprise chaque jour jusqu’à Noël.' : 'A little surprise each day until Christmas.';
  return <main className="min-h-screen bg-[#111236] px-4 py-10 text-white sm:px-8"><div className="mx-auto max-w-6xl">
    <Link href="/pere-noel" className="text-sm text-white/70 hover:text-white">← {locale === 'fr' ? 'Retour au village' : 'Back to the village'}</Link>
    <header className="relative mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#25215a] via-[#263365] to-[#15414b] p-7 sm:p-10"><ArtSlot asset={santaArt('calendrier-avent')!} /><div className="absolute inset-0 bg-[#111236]/55" /><div className="relative"><p className="text-sm font-bold text-amber-200">✦ {locale === 'fr' ? 'Calendrier de l’Avent' : 'Advent calendar'}</p><h1 className="mt-3 font-display text-4xl font-bold sm:text-6xl">{title}</h1><p className="mt-3 max-w-xl text-lg text-white/80">{today}</p><p className="mt-5 text-sm text-amber-100/80">{locale === 'fr' ? 'Les 3 premières portes sont gratuites.' : 'The first 3 doors are free.'}</p></div></header>
    <section aria-label={title} className="mt-7 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">{SANTA_ADVENT.map((entry, index) => {
      const dayOpen = canOpenAdventDay(entry.day), needsPass = adventNeedsPass(entry.day), lockedByPass = needsPass && !pass.tier;
      const isOpen = opened.includes(entry.day), size = sizes[(entry.day * 7 + 2) % sizes.length];
      return <div key={entry.day} className={`relative [perspective:800px] ${index % 5 === 0 ? 'sm:col-span-2' : ''}`}>
        <button type="button" disabled={!dayOpen || lockedByPass} onClick={() => { if (dayOpen && !lockedByPass) { markOpened(entry.day); setSelected(entry); } }} aria-label={`${locale === 'fr' ? 'Case' : 'Door'} ${entry.day}${!dayOpen ? (locale === 'fr' ? ', pas encore ouverte' : ', not open yet') : lockedByPass ? (locale === 'fr' ? ', pass requis' : ', pass required') : ''}`} className={`group relative w-full ${size} overflow-hidden rounded-2xl border border-amber-100/30 bg-gradient-to-br from-[#b82e3c] to-[#64253e] text-left shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-70`}>
          <span className="absolute inset-0 grid place-items-center text-5xl text-amber-100/25" aria-hidden>✦</span>
          <span className="absolute left-3 top-2 font-display text-3xl font-bold text-amber-100">{entry.day}</span>
          {isOpen && <span className="absolute bottom-2 right-3 text-amber-100" aria-label={locale === 'fr' ? 'Déjà ouvert' : 'Already opened'}>✓</span>}
          {lockedByPass && <span className="absolute bottom-2 left-3 text-xs">🔒</span>}
          <motion.span aria-hidden className="absolute inset-0 origin-left border-r border-amber-100/35 bg-gradient-to-br from-[#df4a4c] to-[#913246] shadow-xl" style={{ transformStyle: 'preserve-3d' }} initial={false} animate={isOpen ? (reduced ? { opacity: 0 } : { rotateY: -110 }) : { rotateY: 0, opacity: 1 }} transition={{ duration: reduced ? .2 : .65, ease: 'easeInOut' }} />
        </button>
      </div>;
    })}</section>
    <AnimatePresence>{selected && <motion.div className="fixed inset-0 z-50 grid place-items-center bg-[#08091c]/75 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)}><motion.article role="dialog" aria-modal="true" aria-labelledby="advent-entry-title" initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={(event) => event.stopPropagation()} className="w-full max-w-xl rounded-3xl border border-amber-100/25 bg-[#fff8e8] p-6 text-[#34253c] shadow-2xl sm:p-9"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#9d3640]">{locale === 'fr' ? `Le ${selected.day} décembre` : `December ${selected.day}`}</p><h2 id="advent-entry-title" className="mt-2 font-display text-3xl font-bold">{tr(selected.title, locale)}</h2></div><button type="button" aria-label={locale === 'fr' ? 'Fermer' : 'Close'} onClick={() => setSelected(null)} className="rounded-full p-2 text-2xl hover:bg-black/5">×</button></div><p className="mt-5 text-lg leading-relaxed">{tr(selected.text, locale)}</p>{selected.answer && <p className="mt-3 rounded-xl bg-amber-100 p-3 font-semibold">{tr(selected.answer, locale)}</p>}<div className="mt-6 flex flex-wrap items-center gap-3"><SayButton texts={[tr(selected.title, locale), tr(selected.text, locale), selected.answer && tr(selected.answer, locale)]} locale={locale} />{selected.href && <Link href={selected.href} className="rounded-full bg-[#28214d] px-5 py-3 font-semibold text-white">{locale === 'fr' ? 'Découvrir' : 'Explore'}</Link>}</div></motion.article></motion.div>}</AnimatePresence>
    {SANTA_ADVENT.some((entry) => canOpenAdventDay(entry.day) && adventNeedsPass(entry.day)) && !pass.tier && <aside className="mt-8 rounded-3xl border border-amber-100/20 bg-[#1b1b49] p-6 sm:flex sm:items-center sm:justify-between"><div><h2 className="font-display text-2xl font-bold">{locale === 'fr' ? 'La suite du calendrier' : 'More Advent surprises'}</h2><p className="mt-2 text-white/70">{locale === 'fr' ? 'Les cases 4 à 24 sont incluses avec le pass.' : 'Doors 4 to 24 are included with the pass.'}</p></div><Link href="/pere-noel/parents" className="mt-4 inline-flex rounded-full bg-amber-300 px-6 py-3 font-bold text-[#271c42] sm:mt-0">{locale === 'fr' ? 'Découvrir le pass' : 'See the pass'}</Link></aside>}
  </div></main>;
}

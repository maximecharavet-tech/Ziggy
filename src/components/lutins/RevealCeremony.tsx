'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocale } from 'next-intl';
import { tr, type L } from '@/lib/i18n-text';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { SayButton } from '@/components/arcade/read-aloud';
import { speakSequence, unlockAudio } from '@/lib/voice';
import bible from '@/data/lutins/bible.json';
import { buildLetter, letterLines } from '@/data/lutins/letters';
import type { JournalEntry } from '@/lib/lutins/journal';
import { cleanSpots, hintFor, hitSpot, type ElfSpot, type Hint } from '@/lib/lutins/family';
import { ElfAvatar } from '@/components/lutins/ElfAvatar';
import { ElfLetterDialog, LetterSheet } from '@/components/lutins/ElfLetter';
import { sfx } from '@/components/lutins/sfx';
import { CctvPlayer } from '@/components/lutins/CctvPlayer';
import { PRANK_CATEGORIES, prankById } from '@/data/lutins/pranks';

/**
 * The morning ceremony of the child's journal:
 *   1. a "New footage detected!" alert from the elves' camera (entries with a
 *      clip) or a wrapped present (picture only);
 *   2. the picture / clip and the elves' morning note, read aloud;
 *   3. "Trouve les lutins": tap each elf in the picture (when the parent marked
 *      where they are), else "Who pulled the prank?" with the elves' faces;
 *   4. a celebration, whatever happened: wrong taps only get playful hints.
 */

const T = {
  surprise: { fr: 'Les lutins sont passés cette nuit !', en: 'The elves came by last night!' },
  tapGift: { fr: 'Touche le cadeau pour voir leur farce !', en: 'Tap the present to see their prank!' },
  app: { fr: 'Caméra des lutins', en: 'Elf Cam' },
  now: { fr: 'maintenant', en: 'now' },
  alertTitle: { fr: 'Nouvelle vidéo détectée !', en: 'New footage detected!' },
  alertBody: { fr: 'Du mouvement cette nuit dans la maison… Qui est passé par là ?', en: 'Something moved in the house last night… Who could it be?' },
  watch: { fr: 'Regarder la vidéo', en: 'Watch the video' },
  find: { fr: 'Trouve les lutins !', en: 'Find the elves!' },
  printNote: { fr: 'Le mot à imprimer', en: 'Print the note' },
  close: { fr: 'Fermer', en: 'Close' },
  findTitle: { fr: 'Touche les lutins cachés dans la photo !', en: 'Tap the elves hiding in the picture!' },
  whereIs: { fr: 'Où se cache {elf} ?', en: 'Where is {elf} hiding?' },
  foundOne: { fr: 'Bravo ! Tu as trouvé {elf} !', en: 'Well done! You found {elf}!' },
  glow: { fr: 'Regarde là où ça brille !', en: 'Look where it sparkles!' },
  whoTitle: { fr: 'Qui a fait la farce cette nuit ?', en: 'Who pulled the prank last night?' },
  whoMore: { fr: 'Il y en a encore un ! Qui d’autre ?', en: 'There’s one more! Who else?' },
  whoYes: { fr: 'Oui ! {elf} était là cette nuit !', en: 'Yes! {elf} was here last night!' },
  party: { fr: 'Bravo, tu as trouvé tous les lutins !', en: 'Hooray, you found all the elves!' },
  partyName: { fr: 'Bravo {name}, tu as trouvé tous les lutins !', en: 'Hooray {name}, you found all the elves!' },
  partySub: { fr: 'Les lutins font la fête. À demain matin pour une nouvelle farce !', en: 'The elves are celebrating. See you tomorrow morning for a new prank!' },
  seeAll: { fr: 'Voir toutes leurs farces', en: 'See all their pranks' },
  replay: { fr: 'Rejouer', en: 'Play again' },
} satisfies Record<string, L>;

const HINT: Record<Hint, L> = {
  left: { fr: 'Presque ! Cherche un peu plus à gauche 👈', en: 'Nearly! Look a little more to the left 👈' },
  right: { fr: 'Presque ! Cherche un peu plus à droite 👉', en: 'Nearly! Look a little more to the right 👉' },
  up: { fr: 'Presque ! Cherche un peu plus haut 👆', en: 'Nearly! Look a little higher 👆' },
  down: { fr: 'Presque ! Cherche un peu plus bas 👇', en: 'Nearly! Look a little lower 👇' },
  close: { fr: 'Tout près ! Tu chauffes ! 🔥', en: 'So close! You’re getting warm! 🔥' },
};

/** Where the other elves were, for a playful "not this one" in the multiple choice. */
const ELSEWHERE: Record<string, L> = {
  pepin: { fr: 'Hihi, non ! Pépin ronflait dans son grand bonnet. Essaie un autre lutin !', en: 'Hee hee, no! Pip was snoring in his long hat. Try another elf!' },
  grelotte: { fr: 'Hihi, non ! Grelotte inventait une machine à bulles. Essaie un autre lutin !', en: 'Hee hee, no! Jingle was inventing a bubble machine. Try another elf!' },
  noisette: { fr: 'Hihi, non ! Noisette faisait dodo dans une chaussette. Essaie un autre lutin !', en: 'Hee hee, no! Hazel was napping in a sock. Try another elf!' },
};

const CHEERS: L[] = [
  { fr: 'Youpi !', en: 'Yippee!' },
  { fr: 'Bravo !', en: 'Bravo!' },
  { fr: 'Hourra !', en: 'Hooray!' },
];

const ELVES = bible.elves as { id: string; name: L; color: string; accent: string }[];
const elfOf = (id: string) => ELVES.find((e) => e.id === id) ?? ELVES[0];
const fill = (s: string, k: string, v: string) => s.replace(`{${k}}`, v);

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

/** The elves' security-camera clip, if the entry has one. */
const cctvOf = (e: JournalEntry): Blob | null => e.cctv ?? null;

type Phase = 'alert' | 'opening' | 'reveal' | 'game' | 'party';

export function RevealCeremony({ entry, childName, onOpen, onDone }: { entry: JournalEntry; childName: string | null; onOpen: () => void; onDone: () => void }) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('alert');
  const [noteOpen, setNoteOpen] = useState(false);
  const cctv = cctvOf(entry);
  const hasClip = Boolean(cctv || entry.video);
  const top = useRef<HTMLDivElement>(null);
  const elves = useMemo(() => ELVES.map((e) => e.id).filter((id) => entry.elves.includes(id)), [entry.elves]);
  const letter = buildLetter('morning', locale, { name: childName, prankId: entry.prankId, elves });

  useEffect(() => {
    if (phase !== 'alert') top.current?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
  }, [phase, reduced]);

  const open = () => {
    unlockAudio();
    sfx.jingle();
    onOpen();
    setPhase('opening');
    setTimeout(
      () => {
        setPhase('reveal');
        void speakSequence(`lutins-note-${entry.id}`, [letter.greeting, ...letter.paragraphs], locale);
      },
      reduced ? 60 : hasClip ? 650 : 950
    );
  };

  return (
    <div ref={top} className="scroll-mt-24">
      <AnimatePresence mode="wait">
        {(phase === 'alert' || phase === 'opening') &&
          (hasClip ? <CameraAlert key="alert" elves={elves} opening={phase === 'opening'} onOpen={open} /> : <Present key="gift" opening={phase === 'opening'} onOpen={open} />)}

        {phase === 'reveal' && (
          <motion.section
            key="reveal"
            initial={reduced ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 140, damping: 18 }}
            className="relative mx-auto mt-8 max-w-3xl lg:max-w-6xl"
          >
            <CloseButton onClose={onDone} />
            <div className="lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-center lg:gap-8">
              <Media entry={entry} cctv={cctv} />
              <LetterSheet letter={letter} compact className={`${cctv ? 'mt-4' : '-mt-6'} w-[94%] -rotate-1 lg:mt-0 lg:w-full lg:rotate-1`} />
            </div>
            <div className="mt-10 flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <SayButton texts={letterLines(letter)} locale={locale} size="lg" />
                <motion.button
                  type="button"
                  onClick={() => (unlockAudio(), setPhase('game'))}
                  animate={reduced ? {} : { scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 1.8 }}
                  className="min-h-16 whitespace-nowrap rounded-full bg-gradient-to-r from-[#2fb344] to-[#40c057] px-6 font-display text-xl font-bold text-white shadow-[0_8px_0_#1e7a2e] sm:px-8 sm:text-2xl"
                >
                  🔎 {tr(T.find, locale)}
                </motion.button>
              </div>
              <button type="button" onClick={() => setNoteOpen(true)} className="min-h-12 rounded-full bg-white/10 px-5 text-sm font-bold text-white/85 ring-1 ring-white/20">
                📜 {tr(T.printNote, locale)}
              </button>
            </div>
          </motion.section>
        )}

        {phase === 'game' && (
          <motion.section key="game" initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative mx-auto mt-8 max-w-3xl">
            <CloseButton onClose={onDone} />
            <FindTheElves entry={entry} elves={elves} onWin={() => setPhase('party')} />
          </motion.section>
        )}

        {phase === 'party' && <Party key="party" elves={elves} childName={childName} onReplay={() => setPhase('game')} onDone={onDone} />}
      </AnimatePresence>
      <AnimatePresence>{noteOpen && <ElfLetterDialog kind="morning" prankId={entry.prankId} elves={elves} dateIso={entry.revealAt} onClose={() => setNoteOpen(false)} />}</AnimatePresence>
    </div>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  const locale = useLocale();
  return (
    <div className="mb-3 flex justify-end">
      <button type="button" onClick={onClose} aria-label={tr(T.close, locale)} className="grid h-12 w-12 place-items-center rounded-full bg-white/15 text-xl font-bold text-white ring-1 ring-white/30 backdrop-blur">
        ✕
      </button>
    </div>
  );
}

/* ── 1a. The elves' camera alert ── */

function CameraAlert({ elves, opening, onOpen }: { elves: string[]; opening: boolean; onOpen: () => void }) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [clock, setClock] = useState('');
  useEffect(() => setClock(new Date().toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' })), [locale]);
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={opening ? { opacity: 0, scale: 1.06 } : { opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: opening ? 0.5 : 0.3 }}
      className="mt-8 flex flex-col items-center text-center"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-[2.75rem] bg-[linear-gradient(170deg,#24205e,#0f0d33)] p-4 pb-8 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)] ring-[6px] ring-[#2c2a52]">
        <div aria-hidden="true" className="mx-auto h-6 w-28 rounded-full bg-black/70" />
        <p className="mt-6 font-display text-6xl font-bold tabular-nums text-white/95" suppressHydrationWarning>
          {clock || ' '}
        </p>
        <p className="text-sm font-semibold text-white/60">❄ ❄ ❄</p>
        <motion.button
          type="button"
          onClick={onOpen}
          initial={reduced ? false : { y: -120, opacity: 0 }}
          animate={reduced ? { y: 0, opacity: 1 } : { y: 0, opacity: 1, x: [0, 0, -5, 5, -4, 4, 0, 0] }}
          transition={reduced ? { duration: 0 } : { y: { type: 'spring', stiffness: 220, damping: 16, delay: 0.5 }, opacity: { delay: 0.5 }, x: { delay: 1.4, duration: 0.6, repeat: Infinity, repeatDelay: 2.6 } }}
          className="mt-6 block w-full rounded-[1.4rem] bg-white/90 p-3.5 text-start text-[#1b2150] shadow-xl backdrop-blur"
        >
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#5c6390]">
            <span className="relative grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-b from-[#ff6b6b] to-[#c92a2a] text-sm">
              🎥
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#40c057] ring-2 ring-white" />
            </span>
            {tr(T.app, locale)}
            <span className="ms-auto font-semibold normal-case tracking-normal">{tr(T.now, locale)}</span>
          </span>
          <span className="mt-2 block font-display text-xl font-bold leading-tight">{tr(T.alertTitle, locale)}</span>
          <span className="mt-0.5 block text-sm leading-snug text-[#4a4f7a]">{tr(T.alertBody, locale)}</span>
          <span className="mt-2 flex -space-x-2">
            {elves.map((id) => (
              <span key={id} className="h-9 w-9 overflow-hidden rounded-full ring-2 ring-white" style={{ background: elfOf(id).color }}>
                <ElfAvatar id={id} className="h-full w-full object-cover" />
              </span>
            ))}
          </span>
        </motion.button>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button type="button" onClick={onOpen} className="min-h-16 whitespace-nowrap rounded-full bg-gradient-to-r from-[#c92a2a] to-[#f03e3e] px-6 font-display text-xl font-bold text-white shadow-[0_8px_0_#8a1c1c] sm:px-8 sm:text-2xl">
          ▶ {tr(T.watch, locale)}
        </button>
        <SayButton texts={[tr(T.alertTitle, locale), tr(T.alertBody, locale)]} locale={locale} size="lg" />
      </div>
    </motion.section>
  );
}

/* ── 1b. The wrapped present ── */

function Present({ opening, onOpen }: { opening: boolean; onOpen: () => void }) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  return (
    <motion.section exit={{ opacity: 0 }} className="mt-10 flex flex-col items-center text-center">
      <div className="flex items-center gap-3">
        <p className="font-display text-3xl font-bold text-amber-200 text-balance">{tr(T.surprise, locale)}</p>
        <SayButton texts={[tr(T.surprise, locale), tr(T.tapGift, locale)]} locale={locale} size="md" className="shrink-0" />
      </div>
      <div className="relative mt-10">
        <motion.button
          type="button"
          onClick={onOpen}
          aria-label={tr(T.tapGift, locale)}
          animate={opening ? { scale: [1, 1.15, 0], rotate: [0, -8, 12] } : reduced ? {} : { rotate: [-4, 4, -4], y: [0, -6, 0] }}
          transition={opening ? { duration: 0.9 } : { repeat: Infinity, duration: 1.6 }}
          className="relative block h-48 w-48"
        >
          {/* Lid */}
          <span aria-hidden="true" className="absolute inset-x-0 top-6 h-12 rounded-xl bg-gradient-to-b from-[#ff8787] to-[#e03131] shadow-md" />
          {/* Box */}
          <span aria-hidden="true" className="absolute inset-x-3 bottom-0 top-[4.25rem] rounded-b-2xl bg-gradient-to-b from-[#f03e3e] to-[#a51d1d] shadow-[0_20px_50px_-10px_rgba(201,42,42,0.8)]" />
          {/* Ribbons */}
          <span aria-hidden="true" className="absolute bottom-0 left-1/2 top-6 w-7 -translate-x-1/2 bg-gradient-to-r from-[#f59f00] via-[#ffd43b] to-[#f59f00]" />
          <span aria-hidden="true" className="absolute inset-x-0 top-[2.6rem] h-5 bg-gradient-to-b from-[#ffd43b] to-[#f59f00]" />
          {/* Bow */}
          <span aria-hidden="true" className="absolute left-1/2 top-0 h-10 w-24 -translate-x-1/2">
            <span className="absolute left-0 top-1 h-9 w-11 -rotate-12 rounded-[50%_50%_40%_60%] border-[6px] border-[#ffd43b] bg-[#f59f00]/40" />
            <span className="absolute right-0 top-1 h-9 w-11 rotate-12 rounded-[50%_50%_60%_40%] border-[6px] border-[#ffd43b] bg-[#f59f00]/40" />
            <span className="absolute left-1/2 top-4 h-6 w-6 -translate-x-1/2 rounded-full bg-[#fcc419] shadow" />
          </span>
          <span aria-hidden="true" className="absolute -right-4 top-14 text-3xl">
            ✨
          </span>
        </motion.button>
        {opening && !reduced && <Burst />}
      </div>
      <p className="mt-8 text-lg font-semibold text-white/85">{tr(T.tapGift, locale)}</p>
    </motion.section>
  );
}

/** A burst of sparkles (transform / opacity only). */
function Burst({ n = 14, className = '' }: { n?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={`pointer-events-none absolute inset-0 grid place-items-center ${className}`}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute text-2xl"
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
            animate={{ x: Math.cos(a) * 130, y: Math.sin(a) * 130, opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          >
            {['✨', '⭐', '❄️'][i % 3]}
          </motion.span>
        );
      })}
    </span>
  );
}

/* ── 2. The picture or the clip ── */

const HOUSE: L = { fr: 'Maison', en: 'House' };

/** The camera's room name, from the prank's room (the catalogue's categories). */
function roomOf(entry: JournalEntry, locale: string): string {
  const cat = prankById(entry.prankId)?.cat;
  const c = cat && cat !== 'partout' ? PRANK_CATEGORIES.find((x) => x.id === cat) : null;
  return tr(c?.label ?? HOUSE, locale);
}

function Media({ entry, cctv }: { entry: JournalEntry; cctv: Blob | null }) {
  const locale = useLocale();
  const img = useObjectUrl(entry.image);
  const vid = useObjectUrl(entry.video);
  // The elves' security-camera clip plays in the camera app made for it.
  if (cctv)
    return (
      <div className="rounded-[1.75rem] ring-4 ring-amber-200/70">
        <CctvPlayer entry={entry} room={roomOf(entry, locale)} locale={locale} />
      </div>
    );
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] bg-black shadow-2xl ring-4 ring-amber-200/70">
      {vid ? (
        <video src={vid} autoPlay loop muted playsInline controls className="block max-h-[62vh] w-full object-contain lg:max-h-[68vh]" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        img && <img src={img} alt={entry.caption} className="block max-h-[62vh] w-full object-contain lg:max-h-[68vh]" />
      )}
    </div>
  );
}

/* ── 3. The game ── */

function FindTheElves({ entry, elves, onWin }: { entry: JournalEntry; elves: string[]; onWin: () => void }) {
  const spots = useMemo(() => cleanSpots(entry.spots, elves), [entry.spots, elves]);
  return spots.length ? <TapGame entry={entry} spots={spots} onWin={onWin} /> : <WhoDidIt elves={elves} onWin={onWin} />;
}

function TapGame({ entry, spots, onWin }: { entry: JournalEntry; spots: ElfSpot[]; onWin: () => void }) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const img = useObjectUrl(entry.image);
  const [found, setFound] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [ripples, setRipples] = useState<{ k: number; x: number; y: number }[]>([]);
  const next = spots.find((s) => !found.includes(s.id)) ?? null;
  const whereIs = next ? fill(tr(T.whereIs, locale), 'elf', tr(elfOf(next.id).name, locale)) : '';

  useEffect(() => {
    void speakSequence('lutins-find', [tr(T.findTitle, locale)], locale);
  }, [locale]);

  const tap = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!next) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const aspect = r.width / r.height;
    const hit = hitSpot(spots, x, y, aspect, found);
    if (hit) {
      const now = [...found, hit];
      setFound(now);
      setMisses(0);
      sfx.found(now.length - 1);
      const line = fill(tr(T.foundOne, locale), 'elf', tr(elfOf(hit).name, locale));
      setMsg(line);
      void speakSequence('lutins-find', [line], locale);
      if (now.length === spots.length) setTimeout(onWin, reduced ? 400 : 1400);
      return;
    }
    sfx.boing();
    setMisses((m) => m + 1);
    const h = hintFor(spots, x, y, aspect, found);
    const line = h ? tr(HINT[h], locale) : '';
    setMsg(line);
    if (line) void speakSequence('lutins-find', [line.replace(/\p{Extended_Pictographic}/gu, '')], locale);
    const k = Date.now();
    setRipples((rs) => [...rs.slice(-3), { k, x, y }]);
    setTimeout(() => setRipples((rs) => rs.filter((q) => q.k !== k)), 700);
  };

  return (
    <div>
      <div className="flex items-center justify-center gap-3 text-center">
        <h2 className="font-display text-2xl font-bold text-balance sm:text-3xl">🔎 {tr(T.findTitle, locale)}</h2>
        <SayButton texts={[tr(T.findTitle, locale), whereIs]} locale={locale} size="md" className="shrink-0" />
      </div>
      <ul className="mt-4 flex justify-center gap-3">
        {spots.map((s) => {
          const ok = found.includes(s.id);
          return (
            <li key={s.id} className="flex flex-col items-center">
              <motion.span
                animate={ok && !reduced ? { scale: [1, 1.25, 1] } : {}}
                className={`relative block h-14 w-14 overflow-hidden rounded-full ring-4 ${ok ? 'ring-[#40c057]' : 'opacity-60 ring-white/30 grayscale'}`}
                style={{ background: elfOf(s.id).color }}
              >
                <ElfAvatar id={s.id} className="h-full w-full object-cover" />
              </motion.span>
              <span className="mt-1 text-sm font-bold">
                {ok ? '✓ ' : ''}
                {tr(elfOf(s.id).name, locale)}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="relative mt-4 touch-manipulation select-none overflow-hidden rounded-[1.5rem] shadow-2xl ring-4 ring-amber-200/70" onPointerDown={tap} role="application" aria-label={tr(T.findTitle, locale)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img && <img src={img} alt={entry.caption} draggable={false} className="pointer-events-none block w-full" />}
        {ripples.map((q) => (
          <motion.span
            key={q.k}
            aria-hidden="true"
            initial={{ scale: 0.2, opacity: 0.9 }}
            animate={{ scale: 1.4, opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="pointer-events-none absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white"
            style={{ left: `${q.x * 100}%`, top: `${q.y * 100}%` }}
          />
        ))}
        {misses >= 3 && next && (
          <motion.span
            aria-hidden="true"
            animate={reduced ? { opacity: 1 } : { scale: [0.9, 1.1, 0.9], opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-dashed border-amber-300 shadow-[0_0_30px_rgba(255,212,59,0.8)]"
            style={{ left: `${next.x * 100}%`, top: `${next.y * 100}%`, width: `${Math.max(next.r, 0.075) * 200}%`, aspectRatio: '1' }}
          />
        )}
        {spots
          .filter((s) => found.includes(s.id))
          .map((s) => (
            <span key={s.id} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}>
              {!reduced && <Burst n={10} />}
              <motion.span
                initial={reduced ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 12 }}
                className="relative block h-14 w-14 overflow-hidden rounded-full ring-4 ring-[#40c057] shadow-lg"
                style={{ background: elfOf(s.id).color }}
              >
                <ElfAvatar id={s.id} className="h-full w-full object-cover" />
              </motion.span>
            </span>
          ))}
      </div>
      <p className="mt-4 min-h-[3.5rem] text-center font-display text-xl font-bold text-amber-200" aria-live="polite">
        {msg ?? whereIs}
        {misses >= 3 && next && <span className="block text-base text-white/80">✨ {tr(T.glow, locale)}</span>}
      </p>
    </div>
  );
}

function WhoDidIt({ elves, onWin }: { elves: string[]; onWin: () => void }) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const culprits = elves.length ? elves : ELVES.map((e) => e.id);
  const [found, setFound] = useState<string[]>([]);
  const [nope, setNope] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void speakSequence('lutins-who', [tr(T.whoTitle, locale)], locale);
  }, [locale]);

  const pick = (id: string) => {
    if (found.includes(id)) return;
    if (culprits.includes(id)) {
      const now = [...found, id];
      setFound(now);
      setNope(null);
      sfx.found(now.length - 1);
      const yes = fill(tr(T.whoYes, locale), 'elf', tr(elfOf(id).name, locale));
      const line = now.length < culprits.length ? `${yes} ${tr(T.whoMore, locale)}` : yes;
      setMsg(line);
      void speakSequence('lutins-who', [line], locale);
      if (now.length === culprits.length) setTimeout(onWin, reduced ? 400 : 1500);
    } else {
      sfx.boing();
      setNope(id);
      const line = tr(ELSEWHERE[id] ?? ELSEWHERE.pepin, locale);
      setMsg(line);
      void speakSequence('lutins-who', [line], locale);
    }
  };

  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-3">
        <h2 className="font-display text-3xl font-bold text-balance">🕵️ {tr(T.whoTitle, locale)}</h2>
        <SayButton texts={[tr(T.whoTitle, locale)]} locale={locale} size="md" className="shrink-0" />
      </div>
      <ul className="mx-auto mt-8 grid max-w-xl grid-cols-3 gap-3 sm:gap-5">
        {ELVES.map((e) => {
          const ok = found.includes(e.id);
          const no = nope === e.id;
          return (
            <li key={e.id}>
              <motion.button
                type="button"
                onClick={() => pick(e.id)}
                aria-pressed={ok}
                animate={no && !reduced ? { rotate: [0, -6, 6, -4, 0] } : ok && !reduced ? { y: [0, -14, 0] } : {}}
                transition={{ duration: 0.5 }}
                className={`relative flex min-h-[9rem] w-full flex-col items-center rounded-[1.75rem] p-2.5 transition-colors sm:p-3 ${ok ? 'bg-white text-[#1b2150] ring-4 ring-[#40c057]' : 'bg-white/10 ring-1 ring-white/25'}`}
              >
                <span className="relative block aspect-square w-full overflow-hidden rounded-2xl" style={{ background: `radial-gradient(circle at 50% 35%, ${e.accent}66, ${e.color}44)` }}>
                  <ElfAvatar id={e.id} className="h-full w-full object-contain" />
                  {no && <span className="absolute right-1 top-1 rounded-full bg-[#1b2150]/80 px-2 text-lg">💤</span>}
                  {ok && <span className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-full bg-[#40c057] text-lg font-black text-white">✓</span>}
                </span>
                <span className="mt-2 font-display text-xl font-bold">{tr(e.name, locale)}</span>
              </motion.button>
            </li>
          );
        })}
      </ul>
      <p className="mx-auto mt-6 min-h-[3.5rem] max-w-xl font-display text-xl font-bold text-amber-200" aria-live="polite">
        {msg}
      </p>
    </div>
  );
}

/* ── 4. The celebration ── */

const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 7) * 0.12,
  rot: (i * 47) % 360,
  color: ['#ffd43b', '#ff6b6b', '#51cf66', '#748ffc', '#f783ac'][i % 5],
  dur: 2.2 + (i % 5) * 0.3,
}));

function Party({ elves, childName, onReplay, onDone }: { elves: string[]; childName: string | null; onReplay: () => void; onDone: () => void }) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const title = childName ? fill(tr(T.partyName, locale), 'name', childName) : tr(T.party, locale);
  useEffect(() => {
    sfx.fanfare();
    void speakSequence('lutins-party', [title, tr(T.partySub, locale)], locale);
    // Once, when the party starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="relative mx-auto mt-8 max-w-3xl overflow-hidden rounded-[2rem] bg-[radial-gradient(120%_90%_at_50%_0%,#3b2b8f_0%,#1b1660_60%,#120f45_100%)] px-4 pb-10 pt-10 text-center shadow-2xl ring-1 ring-white/15"
    >
      {!reduced && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {CONFETTI.map((c, i) => (
            <motion.span
              key={i}
              className="absolute top-0 block h-3 w-2 rounded-sm"
              style={{ left: `${c.left}%`, background: c.color }}
              initial={{ y: -20, rotate: 0, opacity: 1 }}
              animate={{ y: 520, rotate: c.rot + 360, opacity: [1, 1, 0] }}
              transition={{ duration: c.dur, delay: c.delay, repeat: Infinity, ease: 'linear' }}
            />
          ))}
        </div>
      )}
      <div className="relative flex items-end justify-center gap-2 sm:gap-6">
        {elves.map((id, i) => (
          <div key={id} className="flex flex-col items-center">
            <motion.span
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.2 }}
              className="relative z-10 mb-5 rounded-2xl bg-white px-3 py-1 font-display text-base font-bold text-[#1b2150] shadow sm:text-lg"
            >
              {tr(CHEERS[i % CHEERS.length], locale)}
            </motion.span>
            <motion.span
              animate={reduced ? {} : { y: [0, -22, 0], rotate: [0, i % 2 ? 8 : -8, 0] }}
              transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15, ease: 'easeOut' }}
              className="block h-24 w-24 overflow-hidden rounded-full ring-4 ring-amber-300 sm:h-32 sm:w-32"
              style={{ background: `radial-gradient(circle at 50% 35%, ${elfOf(id).accent}88, ${elfOf(id).color})` }}
            >
              <ElfAvatar id={id} alt={tr(elfOf(id).name, locale)} className="h-full w-full object-cover" />
            </motion.span>
          </div>
        ))}
      </div>
      <div className="relative mt-6 flex items-center justify-center gap-3">
        <h2 className="font-display text-3xl font-bold text-amber-200 text-balance sm:text-4xl">🎉 {title}</h2>
        <SayButton texts={[title, tr(T.partySub, locale)]} locale={locale} size="md" className="shrink-0" />
      </div>
      <p className="relative mt-2 text-lg font-semibold text-white/85">{tr(T.partySub, locale)}</p>
      <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button type="button" onClick={onDone} className="min-h-16 rounded-full bg-gradient-to-r from-[#c92a2a] to-[#f03e3e] px-8 font-display text-xl font-bold text-white shadow-[0_8px_0_#8a1c1c]">
          📖 {tr(T.seeAll, locale)}
        </button>
        <button type="button" onClick={onReplay} className="min-h-14 rounded-full bg-white/15 px-6 font-display text-lg font-bold text-white ring-1 ring-white/30">
          🔁 {tr(T.replay, locale)}
        </button>
      </div>
    </motion.section>
  );
}

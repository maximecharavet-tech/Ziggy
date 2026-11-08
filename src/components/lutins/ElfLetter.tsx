'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useLocale } from 'next-intl';
import { tr, type L } from '@/lib/i18n-text';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { SayButton } from '@/components/arcade/read-aloud';
import { speakSequence, stopSpeaking } from '@/lib/voice';
import bible from '@/data/lutins/bible.json';
import { buildLetter, letterLines, type Letter, type LetterKind } from '@/data/lutins/letters';
import { useChildName } from '@/lib/lutins/family';

/**
 * The elves' letters on parchment: holly corners, each elf's signature doodle,
 * a wax seal. Printable (only the letter is printed) and read aloud.
 */

const T = {
  print: { fr: 'Imprimer', en: 'Print' },
  close: { fr: 'Fermer', en: 'Close' },
  from: { fr: 'Pôle Nord', en: 'North Pole' },
  signed: { fr: 'Signé :', en: 'Signed:' },
  envelope: { fr: 'Une lettre est arrivée du Pôle Nord !', en: 'A letter has arrived from the North Pole!' },
  envelopeBye: { fr: 'Les lutins t’ont laissé une lettre !', en: 'The elves left you a letter!' },
  tapEnvelope: { fr: 'Touche l’enveloppe pour l’ouvrir', en: 'Tap the envelope to open it' },
} satisfies Record<string, L>;

const ELVES = bible.elves as { id: string; name: L; color: string; accent: string }[];
const elf = (id: string) => ELVES.find((e) => e.id === id) ?? ELVES[0];

/* ── Signature doodles (drawn in code) ── */

const useSvgId = (p: string) => p + useId().replace(/[^a-zA-Z0-9_-]/g, '');

function Doodle({ id }: { id: string }) {
  const stripes = useSvgId('lt-stripes');
  if (id === 'pepin') {
    // The long striped hat with its bell.
    return (
      <svg viewBox="0 0 90 56" className="h-12 w-[4.5rem]" aria-hidden="true">
        <defs>
          <pattern id={stripes} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width="10" height="10" fill="#fff" />
            <rect width="5" height="10" fill="#e03131" />
          </pattern>
        </defs>
        <path d="M10 46 Q24 8 52 12 Q72 16 78 30 Q66 22 54 24 Q36 28 30 46 Z" fill={`url(#${stripes})`} stroke="#8a1c1c" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M6 46 Q20 40 34 46" fill="none" stroke="#3a9d4f" strokeWidth="5" strokeLinecap="round" />
        <circle cx="80" cy="34" r="6" fill="#fcc419" stroke="#b07d00" strokeWidth="1.4" />
        <path d="M77 35 h6" stroke="#b07d00" strokeWidth="1.2" />
        <path d="M70 46 l4 -3 M86 44 l-3 -3 M80 48 v-4" stroke="#fcc419" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === 'grelotte') {
    // Round golden glasses and a snowflake.
    return (
      <svg viewBox="0 0 90 56" className="h-12 w-[4.5rem]" aria-hidden="true">
        <circle cx="26" cy="32" r="12" fill="#fff8" stroke="#c99a06" strokeWidth="3" />
        <circle cx="54" cy="32" r="12" fill="#fff8" stroke="#c99a06" strokeWidth="3" />
        <path d="M38 30 Q40 26 42 30" fill="none" stroke="#c99a06" strokeWidth="3" strokeLinecap="round" />
        <path d="M14 30 L6 26 M66 30 L74 26" stroke="#c99a06" strokeWidth="3" strokeLinecap="round" />
        <g transform="translate(78 12)" stroke="#7950f2" strokeWidth="2" strokeLinecap="round">
          <path d="M0 -9 V9 M-8 -4.5 L8 4.5 M-8 4.5 L8 -4.5" />
          <path d="M-2 -7 L0 -5 L2 -7 M-2 7 L0 5 L2 7" fill="none" />
        </g>
      </svg>
    );
  }
  // Noisette: an acorn with a little leaf.
  return (
    <svg viewBox="0 0 90 56" className="h-12 w-[4.5rem]" aria-hidden="true">
      <path d="M30 26 Q30 50 45 52 Q60 50 60 26 Z" fill="#c98a4b" stroke="#7a4a1d" strokeWidth="1.6" />
      <path d="M27 27 Q45 10 63 27 Q45 32 27 27 Z" fill="#7a4a1d" />
      <path d="M33 24 l4 3 M40 20 l3 4 M48 20 l-2 4 M55 23 l-3 3" stroke="#a0612b" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M45 16 Q46 10 50 8" fill="none" stroke="#7a4a1d" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M64 40 Q76 28 84 34 Q76 46 64 40 Z" fill="#40c057" stroke="#2b8a3e" strokeWidth="1.4" />
      <path d="M64 40 Q74 36 82 34" fill="none" stroke="#2b8a3e" strokeWidth="1.2" />
    </svg>
  );
}

export function ElfSignature({ id, locale, small = false }: { id: string; locale: string; small?: boolean }) {
  const e = elf(id);
  return (
    <span className={`flex flex-col items-center ${small ? 'scale-90' : ''}`}>
      <Doodle id={id} />
      <span className="-mt-1 -rotate-6 font-display text-xl font-bold italic leading-none" style={{ color: e.id === 'grelotte' ? '#6741d9' : e.id === 'noisette' ? '#8a4f1d' : '#2b8a3e' }}>
        {tr(e.name, locale)}
      </span>
    </span>
  );
}

/* ── Wax seal ── */

export function WaxSeal({ className = '' }: { className?: string }) {
  const wax = useSvgId('lt-wax');
  const bumps = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return `${(50 + Math.cos(a) * 44).toFixed(1)},${(50 + Math.sin(a) * 44).toFixed(1)}`;
  });
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={wax} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#f25f5c" />
          <stop offset="0.55" stopColor="#c92a2a" />
          <stop offset="1" stopColor="#7d1414" />
        </radialGradient>
      </defs>
      {bumps.map((p, i) => {
        const [x, y] = p.split(',').map(Number);
        return <circle key={i} cx={x} cy={y} r="9" fill={`url(#${wax})`} />;
      })}
      <circle cx="50" cy="50" r="42" fill={`url(#${wax})`} />
      <circle cx="50" cy="50" r="30" fill="none" stroke="#7d1414" strokeOpacity="0.55" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="#ff9b9b" strokeOpacity="0.35" strokeWidth="1" transform="translate(-1 -1)" />
      {/* A bell, embossed */}
      <g transform="translate(50 52)">
        <path d="M-12 8 Q-12 -14 0 -15 Q12 -14 12 8 L15 11 H-15 Z" fill="#a51d1d" stroke="#ff9b9b" strokeOpacity="0.45" strokeWidth="1.2" />
        <circle cx="0" cy="14" r="3.4" fill="#a51d1d" stroke="#ff9b9b" strokeOpacity="0.45" strokeWidth="1" />
        <path d="M0 -15 v-4" stroke="#ff9b9b" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
      </g>
      <ellipse cx="36" cy="30" rx="10" ry="5" fill="#fff" opacity="0.18" transform="rotate(-30 36 30)" />
    </svg>
  );
}

/* ── Holly corner ── */

function Holly({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 60" className={className} aria-hidden="true">
      <path d="M8 30 Q16 14 30 18 Q26 24 32 28 Q24 30 26 38 Q16 32 8 30 Z" fill="#2b8a3e" />
      <path d="M72 22 Q60 8 46 16 Q52 20 46 26 Q54 26 54 34 Q62 26 72 22 Z" fill="#37b24d" />
      <path d="M12 30 Q22 26 30 24 M68 22 Q58 22 50 22" stroke="#1e6b2e" strokeWidth="1.2" fill="none" />
      <circle cx="36" cy="30" r="5" fill="#e03131" />
      <circle cx="44" cy="34" r="5" fill="#c92a2a" />
      <circle cx="40" cy="24" r="4.5" fill="#f03e3e" />
      <circle cx="34.5" cy="28.5" r="1.4" fill="#fff" opacity="0.6" />
    </svg>
  );
}

/* ── The parchment ── */

export function LetterSheet({ letter, date, compact = false, className = '' }: { letter: Letter; date?: string | null; compact?: boolean; className?: string }) {
  const locale = useLocale();
  return (
    <article
      className={`lutins-letter relative mx-auto w-full overflow-visible rounded-[14px] text-[#4a2c12] shadow-[0_30px_60px_-24px_rgba(0,0,0,0.7)] [print-color-adjust:exact] [-webkit-print-color-adjust:exact] ${compact ? 'max-w-xl px-5 pb-6 pt-5 sm:px-7' : 'max-w-2xl px-6 pb-10 pt-8 sm:px-12 sm:pb-12 sm:pt-11'} ${className}`}
      style={{
        background:
          'radial-gradient(120% 80% at 15% 10%, rgba(255,255,255,0.65), transparent 60%), radial-gradient(90% 70% at 90% 100%, rgba(214,170,98,0.28), transparent 70%), linear-gradient(180deg, #fffaf0 0%, #fbefd4 60%, #f5e2b8 100%)',
      }}
    >
      <div aria-hidden="true" className={`pointer-events-none absolute rounded-[10px] border-2 border-[#d9b97a]/80 ${compact ? 'inset-2' : 'inset-3'}`} />
      <div aria-hidden="true" className={`pointer-events-none absolute rounded-[8px] border border-dashed border-[#d9b97a]/70 ${compact ? 'inset-3.5' : 'inset-5'}`} />
      {!compact && (
        <>
          <Holly className="absolute -left-3 -top-4 h-14 w-20 -rotate-12 drop-shadow" />
          <Holly className="absolute -right-3 -top-4 h-14 w-20 rotate-12 scale-x-[-1] drop-shadow" />
        </>
      )}
      <div className="relative text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a07a4a]">
          ❄ {tr(T.from, locale)}
          {date ? ` · ${date}` : ''} ❄
        </p>
        <h2 className={`mt-2 font-display font-bold leading-tight text-[#b3261e] text-balance ${compact ? 'text-2xl' : 'text-3xl sm:text-4xl'}`}>{letter.title}</h2>
        <div aria-hidden="true" className="mx-auto mt-2 flex items-center justify-center gap-2 text-[#c9a25e]">
          <span className="h-px w-12 bg-current" />
          <span className="text-sm">✦</span>
          <span className="h-px w-12 bg-current" />
        </div>
      </div>
      <div className={`relative ${compact ? 'mt-3 space-y-2 text-lg' : 'mt-5 space-y-3 text-lg sm:text-xl'} leading-relaxed`}>
        <p className="font-display text-2xl font-bold text-[#2b8a3e]">{letter.greeting}</p>
        {letter.paragraphs.map((p, i) => (
          <p key={i} className="text-pretty">
            {p}
          </p>
        ))}
      </div>
      <div className={`relative ${compact ? 'mt-3' : 'mt-6'}`}>
        <p className="italic text-[#7a5a36]">{letter.signoff}</p>
        <div className={`mt-1 flex flex-wrap items-end gap-x-3 gap-y-1 ${compact ? 'pr-16' : 'pr-24'}`}>
          {letter.elves.map((id) => (
            <ElfSignature key={id} id={id} locale={locale} small={compact} />
          ))}
        </div>
      </div>
      <WaxSeal className={`absolute drop-shadow-[0_6px_6px_rgba(0,0,0,0.3)] ${compact ? '-bottom-4 right-3 h-[4.5rem] w-[4.5rem] rotate-12' : '-bottom-6 right-6 h-24 w-24 rotate-12 sm:right-10'}`} />
    </article>
  );
}

/* ── The letter, full screen, with read-aloud and print ── */

export function ElfLetterDialog({
  kind,
  prankId = null,
  elves,
  dateIso,
  autoSay = false,
  onClose,
}: {
  kind: LetterKind;
  prankId?: string | null;
  elves?: string[];
  dateIso?: string | null;
  autoSay?: boolean;
  onClose: () => void;
}) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const name = useChildName();
  const letter = buildLetter(kind, locale, { name, prankId, elves });
  const [mounted, setMounted] = useState(false);
  const date = dateIso ? new Date(dateIso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' }) : null;

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    if (!autoSay) return;
    void speakSequence(`lutins-letter-${kind}`, letterLines(letter), locale);
    return () => stopSpeaking();
    // Say it once when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const print = () => {
    const html = document.documentElement;
    html.classList.add('lutins-print');
    const done = () => {
      html.classList.remove('lutins-print');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 60);
    setTimeout(done, 60_000);
  };

  if (!mounted) return null;
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="lutins-print-portal lutins-dialog fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-[#0b0a26]/90 px-4 pb-10 pt-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={letter.title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-end gap-2 print:hidden">
        <SayButton texts={letterLines(letter)} locale={locale} size="md" />
        <button type="button" onClick={print} className="min-h-12 rounded-full bg-white/15 px-5 font-bold text-white ring-1 ring-white/30">
          🖨️ {tr(T.print, locale)}
        </button>
        <button type="button" onClick={onClose} className="min-h-12 rounded-full bg-white px-5 font-bold text-[#1b2150]">
          ✕ {tr(T.close, locale)}
        </button>
      </div>
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 30, rotate: -2, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 18 }}
        className="lutins-print-root mt-6 pb-8"
      >
        <LetterSheet letter={letter} date={date} />
      </motion.div>
      <style>{`
        @media print {
          html.lutins-print body > *:not(.lutins-print-portal) { display: none !important; }
          html.lutins-print, html.lutins-print body { background: #fff !important; }
          html.lutins-print .lutins-dialog { position: static !important; background: none !important; backdrop-filter: none !important; overflow: visible !important; padding: 0 !important; }
          html.lutins-print .lutins-print-root { transform: none !important; margin: 0 !important; }
          html.lutins-print .lutins-letter { box-shadow: none !important; max-width: 100% !important; break-inside: avoid; }
          @page { margin: 14mm; }
        }
      `}</style>
    </motion.div>,
    document.body
  );
}

/* ── A sealed envelope the child taps to open (arrival / departure) ── */

export function LetterEnvelope({ kind, onOpen }: { kind: 'arrival' | 'departure'; onOpen: () => void }) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const title = tr(kind === 'arrival' ? T.envelope : T.envelopeBye, locale);
  return (
    <section className="mt-10 flex flex-col items-center text-center">
      <div className="flex items-center gap-3">
        <p className="font-display text-3xl font-bold text-amber-200 text-balance">{title}</p>
        <SayButton texts={[title, tr(T.tapEnvelope, locale)]} locale={locale} size="md" className="shrink-0" />
      </div>
      <motion.button
        type="button"
        onClick={onOpen}
        aria-label={tr(T.tapEnvelope, locale)}
        animate={reduced ? {} : { y: [0, -10, 0], rotate: [-2, 2, -2] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        whileTap={{ scale: 0.95 }}
        className="relative mt-8 block aspect-[3/2] w-72 max-w-full rounded-2xl shadow-[0_24px_50px_-12px_rgba(0,0,0,0.7)] sm:w-80"
        style={{ background: 'linear-gradient(180deg,#fff7e6,#f3dfb6)' }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl"
          style={{ background: 'linear-gradient(155deg, transparent 49.5%, rgba(160,120,60,0.25) 50%, transparent 51%), linear-gradient(25deg, transparent 49.5%, rgba(160,120,60,0.25) 50%, transparent 51%)' }}
        />
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[58%] rounded-t-2xl" style={{ background: 'linear-gradient(180deg,#f8e8c6,#ecd3a0)', clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
        <span aria-hidden="true" className="absolute left-4 top-3 text-xs font-bold uppercase tracking-[0.2em] text-[#a07a4a]">
          ❄ {tr(T.from, locale)}
        </span>
        <span aria-hidden="true" className="absolute bottom-3 right-4 text-2xl">
          🎄
        </span>
        <WaxSeal className="absolute left-1/2 top-[58%] h-20 w-20 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_6px_8px_rgba(0,0,0,0.35)]" />
      </motion.button>
      <p className="mt-6 text-lg font-semibold text-white/85">{tr(T.tapEnvelope, locale)}</p>
    </section>
  );
}

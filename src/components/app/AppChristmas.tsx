'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { Snow } from '@/components/santa/Snow';
import { ArtSlot } from '@/components/santa/landing/ArtSlot';
import { useAwake, usePointerDepth, useTilt } from '@/components/create/fx/Parallax';
import { santaArt } from '@/data/santa/art';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/** Christmas is shown in the app until Epiphany. */
export const CHRISTMAS_END = Date.parse('2027-01-07T00:00:00+01:00');

const T = {
  title: { fr: 'C’est bientôt Noël\u00A0!', en: 'Christmas is coming\u00A0!' },
  text: { fr: 'Le Père Noël, ses lutins farceurs et leur atelier t’attendent.', en: 'Santa, his prankster elves and their workshop are waiting for you.' },
} satisfies Record<string, L>;

const DOORS: { href: '/pere-noel' | '/lutins' | '/lutins/jeux'; art: string; label: L }[] = [
  { href: '/pere-noel', art: 'home-door-village', label: { fr: 'Le village du Père Noël', en: 'Santa’s village' } },
  { href: '/lutins', art: 'home-door-lutins', label: { fr: 'Les Lutins Farceurs', en: 'The Prankster Elves' } },
  { href: '/lutins/jeux', art: 'home-door-jeux', label: { fr: 'Les jeux des lutins', en: 'The elves’ games' } },
];

/** The app home's Christmas corner: an illustrated village banner and three picture doors (seasonal). */
export function AppChristmas() {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [on, setOn] = useState(false);
  useEffect(() => setOn(Date.now() < CHRISTMAS_END), []);
  if (!on) return null;
  const title = tr(T.title, locale);
  const text = tr(T.text, locale);
  return (
    <section
      aria-labelledby="app-noel"
      className="relative mt-7 overflow-hidden rounded-[2rem] bg-[#0b0a26] text-white shadow-[0_24px_60px_-24px_rgba(20,10,60,0.8)] ring-1 ring-white/10 md:mt-10"
    >
      <div className="relative aspect-video w-full overflow-hidden">
        <ArtSlot asset={santaArt('home-village-hero')} priority sizes="(max-width: 640px) 100vw, 1152px" />
        <Snow count={reduced ? 0 : 28} />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,6,24,0.12)_0%,rgba(8,6,24,0)_28%,rgba(8,6,24,0.35)_58%,rgba(8,6,24,0.82)_100%)]"
        />
        <div className="absolute inset-x-0 bottom-0 z-[1] p-5 md:p-8">
          <div className="flex items-start gap-3">
            <h2
              id="app-noel"
              className="min-w-0 flex-1 text-balance font-display text-2xl font-bold leading-tight [text-shadow:0_2px_10px_rgba(0,0,0,0.7),0_1px_0_rgba(0,0,0,0.45)] sm:text-[1.65rem] md:text-4xl"
            >
              {title}
            </h2>
            <SayButton
              texts={[title, text, ...DOORS.map((d) => tr(d.label, locale))]}
              locale={locale}
              size="md"
              className="shrink-0 !bg-white/90 !text-[#16301f] shadow-[0_3px_0_rgba(0,0,0,0.25)] !ring-white"
            />
          </div>
          <p className="mt-1 max-w-2xl text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.7)] md:text-xl">{text}</p>
        </div>
      </div>
      <ul className="relative grid gap-3 p-3 sm:grid-cols-3 sm:gap-4 md:p-4 md:pb-5">
        {DOORS.map((d, i) => (
          <DoorTile key={d.href} href={d.href} art={d.art} label={tr(d.label, locale)} index={i} reduced={reduced} />
        ))}
      </ul>
    </section>
  );
}

function DoorTile({
  href,
  art,
  label,
  index,
  reduced,
}: {
  href: '/pere-noel' | '/lutins' | '/lutins/jeux';
  art: string;
  label: string;
  index: number;
  reduced: boolean;
}) {
  const box = useRef<HTMLLIElement>(null);
  const awake = useAwake(box);
  const p = usePointerDepth<HTMLDivElement>();
  const tilt = useTilt(p, 6);
  return (
    <li ref={box} className="[perspective:1100px]">
      <motion.div
        ref={p.ref}
        {...p.handlers}
        data-still={awake ? undefined : ''}
        initial={reduced ? false : { opacity: 0, y: 28, scale: 0.97 }}
        whileInView={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: '0px 0px -40px 0px' }}
        transition={{ type: 'spring', stiffness: 110, damping: 16, delay: 0.06 + index * 0.08 }}
        style={reduced ? undefined : { rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformStyle: 'preserve-3d' }}
        className="group/door relative h-full"
      >
        <Link
          href={href}
          className="relative block aspect-[4/3] overflow-hidden rounded-[1.5rem] shadow-[0_8px_0_rgba(0,0,0,0.28),0_18px_36px_-16px_rgba(0,0,0,0.55)] ring-1 ring-white/20 outline-none transition-[box-shadow,transform] hover:shadow-[0_8px_0_rgba(0,0,0,0.28),0_0_28px_rgba(255,196,80,0.45)] active:translate-y-1 active:shadow-[0_2px_0_rgba(0,0,0,0.25)] focus-visible:ring-4 focus-visible:ring-amber-300/70"
        >
          <ArtSlot asset={santaArt(art)} sizes="(max-width: 640px) 92vw, 33vw" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(115deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0)_32%,rgba(255,255,255,0)_70%,rgba(255,255,255,0.08)_100%)]"
          />
          <span className="absolute inset-x-0 bottom-0 z-[1] px-3.5 pb-3 pt-10 font-display text-xl font-bold leading-tight text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.8),0_1px_0_rgba(0,0,0,0.45)] md:px-4 md:pb-4 md:text-2xl">
            {label}
          </span>
        </Link>
      </motion.div>
    </li>
  );
}

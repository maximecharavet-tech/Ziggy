'use client';

import { motion } from 'framer-motion';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { SayButton } from '@/components/arcade/read-aloud';
import { LutinsScene } from '@/components/lutins/LutinsScene';
import bible from '@/data/lutins/bible.json';

const T = {
  eyebrow: { fr: 'Gratuit tout le mois de décembre', en: 'Free all through December' },
  title: { fr: 'Les Lutins Farceurs', en: 'The Prankster Elves' },
  subtitle: {
    fr: 'Chaque nuit, Pépin, Grelotte et Noisette font une farce chez vous. Une photo de la pièce, une idée de farce, et la magie les fait apparaître.',
    en: 'Every night, Pip, Jingle and Hazel pull a prank at your place. A photo of the room, a prank idea, and magic makes them appear.',
  },
  parent: { fr: 'Préparer la farce de ce soir', en: 'Prepare tonight’s prank' },
  child: { fr: 'Le journal des lutins', en: 'The elves’ journal' },
  meet: { fr: 'Les trois lutins', en: 'The three elves' },
  how: { fr: 'Comment ça marche', en: 'How it works' },
  s1: { fr: 'Le soir, photographiez une pièce sans personne dessus.', en: 'In the evening, photograph a room with nobody in it.' },
  s2: { fr: 'Choisissez une farce parmi des dizaines d’idées, ou décrivez la vôtre.', en: 'Pick a prank from dozens of ideas, or describe your own.' },
  s3: { fr: 'Les lutins apparaissent dans votre photo, toujours les mêmes, avec leurs vrais costumes.', en: 'The elves appear in your photo, always the same, in their real outfits.' },
  s4: { fr: 'Au réveil, votre enfant ouvre le journal des lutins et découvre leur farce, en photo et en vidéo.', en: 'In the morning, your child opens the elves’ journal and discovers their prank, in a photo and a video.' },
  promises: { fr: 'Pensé pour les familles', en: 'Made for families' },
  p1: { fr: 'Aucun désordre à ranger, aucune poupée à acheter.', en: 'No mess to tidy, no doll to buy.' },
  p2: { fr: 'Les photos avec une personne sont refusées sur le téléphone même : aucune image d’enfant n’est envoyée.', en: 'Photos with a person are refused on the phone itself: no child’s picture is ever sent.' },
  p3: { fr: 'Les farces restent sur votre appareil, dans le journal. Rien n’est gardé chez nous.', en: 'The pranks stay on your device, in the journal. Nothing is kept on our side.' },
  p4: { fr: 'Des farces douces : rien de cassé, rien de dangereux à imiter.', en: 'Gentle pranks: nothing broken, nothing dangerous to copy.' },
} satisfies Record<string, L>;

const ELVES = bible.elves as { id: string; name: L; color: string; accent: string; trait: L }[];

export function LutinsHome() {
  const locale = useLocale();
  const reduced = useReducedMotion();
  return (
    <div className="pb-24 text-white">
      <section className="relative w-full">
        <div className="relative h-[66svh] min-h-[420px] w-full overflow-hidden sm:h-[72svh]">
          <LutinsScene mode="hero" className="absolute inset-0" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(11,10,38,0.5)_0%,rgba(11,10,38,0)_22%,rgba(11,10,38,0)_70%,rgba(11,10,38,1)_100%)]" />
        </div>
        <div className="relative -mt-16 flex flex-col items-center px-4 text-center sm:-mt-20">
          <p className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black uppercase tracking-wider text-[#3b1f00]">🎄 {tr(T.eyebrow, locale)}</p>
          <div className="mt-3 flex items-center gap-3">
            <h1 className="font-display text-[2.6rem] font-bold leading-[1.02] text-balance drop-shadow-[0_4px_0_rgba(0,0,0,0.35)] sm:text-6xl">{tr(T.title, locale)}</h1>
            <SayButton texts={[tr(T.title, locale), tr(T.subtitle, locale)]} locale={locale} size="md" className="shrink-0" />
          </div>
          <p className="mt-3 max-w-2xl text-lg font-semibold text-white/90">{tr(T.subtitle, locale)}</p>
          <div className="mt-6 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <Link href="/lutins/atelier" className="inline-flex min-h-16 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#c92a2a] to-[#f03e3e] px-8 font-display text-xl font-bold shadow-[0_8px_0_#8a1c1c]">
              📷 {tr(T.parent, locale)}
            </Link>
            <Link href="/lutins/journal" className="inline-flex min-h-16 items-center justify-center gap-2 rounded-full bg-[#2fb344] px-8 font-display text-xl font-bold shadow-[0_8px_0_#1e7a2e]">
              📖 {tr(T.child, locale)}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-5xl px-4 sm:px-6">
        <h2 className="text-center font-display text-3xl font-bold">🧝 {tr(T.meet, locale)}</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {ELVES.map((e, i) => (
            <motion.li key={e.id} initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }} className="overflow-hidden rounded-[1.75rem] bg-white/10 ring-1 ring-white/15">
              <div className="aspect-square" style={{ background: `radial-gradient(circle at 50% 35%, ${e.accent}66, ${e.color}44 70%)` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/lutins/refs/avatars/${e.id}.png`} alt={tr(e.name, locale)} className="h-full w-full object-contain" />
              </div>
              <div className="p-4">
                <p className="font-display text-2xl font-bold" style={{ color: e.accent }}>
                  {tr(e.name, locale)}
                </p>
                <p className="text-white/80">{tr(e.trait, locale)}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </section>

      <section className="mx-auto mt-16 max-w-5xl px-4 sm:px-6">
        <div className="rounded-[2rem] bg-[#fffaf0] p-6 text-[#2a1d12] shadow-2xl sm:p-10">
          <h2 className="font-display text-3xl font-bold">{tr(T.how, locale)}</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[T.s1, T.s2, T.s3, T.s4].map((s, i) => (
              <li key={i} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#efe0c4]">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#2b8a3e] font-display text-xl font-bold text-white">{i + 1}</span>
                <p className="mt-3 text-[#4a3826]">{tr(s, locale)}</p>
              </li>
            ))}
          </ol>
          <h2 className="mt-10 font-display text-3xl font-bold">🔒 {tr(T.promises, locale)}</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {[T.p1, T.p2, T.p3, T.p4].map((p, i) => (
              <li key={i} className="rounded-2xl bg-white p-4 text-[#4a3826] ring-1 ring-[#efe0c4]">
                {tr(p, locale)}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { SayButton } from '@/components/arcade/read-aloud';
import { LutinsScene } from '@/components/lutins/LutinsScene';
import bible from '@/data/lutins/bible.json';
import { PRANKS } from '@/data/lutins/pranks';
import { buildLetter } from '@/data/lutins/letters';
import { ElfAvatar } from '@/components/lutins/ElfAvatar';
import { LetterSheet } from '@/components/lutins/ElfLetter';

const T = {
  eyebrow: { fr: 'Gratuit tout le mois de décembre', en: 'Free all through December' },
  title: { fr: 'Les Lutins Farceurs', en: 'The Prankster Elves' },
  subtitle: {
    fr: 'Chaque nuit, Pépin, Grelotte et Noisette font une farce chez vous. Une photo de la pièce, une idée de farce, et la magie les fait apparaître.',
    en: 'Every night, Pip, Jingle and Hazel pull a prank at your place. A photo of the room, a prank idea, and magic makes them appear.',
  },
  parent: { fr: 'Préparer la farce de ce soir', en: 'Prepare tonight’s prank' },
  camera: { fr: 'Caméra magique', en: 'Magic camera' },
  child: { fr: 'Le journal des lutins', en: 'The elves’ journal' },
  meet: { fr: 'Les trois lutins', en: 'The three elves' },
  how: { fr: 'Le rituel de chaque soir', en: 'The nightly ritual' },
  howLead: { fr: 'Cinq minutes le soir, des étoiles dans les yeux le matin.', en: 'Five minutes in the evening, stars in their eyes in the morning.' },
  evening: { fr: 'Le soir', en: 'Evening' },
  morning: { fr: 'Le matin', en: 'Morning' },
  s1t: { fr: 'Une photo', en: 'A photo' },
  s1: { fr: 'Photographiez une pièce, sans personne dessus : la cuisine, le salon, le sapin…', en: 'Photograph a room with nobody in it: the kitchen, the living room, the tree…' },
  s2t: { fr: 'Une farce', en: 'A prank' },
  s2: { fr: 'Choisissez parmi des dizaines d’idées, faites tourner la roue, ou décrivez la vôtre.', en: 'Pick from dozens of ideas, spin the wheel, or describe your own.' },
  s3t: { fr: 'La magie', en: 'The magic' },
  s3: { fr: 'Les lutins apparaissent dans votre photo, toujours les mêmes, avec leurs vrais costumes.', en: 'The elves appear in your photo, always the same, in their real outfits.' },
  s4t: { fr: 'La découverte', en: 'The discovery' },
  s4: { fr: 'Au réveil, votre enfant ouvre le journal : une alerte de la caméra des lutins, leur farce, leur petit mot lu à voix haute, et un jeu pour les retrouver.', en: 'On waking, your child opens the journal: an alert from the elf cam, their prank, their little note read aloud, and a game to find them.' },
  lettersTitle: { fr: 'Des lettres du Pôle Nord', en: 'Letters from the North Pole' },
  lettersLead: { fr: 'Les lutins écrivent à votre enfant, avec son prénom, sur un beau parchemin à lire à voix haute ou à imprimer.', en: 'The elves write to your child, by name, on beautiful parchment to read aloud or print.' },
  l1t: { fr: 'La lettre d’arrivée', en: 'The arrival letter' },
  l1: { fr: 'Le premier matin : « Nous sommes arrivés du Pôle Nord ! »', en: 'The first morning: “We’ve arrived from the North Pole!”' },
  l2t: { fr: 'Un mot chaque matin', en: 'A note every morning' },
  l2: { fr: 'Un petit mot rigolo pour chaque farce, signé par les lutins qui l’ont faite.', en: 'A funny little note for every prank, signed by the elves who did it.' },
  l3t: { fr: 'La lettre de départ', en: 'The goodbye letter' },
  l3: { fr: 'À Noël, un au revoir tout joyeux : « À l’année prochaine ! »', en: 'At Christmas, a cheerful goodbye: “See you next year!”' },
  calTitle: { fr: 'Votre calendrier des lutins', en: 'Your elf calendar' },
  calLead: { fr: 'Prévoyez les 24 soirs de décembre en quelques minutes, ou laissez-le se remplir tout seul. Chaque soir, la farce du jour est déjà choisie.', en: 'Plan the 24 evenings of December in a few minutes, or let it fill itself. Every evening, tonight’s prank is already picked.' },
  c1: { fr: 'La roue des farces quand l’inspiration manque', en: 'The prank wheel when inspiration runs dry' },
  c2: { fr: 'Vos farces préférées en favoris', en: 'Your favourite pranks, saved' },
  c3: { fr: 'Les soirs déjà faits cochés automatiquement', en: 'Evenings already done ticked automatically' },
  c4: { fr: 'Un soir oublié ? Les lutins se reposent, c’est tout.', en: 'Missed an evening? The elves just rest.' },
  freeTitle: { fr: 'Gratuit tout décembre, sans compte', en: 'Free all December, no account' },
  f1: { fr: 'Sans compte', en: 'No account' },
  f2: { fr: 'Sans publicité', en: 'No ads' },
  f3: { fr: 'Sans achat', en: 'Nothing to buy' },
  f4: { fr: 'Tout reste sur votre appareil', en: 'Everything stays on your device' },
  promises: { fr: 'Pensé pour les familles', en: 'Made for families' },
  p1: { fr: 'Aucun désordre à ranger, aucune poupée à acheter.', en: 'No mess to tidy, no doll to buy.' },
  p2: { fr: 'Les photos avec une personne sont refusées sur le téléphone même : aucune image d’enfant n’est envoyée.', en: 'Photos with a person are refused on the phone itself: no child’s picture is ever sent.' },
  p3: { fr: 'Les farces restent sur votre appareil, dans le journal. Rien n’est gardé chez nous.', en: 'The pranks stay on your device, in the journal. Nothing is kept on our side.' },
  p4: { fr: 'Des farces douces : rien de cassé, rien de dangereux à imiter.', en: 'Gentle pranks: nothing broken, nothing dangerous to copy.' },
  faq: { fr: 'Questions de parents', en: 'Parents’ questions' },
  ready: { fr: 'Prêts pour la première\u00a0nuit\u00a0?', en: 'Ready for the first night?' },
} satisfies Record<string, L>;

const FAQ: { q: L; a: L }[] = [
  {
    q: { fr: 'C’est vraiment gratuit ?', en: 'Is it really free?' },
    a: {
      fr: 'Oui, tout le mois de décembre : pas de compte, pas de publicité, rien à acheter. Une limite de farces par jour et par appareil garde le service gratuit pour toutes les familles.',
      en: 'Yes, all through December: no account, no ads, nothing to buy. A daily limit of pranks per device keeps the service free for every family.',
    },
  },
  {
    q: { fr: 'Faut-il créer un compte ?', en: 'Do I need an account?' },
    a: {
      fr: 'Non. Le journal, le calendrier, vos favoris et le prénom de votre enfant restent sur votre appareil. Rien n’est envoyé à un compte.',
      en: 'No. The journal, the calendar, your favourites and your child’s first name stay on your device. Nothing goes to an account.',
    },
  },
  {
    q: { fr: 'Que devient ma photo ?', en: 'What happens to my photo?' },
    a: {
      fr: 'Elle est vérifiée sur votre téléphone (une photo avec une personne est refusée), nettoyée de ses données (lieu, date), envoyée uniquement pour créer la farce, puis oubliée : nous ne la gardons pas.',
      en: 'It is checked on your phone (a photo with a person is refused), cleaned of its data (location, date), sent only to make the prank, then forgotten: we don’t keep it.',
    },
  },
  {
    q: { fr: 'Mon enfant risque-t-il de voir la préparation ?', en: 'Could my child see me preparing it?' },
    a: {
      fr: 'L’atelier des parents est protégé par une petite question pour les grands. Votre enfant n’ouvre que le journal, où chaque farce attend le matin (6 h).',
      en: 'The parents’ workshop is behind a little grown-up question. Your child only opens the journal, where each prank waits until morning (6 a.m.).',
    },
  },
  {
    q: { fr: 'Et si j’oublie un soir ?', en: 'What if I forget an evening?' },
    a: {
      fr: 'Aucun souci : les lutins se reposent aussi. Le journal dit simplement qu’ils préparent leur prochaine farce. Pas de série à tenir, pas de pression.',
      en: 'No problem: elves rest too. The journal simply says they’re planning their next prank. No streak to keep, no pressure.',
    },
  },
  {
    q: { fr: 'Pour quel âge ?', en: 'For what age?' },
    a: {
      fr: 'Pensé pour les 4–10 ans. Tout se lit à voix haute pour les petits qui ne lisent pas encore, et le jeu du matin ne se perd jamais.',
      en: 'Made for 4 to 10 year olds. Everything can be read aloud for little ones who can’t read yet, and the morning game can never be lost.',
    },
  },
  {
    q: { fr: 'Faut-il acheter une poupée de lutin ?', en: 'Do I need to buy an elf doll?' },
    a: {
      fr: 'Non. Pépin, Grelotte et Noisette vivent dans vos photos : rien à acheter, rien à cacher, rien à ranger.',
      en: 'No. Pip, Jingle and Hazel live in your photos: nothing to buy, nothing to hide, nothing to tidy.',
    },
  },
  {
    q: { fr: 'Peut-on imprimer les lettres ?', en: 'Can we print the letters?' },
    a: {
      fr: 'Oui : la lettre d’arrivée, chaque mot du matin et la lettre de départ s’impriment depuis le journal ou l’atelier.',
      en: 'Yes: the arrival letter, every morning note and the goodbye letter print from the journal or the workshop.',
    },
  },
];

const ELVES = bible.elves as { id: string; name: L; color: string; accent: string; trait: L }[];

/** A sample month for the calendar illustration (deterministic: same on the server and in the browser). */
const SAMPLE = Array.from({ length: 24 }, (_, i) => PRANKS[(i * 7 + 3) % PRANKS.length]);

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div initial={reduced ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay }} className={className}>
      {children}
    </motion.div>
  );
}

export function LutinsHome() {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const sample = buildLetter('arrival', locale);
  const steps = [
    { e: '📷', t: T.s1t, d: T.s1, when: T.evening },
    { e: '🎭', t: T.s2t, d: T.s2, when: T.evening },
    { e: '✨', t: T.s3t, d: T.s3, when: T.evening },
    { e: '🌅', t: T.s4t, d: T.s4, when: T.morning },
  ];
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
            <Link href="/lutins/camera" className="inline-flex min-h-16 items-center justify-center gap-2 rounded-full bg-white/15 px-8 font-display text-xl font-bold ring-1 ring-white/30">
              🪄 {tr(T.camera, locale)}
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
                <ElfAvatar id={e.id} alt={tr(e.name, locale)} className="h-full w-full object-contain" />
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

      {/* The nightly ritual */}
      <section className="mx-auto mt-20 max-w-5xl px-4 sm:px-6">
        <Reveal className="text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">🌙 {tr(T.how, locale)}</h2>
          <p className="mx-auto mt-2 max-w-xl text-lg text-white/80">{tr(T.howLead, locale)}</p>
        </Reveal>
        <ol className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <span aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-10 hidden h-0.5 bg-[linear-gradient(90deg,rgba(255,212,59,0.1),rgba(255,212,59,0.6),rgba(255,212,59,0.1))] lg:block" />
          {steps.map((s, i) => (
            <li key={i}>
              <Reveal delay={i * 0.08} className={`relative flex h-full flex-col items-center rounded-[1.75rem] p-5 text-center ring-1 ${i === 3 ? 'bg-[linear-gradient(180deg,rgba(255,212,59,0.22),rgba(255,146,43,0.12))] ring-amber-300/40' : 'bg-white/[0.07] ring-white/15'}`}>
                <span className="relative grid h-20 w-20 place-items-center rounded-full bg-[#14113f] text-4xl shadow-[0_0_0_6px_rgba(255,255,255,0.06)] ring-2 ring-amber-300/60">
                  <span aria-hidden="true">{s.e}</span>
                  <span className="absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full bg-amber-300 font-display text-base font-bold text-[#3b1f00]">{i + 1}</span>
                </span>
                <span className="mt-3 text-xs font-black uppercase tracking-widest text-amber-200/80">{tr(s.when, locale)}</span>
                <h3 className="mt-1 font-display text-2xl font-bold">{tr(s.t, locale)}</h3>
                <p className="mt-2 text-white/80">{tr(s.d, locale)}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* Letters */}
      <section className="mx-auto mt-20 max-w-5xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <Reveal>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">✉️ {tr(T.lettersTitle, locale)}</h2>
            <p className="mt-2 text-lg text-white/80">{tr(T.lettersLead, locale)}</p>
            <ul className="mt-6 grid gap-3">
              {[
                ['🛷', T.l1t, T.l1],
                ['🌅', T.l2t, T.l2],
                ['🎄', T.l3t, T.l3],
              ].map(([e, t, d], i) => (
                <li key={i} className="flex gap-4 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/15">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#fbefd4] text-2xl" aria-hidden="true">
                    {e as string}
                  </span>
                  <span>
                    <span className="block font-display text-xl font-bold">{tr(t as L, locale)}</span>
                    <span className="text-white/80">{tr(d as L, locale)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1} className="px-2 pb-6">
            <div className="rotate-[1.5deg]">
              <LetterSheet letter={sample} compact />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Calendar */}
      <section className="mx-auto mt-20 max-w-5xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <Reveal className="order-2 lg:order-1">
            <div className="rounded-[2rem] bg-[linear-gradient(180deg,#fffaf0,#fbefd4)] p-4 shadow-2xl ring-1 ring-[#e8d2a6] sm:p-6">
              <p className="font-display text-xl font-bold text-[#b3261e]">🗓️ {tr(T.calTitle, locale)}</p>
              <ol className="mt-3 grid grid-cols-6 gap-1.5 sm:gap-2" aria-hidden="true">
                {SAMPLE.map((p, i) => (
                  <li key={i} className={`relative grid aspect-square place-items-center rounded-xl text-xl sm:text-2xl ${i === 11 ? 'bg-[#c92a2a] shadow-[0_0_0_3px_#fcc419]' : 'bg-white ring-1 ring-[#e8d2a6]'}`}>
                    <span className={`absolute left-1 top-0.5 font-display text-[0.6rem] font-bold sm:text-xs ${i === 11 ? 'text-white' : 'text-[#b3261e]'}`}>{i + 1}</span>
                    <span className="mt-1.5">{p.emoji}</span>
                    {i < 11 && <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[#2fb344] text-[0.55rem] font-black text-white">✓</span>}
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="order-1 lg:order-2">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">🗓️ {tr(T.calTitle, locale)}</h2>
            <p className="mt-2 text-lg text-white/80">{tr(T.calLead, locale)}</p>
            <ul className="mt-5 grid gap-2">
              {[
                ['🎡', T.c1],
                ['❤️', T.c2],
                ['✅', T.c3],
                ['💤', T.c4],
              ].map(([e, t], i) => (
                <li key={i} className="flex items-center gap-3 text-lg">
                  <span aria-hidden="true" className="text-2xl">
                    {e as string}
                  </span>
                  {tr(t as L, locale)}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Free band + promises */}
      <section className="mx-auto mt-20 max-w-5xl px-4 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#c92a2a,#a51d1d_55%,#7d1414)] p-6 text-center shadow-2xl sm:p-10">
            <span aria-hidden="true" className="pointer-events-none absolute -left-6 -top-6 text-8xl opacity-20">
              ❄
            </span>
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-8 -right-4 text-9xl opacity-20">
              ❄
            </span>
            <h2 className="relative font-display text-3xl font-bold text-balance sm:text-4xl">🎁 {tr(T.freeTitle, locale)}</h2>
            <ul className="relative mt-5 flex flex-wrap justify-center gap-2">
              {[T.f1, T.f2, T.f3, T.f4].map((f, i) => (
                <li key={i} className="rounded-full bg-white/15 px-4 py-2 font-bold ring-1 ring-white/30">
                  ✓ {tr(f, locale)}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal className="mt-8">
          <h2 className="font-display text-2xl font-bold">🔒 {tr(T.promises, locale)}</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {[T.p1, T.p2, T.p3, T.p4].map((p, i) => (
              <li key={i} className="rounded-2xl bg-white/[0.07] p-4 text-white/85 ring-1 ring-white/15">
                {tr(p, locale)}
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-20 max-w-3xl px-4 sm:px-6">
        <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">💬 {tr(T.faq, locale)}</h2>
        <div className="mt-8 grid gap-3">
          {FAQ.map((f, i) => (
            <details key={i} className="group rounded-2xl bg-white/[0.07] ring-1 ring-white/15 open:bg-white/[0.11]">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-display text-lg font-bold [&::-webkit-details-marker]:hidden">
                {tr(f.q, locale)}
                <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-amber-200 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="px-5 pb-4 text-white/85">{tr(f.a, locale)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final call */}
      <section className="mx-auto mt-20 max-w-3xl px-4 text-center sm:px-6">
        <div className="flex items-end justify-center gap-2" aria-hidden="true">
          {ELVES.map((e, i) => (
            <motion.span key={e.id} animate={reduced ? {} : { y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1.6, delay: i * 0.2 }} className={`block overflow-hidden rounded-full ring-4 ring-amber-300/70 ${i === 1 ? 'h-24 w-24' : 'h-20 w-20'}`} style={{ background: `radial-gradient(circle at 50% 35%, ${e.accent}88, ${e.color})` }}>
              <ElfAvatar id={e.id} className="h-full w-full object-cover" />
            </motion.span>
          ))}
        </div>
        <h2 className="mt-5 font-display text-3xl font-bold text-balance sm:text-4xl">{tr(T.ready, locale)}</h2>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/lutins/atelier" className="inline-flex min-h-16 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#c92a2a] to-[#f03e3e] px-8 font-display text-xl font-bold shadow-[0_8px_0_#8a1c1c]">
            📷 {tr(T.parent, locale)}
          </Link>
          <Link href="/lutins/journal" className="inline-flex min-h-16 items-center justify-center gap-2 rounded-full bg-[#2fb344] px-8 font-display text-xl font-bold shadow-[0_8px_0_#1e7a2e]">
            📖 {tr(T.child, locale)}
          </Link>
        </div>
      </section>
    </div>
  );
}

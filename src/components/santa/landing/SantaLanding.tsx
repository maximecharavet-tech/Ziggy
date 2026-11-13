'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { SANTA_FREE_FEATURES, SANTA_NEW_PRICING, SANTA_OFFERS, SANTA_VALID_UNTIL_TEXT } from '@/lib/santa/offer';
import { useSantaPass } from '@/lib/santa/pass-client';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { Snow } from '@/components/santa/Snow';
import { SantaVillage } from '@/components/santa/SantaVillage';
import { ArtSlot } from './ArtSlot';
import { santaArt } from '@/data/santa/art';

const T = {
  title: { fr: 'Le Père Noël va t’appeler !', en: 'Santa is going to call you!' },
  subtitle: { fr: 'Un moment magique à partager en famille, imaginé pour les enfants de 3 à 9 ans.', en: 'A magical moment to share as a family, made for children aged 3 to 9.' },
  call: { fr: 'Recevoir l’appel du Père Noël', en: 'Get a call from Santa' }, letter: { fr: 'Écrire ma lettre (gratuit)', en: 'Write my letter (free)' }, village: { fr: 'Entrer au village', en: 'Enter the village' },
  how: { fr: 'La magie, en trois petits pas', en: 'Three little steps to Christmas magic' }, moments: { fr: 'Les moments magiques', en: 'Magical moments' }, privacy: { fr: 'La magie reste chez vous', en: 'The magic stays with you' }, offers: { fr: 'Choisissez votre moment', en: 'Choose your Christmas moment' }, faq: { fr: 'Les questions des parents', en: 'Parents often ask' }, advent: { fr: 'Ouvrir le calendrier de l’Avent', en: 'Open the Advent calendar' }, certificate: { fr: 'Créer mon certificat', en: 'Make my certificate' },
  pole: { fr: 'Au Pôle Nord, en ce moment', en: 'At the North Pole right now' },
  gift: { fr: 'Offrir la magie', en: 'Give the magic' }, giftText: { fr: 'Une carte cadeau pour les petits-enfants, filleuls ou amis : un simple lien, un grand souvenir.', en: 'A gift card for grandchildren, godchildren or friends: one link, one big memory.' },
  packs: { fr: 'Les packs de Noël', en: 'The Christmas packs' }, packsText: { fr: 'Un paiement unique, sans abonnement, pour toute la famille.', en: 'One payment, no subscription, for the whole family.' },
  poleTiles: [
    { art: 'traineau-decollage', title: { fr: 'Le traîneau se prépare pour le 24', en: 'The sleigh gets ready for the 24th' }, href: '/pere-noel/appel', wide: true },
    { art: 'lettre-envoyee', title: { fr: 'Ta lettre s’envole', en: 'Your letter flies away' }, href: '/pere-noel/lettre', wide: false },
    { art: 'atelier-video', title: { fr: 'L’atelier des lutins', en: 'The elves’ workshop' }, href: '/pere-noel/avent', wide: false },
    { art: 'grand-livre-video', title: { fr: 'Le grand livre des enfants sages', en: 'The big book of kind children' }, href: '/pere-noel/certificat', wide: false },
    { art: 'mere-noel', title: { fr: 'La cuisine de la Mère Noël', en: 'Mrs Claus’s kitchen' }, href: '/pere-noel/photo', wide: false },
  ],
  steps: [
    { fr: 'Écrivez une lettre ensemble, avec de grandes images faciles à choisir.', en: 'Write a letter together with big, easy-to-choose pictures.' },
    { fr: 'Choisissez le bon moment pour entendre le Père Noël dire son prénom.', en: 'Choose a moment to hear Santa say your child’s name.' },
    { fr: 'Gardez une photo, une lettre et de jolis souvenirs sur votre appareil.', en: 'Keep a photo, a letter and lovely memories on your device.' },
  ],
  momentsList: [
    { title: { fr: 'Un appel à l’heure choisie', en: 'A call at your chosen time' }, href: '/pere-noel/appel', mark: '☎' },
    { title: { fr: 'L’appel du 24 décembre', en: 'A Christmas Eve call' }, href: '/pere-noel/appel', mark: '✦' },
    { title: { fr: 'Un appel en direct', en: 'A live conversation' }, href: '/pere-noel/appel', mark: '❄' },
    { title: { fr: 'Une photo avec lui', en: 'A photo together' }, href: '/pere-noel/photo', mark: '◉' },
    { title: { fr: 'Une lettre pour le Pôle Nord', en: 'A letter to the North Pole' }, href: '/pere-noel/lettre', mark: '✉' },
    { title: { fr: 'Le calendrier de l’Avent', en: 'The Advent calendar' }, href: '/pere-noel/avent', mark: '▦' },
    { title: { fr: 'Le certificat Enfant sage', en: 'The Kind Heart certificate' }, href: '/pere-noel/certificat', mark: '❋' },
  ],
  q: [
    { q: { fr: 'La photo de mon enfant est-elle envoyée ?', en: 'Is my child’s photo uploaded?' }, a: { fr: 'Non. La photo et la vidéo sont fabriquées sur votre appareil et n’en sortent pas.', en: 'No. Photos and videos are made on your device and stay there.' } },
    { q: { fr: 'Faut-il acheter un pack ?', en: 'Do we need to buy a pack?' }, a: { fr: 'Non. La lettre et une première partie de l’expérience sont gratuites. Les packs sont un achat unique.', en: 'No. The letter and the start of the experience are free. Packs are a one-time purchase.' } },
    { q: { fr: 'Le Père Noël est-il une vraie personne ?', en: 'Is Santa a real person?' }, a: { fr: 'C’est une expérience magique créée par Ziggy. Le Père Noël ne prétend pas être une vraie personne.', en: 'It is a magical experience made by Ziggy. Santa does not claim to be a real person.' } },
  ],
} satisfies { [key: string]: L | L[] | { title: L; href: string; mark: string }[] | { q: L; a: L }[] | { art: string; title: L; href: string; wide: boolean }[] };

function PriceCounter({ amount, locale, reduced }: { amount: number; locale: string; reduced: boolean }) {
  const value = useMotionValue(reduced ? amount / 100 : 0);
  const formatted = useTransform(value, (current) => new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: 'EUR' }).format(current));
  useEffect(() => {
    if (reduced) { value.set(amount / 100); return; }
    const controls = animate(value, amount / 100, { duration: 1.1, ease: 'easeOut' });
    return () => controls.stop();
  }, [amount, reduced, value]);
  return <motion.span className="font-display text-4xl font-bold text-amber-200">{formatted}</motion.span>;
}

function Countdown({ locale }: { locale: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Date.parse('2026-12-24T20:00:00+01:00') - Date.now()));
    tick(); const id = window.setInterval(tick, 1000); return () => window.clearInterval(id);
  }, []);
  if (remaining === null) return <span className="tabular-nums">—</span>;
  const d = Math.floor(remaining / 86_400_000), h = Math.floor(remaining / 3_600_000) % 24, m = Math.floor(remaining / 60_000) % 60;
  return <span className="tabular-nums">{locale === 'fr' ? `Encore ${d} j ${h} h ${m} min` : `${d} days ${h} hours ${m} min to go`}</span>;
}

function MomentCard({ item, index, locale, reduced }: { item: (typeof T.momentsList)[number]; index: number; locale: string; reduced: boolean }) {
  const x = useMotionValue(0), y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [7, -7]), { stiffness: 180, damping: 18 });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 180, damping: 18 });
  return <motion.li initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }} whileInView={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }} viewport={{ once: true, amount: .2 }} transition={{ delay: index * .06, duration: .4 }}>
    <motion.div style={reduced ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 800 }} onPointerMove={(e) => { if (!reduced) { const r = e.currentTarget.getBoundingClientRect(); x.set((e.clientX - r.left) / r.width - .5); y.set((e.clientY - r.top) / r.height - .5); } }} onPointerLeave={() => { x.set(0); y.set(0); }}>
      <Link href={item.href} className="group flex min-h-44 flex-col justify-between rounded-3xl border border-white/15 bg-[#15143d] p-5 text-white shadow-lg transition-colors hover:bg-[#211e55] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300">
        <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-300 text-2xl text-[#261439]">{item.mark}</span>
        <span className="font-display text-xl font-bold">{tr(item.title, locale)}</span>
      </Link>
    </motion.div>
  </motion.li>;
}

export function SantaLanding() {
  const locale = useLocale(), reduced = useReducedMotion(), pass = useSantaPass();
  const { scrollYProgress } = useScroll();
  const auroraY = useTransform(scrollYProgress, [0, 1], ['0%', reduced ? '0%' : '30%']);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const heroVideo = santaArt('hero-loop');
  return <div className="overflow-hidden bg-[#0e1032] text-white">
    <section className="relative isolate flex min-h-[690px] items-end overflow-hidden px-5 pb-20 pt-28 sm:min-h-[760px] sm:items-center sm:px-10">
      <ArtSlot asset={heroVideo} priority posterOnSmall />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,12,38,.9),rgba(8,12,38,.52)_55%,rgba(8,12,38,.12)),linear-gradient(0deg,rgba(8,12,38,.55),transparent_55%)]" />
      <Snow count={reduced ? 0 : 34} />
      <motion.div aria-hidden="true" style={{ y: auroraY }} className="pointer-events-none absolute -right-10 top-5 h-64 w-[55vw] rounded-full bg-cyan-300/20 blur-[90px]" />
      <div className="relative mx-auto grid w-full max-w-7xl items-end gap-12 sm:grid-cols-[1.1fr_.9fr]">
        <motion.div initial={{ opacity: 0, y: reduced ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65 }}>
          <p className="mb-5 inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">✦ {locale === 'fr' ? 'Un Noël à vivre ensemble' : 'A Christmas to share'}</p>
          <h1 className="max-w-3xl font-display text-5xl font-bold leading-[1.02] tracking-tight text-balance sm:text-7xl">{tr(T.title, locale)}</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80 sm:text-xl">{tr(T.subtitle, locale)}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/pere-noel/appel" className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#d9343e] px-7 font-bold shadow-lg shadow-red-950/40 transition-colors hover:bg-[#ed515b] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300">{tr(T.call, locale)}</Link>
            <Link href="/pere-noel/lettre" className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/35 bg-white/10 px-7 font-bold backdrop-blur hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300">{tr(T.letter, locale)}</Link>
          </div>
          <p className="mt-7 text-sm text-white/70">{locale === 'fr' ? 'Le grand soir approche · ' : 'The big night is getting closer · '}<Countdown locale={locale} /></p>
        </motion.div>
        <div className="hidden min-h-48 items-end justify-end sm:flex">
          <Link href="#village" className="rounded-full border border-white/25 bg-[#14143e]/60 px-5 py-3 text-sm font-semibold backdrop-blur hover:bg-[#14143e]">{tr(T.village, locale)} ↓</Link>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-10" aria-labelledby="how-title">
      <p className="mb-3 text-sm font-semibold text-amber-200">{locale === 'fr' ? 'Pour les petits et les grands' : 'For little and grown-up hearts'}</p>
      <h2 id="how-title" className="max-w-2xl font-display text-3xl font-bold sm:text-5xl">{tr(T.how, locale)}</h2>
      <ol className="mt-9 grid gap-4 md:grid-cols-3">{T.steps.map((step, i) => <motion.li key={i} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }} whileInView={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .06 }} className="rounded-3xl border border-white/10 bg-white/[.06] p-6"><span className="font-display text-4xl text-amber-200">0{i + 1}</span><p className="mt-5 max-w-xs text-lg leading-relaxed text-white/85">{tr(step, locale)}</p></motion.li>)}</ol>
    </section>

    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-10" aria-labelledby="pole-title"><h2 id="pole-title" className="font-display text-3xl font-bold sm:text-5xl">{tr(T.pole, locale)}</h2><ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{T.poleTiles.map((tile, i) => <motion.li key={tile.art} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18 }} whileInView={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ delay: (i % 3) * .07 }} className={`group relative isolate overflow-hidden rounded-3xl border border-white/10 bg-[#1b1b48] ${tile.wide ? 'aspect-[21/9] sm:col-span-2' : 'aspect-[4/3]'}`}><ArtSlot asset={santaArt(tile.art)} sizes={tile.wide ? '(min-width:640px) 66vw, 100vw' : '(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw'} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" /><div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0b0d2b]/85 via-transparent to-transparent" /><Link href={tile.href} className="absolute inset-x-0 bottom-0 p-5 font-display text-xl font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300">{tr(tile.title, locale)} ↗</Link></motion.li>)}</ul></section>

    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-10" aria-labelledby="moments-title"><h2 id="moments-title" className="font-display text-3xl font-bold sm:text-5xl">{tr(T.moments, locale)}</h2><ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{T.momentsList.map((item, i) => <MomentCard key={item.href + i} item={item} index={i} locale={locale} reduced={reduced} />)}</ul></section>

    <section className="relative isolate my-20 overflow-hidden border-y border-cyan-100/10 bg-[#15173c] px-5 py-16 sm:px-10"><motion.div aria-hidden style={{ y: auroraY }} className="absolute inset-x-0 -top-36 -z-10 mx-auto h-72 max-w-5xl rounded-[50%] bg-[radial-gradient(ellipse,rgba(53,229,198,.2),rgba(90,95,255,.12)_40%,transparent_70%)] blur-2xl" /><div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[.8fr_1.2fr] md:items-center"><h2 className="font-display text-3xl font-bold sm:text-5xl">{tr(T.privacy, locale)}</h2><p className="max-w-2xl text-lg leading-relaxed text-white/80">{locale === 'fr' ? 'Les photos, vidéos, lettres et prénoms restent sur votre téléphone. Pas de publicité, pas de compte enfant, pas de traceur.' : 'Photos, videos, letters and first names stay on your phone. No ads, no child account, no tracker.'}</p></div></section>

    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-10" aria-labelledby="offer-title"><div className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 px-6 py-14 sm:px-10 sm:py-20"><ArtSlot asset={santaArt('offres-3-cadeaux')} sizes="(min-width:1280px) 1200px, 100vw" /><div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(14,16,50,.88),rgba(14,16,50,.35))]" /><h2 id="offer-title" className="relative max-w-xl font-display text-3xl font-bold sm:text-5xl">{tr(T.offers, locale)}</h2></div><div className="mt-8 grid gap-4 md:grid-cols-3"><article className="rounded-3xl border border-white/15 bg-white/[.06] p-6"><h3 className="font-display text-2xl font-bold">{locale === 'fr' ? 'Gratuit' : 'Free'}</h3><p className="mt-2 text-4xl font-bold text-emerald-300">0 €</p><ul className="mt-5 space-y-2 text-sm text-white/75">{SANTA_FREE_FEATURES.map((f) => <li key={f.fr}>✓ {tr(f, locale)}</li>)}</ul></article>{(['essentiel', 'magique'] as const).map((tier) => { const offer = SANTA_OFFERS[tier]; const featured = tier === 'magique'; return <article key={tier} className={`relative overflow-hidden rounded-3xl border p-6 ${featured ? 'border-amber-200/60 bg-gradient-to-br from-[#473051] via-[#281f53] to-[#161d47]' : 'border-white/15 bg-white/[.06]'}`}><h3 className="font-display text-2xl font-bold">{tr(offer.name, locale)}</h3><div className="mt-2 flex items-baseline gap-2"><PriceCounter amount={offer.amount} locale={locale} reduced={reduced} /></div><ul className="mt-5 space-y-2 text-sm text-white/75">{offer.features.map((f) => <li key={f.fr}>✓ {tr(f, locale)}</li>)}</ul>{featured && <motion.div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-100 to-transparent" animate={reduced ? { opacity: 1 } : { opacity: [.3, .9, .3] }} transition={{ duration: 3, repeat: Infinity }} />}</article>; })}</div><p className="mt-4 text-sm text-white/50">{locale === 'fr' ? 'Paiement unique · valable jusqu’au ' : 'One-time payment · valid until '}{tr(SANTA_VALID_UNTIL_TEXT, locale)}.</p><Link href="/pere-noel/parents" className="group relative isolate mt-8 flex min-h-56 items-end overflow-hidden rounded-3xl border border-amber-200/30 p-6 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300 sm:min-h-64"><ArtSlot asset={santaArt('carte-cadeau')} sizes="(min-width:1280px) 1200px, 100vw" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" /><span aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#2a0f1f]/90 via-[#2a0f1f]/40 to-transparent" /><span className="relative"><span className="block font-display text-2xl font-bold sm:text-3xl">{tr(SANTA_NEW_PRICING ? T.gift : T.packs, locale)}</span><span className="mt-1 block max-w-md text-white/80">{tr(SANTA_NEW_PRICING ? T.giftText : T.packsText, locale)}</span></span></Link><Link href="/pere-noel/parents" className="mt-5 inline-flex rounded-full bg-amber-300 px-6 py-3 font-bold text-[#221b42]">{pass.tier ? (locale === 'fr' ? 'Votre pack est actif' : 'Your pack is active') : (locale === 'fr' ? 'Voir les packs' : 'See the packs')}</Link></section>

    <section className="mx-auto max-w-5xl px-5 py-20 sm:px-10" aria-labelledby="faq-title"><h2 id="faq-title" className="font-display text-3xl font-bold sm:text-5xl">{tr(T.faq, locale)}</h2><div className="mt-7 divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/[.04]">{T.q.map(({ q, a }, i) => <div key={i} className="p-5"><button type="button" aria-expanded={openFaq === i} onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center justify-between gap-6 text-left font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">{tr(q, locale)}<span aria-hidden>{openFaq === i ? '−' : '+'}</span></button><AnimatePresence initial={false}>{openFaq === i && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? .15 : .25 }}><span className="block pt-4 leading-relaxed text-white/70">{tr(a, locale)}</span></motion.p>}</AnimatePresence></div>)}</div></section>

    <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-10"><div className="grid gap-4 rounded-[2rem] border border-white/10 bg-[#17183f] p-6 sm:grid-cols-2 sm:p-9"><Link href="/pere-noel/avent" className="rounded-2xl bg-[#29275c] p-5 font-display text-xl font-bold hover:bg-[#383675]">{tr(T.advent, locale)} ↗</Link><Link href="/pere-noel/certificat" className="rounded-2xl bg-[#29275c] p-5 font-display text-xl font-bold hover:bg-[#383675]">{tr(T.certificate, locale)} ↗</Link></div></section>
    <div id="village" className="border-t border-white/10"><SantaVillage /></div>
  </div>;
}

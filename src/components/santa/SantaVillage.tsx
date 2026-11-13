"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { tr, type L } from "@/lib/i18n-text";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { SayButton } from "@/components/arcade/read-aloud";
import { VillageScene } from "@/components/santa/landing/VillageScene";
import {
  SANTA_FREE_FEATURES,
  SANTA_OFFERS,
  SANTA_VALID_UNTIL_TEXT,
} from "@/lib/santa/offer";
import { useSantaPass } from "@/lib/santa/pass-client";

const T = {
  eyebrow: { fr: "L’appli du Père Noël", en: "Santa’s app" },
  title: { fr: "Le Village du Père Noël", en: "Santa’s Village" },
  subtitle: {
    fr: "Écris ta lettre, reçois un appel vidéo du Père Noël et prends ta photo avec lui !",
    en: "Write your letter, get a video call from Santa and take your photo with him!",
  },
  write: { fr: "Écrire ma lettre", en: "Write my letter" },
  call: { fr: "Appeler le Père Noël", en: "Call Santa" },
  daysLeft: { fr: "Noël dans", en: "Christmas in" },
  days: { fr: "jours", en: "days" },
  day: { fr: "jour", en: "day" },
  today: { fr: "Joyeux Noël !", en: "Merry Christmas!" },
  doors: { fr: "Les portes magiques", en: "The magic doors" },
  free: { fr: "Gratuit", en: "Free" },
  firstFree: { fr: "Début gratuit", en: "Free start" },
  oneFree: { fr: "Gratuit", en: "Free" },
  open: { fr: "Ouvrir", en: "Open" },
  parentsTitle: { fr: "Pour les parents", en: "For parents" },
  parentsLead: {
    fr: "Un moment magique à vivre avec votre enfant, pensé pour être sûr : pas de publicité, pas de compte à créer, et la photo de votre enfant ne quitte jamais votre téléphone.",
    en: "A magical moment to share with your child, designed to be safe: no ads, no account to create, and your child’s photo never leaves your phone.",
  },
  how: { fr: "Comment ça marche", en: "How it works" },
  step1: {
    fr: "Votre enfant écrit sa lettre en touchant de grandes images (même sans savoir lire).",
    en: "Your child writes their letter by tapping big pictures (even before they can read).",
  },
  step2: {
    fr: "Le Père Noël l’appelle en vidéo, dit son prénom, parle de sa liste et l’écoute répondre.",
    en: "Santa video-calls them, says their name, talks about their list and listens to their answers.",
  },
  step3: {
    fr: "Une photo et une petite vidéo avec le Père Noël, à garder et à partager en famille.",
    en: "A photo and a short video with Santa, to keep and share with the family.",
  },
  offer: { fr: "Ce qui est inclus", en: "What’s included" },
  freeTier: { fr: "Gratuit", en: "Free" },
  oneTime: {
    fr: "Paiement unique · sans abonnement · valable jusqu’au",
    en: "One-time payment · no subscription · valid until",
  },
  choose: { fr: "Voir les packs", en: "See the packs" },
  yours: { fr: "Votre pack est actif", en: "Your pack is active" },
  promises: { fr: "Nos promesses", en: "Our promises" },
  p1: {
    fr: "Photo et vidéo fabriquées sur votre téléphone : rien n’est envoyé.",
    en: "Photo and video made on your phone: nothing is uploaded.",
  },
  p2: {
    fr: "Le micro sert seulement à savoir quand votre enfant répond. Rien n’est enregistré.",
    en: "The microphone only tells when your child answers. Nothing is recorded.",
  },
  p3: {
    fr: "Aucune publicité, aucun traceur, aucun achat possible par l’enfant.",
    en: "No ads, no trackers, no purchase possible by the child.",
  },
  p4: {
    fr: "Le Père Noël est une voix créée par Ziggy. L’appel en direct (Pack magique) utilise une IA : vous l’activez vous-même.",
    en: "Santa is a voice made by Ziggy. The live call (Magic Pack) uses AI: you switch it on yourself.",
  },
  faq: { fr: "Questions fréquentes", en: "Questions" },
  q1: { fr: "Sur quels appareils ?", en: "Which devices?" },
  a1: {
    fr: "Téléphone, tablette et ordinateur, dans le navigateur ou l’appli Ziggy. L’appel en direct avec l’IA demande Chrome (Android ou ordinateur), qui comprend la voix sur l’appareil ; ailleurs, les appels guidés marchent partout.",
    en: "Phone, tablet and computer, in the browser or the Ziggy app. The live AI call needs Chrome (Android or computer), which understands speech on the device; elsewhere, the guided calls work everywhere.",
  },
  q2: {
    fr: "Que devient le prénom de mon enfant ?",
    en: "What happens to my child’s first name?",
  },
  a2: {
    fr: "Il reste sur votre appareil. Seul le prénom est envoyé pour que le Père Noël le prononce (un petit fichier audio du prénom seul, sans rien d’autre).",
    en: "It stays on your device. Only the first name is sent so Santa can say it (a tiny audio clip of the name alone, nothing else).",
  },
  q3: {
    fr: "Et si mon enfant demande si le Père Noël est réel ?",
    en: "What if my child asks whether Santa is real?",
  },
  a3: {
    fr: "Le Père Noël ne prétend jamais être une vraie personne : il répond avec douceur que c’est sa voix magique, créée par Ziggy. La magie, c’est vous qui la racontez.",
    en: "Santa never claims to be a real person: he gently says it is his magic voice, made by Ziggy. The magic is yours to tell.",
  },
  q4: { fr: "Puis-je être remboursé ?", en: "Can I get a refund?" },
  a4: {
    fr: "Écrivez-nous depuis l’adresse du reçu : nous regardons chaque demande avec bienveillance. Les détails sont dans les conditions.",
    en: "Write to us from the receipt’s address: we look at every request kindly. Details are in the terms.",
  },
} satisfies Record<string, L>;

const DOORS = [
  {
    href: "/pere-noel/lettre",
    emoji: "✉️",
    title: { fr: "Ma lettre", en: "My letter" },
    text: {
      fr: "Choisis tes cadeaux et signe avec ton doigt.",
      en: "Pick your gifts and sign with your finger.",
    },
    tag: "free",
    from: "#c92a2a",
    to: "#ff8787",
  },
  {
    href: "/pere-noel/appel?k=message",
    emoji: "🎧",
    title: { fr: "Son message", en: "His message" },
    text: {
      fr: "Le Père Noël te dit bonjour avec ton prénom.",
      en: "Santa says hello with your name.",
    },
    tag: "free",
    from: "#e67700",
    to: "#fcc419",
  },
  {
    href: "/pere-noel/appel",
    emoji: "📞",
    title: { fr: "L’appel vidéo", en: "The video call" },
    text: {
      fr: "Il t’appelle, te parle et t’écoute !",
      en: "He calls you, talks and listens to you!",
    },
    tag: "firstFree",
    from: "#2b8a3e",
    to: "#69db7c",
  },
  {
    href: "/pere-noel/photo",
    emoji: "📸",
    title: { fr: "Ma photo avec lui", en: "My photo with him" },
    text: {
      fr: "Une vraie photo avec le Père Noël et la neige.",
      en: "A real photo with Santa and the snow.",
    },
    tag: "oneFree",
    from: "#1864ab",
    to: "#74c0fc",
  },
] as const;

function daysToChristmas(now = new Date()) {
  const y =
    now.getMonth() === 11 && now.getDate() > 25
      ? now.getFullYear() + 1
      : now.getFullYear();
  const xmas = new Date(y, 11, 25);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((xmas.getTime() - today.getTime()) / 86_400_000);
}

export function SantaVillage() {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const pass = useSantaPass();
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => setDays(daysToChristmas()), []);

  return (
    <div className="pb-24">
      {/* Hero: the 3D village */}
      {/* The 3D scene gets the screen; the words sit under it, on the snow, so Santa stays visible. */}
      <section className="relative w-full">
        <div className="relative h-[68svh] min-h-[420px] w-full overflow-hidden sm:h-[74svh]">
          <VillageScene className="absolute inset-0" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(11,10,38,0.5)_0%,rgba(11,10,38,0)_22%,rgba(11,10,38,0)_70%,rgba(11,10,38,1)_100%)]"
          />
        </div>
        <div className="relative -mt-16 flex flex-col items-center px-4 text-center sm:-mt-20">
          {days !== null && (
            <motion.p
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold ring-1 ring-white/25 backdrop-blur"
            >
              🎄{" "}
              {days === 0
                ? tr(T.today, locale)
                : `${tr(T.daysLeft, locale)} ${days} ${days === 1 ? tr(T.day, locale) : tr(T.days, locale)}`}
            </motion.p>
          )}
          <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-200">
            {tr(T.eyebrow, locale)}
          </p>
          <div className="mt-2 flex items-center gap-3">
            {/* The landing's own <h1> is the page title; this one is a section heading. */}
            <h2 className="font-display text-[2.6rem] font-bold leading-[1.02] text-balance drop-shadow-[0_4px_0_rgba(0,0,0,0.35)] sm:text-6xl">
              {tr(T.title, locale)}
            </h2>
            <SayButton
              texts={[tr(T.title, locale), tr(T.subtitle, locale)]}
              locale={locale}
              size="md"
              className="shrink-0"
            />
          </div>
          <p className="mt-3 max-w-xl text-lg font-semibold text-white/90 drop-shadow sm:text-xl">
            {tr(T.subtitle, locale)}
          </p>
          <div className="mt-6 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <Link
              href="/pere-noel/lettre"
              className="inline-flex min-h-16 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#c92a2a] to-[#f03e3e] px-8 font-display text-xl font-bold shadow-[0_8px_0_#8a1c1c] transition-transform active:translate-y-1 active:shadow-[0_3px_0_#8a1c1c]"
            >
              ✉️ {tr(T.write, locale)}
            </Link>
            <Link
              href="/pere-noel/appel"
              className="inline-flex min-h-16 items-center justify-center gap-2 rounded-full bg-[#2fb344] px-8 font-display text-xl font-bold shadow-[0_8px_0_#1e7a2e] transition-transform active:translate-y-1 active:shadow-[0_3px_0_#1e7a2e]"
            >
              📞 {tr(T.call, locale)}
            </Link>
          </div>
        </div>
      </section>

      {/* The four doors */}
      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
        <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">
          ✨ {tr(T.doors, locale)}
        </h2>
        <ul className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {DOORS.map((d, i) => (
            <motion.li
              key={d.href}
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
            >
              <Link
                href={d.href}
                className="group relative flex h-full min-h-[14rem] flex-col overflow-hidden rounded-[2rem] p-4 text-white shadow-[0_14px_30px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/15 transition-transform hover:-translate-y-1 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/70 sm:p-5"
                style={{
                  background: `linear-gradient(155deg, ${d.from}, ${d.to})`,
                }}
              >
                <span className="w-fit rounded-full bg-white/25 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider">
                  {tr(T[d.tag], locale)}
                </span>
                <span
                  aria-hidden="true"
                  className="mt-3 text-6xl drop-shadow-lg transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110 sm:text-7xl"
                >
                  {d.emoji}
                </span>
                <span className="mt-auto pt-3 font-display text-xl font-bold leading-tight sm:text-2xl">
                  {tr(d.title, locale)}
                </span>
                <span className="mt-1 text-sm leading-snug text-white/90">
                  {tr(d.text, locale)}
                </span>
              </Link>
            </motion.li>
          ))}
        </ul>
      </section>

      {/* Parents */}
      <section
        className="mx-auto mt-20 max-w-5xl px-4 sm:px-6"
        aria-labelledby="parents-title"
      >
        <div className="rounded-[2rem] bg-[#fffaf0] p-6 text-[#2a1d12] shadow-2xl sm:p-10">
          <h2
            id="parents-title"
            className="font-display text-3xl font-bold sm:text-4xl"
          >
            👨‍👩‍👧 {tr(T.parentsTitle, locale)}
          </h2>
          <p className="mt-3 max-w-3xl text-lg text-[#5a4632]">
            {tr(T.parentsLead, locale)}
          </p>

          <h3 className="mt-8 font-display text-2xl font-bold">
            {tr(T.how, locale)}
          </h3>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {[T.step1, T.step2, T.step3].map((s, i) => (
              <li
                key={i}
                className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#efe0c4]"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#c92a2a] font-display text-xl font-bold text-white">
                  {i + 1}
                </span>
                <p className="mt-3 text-[#4a3826]">{tr(s, locale)}</p>
              </li>
            ))}
          </ol>

          <h3 className="mt-10 font-display text-2xl font-bold">
            {tr(T.offer, locale)}
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 ring-1 ring-[#efe0c4]">
              <p className="font-display text-xl font-bold">
                {tr(T.freeTier, locale)}
              </p>
              <p className="mt-1 font-display text-3xl font-bold text-[#2b8a3e]">
                0 €
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-[#4a3826]">
                {SANTA_FREE_FEATURES.map((f, i) => (
                  <li key={i}>✓ {tr(f, locale)}</li>
                ))}
              </ul>
            </div>
            {(["essentiel", "magique"] as const).map((tier) => {
              const o = SANTA_OFFERS[tier];
              return (
                <div
                  key={tier}
                  className={`rounded-2xl p-5 ring-1 ${tier === "magique" ? "bg-gradient-to-b from-[#fff4d6] to-white ring-[#f2c94c]" : "bg-white ring-[#efe0c4]"}`}
                >
                  <p className="font-display text-xl font-bold">
                    {tier === "magique" ? "✨ " : "🎁 "}
                    {tr(o.name, locale)}
                  </p>
                  <p className="mt-1 font-display text-3xl font-bold text-[#c92a2a]">
                    {tr(o.price, locale)}
                  </p>
                  <ul className="mt-3 space-y-1.5 text-sm text-[#4a3826]">
                    {o.features.map((f, i) => (
                      <li key={i}>✓ {tr(f, locale)}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-[#7a6650]">
            {tr(T.oneTime, locale)} {tr(SANTA_VALID_UNTIL_TEXT, locale)}.
          </p>
          <Link
            href="/pere-noel/parents"
            className="mt-5 inline-flex min-h-14 items-center gap-2 rounded-full bg-[#2a1d12] px-7 font-display text-lg font-bold text-white"
          >
            {pass.tier
              ? `✓ ${tr(T.yours, locale)}`
              : `🎁 ${tr(T.choose, locale)}`}
          </Link>

          <h3 className="mt-10 font-display text-2xl font-bold">
            🔒 {tr(T.promises, locale)}
          </h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {[T.p1, T.p2, T.p3, T.p4].map((p, i) => (
              <li
                key={i}
                className="rounded-2xl bg-white p-4 text-[#4a3826] ring-1 ring-[#efe0c4]"
              >
                {tr(p, locale)}
              </li>
            ))}
          </ul>

          <h3 className="mt-10 font-display text-2xl font-bold">
            {tr(T.faq, locale)}
          </h3>
          <div className="mt-4 divide-y divide-[#efe0c4] rounded-2xl bg-white ring-1 ring-[#efe0c4]">
            {(
              [
                [T.q1, T.a1],
                [T.q2, T.a2],
                [T.q3, T.a3],
                [T.q4, T.a4],
              ] as const
            ).map(([q, a], i) => (
              <details key={i} className="group p-4">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 font-bold">
                  {tr(q, locale)}
                  <span
                    aria-hidden="true"
                    className="text-xl transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2 text-[#5a4632]">{tr(a, locale)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

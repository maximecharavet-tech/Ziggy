'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowRight, Ban, Check, ChevronDown, Download, Lock, Monitor, RefreshCw, ShoppingBag, Smartphone, TabletSmartphone, Tv } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { EASE_OUT } from '@/lib/motion';
import { tr, type L } from '@/lib/i18n-text';
import { ANDROID_MIN, APK_PATH, APK_SIZE_MB, detectDevice, type Device } from '@/lib/downloads';

const T = {
  badge: { fr: 'Les applis Ziggy', en: 'The Ziggy apps' },
  title: { fr: 'Ziggy sur tous vos écrans', en: 'Ziggy on all your screens' },
  lead: {
    fr: 'Téléphone, tablette et télévision : les mêmes histoires, jeux et créations, dans une appli pensée pour les enfants.',
    en: 'Phone, tablet and TV: the same stories, games and creations, in an app made for children.',
  },
  ctaAndroid: { fr: 'Télécharger pour Android', en: 'Download for Android' },
  ctaIos: { fr: 'Installer sur iPhone et iPad', en: 'Install on iPhone and iPad' },
  ctaAll: { fr: 'Tous les appareils', en: 'All devices' },
  meta: {
    fr: `Téléchargement gratuit · ${APK_SIZE_MB} Mo · Android ${ANDROID_MIN} ou plus récent`,
    en: `Free download · ${APK_SIZE_MB} MB · Android ${ANDROID_MIN} or newer`,
  },
  inApp: { fr: 'Vous êtes déjà dans l’appli Ziggy 🎉', en: 'You are already in the Ziggy app 🎉' },
  shotTv: { fr: 'L’appli Ziggy sur une télévision : l’histoire du jour et les histoires du soir', en: 'The Ziggy app on a TV: the story of the day and bedtime stories' },
  shotPhone: { fr: 'L’appli Ziggy sur un téléphone : Ziggy dit bonjour', en: 'The Ziggy app on a phone: Ziggy says hello' },
  pick: { fr: 'Choisissez votre appareil', en: 'Pick your device' },
  yours: { fr: 'Votre appareil', en: 'Your device' },
  qrTitle: { fr: 'Sur votre téléphone', en: 'On your phone' },
  qrText: {
    fr: 'Scannez ce code avec l’appareil photo : cette page s’ouvre sur le téléphone, avec le bon bouton.',
    en: 'Scan this code with the camera: this page opens on the phone, with the right button.',
  },
  qrAlt: { fr: 'QR code vers ziggy-ai.fr/telecharger', en: 'QR code to ziggy-ai.fr/telecharger' },
  promises: { fr: 'Une appli faite pour les enfants', en: 'An app made for children' },
  faq: { fr: 'Questions des parents', en: 'Parents’ questions' },
} satisfies Record<string, L>;

interface Platform {
  id: Device | 'tv';
  icon: ReactNode;
  tint: string;
  title: L;
  status: { ready: boolean; text: L };
  intro?: L;
  steps?: L[];
  text?: L;
  address?: string;
  action?: { href: string; label: L; download?: boolean };
  foot?: L;
}

const PLATFORMS: Platform[] = [
  {
    id: 'android',
    icon: <Smartphone size={26} strokeWidth={2.2} />,
    tint: 'bg-green/12 text-green',
    title: { fr: 'Téléphone et tablette Android', en: 'Android phone and tablet' },
    status: { ready: true, text: { fr: 'Disponible', en: 'Available' } },
    steps: [
      { fr: 'Touchez « Télécharger l’appli ».', en: 'Tap “Download the app”.' },
      { fr: 'Ouvrez le fichier, puis autorisez l’installation si Android le demande.', en: 'Open the file, then allow the install if Android asks.' },
      { fr: 'Ziggy apparaît avec vos applis.', en: 'Ziggy appears with your apps.' },
    ],
    action: { href: APK_PATH, label: { fr: 'Télécharger l’appli', en: 'Download the app' }, download: true },
    foot: { fr: 'Google Play : en préparation', en: 'Google Play: in preparation' },
  },
  {
    id: 'tv',
    icon: <Tv size={26} strokeWidth={2.2} />,
    tint: 'bg-sky/12 text-sky',
    title: { fr: 'Android TV, Google TV et Fire TV', en: 'Android TV, Google TV and Fire TV' },
    status: { ready: true, text: { fr: 'Disponible', en: 'Available' } },
    steps: [
      { fr: 'Sur la télé, installez l’appli gratuite « Downloader » depuis le store de la télé.', en: 'On the TV, install the free “Downloader” app from the TV’s store.' },
      { fr: 'Ouvrez-la et autorisez-la à installer des applis.', en: 'Open it and allow it to install apps.' },
      { fr: 'Tapez cette adresse, puis « Installer » :', en: 'Type this address, then “Install”:' },
    ],
    address: 'ziggy-ai.fr/apk',
    foot: { fr: 'Sur la télé, Ziggy se pilote entièrement à la télécommande.', en: 'On the TV, Ziggy works entirely with the remote.' },
  },
  {
    id: 'ios',
    icon: <TabletSmartphone size={26} strokeWidth={2.2} />,
    tint: 'bg-coral/12 text-coral',
    title: { fr: 'iPhone et iPad', en: 'iPhone and iPad' },
    status: { ready: false, text: { fr: 'App Store : en préparation', en: 'App Store: in preparation' } },
    intro: { fr: 'En attendant, Ziggy s’installe en trois gestes :', en: 'Meanwhile, add Ziggy in three steps:' },
    steps: [
      { fr: 'Ouvrez ziggy-ai.fr dans Safari.', en: 'Open ziggy-ai.fr in Safari.' },
      { fr: 'Touchez le bouton Partager (le carré avec une flèche).', en: 'Tap the Share button (the square with an arrow).' },
      { fr: 'Choisissez « Sur l’écran d’accueil ».', en: 'Choose “Add to Home Screen”.' },
    ],
    foot: { fr: 'Ziggy s’ouvre alors en plein écran, comme une appli.', en: 'Ziggy then opens full screen, like an app.' },
  },
  {
    id: 'desktop',
    icon: <Monitor size={26} strokeWidth={2.2} />,
    tint: 'bg-leaf/15 text-leaf',
    title: { fr: 'Ordinateur', en: 'Computer' },
    status: { ready: true, text: { fr: 'Rien à installer', en: 'Nothing to install' } },
    text: {
      fr: 'Ziggy marche directement dans le navigateur : Chrome, Edge, Firefox ou Safari.',
      en: 'Ziggy runs right in the browser: Chrome, Edge, Firefox or Safari.',
    },
    action: { href: '/monde', label: { fr: 'Jouer maintenant', en: 'Play now' } },
  },
];

const PROMISES: { icon: ReactNode; title: L; text: L }[] = [
  { icon: <Ban size={20} />, title: { fr: 'Sans publicité', en: 'No ads' }, text: { fr: 'Jamais, nulle part.', en: 'Never, anywhere.' } },
  {
    icon: <ShoppingBag size={20} />,
    title: { fr: 'Pas d’achat dans l’appli', en: 'No in-app purchases' },
    text: { fr: 'Rien à acheter pour un enfant.', en: 'Nothing for a child to buy.' },
  },
  {
    icon: <Lock size={20} />,
    title: { fr: 'Espace parents protégé', en: 'Protected parents’ area' },
    text: { fr: 'Ce qui sort de l’appli passe par un contrôle parental.', en: 'Anything that leaves the app goes through a grown-up check.' },
  },
  {
    icon: <RefreshCw size={20} />,
    title: { fr: 'Toujours à jour', en: 'Always up to date' },
    text: { fr: 'Les nouvelles histoires et les nouveaux jeux arrivent tout seuls.', en: 'New stories and games arrive on their own.' },
  },
];

const FAQ: { q: L; a: L }[] = [
  {
    q: { fr: 'Pourquoi l’appli Android ne vient-elle pas de Google Play ?', en: 'Why doesn’t the Android app come from Google Play?' },
    a: {
      fr: 'Les applis sont en préparation pour Google Play et l’App Store. En attendant, l’appli Android s’installe directement depuis ce site. Android peut prévenir qu’elle ne vient pas du Play Store : touchez « Plus de détails », puis « Installer quand même ».',
      en: 'The apps are being prepared for Google Play and the App Store. Meanwhile, the Android app installs straight from this site. Android may warn that it does not come from the Play Store: tap “More details”, then “Install anyway”.',
    },
  },
  {
    q: { fr: 'D’où vient le fichier ?', en: 'Where does the file come from?' },
    a: {
      fr: 'Il est fabriqué automatiquement à partir du code de Ziggy et hébergé sur GitHub (github.com), où ce code est publié. Il ne contient ni publicité ni traceur.',
      en: 'It is built automatically from Ziggy’s code and hosted on GitHub (github.com), where that code is published. It contains no ads and no trackers.',
    },
  },
  {
    q: { fr: 'Faut-il faire des mises à jour ?', en: 'Does it need updates?' },
    a: {
      fr: 'Rarement : les histoires, les jeux et les nouveautés arrivent directement dans l’appli. Pour installer une nouvelle version de l’appli Android avant son arrivée sur Google Play, désinstallez d’abord l’ancienne.',
      en: 'Rarely: stories, games and new features arrive straight in the app. To install a new version of the Android app before it reaches Google Play, uninstall the old one first.',
    },
  },
];

const BTN = 'inline-flex min-h-14 items-center whitespace-nowrap justify-center gap-2 rounded-full px-7 text-lg font-bold transition-[box-shadow,transform,border-color] duration-200 active:scale-[0.97]';
const BTN_PRIMARY = `${BTN} gradient-green-cta text-white shadow-[0_12px_30px_-8px_rgba(34,197,94,0.55)] hover:shadow-[0_14px_34px_-8px_rgba(34,197,94,0.65)]`;
const BTN_SECONDARY = `${BTN} border border-border bg-bg-card text-text-body hover:border-green/40`;

/** The download button: a plain link (the APK address is outside the localized pages). */
function ApkLink({ className, children }: { className: string; children: ReactNode }) {
  return (
    <a href={APK_PATH} className={className}>
      {children}
    </a>
  );
}

export function DownloadPage() {
  const locale = useLocale();
  const t = (l: L) => tr(l, locale);
  // Static page: the device is known after hydration (the first render is the computer's).
  const [device, setDevice] = useState<Device | null>(null);
  useEffect(() => setDevice(detectDevice(navigator.userAgent, navigator.maxTouchPoints)), []);

  // MotionProvider (reducedMotion="user") keeps only the fade for reduced motion.
  const rise = (delay = 0) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay, ease: EASE_OUT } });

  return (
    <main className="relative overflow-clip px-4 pb-24 pt-24 sm:px-6 sm:pt-32 lg:px-8">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -start-32 -top-40 h-[36rem] w-[36rem] rounded-full bg-leaf/15 blur-3xl" />
        <div className="absolute -end-40 top-10 h-[34rem] w-[34rem] rounded-full bg-sky/15 blur-3xl" />
        <div className="absolute end-1/4 top-[55rem] h-[26rem] w-[26rem] rounded-full bg-peach/35 blur-3xl dark:bg-peach/10" />
      </div>

      {/* Hero */}
      <section className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
        <motion.div {...rise()} className="text-center lg:text-start">
          <span className="inline-flex items-center gap-2 rounded-full border border-green/25 bg-green/10 py-1 pe-4 ps-1.5 text-sm font-bold text-green">
            <Image src="/media/apps/icon.webp" alt="" width={28} height={28} className="rounded-lg" />
            {t(T.badge)}
          </span>
          <h1 className="mt-6 text-balance text-[2.6rem] font-bold leading-[1.04] text-text-body sm:text-6xl xl:text-7xl">{t(T.title)}</h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-text-muted sm:text-xl lg:mx-0">{t(T.lead)}</p>

          <div className="web-only mt-9 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap lg:justify-start">
            {device === 'ios' ? (
              <a href="#ios" className={BTN_PRIMARY}>
                <TabletSmartphone size={22} />
                {t(T.ctaIos)}
              </a>
            ) : (
              <ApkLink className={BTN_PRIMARY}>
                <Download size={22} />
                {t(T.ctaAndroid)}
              </ApkLink>
            )}
            <a href="#appareils" className={BTN_SECONDARY}>
              {t(T.ctaAll)}
              <ChevronDown size={20} />
            </a>
          </div>
          <p className="web-only mt-4 text-sm font-semibold text-text-dim">{t(T.meta)}</p>
          <p className="app-only mt-8 inline-flex rounded-2xl bg-green/10 px-5 py-3 text-lg font-bold text-green">{t(T.inApp)}</p>
        </motion.div>

        {/* The app on a TV and a phone (real screens of the app) */}
        <motion.div {...rise(0.12)} className="relative mx-auto w-full max-w-[680px] pb-6 ps-[9%] sm:pb-10">
          <figure className="relative">
            <div className="rounded-[1.4rem] bg-[#16142b] p-2 shadow-[0_40px_80px_-30px_rgba(30,20,80,0.6)] ring-1 ring-white/10 sm:p-2.5">
              <Image
                src="/media/apps/tv.webp"
                alt={t(T.shotTv)}
                width={1280}
                height={720}
                priority
                sizes="(min-width: 1024px) 600px, 88vw"
                className="h-auto w-full rounded-[1rem]"
              />
            </div>
            <div className="mx-auto h-2.5 w-28 rounded-b-xl bg-[#16142b]/85" aria-hidden="true" />
          </figure>
          <figure className="absolute bottom-0 start-0 w-[27%] min-w-[96px] -rotate-[5deg] rtl:rotate-[5deg]">
            <div className="rounded-[1.5rem] bg-[#16142b] p-1.5 shadow-[0_30px_50px_-20px_rgba(30,20,80,0.7)] ring-1 ring-white/10">
              <div className="relative aspect-[9/17] overflow-hidden rounded-[1.15rem]">
                <Image src="/media/apps/phone.webp" alt={t(T.shotPhone)} fill sizes="(min-width: 1024px) 180px, 26vw" className="object-cover object-top" />
              </div>
            </div>
          </figure>
        </motion.div>
      </section>

      {/* Devices */}
      <section id="appareils" className="relative mx-auto mt-24 max-w-6xl scroll-mt-28">
        <h2 className="text-center text-3xl font-bold text-text-body sm:text-4xl">{t(T.pick)}</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {PLATFORMS.map((p) => {
            const yours = device === p.id;
            return (
              <article
                key={p.id}
                id={p.id}
                className={`relative flex scroll-mt-28 flex-col rounded-3xl border bg-bg-card/90 p-6 shadow-[0_20px_40px_-30px_rgba(30,30,60,0.35)] backdrop-blur sm:p-7 ${
                  yours ? 'border-green/50 ring-2 ring-green/30' : 'border-border/70'
                }`}
              >
                <div className="flex items-start gap-4">
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${p.tint}`}>{p.icon}</span>
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-text-body sm:text-2xl">{t(p.title)}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          p.status.ready ? 'bg-green/12 text-green' : 'bg-amber-400/15 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {p.status.ready && <Check size={13} strokeWidth={3} />}
                        {t(p.status.text)}
                      </span>
                      {yours && <span className="rounded-full bg-sky/12 px-2.5 py-0.5 text-xs font-bold text-sky">{t(T.yours)}</span>}
                    </div>
                  </div>
                </div>

                {p.intro && <p className="mt-5 font-semibold text-text-body">{t(p.intro)}</p>}
                {p.text && <p className="mt-5 leading-relaxed text-text-muted">{t(p.text)}</p>}
                {p.steps && (
                  <ol className="mt-5 space-y-3">
                    {p.steps.map((s, i) => (
                      <li key={i} className="flex gap-3 leading-relaxed text-text-muted">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-text-body/[0.07] text-xs font-bold text-text-body">
                          {i + 1}
                        </span>
                        <span>{t(s)}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {p.address && (
                  <p
                    dir="ltr"
                    className="mt-4 self-start rounded-2xl border-2 border-dashed border-sky/40 bg-sky/[0.07] px-5 py-3 font-mono text-xl font-bold tracking-wide text-text-body sm:text-2xl"
                  >
                    {p.address}
                  </p>
                )}

                <div className="mt-auto pt-6">
                  {p.action && (
                    <div className="web-only">
                      {p.action.download ? (
                        <ApkLink className={`${BTN_PRIMARY} w-full sm:w-auto`}>
                          <Download size={22} />
                          {t(p.action.label)}
                        </ApkLink>
                      ) : (
                        <Link href={p.action.href as '/monde'} className={`${BTN_SECONDARY} w-full sm:w-auto`}>
                          {t(p.action.label)}
                          <ArrowRight size={20} className="rtl:rotate-180" />
                        </Link>
                      )}
                    </div>
                  )}
                  {p.foot && <p className={`text-sm text-text-dim ${p.action ? 'mt-3' : ''}`}>{t(p.foot)}</p>}
                </div>
              </article>
            );
          })}
        </div>

        {/* On a computer: the phone scans its way here. */}
        <div className="mt-6 hidden items-center gap-6 rounded-3xl border border-border/70 bg-bg-card/90 p-6 md:flex">
          <div className="shrink-0 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
            <Image src="/media/apps/qr-telecharger.svg" alt={t(T.qrAlt)} width={112} height={112} unoptimized />
          </div>
          <div>
            <h3 className="text-xl font-bold text-text-body">{t(T.qrTitle)}</h3>
            <p className="mt-1.5 max-w-xl leading-relaxed text-text-muted">{t(T.qrText)}</p>
          </div>
        </div>
      </section>

      {/* Promises */}
      <section className="relative mx-auto mt-24 max-w-6xl">
        <h2 className="text-center text-3xl font-bold text-text-body sm:text-4xl">{t(T.promises)}</h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map((p) => (
            <li key={p.title.en} className="rounded-3xl border border-border/70 bg-bg-card/90 p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green/12 text-green">{p.icon}</span>
              <h3 className="mt-4 text-lg font-bold text-text-body">{t(p.title)}</h3>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">{t(p.text)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Parents' questions */}
      <section className="relative mx-auto mt-24 max-w-3xl">
        <h2 className="text-center text-3xl font-bold text-text-body sm:text-4xl">{t(T.faq)}</h2>
        <div className="mt-8 space-y-3">
          {FAQ.map((f) => (
            <details key={f.q.en} className="group rounded-2xl border border-border/70 bg-bg-card/90 px-5 py-4 open:pb-5">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-4 font-bold text-text-body [&::-webkit-details-marker]:hidden">
                {t(f.q)}
                <ChevronDown size={20} className="shrink-0 text-text-dim transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="mt-3 leading-relaxed text-text-muted">{t(f.a)}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}

'use client';

import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { Snow } from '@/components/santa/Snow';
import { useReducedMotion } from '@/lib/use-reduced-motion';

const T = {
  badge: { fr: 'Nouveau pour Noël', en: 'New for Christmas' },
  title: { fr: 'Le Père Noël va t’appeler !', en: 'Santa is going to call you!' },
  text: {
    fr: 'Écris ta lettre, reçois un appel vidéo du Père Noël qui dit ton prénom, et prends ta photo avec lui.',
    en: 'Write your letter, get a video call from Santa who says your name, and take your photo with him.',
  },
  go: { fr: 'Entrer au village', en: 'Enter the village' },
  letter: { fr: 'Ma lettre (gratuit)', en: 'My letter (free)' },
} satisfies Record<string, L>;

/** Home page, seasonal: the door to L'appli du Père Noël. */
export function SantaTeaser() {
  const locale = useLocale();
  const reduced = useReducedMotion();
  return (
    <section aria-labelledby="santa-teaser" className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-[radial-gradient(120%_120%_at_20%_0%,#3b2385_0%,#17124a_55%,#0b0a26_100%)] p-6 text-white shadow-[0_24px_60px_-24px_rgba(20,10,60,0.8)] ring-1 ring-white/10 sm:p-10">
        <Snow count={reduced ? 0 : 28} />
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(64,255,190,0.25),transparent_70%)] blur-2xl" />
        <div className="relative grid items-center gap-6 sm:grid-cols-[1fr_auto]">
          <div>
            <span className="inline-flex rounded-full bg-amber-300 px-3 py-1 text-xs font-black uppercase tracking-wider text-[#3b1f00]">🎄 {tr(T.badge, locale)}</span>
            <div className="mt-3 flex items-center gap-3">
              <h2 id="santa-teaser" className="font-display text-3xl font-bold text-balance sm:text-5xl">{tr(T.title, locale)}</h2>
              <SayButton texts={[tr(T.title, locale), tr(T.text, locale)]} locale={locale} size="md" className="shrink-0" />
            </div>
            <p className="mt-3 max-w-2xl text-lg text-white/85">{tr(T.text, locale)}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/pere-noel" className="inline-flex min-h-16 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#c92a2a] to-[#f03e3e] px-7 font-display text-xl font-bold shadow-[0_8px_0_#8a1c1c] transition-transform active:translate-y-1 active:shadow-[0_3px_0_#8a1c1c]">
                🎅 {tr(T.go, locale)}
              </Link>
              <Link href="/pere-noel/lettre" className="inline-flex min-h-16 items-center justify-center gap-2 rounded-full bg-white/15 px-7 font-display text-xl font-bold ring-1 ring-white/30">
                ✉️ {tr(T.letter, locale)}
              </Link>
            </div>
          </div>
          <div aria-hidden="true" className={`hidden text-[9rem] leading-none drop-shadow-[0_20px_30px_rgba(0,0,0,0.45)] sm:block ${reduced ? '' : 'animate-[santa-bob_4s_ease-in-out_infinite]'}`}>
            🎅
          </div>
        </div>
        <style>{`@keyframes santa-bob { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-10px) rotate(3deg); } }`}</style>
      </div>
    </section>
  );
}

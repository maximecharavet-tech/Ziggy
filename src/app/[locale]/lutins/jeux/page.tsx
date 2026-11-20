import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { alternatesFor } from '@/lib/seo';
import { DioramaCard } from '@/components/create/fx/DioramaCard';
import { Layer } from '@/components/create/fx/Parallax';
import { Twinkle } from '@/components/create/fx/Burst';
import { fx, loop, shade } from '@/components/create/fx/toy';
import { Garland } from '@/components/sections/magic/Garland';

/** Lutin Chaos lives in `jeux/chahut` (built by the other team); set false to show "soon" instead. */
const CHAHUT_READY = true;

const T = {
  title: { fr: 'Les jeux des lutins', en: 'The elves’ games' },
  intro: {
    fr: 'Pépin, Grelotte et Noisette t’invitent à jouer avec Ziggy. Choisis ton jeu !',
    en: 'Pip, Jingle and Hazel invite you to play with Ziggy. Pick your game!',
  },
  atelier: { fr: 'L’Atelier des Lutins', en: 'Elf Workshop' },
  atelierText: {
    fr: 'Construis la chaîne de machines et fabrique les jouets des lettres d’enfants.',
    en: 'Build the machine line and make the toys the children wish for.',
  },
  chahut: { fr: 'Le Grand Chahut des Lutins', en: 'Elf Chaos' },
  chahutText: {
    fr: 'Les lutins ont tout mélangé dans la maison : retrouve qui a fait quoi !',
    en: 'The elves mixed everything up in the house: find out who did what!',
  },
  soon: { fr: 'Bientôt', en: 'Soon' },
  play: { fr: 'Jouer', en: 'Play' },
  back: { fr: 'Retour aux lutins', en: 'Back to the elves' },
} satisfies Record<string, L>;

const ELVES = [
  { id: 'pepin', size: 'h-[76px] w-[76px] sm:h-[88px] sm:w-[88px]', delay: 0 },
  { id: 'grelotte', size: 'h-[84px] w-[84px] sm:h-24 sm:w-24', delay: -1.3 },
  { id: 'noisette', size: 'h-16 w-16 sm:h-[72px] sm:w-[72px]', delay: -2.1 },
] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const fr = locale === 'fr';
  return {
    title: fr ? 'Les jeux des lutins | Ziggy' : 'The elves’ games | Ziggy',
    description: fr ? 'Deux jeux avec Pépin, Grelotte, Noisette et Ziggy : l’Atelier des Lutins et le Grand Chahut.' : 'Two games with Pip, Jingle, Hazel and Ziggy: Elf Workshop and Elf Chaos.',
    alternates: alternatesFor(locale, '/lutins/jeux'),
  };
}

/** The elves' workshop in a little window: a conveyor belt of toys under the lights. */
function WorkshopScene() {
  return (
    <>
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(70%_60%_at_80%_10%,rgba(255,230,170,0.55),transparent_60%),linear-gradient(180deg,#5a2a1a_0%,#8a3d1f_55%,#3d1d12_55%,#2a140c_100%)]" />
      <Garland className="absolute inset-x-0 top-0" count={9} />
      <Layer depth={-4} className="bottom-[34%] left-[6%] right-[6%] h-3 rounded-full bg-[repeating-linear-gradient(90deg,#c9b8a6_0_14px,#8f7b68_14px_18px)] shadow-[0_4px_0_rgba(0,0,0,0.35)]" />
      <Layer depth={8} className="bottom-[40%] left-[10%] text-[2.6rem]">
        <span className={`block leading-none drop-shadow-[0_6px_5px_rgba(0,0,0,0.35)] ${fx.float}`} style={loop({ dur: 3.6, amp: -5 })}>
          🧸
        </span>
      </Layer>
      <Layer depth={12} className="bottom-[40%] left-[40%] text-[2.6rem]">
        <span className={`block leading-none drop-shadow-[0_6px_5px_rgba(0,0,0,0.35)] ${fx.float}`} style={loop({ dur: 4.2, amp: -6, delay: 0.6 })}>
          🚂
        </span>
      </Layer>
      <Layer depth={16} className="bottom-[40%] right-[10%] text-[2.6rem]">
        <span className={`block leading-none drop-shadow-[0_6px_5px_rgba(0,0,0,0.35)] ${fx.float}`} style={loop({ dur: 3.9, amp: -5, delay: 1.1 })}>
          🎁
        </span>
      </Layer>
      <Layer depth={20} className="bottom-[4%] left-[8%] text-[2.2rem]">
        <span className={`block leading-none ${fx.bob}`}>🏭</span>
      </Layer>
      <Layer depth={14} className="right-[18%] top-[34%]">
        <Twinkle size={14} color="#FFD447" className={fx.twinkle} style={loop({ dur: 2.4 })} />
      </Layer>
    </>
  );
}

/** The elves' messy house in a little window: socks everywhere, a magnifying glass. */
function ChaosScene() {
  return (
    <>
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_15%,rgba(207,232,255,0.5),transparent_60%),linear-gradient(180deg,#2c2a7a_0%,#4a43b0_58%,#d9c7a8_58%,#b99f78_100%)]" />
      <Layer depth={-5} className="left-[34%] top-[10%] text-[3.2rem]">
        <span className="block leading-none drop-shadow-[0_6px_6px_rgba(0,0,0,0.3)]">🏠</span>
      </Layer>
      <Layer depth={10} className="bottom-[10%] left-[8%] text-[2.4rem]">
        <span className={`block leading-none ${fx.wiggle}`} style={loop({ dur: 2.6 })}>
          🧦
        </span>
      </Layer>
      <Layer depth={14} className="bottom-[16%] right-[30%] rotate-12 text-[2.2rem]">
        <span className={`block leading-none ${fx.wiggle}`} style={loop({ dur: 3.2, delay: 0.5 })}>
          🧦
        </span>
      </Layer>
      <Layer depth={22} className="bottom-[6%] right-[6%] text-[3rem]">
        <span className={`block leading-none drop-shadow-[0_6px_6px_rgba(0,0,0,0.3)] ${fx.drift}`} style={loop({ dur: 6, dx: -12, dy: -6 })}>
          🔍
        </span>
      </Layer>
      {[
        [14, 16],
        [80, 22],
        [62, 8],
      ].map(([x, y], i) => (
        <Layer key={i} depth={6 + i * 3} className="" style={{ left: `${x}%`, top: `${y}%` }}>
          <Twinkle size={12} color="#FFF4C8" className={fx.twinkle} style={loop({ dur: 2.2 + i * 0.5, delay: i * 0.4 })} />
        </Layer>
      ))}
    </>
  );
}

export default async function LutinsGamesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = (l: L) => tr(l, locale);
  const games = [
    { href: '/lutins/jeux/atelier', title: t(T.atelier), text: t(T.atelierText), from: '#e8743b', to: '#b8360f', scene: <WorkshopScene /> },
    ...(CHAHUT_READY ? [{ href: '/lutins/jeux/chahut', title: t(T.chahut), text: t(T.chahutText), from: '#7a6ae0', to: '#3f3aa8', scene: <ChaosScene /> }] : []),
  ];
  return (
    // The site's <main> is in the layout: this page is a plain block under the top bar.
    <div className="mx-auto flex min-h-[80vh] w-full max-w-5xl flex-col gap-8 px-4 pb-14 pt-24 sm:pt-28">
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-end gap-2 sm:gap-3" aria-hidden="true">
          {ELVES.map((e) => (
            <span key={e.id} className="mg-bob block" style={{ '--delay': `${e.delay}s`, '--dur': '4.6s', '--amp': '-6px' } as CSSProperties}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/lutins/refs/avatars/${e.id}.png`} alt="" width={96} height={96} className={`rounded-full bg-white/85 object-cover shadow-[0_10px_24px_-8px_rgba(0,0,0,0.6)] ring-4 ring-white/80 ${e.size}`} />
            </span>
          ))}
        </div>
        <h1 className="mt-1 font-display text-4xl font-bold text-white drop-shadow-[0_3px_0_rgba(20,10,60,0.6)] sm:text-6xl">{t(T.title)}</h1>
        <p className="flex max-w-xl items-center gap-3 text-lg font-semibold text-[#fff3e0] sm:text-xl">
          {t(T.intro)}
          <SayButton texts={[t(T.intro), ...games.map((g) => `${g.title}. ${g.text}`)]} locale={locale} size="md" className="!bg-white/15 !text-white !ring-white/40" />
        </p>
      </header>

      <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2">
        {games.map((g, i) => (
          <li key={g.href}>
            <DioramaCard
              href={g.href}
              label={`${g.title}. ${g.text}`}
              from={g.from}
              to={g.to}
              index={i}
              windowClassName="h-44 sm:h-52"
              window={g.scene}
              corner={<SayButton texts={[g.title, g.text]} locale={locale} size="md" className="!bg-white/90 !text-[#5FB6EA] shadow-[0_4px_0_rgba(0,0,0,0.12)] !ring-white" />}
            >
              <span className="flex flex-1 flex-col px-1.5 pb-1.5 pt-4">
                <span className="font-display text-[1.7rem] font-bold leading-tight [text-shadow:0_2px_0_rgba(0,0,0,0.18)]">{g.title}</span>
                <span className="mt-1.5 flex-1 text-[1.02rem] font-semibold leading-snug text-white/95">{g.text}</span>
                <span
                  className={`${fx.toy} ${fx.light} ${fx.sheen} mt-5 inline-flex min-h-14 w-fit items-center gap-2 rounded-full px-7 font-display text-xl font-bold`}
                  style={{ '--ink': shade(g.to, -0.35), '--delay': `${1 + i * 0.7}s` } as CSSProperties}
                >
                  <span aria-hidden="true">▶</span> {t(T.play)}
                </span>
              </span>
            </DioramaCard>
          </li>
        ))}
        {!CHAHUT_READY && (
          <li className="flex min-h-[200px] flex-col justify-between gap-3 rounded-[2rem] bg-white/70 p-5 shadow-xl ring-4 ring-white/50">
            <span className="text-5xl opacity-80" aria-hidden="true">
              🧦🏠🔍
            </span>
            <span>
              <span className="block font-display text-2xl font-bold text-[#2a2a5a]">{t(T.chahut)}</span>
              <span className="mt-1 block font-semibold text-[#3a3a6a]">{t(T.chahutText)}</span>
            </span>
            <span className="inline-flex min-h-[44px] w-fit items-center rounded-full bg-[#e9e4ff] px-5 font-bold text-[#4a3a8a]">✨ {t(T.soon)}</span>
          </li>
        )}
      </ul>
      <Link href="/lutins" className="press mx-auto inline-flex min-h-12 items-center gap-2 rounded-full bg-white/10 px-6 font-display text-lg font-semibold text-[#fff3e0] ring-1 ring-white/25 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300">
        <span aria-hidden="true" className="rtl:rotate-180">←</span> {t(T.back)}
      </Link>
    </div>
  );
}

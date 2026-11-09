import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { alternatesFor } from '@/lib/seo';

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

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const fr = locale === 'fr';
  return {
    title: fr ? 'Les jeux des lutins | Ziggy' : 'The elves’ games | Ziggy',
    description: fr ? 'Deux jeux avec Pépin, Grelotte, Noisette et Ziggy : l’Atelier des Lutins et le Grand Chahut.' : 'Two games with Pip, Jingle, Hazel and Ziggy: Elf Workshop and Elf Chaos.',
    alternates: alternatesFor(locale, '/lutins/jeux'),
  };
}

export default async function LutinsGamesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = (l: L) => tr(l, locale);
  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-end gap-2" aria-hidden="true">
          {(['pepin', 'grelotte', 'noisette'] as const).map((id) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={id} src={`/lutins/refs/avatars/${id}.png`} alt="" width={72} height={72} className={`rounded-full bg-white/85 object-cover shadow-lg ring-4 ring-white/70 ${id === 'noisette' ? 'h-14 w-14' : 'h-[72px] w-[72px]'}`} />
          ))}
        </div>
        <h1 className="font-display text-4xl font-bold text-white drop-shadow sm:text-5xl">{t(T.title)}</h1>
        <p className="flex max-w-xl items-center gap-2 text-lg font-semibold text-[#fff3e0]">
          {t(T.intro)}
          <SayButton texts={[t(T.intro), `${t(T.atelier)}. ${t(T.atelierText)}`, `${t(T.chahut)}. ${t(T.chahutText)}`]} locale={locale} size="sm" />
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/lutins/jeux/atelier" className="group flex min-h-[200px] flex-col justify-between gap-3 rounded-[2rem] bg-gradient-to-br from-[#fff4e2] to-[#ffd9a8] p-5 shadow-xl ring-4 ring-white/70 transition hover:scale-[1.02]">
          <span className="text-5xl" aria-hidden="true">
            🏭🧸🚂
          </span>
          <span>
            <span className="block font-display text-2xl font-bold text-[#4a2a12]">{t(T.atelier)}</span>
            <span className="mt-1 block font-semibold text-[#6b4a2a]">{t(T.atelierText)}</span>
          </span>
          <span className="inline-flex min-h-[52px] w-fit items-center rounded-full bg-gradient-to-r from-[#56b45a] to-[#2f8f46] px-6 text-lg font-bold text-white shadow-lg">▶ {t(T.play)}</span>
        </Link>
        {CHAHUT_READY ? (
          <Link href="/lutins/jeux/chahut" className="flex min-h-[200px] flex-col justify-between gap-3 rounded-[2rem] bg-gradient-to-br from-[#eef2ff] to-[#c9d6ff] p-5 shadow-xl ring-4 ring-white/70 transition hover:scale-[1.02]">
            <span className="text-5xl" aria-hidden="true">
              🧦🏠🔍
            </span>
            <span>
              <span className="block font-display text-2xl font-bold text-[#2a2a5a]">{t(T.chahut)}</span>
              <span className="mt-1 block font-semibold text-[#3a3a6a]">{t(T.chahutText)}</span>
            </span>
            <span className="inline-flex min-h-[52px] w-fit items-center rounded-full bg-gradient-to-r from-[#7a6ae0] to-[#4a5ac8] px-6 text-lg font-bold text-white shadow-lg">▶ {t(T.play)}</span>
          </Link>
        ) : (
          <div className="flex min-h-[200px] flex-col justify-between gap-3 rounded-[2rem] bg-white/70 p-5 shadow-xl ring-4 ring-white/50" aria-disabled="true">
            <span className="text-5xl opacity-80" aria-hidden="true">
              🧦🏠🔍
            </span>
            <span>
              <span className="block font-display text-2xl font-bold text-[#2a2a5a]">{t(T.chahut)}</span>
              <span className="mt-1 block font-semibold text-[#3a3a6a]">{t(T.chahutText)}</span>
            </span>
            <span className="inline-flex min-h-[44px] w-fit items-center rounded-full bg-[#e9e4ff] px-5 font-bold text-[#4a3a8a]">✨ {t(T.soon)}</span>
          </div>
        )}
      </div>
      <Link href="/lutins" className="mx-auto text-sm font-semibold text-[#fff3e0] underline">
        ← {t(T.back)}
      </Link>
    </main>
  );
}

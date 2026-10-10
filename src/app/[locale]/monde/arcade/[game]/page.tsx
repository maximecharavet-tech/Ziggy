import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ARCADE_GAME_IDS, type ArcadeGameId } from '@/lib/arcade/types';
import { getGame } from '@/lib/arcade/registry';
import { PlayFlow } from '@/components/world/PlayFlow';
import { tr } from '@/lib/i18n-text';

type Props = { params: Promise<{ locale: string; game: string }> };
const isGame = (g: string): g is ArcadeGameId => (ARCADE_GAME_IDS as readonly string[]).includes(g);

export function generateStaticParams() {
  return ARCADE_GAME_IDS.map((game) => ({ game }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, game } = await params;
  if (!isGame(game)) return {};
  const g = getGame(game);
  return { title: `${tr(g.name, locale)} — Ziggy Arcade`, description: tr(g.description, locale) };
}

export default async function ArcadeGamePage({ params }: Props) {
  const { locale, game } = await params;
  if (!isGame(game)) notFound();
  setRequestLocale(locale);
  return <PlayFlow gameId={game} />;
}

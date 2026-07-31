import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, getGame } from '@/lib/games';
import { GamePageContent } from './GamePageContent';

export function generateStaticParams() {
  return GAMES.map((game) => ({ game: game.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; game: string }>;
}): Promise<Metadata> {
  const { locale, game: gameId } = await params;
  if (!getGame(gameId)) return { title: 'Not Found' };

  const t = await getTranslations({ locale, namespace: 'games' });
  return {
    title: `${t(`${gameId}.name`)} — Ziggy`,
    description: t(`${gameId}.description`),
  };
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ locale: string; game: string }>;
}) {
  const { locale, game: gameId } = await params;

  if (!getGame(gameId)) notFound();

  setRequestLocale(locale);

  return <GamePageContent gameId={gameId} />;
}

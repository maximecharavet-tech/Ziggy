import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, getGame } from '@/lib/games';
import { GamePageContent } from './GamePageContent';
import { alternatesFor, breadcrumbLd, clampTitle, frSeoTitle, FR_GAME_KEYWORDS, localeUrl } from '@/lib/seo';
import { SITE_URL } from '@/lib/site-url';
import { JsonLd } from '@/components/seo/JsonLd';

/** Unknown ids are a real 404, not a 200 "not found" page. */
export const dynamicParams = false;

export function generateStaticParams() {
  return GAMES.map((game) => ({ game: game.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; game: string }> }): Promise<Metadata> {
  const { locale, game: gameId } = await params;
  if (!getGame(gameId)) return { title: 'Not Found' };

  const t = await getTranslations({ locale, namespace: 'games' });
  const name = t(`${gameId}.name`);
  return {
    title: locale === 'fr' ? frSeoTitle(name, FR_GAME_KEYWORDS) : clampTitle(`${name} — Ziggy`),
    description: t(`${gameId}.description`),
    alternates: alternatesFor(locale, `/games/${gameId}`),
  };
}

export default async function GamePage({ params }: { params: Promise<{ locale: string; game: string }> }) {
  const { locale, game: gameId } = await params;

  if (!getGame(gameId)) notFound();

  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'games' });
  const name = t(`${gameId}.name`);
  const url = localeUrl(SITE_URL, locale, `/games/${gameId}`);
  const learningResource = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name,
    description: t(`${gameId}.description`),
    url,
    inLanguage: locale,
    learningResourceType: 'Game',
    typicalAgeRange: '5-12',
    provider: { '@type': 'Organization', name: 'Ziggy Technologies SAS', url: SITE_URL },
  };
  const crumbs = breadcrumbLd(SITE_URL, locale, [
    { name: t('pageTitle'), path: '/games' },
    { name, path: `/games/${gameId}` },
  ]);

  return (
    <>
      <JsonLd data={[learningResource, crumbs]} />
      <GamePageContent gameId={gameId} />
    </>
  );
}

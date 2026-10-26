import { setRequestLocale, getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { GamesPageContent } from './GamesPageContent';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'games' });
  return {
    ...{
      title: t('pageTitle'),
      description: t('pageSubtitle'),
    },
    alternates: alternatesFor(locale, '/games'),
  };
}

export default async function GamesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <GamesPageContent />;
}

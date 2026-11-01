import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { CollectionPage } from '@/components/world/CollectionPage';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...{
      title: `${locale === 'fr' ? 'Ma collection' : 'My collection'} — Ziggy World`,
      description: locale === 'fr'
        ? 'Ta collection Ziggy World : les lieux, objets et personnages gagnés en jouant aux quêtes. Joue une quête pour la commencer !'
        : 'Your Ziggy World collection: the places, items and characters you win by playing quests. Play a quest to start it!',
    },
    alternates: alternatesFor(locale, '/monde/collection'),
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CollectionPage />;
}

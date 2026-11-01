import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { StoryBuilder } from '@/components/world/StoryBuilder';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...{
      title: locale === 'fr' ? 'Invente ton histoire magique avec Ziggy | Ziggy World' : 'Story Builder — Ziggy World',
      description: locale === 'fr'
        ? 'L’atelier des histoires : choisis un héros, un lieu, un ami, un objet et une mission, et Ziggy raconte ton histoire magique !'
        : 'The story workshop: pick a hero, a place, a friend, an object and a mission, and Ziggy tells your magic story!',
    },
    alternates: alternatesFor(locale, '/monde/histoires'),
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <StoryBuilder />;
}

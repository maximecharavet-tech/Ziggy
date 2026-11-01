import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AvatarStudio } from '@/components/world/AvatarStudio';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...{
      title: locale === 'fr' ? 'Crée ton avatar d’aventurier avec Ziggy | Ziggy World' : 'Avatar Studio — Ziggy World',
      description: locale === 'fr'
        ? 'Le studio d’avatar de Ziggy World : choisis tes couleurs, ta tenue et ton style, et Ziggy dessine ton avatar d’aventurier !'
        : 'The Ziggy World avatar studio: choose your colours, outfit and style, and Ziggy draws your explorer avatar!',
    },
    alternates: alternatesFor(locale, '/monde/avatar'),
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AvatarStudio />;
}

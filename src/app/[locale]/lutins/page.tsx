import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LutinsHome } from '@/components/lutins/LutinsHome';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const fr = locale === 'fr';
  return {
    title: fr ? 'Les Lutins Farceurs — une farce de lutins chez vous chaque nuit de décembre' : 'The Prankster Elves — an elf prank at your place every December night',
    description: fr
      ? 'Photographiez une pièce, choisissez une farce : trois lutins en feutrine apparaissent dans votre photo. Gratuit, sans désordre, et aucune image d’enfant n’est envoyée.'
      : 'Photograph a room, pick a prank: three felt elves appear in your photo. Free, no mess, and no child’s picture is ever sent.',
    alternates: alternatesFor(locale, '/lutins'),
  };
}

export default async function LutinsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LutinsHome />;
}

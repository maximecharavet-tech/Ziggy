import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { PizzaPlayer } from '@/components/games3d/PizzaPlayer';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...(locale === 'fr'
      ? {
          title: 'La Pizzeria de Ziggy — jeu 3D',
          description: 'Garnis les pizzas des animaux du village avec Ziggy, en 3D : compter, additionner, moitiés, fractions et monnaie.',
        }
      : {
          title: 'Ziggy’s Pizzeria — 3D game',
          description: 'Top the village animals’ pizzas with Ziggy, in 3D: counting, adding, halves, fractions and giving change.',
        }),
    alternates: alternatesFor(locale, '/monde/3d/pizza'),
  };
}

export default async function PizzaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PizzaPlayer />;
}

import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LugePlayer } from '@/components/games3d/LugePlayer';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return locale === 'fr'
    ? { title: 'La Luge des nombres — jeu 3D', description: 'Dévale la piste avec Ziggy et passe sous l’arche de la bonne réponse, en 3D.' }
    : { title: 'The Number Sled — 3D game', description: 'Race down the slope with Ziggy and ride under the arch with the right answer, in 3D.' };
}

export default async function LugePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LugePlayer />;
}

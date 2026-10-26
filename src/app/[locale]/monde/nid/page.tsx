import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { NidPlayer } from '@/components/games3d/nid/NidPlayer';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return locale === 'fr'
    ? { title: 'Le Nid de mon compagnon — jeu 3D', description: 'Prends soin de ton compagnon dans son petit jardin en 3D : il grandit quand tu apprends.' }
    : { title: 'My Companion’s Nest — 3D game', description: 'Look after your companion in its little 3D garden: it grows when you learn.' };
}

export default async function NidPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NidPlayer />;
}

import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { CreateHub } from '@/components/create/CreateHub';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return locale === 'fr'
    ? { title: 'L’Atelier des créateurs — Ziggy', description: 'Coloriage 3D, musique, sciences, histoires et compagnon : le jeu libre de Ziggy.' }
    : { title: 'The Makers’ Workshop — Ziggy', description: '3D colouring, music, science, stories and a companion: Ziggy’s open-ended play.' };
}

export default async function CreatePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CreateHub />;
}

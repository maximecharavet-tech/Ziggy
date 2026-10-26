import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { SongMaker } from '@/components/music/SongMaker';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return locale === 'fr'
    ? { title: 'La Fabrique à chansons — Ziggy', description: 'Compose ta chanson avec les animaux musiciens : aucune note ne sonne faux.' }
    : { title: 'The Song Factory — Ziggy', description: 'Compose your song with the animal band: no note can sound wrong.' };
}

export default async function MusicPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SongMaker />;
}

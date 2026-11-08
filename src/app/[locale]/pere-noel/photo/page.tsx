import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { PhotoBooth } from '@/components/santa/booth/PhotoBooth';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...(locale === 'fr'
      ? { title: 'Photo avec le Père Noël — l’appli du Père Noël de Ziggy', description: 'Une photo magique avec le Père Noël, détourée sur votre appareil : la photo ne quitte jamais votre téléphone.' }
      : { title: 'Photo with Santa — Ziggy’s Santa app', description: 'A magical photo with Santa, cut out on your device: the photo never leaves your phone.' }),
    alternates: alternatesFor(locale, '/pere-noel/photo'),
  };
}

export default async function PhotoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PhotoBooth />;
}

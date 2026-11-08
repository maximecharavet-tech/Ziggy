import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LetterBuilder } from '@/components/santa/letter/LetterBuilder';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...(locale === 'fr'
      ? { title: 'Ma lettre au Père Noël — l’appli du Père Noël de Ziggy', description: 'Les enfants choisissent leurs cadeaux en touchant de grandes images, signent avec le doigt et envoient leur lettre au Père Noël. Gratuit.' }
      : { title: 'My letter to Santa — Ziggy’s Santa app', description: 'Children pick their gifts by tapping big pictures, sign with a finger and send their letter to Santa. Free.' }),
    alternates: alternatesFor(locale, '/pere-noel/lettre'),
  };
}

export default async function LettrePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LetterBuilder />;
}

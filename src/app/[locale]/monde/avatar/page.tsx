import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AvatarStudio } from '@/components/world/AvatarStudio';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: `${locale === 'fr' ? 'Atelier d’avatar' : 'Avatar Studio'} — Ziggy World` };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AvatarStudio />;
}

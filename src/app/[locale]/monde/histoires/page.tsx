import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { StoryBuilder } from '@/components/world/StoryBuilder';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: `${locale === 'fr' ? 'Story Builder' : 'Story Builder'} — Ziggy World` };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <StoryBuilder />;
}

import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { WorldMapHome } from '@/components/world/WorldMapHome';
import { tr } from '@/lib/i18n-text';
import { WORLD_UI } from '@/components/world/text';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: `${tr(WORLD_UI.title, locale)} — Ziggy`, description: tr(WORLD_UI.tagline, locale) };
}

export default async function WorldPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <WorldMapHome />;
}

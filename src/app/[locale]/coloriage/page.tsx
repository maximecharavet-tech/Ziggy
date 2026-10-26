import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { tr } from '@/lib/i18n-text';
import { T } from '@/coloring/text';
import { ColoringApp } from '@/components/coloring/ColoringApp';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: `${tr(T.appName, locale)} — Ziggy`, description: tr(T.subtitle, locale) };
}

export default async function ColoriagePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ColoringApp />;
}

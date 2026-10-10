import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { WORLDS } from '@/data/worlds';
import { WorldView } from '@/components/world/WorldView';
import { tr } from '@/lib/i18n-text';

export function generateStaticParams() {
  return WORLDS.map((w) => ({ world: w.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; world: string }> }): Promise<Metadata> {
  const { locale, world } = await params;
  const w = WORLDS.find((x) => x.id === world);
  if (!w) return {};
  return { title: `${tr(w.name, locale)} — Ziggy World`, description: tr(w.description, locale) };
}

export default async function WorldDetailPage({ params }: { params: Promise<{ locale: string; world: string }> }) {
  const { locale, world } = await params;
  if (!WORLDS.some((w) => w.id === world)) notFound();
  setRequestLocale(locale);
  return <WorldView worldId={world} />;
}

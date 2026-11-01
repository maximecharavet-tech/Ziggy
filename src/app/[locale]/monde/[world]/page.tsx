import { alternatesFor, clampTitle, frSeoTitle, FR_WORLD_KEYWORDS } from '@/lib/seo';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { WORLDS } from '@/data/worlds';
import { WorldView } from '@/components/world/WorldView';
import { tr } from '@/lib/i18n-text';

/** Unknown ids are a real 404, not a 200 "not found" page. */
export const dynamicParams = false;

export function generateStaticParams() {
  return WORLDS.map((w) => ({ world: w.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; world: string }> }): Promise<Metadata> {
  const { locale, world } = await params;
  const w = WORLDS.find((x) => x.id === world);
  if (!w) return {};
  return {
    ...{
      title: locale === 'fr' ? frSeoTitle(w.name.fr, FR_WORLD_KEYWORDS) : clampTitle(`${tr(w.name, locale)} — Ziggy World`),
      description: tr(w.description, locale),
    },
    alternates: alternatesFor(locale, `/monde/${world}`),
  };
}

export default async function WorldDetailPage({ params }: { params: Promise<{ locale: string; world: string }> }) {
  const { locale, world } = await params;
  if (!WORLDS.some((w) => w.id === world)) notFound();
  setRequestLocale(locale);
  return <WorldView worldId={world} />;
}

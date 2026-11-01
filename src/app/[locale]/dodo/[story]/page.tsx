import { alternatesFor, breadcrumbLd, clampTitle } from '@/lib/seo';
import { SITE_URL } from '@/lib/site-url';
import { JsonLd } from '@/components/seo/JsonLd';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { DODO_STORIES, getDodoStory } from '@/data/dodo';
import { DodoPlayer } from '@/components/dodo/DodoPlayer';
import { tr } from '@/lib/i18n-text';
import { readVoiceTiming } from '../voice-files';

function dodoTitle(name: string, locale: string): string {
  const full = locale === 'fr' ? `${name} : histoire du soir | Ziggy` : `${name} — Bedtime story | Ziggy`;
  return full.length <= 60 ? full : clampTitle(`${name} | Ziggy`);
}

/** Unknown ids are a real 404, not a 200 "not found" page. */
export const dynamicParams = false;

export function generateStaticParams() {
  return DODO_STORIES.map((s) => ({ story: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; story: string }> }): Promise<Metadata> {
  const { locale, story } = await params;
  const s = getDodoStory(story);
  if (!s) return {};
  return {
    ...{
      title: dodoTitle(tr(s.title, locale), locale),
      description: tr(s.teaser, locale),
    },
    alternates: alternatesFor(locale, `/dodo/${story}`),
  };
}

export default async function DodoStoryPage({ params }: { params: Promise<{ locale: string; story: string }> }) {
  const { locale, story } = await params;
  const s = getDodoStory(story);
  if (!s) notFound();
  setRequestLocale(locale);
  const crumbs = breadcrumbLd(SITE_URL, locale, [
    { name: locale === 'fr' ? 'Mode dodo' : 'Bedtime mode', path: '/dodo' },
    { name: tr(s.title, locale), path: `/dodo/${s.id}` },
  ]);
  return (
    <>
      <JsonLd data={crumbs} />
      <DodoPlayer story={s} timing={await readVoiceTiming(locale, s.id)} />
    </>
  );
}

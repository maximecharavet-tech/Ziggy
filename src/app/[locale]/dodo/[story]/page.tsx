import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { DODO_STORIES, getDodoStory } from '@/data/dodo';
import { DodoPlayer } from '@/components/dodo/DodoPlayer';
import { tr } from '@/lib/i18n-text';

export function generateStaticParams() {
  return DODO_STORIES.map((s) => ({ story: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; story: string }> }): Promise<Metadata> {
  const { locale, story } = await params;
  const s = getDodoStory(story);
  if (!s) return {};
  return { title: `${tr(s.title, locale)} — Mode dodo Ziggy`, description: tr(s.teaser, locale), openGraph: s.cover ? { images: [s.cover] } : undefined };
}

export default async function DodoStoryPage({ params }: { params: Promise<{ locale: string; story: string }> }) {
  const { locale, story } = await params;
  const s = getDodoStory(story);
  if (!s) notFound();
  setRequestLocale(locale);
  return <DodoPlayer story={s} />;
}

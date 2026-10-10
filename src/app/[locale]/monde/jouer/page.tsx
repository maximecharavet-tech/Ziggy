import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { WORLDS } from '@/data/worlds';
import { PlayFlow } from '@/components/world/PlayFlow';
import { tr } from '@/lib/i18n-text';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ world?: string; quest?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const { world, quest } = await searchParams;
  const q = WORLDS.find((w) => w.id === world)?.quests.find((x) => x.id === quest);
  return { title: `${q ? tr(q.title, locale) : 'Quest'} — Ziggy World`, robots: { index: false } };
}

export default async function PlayPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { world, quest } = await searchParams;
  const w = WORLDS.find((x) => x.id === world);
  if (!w || !w.quests.some((q) => q.id === quest)) redirect(`/${locale}/monde`);
  setRequestLocale(locale);
  return <PlayFlow key={`${world}-${quest}`} worldId={world} questId={quest} />;
}

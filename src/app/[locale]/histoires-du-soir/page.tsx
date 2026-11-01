import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LandingShell } from '@/components/seo/LandingShell';
import { LANDING_COPY } from '@/data/landings';
import { landingBreadcrumb, landingMetadata } from '@/lib/landing';
import { DODO_STORIES } from '@/data/dodo';
import { tr } from '@/lib/i18n-text';
import { SITE_URL } from '@/lib/site-url';
import { localeUrl } from '@/lib/seo';

const PATH = '/histoires-du-soir' as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return landingMetadata(locale, PATH);
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = LANDING_COPY[PATH];
  const links = DODO_STORIES.map((s) => ({ href: `/dodo/${s.id}`, label: `${s.emoji} ${tr(s.title, 'fr')}`, text: tr(s.teaser, 'fr') }));
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: c.h1,
    numberOfItems: DODO_STORIES.length,
    itemListElement: DODO_STORIES.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: localeUrl(SITE_URL, 'fr', `/dodo/${s.id}`),
      name: tr(s.title, 'fr'),
    })),
  };
  return (
    <LandingShell
      h1={c.h1}
      intro={c.intro}
      jsonLd={[landingBreadcrumb(PATH), itemList]}
      sections={[{ title: `Les ${DODO_STORIES.length} histoires du mode dodo`, links }]}
    />
  );
}

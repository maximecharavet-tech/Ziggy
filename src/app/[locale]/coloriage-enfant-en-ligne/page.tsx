import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LandingShell } from '@/components/seo/LandingShell';
import { LANDING_COPY } from '@/data/landings';
import { landingBreadcrumb, landingMetadata } from '@/lib/landing';

const PATH = '/coloriage-enfant-en-ligne' as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return landingMetadata(locale, PATH);
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = LANDING_COPY[PATH];
  return (
    <LandingShell
      h1={c.h1}
      intro={c.intro}
      jsonLd={[landingBreadcrumb(PATH)]}
      sections={[
        {
          title: 'Commencer à colorier',
          links: [
            { href: '/coloriage', label: 'Colorie avec Ziggy', text: 'Choisis un dessin à colorier !' },
            { href: '/creer', label: 'L’Atelier des créateurs' },
          ],
        },
      ]}
    />
  );
}

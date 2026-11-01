import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LandingShell } from '@/components/seo/LandingShell';
import { LANDING_COPY } from '@/data/landings';
import { landingBreadcrumb, landingMetadata } from '@/lib/landing';

const PATH = '/apprendre-ia-enfants' as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return landingMetadata(locale, PATH);
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = LANDING_COPY[PATH];
  const lab = await getTranslations({ locale: 'fr', namespace: 'lab' });
  const games = await getTranslations({ locale: 'fr', namespace: 'games' });
  const learn = await getTranslations({ locale: 'fr', namespace: 'learn' });
  return (
    <LandingShell
      h1={c.h1}
      intro={c.intro}
      jsonLd={[landingBreadcrumb(PATH)]}
      sections={[
        {
          title: 'Pour découvrir l’IA en jouant',
          links: [
            { href: '/lab', label: lab('title'), text: lab('subtitle') },
            { href: '/games/quiz', label: games('quiz.name'), text: games('quiz.description') },
            { href: '/apprendre', label: learn('title'), text: learn('subtitle') },
          ],
        },
      ]}
    />
  );
}

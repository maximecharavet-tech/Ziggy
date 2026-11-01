import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LandingShell } from '@/components/seo/LandingShell';
import { LANDING_COPY } from '@/data/landings';
import { landingBreadcrumb, landingMetadata } from '@/lib/landing';

const PATH = '/securite-parents' as const;
const FAQ_KEYS = ['1', '2', '4'] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return landingMetadata(locale, PATH);
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = LANDING_COPY[PATH];
  const faq = await getTranslations({ locale: 'fr', namespace: 'faq' });
  const trust = await getTranslations({ locale: 'fr', namespace: 'trust' });
  const qa = FAQ_KEYS.map((k) => ({ q: faq(`q${k}`), a: faq(`a${k}`) }));
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qa.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
  return (
    <LandingShell
      h1={c.h1}
      intro={c.intro}
      jsonLd={[landingBreadcrumb(PATH), faqLd]}
      sections={[
        {
          title: 'Nos engagements',
          links: [
            { href: '/privacy', label: trust('no_ads') },
            { href: '/privacy', label: trust('eu_storage') },
            { href: '/privacy', label: trust('parent_account') },
            { href: '/privacy', label: trust('encrypted') },
          ],
        },
        {
          title: 'Pour aller plus loin',
          links: [
            { href: '/privacy', label: 'Politique de confidentialité' },
            { href: '/cookies', label: 'Politique de cookies' },
            { href: '/terms', label: 'Conditions d’utilisation' },
          ],
        },
      ]}
    >
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-text-body mb-4">{faq('title')}</h2>
        {qa.map(({ q, a }) => (
          <div key={q} className="mb-6">
            <h3 className="font-semibold text-text-body">{q}</h3>
            <p className="mt-1 text-text-muted">{a}</p>
          </div>
        ))}
      </section>
    </LandingShell>
  );
}

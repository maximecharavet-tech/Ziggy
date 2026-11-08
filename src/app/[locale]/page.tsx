import type { Metadata } from 'next';
import { alternatesFor } from '@/lib/seo';
import { setRequestLocale } from 'next-intl/server';
import { TrustBar } from '@/components/sections/TrustBar';
import { TaglineRibbon } from '@/components/sections/TaglineRibbon';
import { PageTransition } from '@/components/ui/PageTransition';
import { HeroSection } from '@/components/sections/HeroSection';
import { ZiggyShowcase } from '@/components/sections/ZiggyShowcase';
import { LabTeaser } from '@/components/sections/LabTeaser';
import { Planet3DSection } from '@/components/sections/Planet3DSection';
import { MissionCard } from '@/components/rewards/MissionCard';
import { FeaturesSection } from '@/components/sections/FeaturesSection';
import { ModulesSection } from '@/components/sections/ModulesSection';
import { HowItWorksSection } from '@/components/sections/HowItWorksSection';
import { PricingSection } from '@/components/sections/PricingSection';
import { AgentsSection } from '@/components/sections/AgentsSection';
import { GamesSection } from '@/components/sections/GamesSection';
import { PlayShowcase } from '@/components/sections/PlayShowcase';
import { SantaTeaser } from '@/components/sections/SantaTeaser';

/** L'appli du Père Noël is shown on the home page until Epiphany. */
const SANTA_SEASON_END = Date.parse('2027-01-07T00:00:00+01:00');
import { DemoSection } from '@/components/sections/DemoSection';
import { FAQSection } from '@/components/sections/FAQSection';
import { CTAFinalSection } from '@/components/sections/CTAFinalSection';
import { fetchSiteConfig } from '@/lib/site-config.server';
import { ParentsNotice } from '@/components/app/ParentsNotice';
import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/seo/JsonLd';
import { SITE_URL } from '@/lib/site-url';
import { localeUrl } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, '') };
}

// Owner edits reach the page within a minute, or at once via /api/revalidate.
export const revalidate = 60;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { sections } = await fetchSiteConfig();
  const meta = await getTranslations({ locale, namespace: 'metadata' });
  const faq = await getTranslations({ locale, namespace: 'faq' });
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Ziggy',
    url: localeUrl(SITE_URL, locale, ''),
    description: meta('description'),
    inLanguage: locale,
    publisher: { '@type': 'Organization', name: 'Ziggy Technologies SAS', url: SITE_URL },
  };
  // Mirrors the FAQ shown on this page (FAQSection, same five questions).
  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [1, 2, 3, 4, 5].map((i) => ({
      '@type': 'Question',
      name: faq(`q${i}`),
      acceptedAnswer: { '@type': 'Answer', text: faq(`a${i}`) },
    })),
  };

  return (
    <PageTransition>
      <JsonLd data={[website, faqPage]} />
      <HeroSection />
      <TaglineRibbon />
      {Date.now() < SANTA_SEASON_END && <SantaTeaser />}
      {/* Games and creative workshops right after the hero: what makes children want to come in. */}
      <PlayShowcase />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-4">
        <MissionCard />
      </div>
      <TrustBar />
      <Planet3DSection />
      {sections.showcase && <ZiggyShowcase />}
      <LabTeaser />
      <FeaturesSection />
      <ModulesSection />
      {sections.agents && <AgentsSection />}
      {sections.games && <GamesSection />}
      <HowItWorksSection />
      {/* No prices in the app (children's store rules): a calm pointer to the parents' area instead. */}
      {sections.pricing && (
        <div className="web-only">
          <PricingSection />
        </div>
      )}
      <ParentsNotice />
      <DemoSection />
      <FAQSection />
      <div className="web-only">
        <CTAFinalSection />
      </div>
    </PageTransition>
  );
}

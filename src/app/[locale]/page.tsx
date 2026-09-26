import { setRequestLocale } from 'next-intl/server';
import { TrustBar } from '@/components/sections/TrustBar';
import { TaglineRibbon } from '@/components/sections/TaglineRibbon';
import { PageTransition } from '@/components/ui/PageTransition';
import { HeroSection } from '@/components/sections/HeroSection';
import { ZiggyShowcase } from '@/components/sections/ZiggyShowcase';
import { FeaturesSection } from '@/components/sections/FeaturesSection';
import { ModulesSection } from '@/components/sections/ModulesSection';
import { HowItWorksSection } from '@/components/sections/HowItWorksSection';
import { PricingSection } from '@/components/sections/PricingSection';
import { ReviewsSection } from '@/components/sections/ReviewsSection';
import { AgentsSection } from '@/components/sections/AgentsSection';
import { GamesSection } from '@/components/sections/GamesSection';
import { DemoSection } from '@/components/sections/DemoSection';
import { FAQSection } from '@/components/sections/FAQSection';
import { CTAFinalSection } from '@/components/sections/CTAFinalSection';
import { fetchSiteConfig } from '@/lib/site-config.server';

// Owner edits reach the page within a minute, or at once via /api/revalidate.
export const revalidate = 60;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { stats, sections } = await fetchSiteConfig();

  return (
    <PageTransition>
      <HeroSection stats={stats} />
      <TaglineRibbon />
      <TrustBar />
      {sections.showcase && <ZiggyShowcase />}
      <FeaturesSection />
      <ModulesSection />
      {sections.agents && <AgentsSection />}
      {sections.games && <GamesSection />}
      <HowItWorksSection />
      {sections.pricing && <PricingSection />}
      {sections.reviews && <ReviewsSection />}
      <DemoSection />
      <FAQSection />
      <CTAFinalSection />
    </PageTransition>
  );
}

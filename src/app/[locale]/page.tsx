import { setRequestLocale } from 'next-intl/server';
import { TrustBar } from '@/components/sections/TrustBar';
import { PageTransition } from '@/components/ui/PageTransition';
import { HeroSection } from '@/components/sections/HeroSection';
import { FeaturesSection } from '@/components/sections/FeaturesSection';
import { ModulesSection } from '@/components/sections/ModulesSection';
import { HowItWorksSection } from '@/components/sections/HowItWorksSection';
import { PricingSection } from '@/components/sections/PricingSection';
import { ReviewsSection } from '@/components/sections/ReviewsSection';
import { DemoSection } from '@/components/sections/DemoSection';
import { FAQSection } from '@/components/sections/FAQSection';
import { CTAFinalSection } from '@/components/sections/CTAFinalSection';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <PageTransition>
      <HeroSection />
      <TrustBar />
      <FeaturesSection />
      <ModulesSection />
      <HowItWorksSection />
      <PricingSection />
      <ReviewsSection />
      <DemoSection />
      <FAQSection />
      <CTAFinalSection />
    </PageTransition>
  );
}

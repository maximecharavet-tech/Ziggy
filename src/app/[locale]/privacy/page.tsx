import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return {
    title: `Privacy Policy — ${t('title')}`,
    description: 'Privacy policy for Ziggy AI Learning Platform',
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="glass-strong rounded-2xl border border-border/50 p-8 sm:p-12 shadow-lg">
          <h1 className="text-3xl font-extrabold text-text-body mb-2">Privacy Policy</h1>
          <p className="text-sm text-text-dim mb-8">Last updated: June 2026</p>

          <div className="space-y-8 text-sm text-text-muted leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">1. Introduction</h2>
              <p>Ziggy Technologies SAS (&quot;Ziggy&quot;, &quot;we&quot;, &quot;us&quot;) is committed to protecting the privacy of children and families who use our AI learning platform. This policy explains how we collect, use, and safeguard personal information.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">2. Children&apos;s Data (COPPA &amp; GDPR-K)</h2>
              <p>Ziggy is designed for children aged 5-12. We comply with COPPA (Children&apos;s Online Privacy Protection Act) and GDPR provisions for children&apos;s data. We do not knowingly collect personal information from children without verifiable parental consent. Chat conversations are processed in real-time and are not stored permanently.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">3. Data We Collect</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Account information (parent email, child&apos;s display name and age range)</li>
                <li>Usage data (sessions, modules accessed, time spent)</li>
                <li>Chat messages (processed by Anthropic Claude API, not permanently stored)</li>
                <li>Technical data (device type, browser, IP address for rate limiting)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">4. How We Use Data</h2>
              <p>We use data exclusively to provide and improve the learning experience: adaptive difficulty, progress tracking, and platform security. We never sell personal data. We never use children&apos;s data for advertising.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">5. Third-Party Services</h2>
              <p>We use Anthropic&apos;s Claude API for AI chat. Chat messages are sent to Anthropic for processing only and are subject to Anthropic&apos;s data processing agreement. No other third parties receive personal data.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">6. Data Security</h2>
              <p>All data is encrypted in transit (TLS 1.3) and at rest. We implement strict access controls and regular security audits. Data is hosted within the EU.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">7. Your Rights (GDPR)</h2>
              <p>Under GDPR, you have the right to access, rectify, delete, and port your data. Parents can request complete deletion of their child&apos;s data at any time. Contact us at privacy@ziggy.ai.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">8. Contact</h2>
              <p>For privacy inquiries: <span className="text-green font-semibold">privacy@ziggy.ai</span></p>
              <p>Ziggy Technologies SAS, Paris, France</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return {
    title: `Terms of Service — ${t('title')}`,
    description: 'Terms of service for Ziggy AI Learning Platform',
  };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="glass-strong rounded-2xl border border-border/50 p-8 sm:p-12 shadow-lg">
          <h1 className="text-3xl font-extrabold text-text-body mb-2">Terms of Service</h1>
          <p className="text-sm text-text-dim mb-8">Last updated: June 2026</p>

          <div className="space-y-8 text-sm text-text-muted leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">1. Acceptance of Terms</h2>
              <p>By accessing Ziggy, you agree to these terms. If you are a parent or guardian creating an account for a child, you accept these terms on their behalf.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">2. Service Description</h2>
              <p>Ziggy is an AI-powered educational platform for children aged 5-12. It provides interactive learning through AI conversations, games, and exercises across subjects including AI literacy, mathematics, logic, and creativity.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">3. User Accounts</h2>
              <p>Accounts must be created by a parent or legal guardian. You are responsible for maintaining account security. One Family plan supports up to 3 child profiles.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">4. Acceptable Use</h2>
              <p>Users may not attempt to bypass safety filters, use the service for non-educational purposes, or interfere with platform operations. Ziggy&apos;s AI is designed to be safe for children and will not respond to inappropriate requests.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">5. Subscriptions &amp; Billing</h2>
              <p>Free tier: 5 sessions/month. Paid plans are billed monthly or yearly. You may cancel anytime; access continues until the billing period ends. Refunds are available within 14 days of initial purchase.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">6. Intellectual Property</h2>
              <p>All Ziggy content, design, and technology are owned by Ziggy Technologies SAS. Educational content generated during sessions may be saved by users for personal use only.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">7. Limitation of Liability</h2>
              <p>Ziggy is an educational supplement, not a replacement for formal education. We are not liable for learning outcomes. AI responses are generated and may occasionally contain inaccuracies.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">8. Governing Law</h2>
              <p>These terms are governed by French law. Disputes shall be resolved in the courts of Paris, France.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

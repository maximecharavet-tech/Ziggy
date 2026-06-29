import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return {
    title: `Cookie Policy — ${t('title')}`,
    description: 'Cookie policy for Ziggy AI Learning Platform',
  };
}

export default async function CookiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="glass-strong rounded-2xl border border-border/50 p-8 sm:p-12 shadow-lg">
          <h1 className="text-3xl font-extrabold text-text-body mb-2">Cookie Policy</h1>
          <p className="text-sm text-text-dim mb-8">Last updated: June 2026</p>

          <div className="space-y-8 text-sm text-text-muted leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">1. What Are Cookies</h2>
              <p>Cookies are small text files stored on your device when you visit a website. They help us provide a better experience by remembering your preferences.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">2. Cookies We Use</h2>
              <div className="space-y-3">
                <div className="glass rounded-xl p-4 border border-border/50">
                  <p className="font-semibold text-text-body mb-1">Essential Cookies</p>
                  <p>Required for the site to function. Includes locale preference, cookie consent status, and theme selection. Cannot be disabled.</p>
                </div>
                <div className="glass rounded-xl p-4 border border-border/50">
                  <p className="font-semibold text-text-body mb-1">Functional Cookies</p>
                  <p>Remember your preferences like language and dark/light mode to improve your experience.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">3. Third-Party Cookies</h2>
              <p>Ziggy does not use third-party advertising or tracking cookies. We do not share cookie data with advertisers. We prioritize your child&apos;s privacy above all.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-text-body mb-3">4. Managing Cookies</h2>
              <p>You can manage cookies through your browser settings. Disabling essential cookies may affect site functionality. You can withdraw cookie consent at any time using the cookie settings in the footer or by clearing your browser data.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

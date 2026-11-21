import type { CSSProperties } from 'react';
import Link from 'next/link';
import { MascotCutout } from '@/components/ziggy/Mascot';
import { SayButton } from '@/components/arcade/read-aloud';
import { tr, type L } from '@/lib/i18n-text';
import './globals.css';

const T = {
  title: { fr: 'Oh ! Cette page joue à cache-cache.', en: 'Oh! This page is playing hide-and-seek.' },
  text: { fr: 'Pas grave : Ziggy connaît le chemin de la maison.', en: 'No problem: Ziggy knows the way home.' },
  home: { fr: 'Retour à l’accueil', en: 'Back home' },
} satisfies Record<string, L>;

/**
 * The last-resort 404, for URLs that never get a language: an unknown first
 * segment that is not a locale (/foo.php, /xx/…) or an unknown /api path.
 * Everything else gets the localized 404 (src/app/[locale]/[...rest]/page.tsx).
 * There is no root layout (each locale has its own <html>), so Next wraps this
 * in its bare built-in one: the page brings its own styles and speaks both
 * languages, with Ziggy, read-aloud and a link home. Status 404, never a redirect.
 */
export default function RootNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-12 text-text-body antialiased">
      <title>404 — Ziggy</title>
      <div className="w-full max-w-md text-center">
        <div className="mb-4 flex justify-center">
          <MascotCutout pose="wave" width={140} className="w-[140px]" />
        </div>
        <div className="mg-card mg-static p-8" style={{ '--tint': '#7FC85C' } as CSSProperties}>
          <p className="font-display text-6xl font-bold text-leaf-ink" aria-hidden="true">
            404
          </p>
          {(['fr', 'en'] as const).map((locale) => {
            const Heading = locale === 'fr' ? 'h1' : 'h2';
            return (
            <section key={locale} lang={locale} className="mt-5">
              <div className="flex items-start justify-center gap-2">
                <Heading className="font-display text-2xl font-bold text-balance">{tr(T.title, locale)}</Heading>
                <SayButton texts={[tr(T.title, locale), tr(T.text, locale)]} locale={locale} size="sm" className="mt-1" />
              </div>
              <p className="mb-4 mt-2 text-text-muted">{tr(T.text, locale)}</p>
              <Link href={locale === 'fr' ? '/' : '/en'} className="mg-pill" style={{ '--tint': '#2f7a1f' } as CSSProperties}>
                {tr(T.home, locale)}
              </Link>
            </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

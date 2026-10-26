import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';

/**
 * Canonical + hreflang for one page. French is the default locale and has no
 * prefix (`/monde`); the others are prefixed (`/en/monde`). `path` starts with
 * "/" ("" for the home page).
 */
export function alternatesFor(locale: string, path: string): Metadata['alternates'] {
  const href = (l: string) => (l === routing.defaultLocale ? path || '/' : `/${l}${path}`);
  const languages: Record<string, string> = Object.fromEntries(routing.locales.map((l) => [l, href(l)]));
  languages['x-default'] = href(routing.defaultLocale);
  return { canonical: href(locale), languages };
}

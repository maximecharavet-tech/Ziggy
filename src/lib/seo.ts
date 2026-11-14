import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';
import { AGE_MAX, AGE_MIN } from '@/lib/ages';
import { FULLY_TRANSLATED_LOCALES, isFullyTranslated } from '@/i18n/config';

/**
 * Canonical + hreflang for one page. French is the default locale and has no
 * prefix (`/monde`); the others are prefixed (`/en/monde`). `path` starts with
 * "/" ("" for the home page).
 *
 * Only the fully translated locales are announced (hreflang); any other locale
 * has its canonical on the English page (see `robotsFor`, which also makes it
 * noindex).
 */
export function alternatesFor(locale: string, path: string): Metadata['alternates'] {
  const href = (l: string) => (l === routing.defaultLocale ? path || '/' : `/${l}${path}`);
  const languages: Record<string, string> = Object.fromEntries(FULLY_TRANSLATED_LOCALES.map((l) => [l, href(l)]));
  languages['x-default'] = href(routing.defaultLocale);
  return { canonical: isFullyTranslated(locale) ? href(locale) : href('en'), languages };
}

/** Indexable only when the locale's content is really translated; links are always followed. */
export function robotsFor(locale: string): NonNullable<Metadata['robots']> {
  return { index: isFullyTranslated(locale), follow: true };
}

/** Absolute URL of a page in a locale (French has no prefix; home keeps its trailing slash). */
export function localeUrl(siteUrl: string, locale: string, path: string): string {
  return `${siteUrl}${locale === routing.defaultLocale ? path || '/' : `/${locale}${path}`}`;
}

/**
 * Keyword + brand title for French pages, aimed at 50–60 characters:
 * "<name> : <keyword> | Ziggy" with the longest keyword variant that fits,
 * falling back to "<name> | Ziggy".
 */
export function frSeoTitle(name: string, keywords: string | string[]): string {
  for (const kw of Array.isArray(keywords) ? keywords : [keywords]) {
    const full = `${name} : ${kw} | Ziggy`;
    if (full.length <= 60) return full;
  }
  const short = `${name} | Ziggy`;
  return short.length <= 60 ? short : `${name.slice(0, 51).trimEnd()}… | Ziggy`;
}

export const FR_GAME_KEYWORDS = [
  `jeu éducatif en ligne pour enfants de ${AGE_MIN} à ${AGE_MAX} ans`,
  'jeu éducatif en ligne pour les enfants',
  'jeu éducatif en ligne pour enfants',
  'jeu éducatif pour enfants',
  'jeu éducatif',
];
export const FR_WORLD_KEYWORDS = [
  `jeux éducatifs pour enfants de ${AGE_MIN} à ${AGE_MAX} ans`,
  'monde de jeux éducatifs pour enfants',
  'jeux éducatifs pour enfants',
  'jeux éducatifs',
];

/** Trim any title longer than 60 characters on a word boundary. */
export function clampTitle(title: string, max = 60): string {
  if (title.length <= max) return title;
  const cut = title.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s—:|,-]+$/, '')}…`;
}

export type Crumb = { name: string; path: string };

/** schema.org BreadcrumbList for a page, from the home page down. */
export function breadcrumbLd(siteUrl: string, locale: string, crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Ziggy', path: '' }, ...crumbs].map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: localeUrl(siteUrl, locale, c.path),
    })),
  };
}

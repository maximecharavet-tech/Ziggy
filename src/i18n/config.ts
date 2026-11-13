export const locales = ['fr', 'en', 'es', 'de', 'pt', 'it', 'nl', 'tr', 'ja', 'ko', 'zh', 'ar'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'fr';

export const localeNames: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  pt: 'Português',
  it: 'Italiano',
  nl: 'Nederlands',
  tr: 'Türkçe',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
  ar: 'العربية',
};

export const rtlLocales: Locale[] = ['ar'];

/**
 * Locales whose whole content is really translated (every `tr()` text exists
 * in FR + EN only, so the other ten still show English for most of the site).
 * Only these are announced to search engines (hreflang, sitemap, indexable);
 * the others stay reachable from the language picker but are `noindex` and
 * point their canonical at the English page. Add a locale here only once its
 * `tr()` content is translated.
 */
export const FULLY_TRANSLATED_LOCALES: readonly Locale[] = ['fr', 'en'];

export function isFullyTranslated(locale: string): boolean {
  return (FULLY_TRANSLATED_LOCALES as readonly string[]).includes(locale);
}

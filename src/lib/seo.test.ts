import { describe, expect, it } from 'vitest';
import { alternatesFor, breadcrumbLd, clampTitle, frSeoTitle, FR_GAME_KEYWORDS, localeUrl, robotsFor } from './seo';
import robots from '@/app/robots';
import sitemap, { generateSitemaps, sitemapEntries, SITEMAP_PATHS } from '@/app/sitemap';
import { sitemapIndexXml } from '@/app/sitemap.xml/route';
import { FULLY_TRANSLATED_LOCALES, locales } from '@/i18n/config';

describe('seo helpers', () => {
  it('builds French titles of at most 60 characters', () => {
    for (const n of ['Taquin', 'Jeu de mémoire', 'Un nom de jeu vraiment très très long pour tester la coupe']) {
      expect(frSeoTitle(n, FR_GAME_KEYWORDS).length).toBeLessThanOrEqual(60);
    }
    expect(frSeoTitle('Taquin', FR_GAME_KEYWORDS).length).toBeGreaterThanOrEqual(50);
  });
  it('clamps long titles', () => {
    expect(clampTitle('x '.repeat(50)).length).toBeLessThanOrEqual(60);
  });
  it('keeps the home trailing slash and prefixes other locales', () => {
    expect(localeUrl('https://a.fr', 'fr', '')).toBe('https://a.fr/');
    expect(localeUrl('https://a.fr', 'en', '/games')).toBe('https://a.fr/en/games');
    expect(breadcrumbLd('https://a.fr', 'fr', [{ name: 'Jeux', path: '/games' }]).itemListElement).toHaveLength(2);
  });
});

describe('robots & sitemap', () => {
  it('welcomes AI crawlers and keeps /api/ closed', () => {
    const rules = [robots().rules].flat();
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', '*']) {
      expect(rules.find((r) => r.userAgent === bot)?.disallow).toBe('/api/');
    }
  });
  it('lists no private or excluded page and no fake dates', async () => {
    const urls = (await Promise.all(FULLY_TRANSLATED_LOCALES.map((id) => sitemap({ id })))).flat();
    expect(urls.length).toBeGreaterThan(100);
    expect(urls.some((u) => /\/(login|signup|account|agents|hyper|owner)(\/|$)|\/monde\/jouer/.test(u.url))).toBe(false);
    expect(urls.every((u) => !('lastModified' in u) && !('priority' in u))).toBe(true);
    expect(urls.filter((u) => u.url.endsWith('/histoires-du-soir'))).toHaveLength(1);
  });
  it('has one sitemap per translated language and nothing for the others', async () => {
    expect((await generateSitemaps()).map((s) => s.id)).toEqual([...FULLY_TRANSLATED_LOCALES]);
    for (const l of locales.filter((x) => !FULLY_TRANSLATED_LOCALES.includes(x))) expect(await sitemap({ id: l })).toEqual([]);
    expect(await sitemap({ id: Promise.resolve('en') as unknown as string })).toHaveLength(SITEMAP_PATHS.length);
  });
  it('announces hreflang for the translated languages only, in the right sitemap', () => {
    const en = sitemapEntries('en');
    expect(en.every((e) => e.url.includes('/en'))).toBe(true);
    const home = en.find((e) => e.url.endsWith('/en'));
    expect(Object.keys(home?.alternates?.languages ?? {})).toEqual([...FULLY_TRANSLATED_LOCALES]);
    const fr = sitemapEntries('fr');
    expect(fr.length).toBeGreaterThan(SITEMAP_PATHS.length); // + the French-only landing pages
    expect(fr.some((e) => /\/(en|es|de|ja)\//.test(e.url))).toBe(false);
  });
  it('builds the sitemap index', () => {
    const xml = sitemapIndexXml('https://a.fr');
    expect(xml).toContain('<sitemapindex');
    expect(xml).toContain('<loc>https://a.fr/sitemap/fr.xml</loc>');
    expect(xml).toContain('<loc>https://a.fr/sitemap/en.xml</loc>');
    expect(xml).not.toContain('/sitemap/de.xml');
  });
});

describe('locale SEO (only translated languages are announced)', () => {
  it('announces fr, en and x-default only', () => {
    const alt = alternatesFor('fr', '/monde');
    expect(alt?.languages).toEqual({ fr: '/monde', en: '/en/monde', 'x-default': '/monde' });
    expect(alt?.canonical).toBe('/monde');
    expect(alternatesFor('en', '')?.canonical).toBe('/en');
  });
  it('points the other locales at the English page and keeps the same hreflang set', () => {
    for (const l of locales.filter((x) => !FULLY_TRANSLATED_LOCALES.includes(x))) {
      const alt = alternatesFor(l, '/dodo');
      expect(alt?.canonical).toBe('/en/dodo');
      expect(Object.keys(alt?.languages ?? {})).toEqual(['fr', 'en', 'x-default']);
    }
    expect(alternatesFor('de', '')?.canonical).toBe('/en');
  });
  it('indexes only the translated locales', () => {
    expect(robotsFor('fr')).toEqual({ index: true, follow: true });
    expect(robotsFor('en')).toEqual({ index: true, follow: true });
    expect(robotsFor('ja')).toEqual({ index: false, follow: true });
  });
});

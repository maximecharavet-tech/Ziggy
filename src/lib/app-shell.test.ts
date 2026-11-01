import { describe, expect, it } from 'vitest';
import {
  NO_APP,
  SHELL_BOOT_SCRIPT,
  homeOf,
  isAppHome,
  isSiteRoot,
  overrideFromQuery,
  parseAppShell,
  parseShellOverride,
  resolveAppShell,
  stripLocale,
} from './app-shell';

const LOCALES = ['fr', 'en', 'es', 'ar'] as const;
const ANDROID_WEBVIEW = 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';

describe('parseAppShell', () => {
  it('is not the app in a normal browser, on the server or without a user agent', () => {
    expect(parseAppShell(ANDROID_WEBVIEW)).toEqual(NO_APP);
    expect(parseAppShell('')).toEqual(NO_APP);
    expect(parseAppShell(null)).toEqual(NO_APP);
    expect(parseAppShell(undefined)).toEqual(NO_APP);
  });

  it('reads the token appended to a real WebView user agent', () => {
    expect(parseAppShell(`${ANDROID_WEBVIEW} ZiggyApp/1.0.0 (android)`)).toEqual({ app: true, platform: 'android', tv: false, version: '1.0.0' });
    expect(parseAppShell(`${IPAD} ZiggyApp/2.3.10 (ios)`)).toEqual({ app: true, platform: 'ios', tv: false, version: '2.3.10' });
  });

  it('detects the TV, whatever the order, spacing or case of the parts', () => {
    expect(parseAppShell('ZiggyApp/1.0.0 (android; tv)').tv).toBe(true);
    expect(parseAppShell('ZiggyApp/1.0.0 (TV;Android)')).toEqual({ app: true, platform: 'android', tv: true, version: '1.0.0' });
    expect(parseAppShell('ZiggyApp/1.0.0 ( android ;  tv )').tv).toBe(true);
    expect(parseAppShell('ZiggyApp/1.0.0(android)').app).toBe(true);
  });

  it('keeps an unknown platform as null but still is the app', () => {
    expect(parseAppShell('ZiggyApp/1.0 (fuchsia)')).toEqual({ app: true, platform: null, tv: false, version: '1.0' });
    expect(parseAppShell('ZiggyApp/1 ()')).toEqual({ app: true, platform: null, tv: false, version: '1' });
  });

  it('does not take a lookalike for the token', () => {
    expect(parseAppShell('NotZiggyApp (android)').app).toBe(false);
    expect(parseAppShell('ZiggyApp/beta (android)').app).toBe(false);
    expect(parseAppShell('ZiggyApp/1.0.0 android').app).toBe(false);
    // "tv" must be a part of its own, not inside another word.
    expect(parseAppShell('ZiggyApp/1.0.0 (android; tvos-like)').tv).toBe(false);
  });
});

describe('testing override (?tv=1, ?app=1)', () => {
  it('reads the query string', () => {
    expect(overrideFromQuery(new URLSearchParams('tv=1'))).toBe('tv');
    expect(overrideFromQuery(new URLSearchParams('app=1'))).toBe('app');
    expect(overrideFromQuery(new URLSearchParams('tv=0'))).toBe('clear');
    expect(overrideFromQuery(new URLSearchParams('app=0&x=1'))).toBe('clear');
    expect(overrideFromQuery(new URLSearchParams('tv=yes'))).toBe(null);
    expect(overrideFromQuery(new URLSearchParams(''))).toBe(null);
  });

  it('only accepts known cookie values', () => {
    expect(parseShellOverride('tv')).toBe('tv');
    expect(parseShellOverride('app')).toBe('app');
    expect(parseShellOverride('admin')).toBe(null);
    expect(parseShellOverride(undefined)).toBe(null);
  });

  it('turns a browser into the app or the TV, but never overrides a real app', () => {
    expect(resolveAppShell(ANDROID_WEBVIEW, 'tv')).toMatchObject({ app: true, tv: true });
    expect(resolveAppShell(ANDROID_WEBVIEW, 'app')).toMatchObject({ app: true, tv: false });
    expect(resolveAppShell(ANDROID_WEBVIEW, null)).toEqual(NO_APP);
    expect(resolveAppShell('ZiggyApp/1.0.0 (ios)', 'tv')).toEqual({ app: true, platform: 'ios', tv: false, version: '1.0.0' });
  });
});

describe('homes and paths', () => {
  it('picks the right home', () => {
    expect(homeOf(NO_APP)).toBe('/');
    expect(homeOf(parseAppShell('ZiggyApp/1.0.0 (ios)'))).toBe('/app');
    expect(homeOf(parseAppShell('ZiggyApp/1.0.0 (android; tv)'))).toBe('/tv');
  });

  it('strips the locale prefix', () => {
    expect(stripLocale('/', LOCALES)).toEqual({ prefix: '', path: '/' });
    expect(stripLocale('/en', LOCALES)).toEqual({ prefix: '/en', path: '/' });
    expect(stripLocale('/en/dodo/lili', LOCALES)).toEqual({ prefix: '/en', path: '/dodo/lili' });
    expect(stripLocale('/dodo', LOCALES)).toEqual({ prefix: '', path: '/dodo' });
    // Not a locale: a two-letter page stays a page.
    expect(stripLocale('/tv', LOCALES)).toEqual({ prefix: '', path: '/tv' });
    expect(stripLocale('/english', LOCALES)).toEqual({ prefix: '', path: '/english' });
  });

  it('knows the site root and the app homes', () => {
    expect(isSiteRoot('/', LOCALES)).toBe(true);
    expect(isSiteRoot('/ar', LOCALES)).toBe(true);
    expect(isSiteRoot('/ar/', LOCALES)).toBe(true);
    expect(isSiteRoot('/dodo', LOCALES)).toBe(false);
    expect(isAppHome('/tv', LOCALES)).toBe(true);
    expect(isAppHome('/en/app/', LOCALES)).toBe(true);
    expect(isAppHome('/en/dodo', LOCALES)).toBe(false);
  });
});

/** Runs the inline boot script against a fake document, like a browser would before the first paint. */
function boot({ ua, search = '', cookie = '' }: { ua: string; search?: string; cookie?: string }) {
  const attrs = new Map<string, string>();
  const doc = {
    cookie,
    documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, v) },
  };
  new Function('document', 'navigator', 'location', SHELL_BOOT_SCRIPT)(doc, { userAgent: ua }, { search });
  return { attrs: Object.fromEntries(attrs), cookie: doc.cookie };
}

describe('SHELL_BOOT_SCRIPT (inline, before the first paint)', () => {
  it('leaves a normal browser alone', () => {
    expect(boot({ ua: ANDROID_WEBVIEW }).attrs).toEqual({});
  });

  it('agrees with parseAppShell on the app, the platform and the TV', () => {
    for (const ua of ['ZiggyApp/1.0.0 (android)', 'ZiggyApp/1.0.0 (ios)', 'ZiggyApp/1.0.0 (android; tv)', 'ZiggyApp/1.0 (TV;Android)', `${IPAD} ZiggyApp/3.1.4 (ios)`]) {
      const shell = parseAppShell(ua);
      const { attrs } = boot({ ua });
      expect('data-app' in attrs).toBe(shell.app);
      expect('data-tv' in attrs).toBe(shell.tv);
      expect(attrs['data-platform'] ?? null).toBe(shell.platform);
    }
  });

  it('turns the TV layout on with ?tv=1 and remembers it in a cookie', () => {
    const first = boot({ ua: ANDROID_WEBVIEW, search: '?tv=1' });
    expect(first.attrs).toEqual({ 'data-app': '', 'data-platform': 'android', 'data-tv': '' });
    expect(first.cookie).toContain('ziggy-shell=tv');
    // Next page, no query: the cookie keeps it.
    expect(boot({ ua: ANDROID_WEBVIEW, cookie: 'theme=dark; ziggy-shell=tv' }).attrs).toHaveProperty('data-tv');
    // ?tv=0 clears it.
    const off = boot({ ua: ANDROID_WEBVIEW, search: '?tv=0', cookie: 'ziggy-shell=tv' });
    expect(off.attrs).toEqual({});
    expect(off.cookie).toContain('max-age=0');
  });

  it('turns the phone app layout on with ?app=1', () => {
    expect(boot({ ua: ANDROID_WEBVIEW, search: '?app=1' }).attrs).toEqual({ 'data-app': '' });
  });

  it('ignores a forged cookie value', () => {
    expect(boot({ ua: ANDROID_WEBVIEW, cookie: 'ziggy-shell=tvx' }).attrs).toEqual({});
  });
});

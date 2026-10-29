/**
 * Ziggy's native apps (Android, Android TV, iPhone, iPad) are a Capacitor
 * shell around the site (`apps/ziggy-app/`). The shell appends one token to
 * the WebView's user agent, so the site knows where it runs:
 *
 *   ZiggyApp/<version> (<platform>[; tv])
 *   e.g. "ZiggyApp/1.0.0 (android)", "ZiggyApp/1.0.0 (android; tv)", "ZiggyApp/1.0.0 (ios)"
 *
 * In the app, the site hides what does not belong in a children's store app
 * (prices, purchases, marketing calls to action), puts external links behind
 * a grown-up gate, and on a TV switches to the 10-foot layout driven by the
 * remote control (arrow keys + OK).
 */

export type AppPlatform = 'android' | 'ios';

export interface AppShell {
  /** Running inside the Ziggy app. */
  app: boolean;
  platform: AppPlatform | null;
  /** Android TV / Google TV / Fire TV: remote control, big screen. */
  tv: boolean;
  version: string | null;
}

export const NO_APP: AppShell = { app: false, platform: null, tv: false, version: null };

const TOKEN = /ZiggyApp\/([\d.]+)\s*\(([^)]*)\)/;

/** Read the shell token from a user agent string (server or browser). */
export function parseAppShell(userAgent: string | null | undefined): AppShell {
  const m = userAgent ? TOKEN.exec(userAgent) : null;
  if (!m) return NO_APP;
  const parts = m[2].split(';').map((p) => p.trim().toLowerCase());
  const platform: AppPlatform | null = parts.includes('ios') ? 'ios' : parts.includes('android') ? 'android' : null;
  return { app: true, platform, tv: parts.includes('tv'), version: m[1] };
}

/** In the browser: the shell the page runs in (always NO_APP on the server). */
export function currentAppShell(): AppShell {
  if (typeof navigator === 'undefined') return NO_APP;
  return parseAppShell(navigator.userAgent);
}

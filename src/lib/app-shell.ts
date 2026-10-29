/**
 * Ziggy's native apps (Android, Android TV, iPhone, iPad) are a native shell
 * around the site (`apps/ziggy-app/`). The shell appends one token to the
 * WebView's user agent, so the site knows where it runs:
 *
 *   ZiggyApp/<version> (<platform>[; tv])
 *   e.g. "ZiggyApp/1.0.0 (android)", "ZiggyApp/1.0.0 (android; tv)", "ZiggyApp/1.0.0 (ios)"
 *
 * In the app, the site hides what does not belong in a children's store app
 * (prices, purchases, marketing calls to action), puts external links behind
 * a grown-up gate, and on a TV switches to the 10-foot layout driven by the
 * remote control (arrow keys + OK).
 *
 * How the first render knows: pages stay statically generated (no per-request
 * rendering, no running cost). A tiny inline script (SHELL_BOOT_SCRIPT, run
 * before the body paints) reads the same token and sets `data-app`,
 * `data-platform` and `data-tv` on <html>, so CSS is right from the first
 * frame; components read those attributes after hydration (useAppShell). The
 * middleware sends the home page to the app home (/app) or the TV home (/tv).
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

/* ── Trying the app layouts in a normal browser ── */

/**
 * Cookie that turns the app or TV layout on in a normal browser, for testing
 * and demos: `?tv=1` or `?app=1` sets it, `?tv=0` / `?app=0` clears it.
 */
export const SHELL_COOKIE = 'ziggy-shell';
export type ShellOverride = 'tv' | 'app';

export function parseShellOverride(value: string | null | undefined): ShellOverride | null {
  return value === 'tv' || value === 'app' ? value : null;
}

/** What the query string asks: a layout, 'clear', or nothing (null). */
export function overrideFromQuery(params: URLSearchParams): ShellOverride | 'clear' | null {
  if (params.get('tv') === '1') return 'tv';
  if (params.get('app') === '1') return 'app';
  if (params.get('tv') === '0' || params.get('app') === '0') return 'clear';
  return null;
}

/** The shell from the user agent; a real app always wins over the testing override. */
export function resolveAppShell(userAgent: string | null | undefined, override: ShellOverride | null): AppShell {
  const real = parseAppShell(userAgent);
  if (real.app || !override) return real;
  return override === 'tv' ? { app: true, platform: 'android', tv: true, version: null } : { app: true, platform: null, tv: false, version: null };
}

/* ── Homes ── */

/** The app's home on phones and tablets: the essentials, big tiles. */
export const APP_HOME = '/app';
/** The 10-foot home on a TV. */
export const TV_HOME = '/tv';

export function homeOf(shell: AppShell): string {
  return shell.tv ? TV_HOME : shell.app ? APP_HOME : '/';
}

/** The path without its locale prefix ("/en/dodo" → "/dodo", "/en" → "/"). */
export function stripLocale(pathname: string, locales: readonly string[]): { prefix: string; path: string } {
  const m = /^\/([a-z]{2})(?=\/|$)/.exec(pathname);
  if (m && locales.includes(m[1])) return { prefix: `/${m[1]}`, path: pathname.slice(3) || '/' };
  return { prefix: '', path: pathname || '/' };
}

/** True on the site's home page ("/", "/en", "/en/"). */
export function isSiteRoot(pathname: string, locales: readonly string[]): boolean {
  const { path } = stripLocale(pathname, locales);
  return path === '/' || path === '';
}

/** True on the app's own home (where Back offers to leave the app). */
export function isAppHome(pathname: string, locales: readonly string[]): boolean {
  const { path } = stripLocale(pathname, locales);
  const p = path.replace(/\/$/, '') || '/';
  return p === APP_HOME || p === TV_HOME || p === '/';
}

/**
 * Inline script for the top of <body>: sets `data-app`, `data-platform` and
 * `data-tv` on <html> before anything paints. Self-contained on purpose (it
 * runs before any bundle); keep it in step with parseAppShell (tested).
 */
export const SHELL_BOOT_SCRIPT = `(function(){var d=document.documentElement,u=navigator.userAgent||'',m=/ZiggyApp\\/([\\d.]+)\\s*\\(([^)]*)\\)/.exec(u),o=null;try{var q=new URLSearchParams(location.search),f=q.get('tv')==='1'?'tv':q.get('app')==='1'?'app':(q.get('tv')==='0'||q.get('app')==='0')?'':null;if(f!==null){document.cookie='${SHELL_COOKIE}='+f+';path=/;samesite=lax'+(f?'':';max-age=0')}var c=/(?:^|;\\s*)${SHELL_COOKIE}=(tv|app)(?:;|$)/.exec(document.cookie);o=f!==null?(f||null):(c?c[1]:null)}catch(e){}var p=m?m[2].toLowerCase().split(';').map(function(s){return s.trim()}):[];var app=!!m||!!o,tv=m?p.indexOf('tv')>=0:o==='tv';var pf=p.indexOf('ios')>=0?'ios':p.indexOf('android')>=0?'android':o==='tv'?'android':'';if(app){d.setAttribute('data-app','');if(pf)d.setAttribute('data-platform',pf)}if(tv)d.setAttribute('data-tv','')})()`;

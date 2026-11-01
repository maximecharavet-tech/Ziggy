import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { locales } from './i18n/config';
import { SHELL_COOKIE, homeOf, isSiteRoot, overrideFromQuery, parseShellOverride, resolveAppShell, stripLocale } from './lib/app-shell';

const intl = createMiddleware(routing);

/**
 * Languages (next-intl), plus the Ziggy app: its home page is the app's home
 * (/app) or, on a TV, the 10-foot home (/tv), not the website's. `?tv=1` /
 * `?app=1` try those layouts in a normal browser (cookie; `=0` clears it).
 * Pages stay static: only this redirect looks at the user agent.
 */
export default function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const asked = overrideFromQuery(searchParams);
  const override = asked === 'clear' ? null : (asked ?? parseShellOverride(request.cookies.get(SHELL_COOKIE)?.value));
  const shell = resolveAppShell(request.headers.get('user-agent'), override);

  let response: NextResponse;
  if (shell.app && isSiteRoot(pathname, locales)) {
    const url = request.nextUrl.clone();
    url.pathname = `${stripLocale(pathname, locales).prefix}${homeOf(shell)}`;
    response = NextResponse.redirect(url, 307);
  } else {
    response = intl(request);
  }
  if (asked === 'clear') response.cookies.delete(SHELL_COOKIE);
  else if (asked) response.cookies.set(SHELL_COOKIE, asked, { path: '/', sameSite: 'lax' });
  return response;
}

export const config = {
  matcher: ['/', '/(fr|en|es|de|pt|it|nl|tr|ja|ko|zh|ar)/:path*', '/((?!api|_next|.*\\..*).*)'],
};

import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: ['/', '/(fr|en|es|de|pt|it|nl|tr|ja|ko|zh|ar)/:path*', '/((?!api|_next|.*\\..*).*)'],
};

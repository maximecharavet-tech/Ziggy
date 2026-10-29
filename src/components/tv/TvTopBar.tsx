'use client';

import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { ZiggyAvatar } from '@/components/ziggy/Mascot';
import { ZiggyLogo } from '@/components/ziggy/ZiggyLogo';

const HOME: L = { fr: 'Accueil', en: 'Home' };
const BACK_HINT: L = { fr: 'Retour', en: 'Back' };

/**
 * On TV, instead of the website's navigation: Ziggy (home) on the left, and
 * a reminder of the remote's Back key. Rendered everywhere but shown only on
 * TV (CSS `tv-only`); the TV home draws its own header.
 */
export function TvTopBar() {
  const locale = useLocale();
  const pathname = usePathname();
  if (pathname === '/tv') return null;
  return (
    <div className="tv-only pointer-events-none fixed inset-x-0 top-0 z-50 flex items-start justify-between px-[4vw] pt-[2.5vh]">
      <Link
        href="/tv"
        className="pointer-events-auto inline-flex items-center gap-3 rounded-full bg-[#120d2a]/70 py-1.5 pe-5 ps-1.5 text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] ring-1 ring-white/15 backdrop-blur-md"
      >
        <ZiggyAvatar size={44} />
        <ZiggyLogo size={84} />
        <span className="text-lg font-bold text-white/85">· {tr(HOME, locale)}</span>
      </Link>
      <span className="inline-flex items-center gap-2 rounded-full bg-[#120d2a]/60 px-4 py-2 text-base font-semibold text-white/75 ring-1 ring-white/10 backdrop-blur-md" aria-hidden="true">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-sm">↩</span>
        {tr(BACK_HINT, locale)}
      </span>
    </div>
  );
}

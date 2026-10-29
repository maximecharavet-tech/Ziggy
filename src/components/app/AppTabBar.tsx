'use client';

import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { Link, usePathname } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { haptic } from '@/lib/app-bridge';

type Tab = { href: '/app' | '/monde' | '/dodo' | '/creer'; emoji: string; label: L; color: string; match: (p: string) => boolean };

const TABS: Tab[] = [
  { href: '/app', emoji: '🏠', label: { fr: 'Accueil', en: 'Home' }, color: '#22C55E', match: (p) => p === '/app' || p === '/' },
  { href: '/monde', emoji: '🌍', label: { fr: 'Jouer', en: 'Play' }, color: '#5FB6EA', match: (p) => (p.startsWith('/monde') && !p.startsWith('/monde/parents')) || p.startsWith('/games') },
  { href: '/dodo', emoji: '🌙', label: { fr: 'Histoires', en: 'Stories' }, color: '#8B84F0', match: (p) => p.startsWith('/dodo') },
  { href: '/creer', emoji: '🎨', label: { fr: 'Créer', en: 'Create' }, color: '#F2647B', match: (p) => p.startsWith('/creer') || p.startsWith('/coloriage') },
];

/**
 * The app's tab bar (phones and tablets): the essentials, always one tap
 * away. Rendered on every page but shown only in the app (CSS `app-touch-only`),
 * so it is there from the very first frame.
 */
export function AppTabBar() {
  const locale = useLocale();
  const pathname = usePathname();
  const active = TABS.findIndex((t) => t.match(pathname));
  return (
    <nav
      aria-label={locale === 'fr' ? 'Menu principal' : 'Main menu'}
      className="app-touch-only fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 ps-[max(0.75rem,env(safe-area-inset-left))] pe-[max(0.75rem,env(safe-area-inset-right))]"
    >
      <ul className="mx-auto grid h-[calc(var(--tabbar-h,4.5rem)-0.5rem)] max-w-lg grid-cols-4 gap-1 rounded-[1.75rem] bg-bg-card/85 p-1.5 shadow-[0_18px_40px_-18px_rgba(40,30,80,0.45)] ring-1 ring-border/70 backdrop-blur-xl backdrop-saturate-150">
        {TABS.map((t, i) => {
          const on = i === active;
          return (
            <li key={t.href} className="relative">
              {on ? (
                <motion.span
                  layoutId="app-tab"
                  className="absolute inset-0 rounded-[1.35rem]"
                  style={{ background: `color-mix(in srgb, ${t.color} 16%, transparent)`, boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${t.color} 35%, transparent)` }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              ) : null}
              <Link
                href={t.href}
                aria-current={on ? 'page' : undefined}
                onClick={() => haptic('light')}
                className="relative flex h-full flex-col items-center justify-center gap-0.5 rounded-[1.35rem] transition-transform active:scale-[0.94]"
              >
                <span className={`text-[1.6rem] leading-none transition-transform duration-300 ${on ? '-translate-y-px scale-110' : 'opacity-80 grayscale-[35%]'}`} aria-hidden="true">
                  {t.emoji}
                </span>
                <span className={`text-[0.72rem] font-bold leading-none ${on ? '' : 'text-text-muted'}`} style={on ? { color: `color-mix(in srgb, ${t.color} 70%, var(--color-text-body))` } : undefined}>
                  {tr(t.label, locale)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

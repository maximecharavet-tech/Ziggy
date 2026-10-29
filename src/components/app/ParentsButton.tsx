'use client';

import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';

const LABEL: L = { fr: 'Parents', en: 'Parents' };
const TITLE: L = { fr: 'Espace parents (pour les grands)', en: 'Parents’ area (for grown-ups)' };

/**
 * The way to the parents' area. In the app the link goes through the
 * grown-up gate (the global click interceptor sees /monde/parents).
 */
export function ParentsButton({ className = '', tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const locale = useLocale();
  return (
    <Link
      href="/monde/parents"
      title={tr(TITLE, locale)}
      aria-label={tr(TITLE, locale)}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition active:scale-95 ${
        tone === 'dark' ? 'bg-white/10 text-white/85 ring-1 ring-white/15' : 'bg-text-body/[0.06] text-text-muted ring-1 ring-border/70'
      } ${className}`}
    >
      <span aria-hidden="true">🔒</span>
      {tr(LABEL, locale)}
    </Link>
  );
}

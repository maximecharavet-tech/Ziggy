'use client';

import { useLocale } from 'next-intl';
import { tr, type L } from '@/lib/i18n-text';
import { ZiggyAvatar } from '@/components/ziggy/Mascot';
import { ParentsButton } from './ParentsButton';

const T = {
  title: { fr: 'Espace parents', en: 'Parents’ area' },
  text: {
    fr: 'Les comptes, les réglages, les progrès et la confidentialité se trouvent dans l’Espace parents, réservé aux grands.',
    en: 'Accounts, settings, progress and privacy are in the Parents’ area, for grown-ups only.',
  },
} satisfies Record<string, L>;

/** In the app, in place of prices and sign-up calls: a calm pointer to the parents' area. */
export function ParentsNotice({ className = '' }: { className?: string }) {
  const locale = useLocale();
  return (
    <section className={`app-only px-4 py-16 sm:px-6 ${className}`} aria-labelledby="parents-notice">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-[2rem] bg-bg-card p-8 text-center shadow-sm ring-1 ring-border/60">
        <ZiggyAvatar size={56} />
        <h2 id="parents-notice" className="font-display text-2xl font-bold text-text-body">
          {tr(T.title, locale)}
        </h2>
        <p className="max-w-md text-text-muted">{tr(T.text, locale)}</p>
        <ParentsButton />
      </div>
    </section>
  );
}

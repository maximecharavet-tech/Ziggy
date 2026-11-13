'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from '@/i18n/navigation';

const KEY = 'cookie-consent';

/**
 * Ziggy has no advertising trackers. Vercel Web Analytics + Speed Insights are
 * cookieless (no consent required); this banner is just a notice about needed storage.
 */
export function CookieConsent() {
  const t = useTranslations('cookies_banner');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(KEY);
    } catch {}
    // The app shows no banner (nothing to consent to; the policy is in the parents' area).
    if (seen || document.documentElement.hasAttribute('data-app')) return;
    // A moment's delay so it doesn't jump in on first paint.
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, 'seen');
    } catch {}
    setVisible(false);
  };

  // One line for the bar: the first sentence ("no ads, no tracking"); the full detail is on the cookies page.
  const text = t('text');
  const short = text.match(/^.+?[.。!！](?=\s|$)/)?.[0] ?? text;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="region"
          aria-label={t('title')}
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="web-only fixed inset-x-0 bottom-0 z-50 glass-strong border-t border-border/50 px-3 py-2 shadow-[0_-6px_20px_-12px_rgba(0,0,0,0.25)] sm:px-6"
        >
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <p className="min-w-0 text-xs font-semibold leading-snug text-text-body sm:text-sm">{short}</p>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={dismiss}
                className="min-h-10 rounded-xl px-4 text-xs font-bold text-white shadow-sm shadow-green/20 gradient-green-cta"
              >
                {t('ok')}
              </button>
              <Link href="/cookies" aria-label={`${t('more')} – ${t('title')}`} className="inline-flex min-h-10 items-center text-xs font-semibold text-text-muted underline-offset-2 hover:text-green hover:underline">
                {t('more')}
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

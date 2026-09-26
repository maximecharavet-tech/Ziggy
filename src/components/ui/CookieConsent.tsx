'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { ZiggyAvatar } from '@/components/ziggy/Mascot';

const KEY = 'cookie-consent';

/**
 * Ziggy has no analytics and no advertising, so there is nothing to opt into:
 * this is a notice about the storage the site needs to work, dismissed once.
 */
export function CookieConsent() {
  const t = useTranslations('cookies_banner');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(KEY);
    } catch {}
    if (seen) return;
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

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="region"
          aria-label={t('title')}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:end-6 sm:bottom-6 sm:max-w-sm z-50 glass-strong rounded-2xl border border-border/50 p-4 shadow-xl"
        >
          <div className="flex items-start gap-3">
            <ZiggyAvatar size={40} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text-body mb-1">{t('title')}</p>
              <p className="text-xs text-text-muted leading-relaxed mb-3">{t('text')}</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={dismiss}
                  className="px-4 py-2 text-xs font-bold rounded-xl gradient-green-cta text-white shadow-sm shadow-green/20 hover:shadow-md hover:shadow-green/30 transition-shadow"
                >
                  {t('ok')}
                </button>
                <Link href="/cookies" className="text-xs font-semibold text-text-muted hover:text-green transition-colors">
                  {t('more')}
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

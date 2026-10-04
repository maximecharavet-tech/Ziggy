'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, X } from 'lucide-react';
import { Breathe } from './Breathe';
import { ZiggyAvatar } from '@/components/ziggy/Mascot';

const KEY = 'ziggy:screen-time';
const AFTER_MS = 20 * 60_000;
const SNOOZE_MS = 10 * 60_000;

/**
 * Ziggy suggests a break after 20 minutes on screen (only time the tab is
 * visible counts). A breathing minute, or "later" — never a lock.
 */
export function BreakReminder() {
  const t = useTranslations('breathe');
  const [show, setShow] = useState(false);
  const [breathing, setBreathing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let spent = 0;
    try {
      spent = Number(sessionStorage.getItem(KEY)) || 0;
    } catch {}
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === 'visible') spent += now - last;
      last = now;
      try {
        sessionStorage.setItem(KEY, String(spent));
      } catch {}
      if (spent >= AFTER_MS) setShow(true);
    }, 15_000);
    return () => window.clearInterval(id);
  }, []);

  const reset = (ms: number) => {
    try {
      sessionStorage.setItem(KEY, String(ms));
    } catch {}
  };

  const later = () => {
    reset(AFTER_MS - SNOOZE_MS);
    setShow(false);
  };

  const close = () => {
    reset(0);
    setBreathing(false);
    setShow(false);
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {show && !breathing && (
        <motion.div
          role="status"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:start-6 sm:bottom-6 sm:max-w-sm z-[80] rounded-2xl border border-border/50 glass-strong p-4 shadow-xl"
        >
          <div className="flex items-start gap-3">
            <ZiggyAvatar size={44} />
            <div className="flex-1">
              <p className="font-bold text-text-body">{t('reminder_title')}</p>
              <p className="mt-0.5 text-sm text-text-muted">{t('reminder_text')}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setBreathing(true)} className="press inline-flex items-center gap-1.5 rounded-xl gradient-green-cta px-3.5 py-2 text-sm font-bold text-white">
                  <Wind size={15} /> {t('start')}
                </button>
                <button type="button" onClick={later} className="press rounded-xl px-3 py-2 text-sm font-semibold text-text-muted">
                  {t('later')}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
      {breathing && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={t('title')}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#E8F7FF_0%,#DDF5E4_55%,#FFF4E2_100%)] dark:bg-[radial-gradient(circle_at_50%_40%,#12233a_0%,#0f2318_55%,#0A0A1A_100%)] p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" onClick={close} className="press absolute end-5 top-5 rounded-full p-2 text-text-muted" aria-label={t('close')}>
            <X size={22} />
          </button>
          <div>
            <h2 className="mb-6 text-center font-display text-2xl font-bold text-text-body">{t('title')}</h2>
            <Breathe onDone={() => window.setTimeout(close, 2500)} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie } from 'lucide-react';

// TODO: Replace hardcoded English text with next-intl translations
// using the 'cookies_banner' namespace once messages/*.json files are updated.

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      // Small delay so the banner doesn't appear instantly on page load
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie-consent', 'declined');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 glass-strong rounded-2xl border border-border/50 p-5 shadow-lg"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-green/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Cookie size={18} className="text-green" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-body mb-1">
                We use cookies
              </p>
              <p className="text-xs text-text-muted leading-relaxed mb-4">
                We use cookies to enhance your experience, analyze site traffic, and personalize content. By clicking &quot;Accept&quot;, you consent to our use of cookies.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAccept}
                  className="px-4 py-2 text-xs font-semibold rounded-xl gradient-green-cta text-white shadow-sm shadow-green/20 hover:shadow-md hover:shadow-green/30 transition-shadow"
                >
                  Accept
                </button>
                <button
                  onClick={handleDecline}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-text-muted hover:text-text-body hover:bg-border/30 transition-all"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

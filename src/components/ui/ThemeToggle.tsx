'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };

function apply(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  } catch {}
}

/**
 * Light / dark switch. Where the View Transitions API exists, the new theme
 * spreads from the button as a growing circle; elsewhere it simply switches.
 */
export function ThemeToggle() {
  const t = useTranslations('nav');
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next = !dark;
    setDark(next);
    const doc = document as DocWithVT;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!doc.startViewTransition || reduce) {
      apply(next);
      return;
    }
    const x = e.clientX || window.innerWidth - 40;
    const y = e.clientY || 40;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const vt = doc.startViewTransition(() => apply(next));
    void vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 560, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="press w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:text-green hover:bg-green/10 transition-colors"
      aria-label={dark ? t('theme_light') : t('theme_dark')}
    >
      {mounted ? (
        <motion.span
          key={dark ? 'moon' : 'sun'}
          initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', duration: 0.4, bounce: 0.35 }}
        >
          {dark ? <Moon size={18} /> : <Sun size={18} />}
        </motion.span>
      ) : (
        <Sun size={18} />
      )}
    </button>
  );
}

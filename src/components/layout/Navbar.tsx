'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ZiggyLogo } from '@/components/ziggy/ZiggyLogo';
import { ZiggyRobot } from '@/components/ziggy/ZiggyRobot';
import { AccountButton } from '@/components/account/AccountButton';

export function Navbar() {
  const t = useTranslations('nav');
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const navLinks = [
    { href: '#features', label: t('features') },
    { href: '#modules', label: t('modules') },
    { href: '#agents', label: t('agents') },
    { href: '#games', label: t('games') },
    { href: '#pricing', label: t('pricing') },
    { href: '#demo', label: t('demo') },
  ];

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'glass-strong border-b border-border/50 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
          : 'bg-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group shrink-0" aria-label="Ziggy — home">
          <ZiggyRobot size={34} fullBody={false} className="transition-transform duration-300 group-hover:scale-110" />
          <ZiggyLogo size={96} className="transition-transform duration-300 group-hover:-rotate-1" />
        </Link>

        <div className="hidden lg:flex items-center gap-6 xl:gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="relative text-sm font-medium text-text-muted hover:text-green transition-colors py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-green after:rounded-full after:transition-all hover:after:w-full"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <ThemeToggle />
          <LanguageSwitcher />
          <AccountButton />
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl text-text-muted hover:text-text-body hover:bg-border/30 transition-all"
          aria-label="Toggle menu"
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="lg:hidden border-t border-border/50 glass-strong overflow-hidden"
          >
            <div className="px-4 py-5 space-y-1">
              {navLinks.map((link, i) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="block text-base font-medium text-text-muted hover:text-green transition-colors py-3 px-3 rounded-xl hover:bg-green/5"
                >
                  {link.label}
                </motion.a>
              ))}
              <div className="flex items-center gap-3 pt-4 px-3">
                <ThemeToggle />
                <LanguageSwitcher />
                <AccountButton className="flex-1 justify-center" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

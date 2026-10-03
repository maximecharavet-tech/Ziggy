'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { SoundToggle } from '@/components/ui/SoundToggle';
import { ZiggyLogo } from '@/components/ziggy/ZiggyLogo';
import { ZiggyAvatar } from '@/components/ziggy/Mascot';
import { AccountButton } from '@/components/account/AccountButton';

export function Navbar() {
  const t = useTranslations('nav');
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  // Pages on a dark stage keep the glass pill on, so the links stay readable.
  const pathname = usePathname();
  const pill = scrolled || pathname.startsWith('/hyper');

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Section anchors live on the home page, so they point there from any page.
  const navLinks: { hash?: string; path?: '/lab'; label: string; key: string }[] = [
    { key: 'lab', path: '/lab', label: t('lab') },
    { key: 'features', hash: 'features', label: t('features') },
    { key: 'agents', hash: 'agents', label: t('agents') },
    { key: 'games', hash: 'games', label: t('games') },
    { key: 'pricing', hash: 'pricing', label: t('pricing') },
    { key: 'demo', hash: 'demo', label: t('demo') },
  ];
  const hrefOf = (l: (typeof navLinks)[number]) => (l.path ? l.path : { pathname: '/' as const, hash: l.hash });

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-[padding] duration-300 ${scrolled ? 'pt-2 sm:pt-3' : 'pt-0'}`}
    >
      <nav
        data-scrolled={pill}
        className={`liquid-nav mx-auto flex items-center justify-between transition-all duration-300 ${
          scrolled ? 'max-w-6xl h-14 sm:h-16 px-3 sm:px-5 mx-3 sm:mx-auto' : 'max-w-7xl h-16 sm:h-18 px-4 sm:px-6 lg:px-8'
        }`}
      >
        <Link href="/" className="relative z-10 flex items-center gap-2 group shrink-0" aria-label="Ziggy — home">
          <ZiggyAvatar size={36} className="transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />
          <ZiggyLogo size={96} className="transition-transform duration-300 group-hover:-rotate-1" />
        </Link>

        <div className="relative z-10 hidden lg:flex items-center gap-1" onMouseLeave={() => setHovered(null)}>
          {navLinks.map((link) => (
            <Link
              key={link.key}
              href={hrefOf(link)}
              onMouseEnter={() => setHovered(link.key)}
              onFocus={() => setHovered(link.key)}
              className="relative px-3.5 py-2 text-sm font-semibold text-text-muted hover:text-text-body transition-colors rounded-full"
            >
              {hovered === link.key && (
                <motion.span
                  layoutId="nav-hover"
                  className="absolute inset-0 -z-10 rounded-full bg-green/10 ring-1 ring-green/15"
                  transition={{ type: 'spring', duration: 0.35, bounce: 0.18 }}
                />
              )}
              {link.label}
              {link.path && <span className="ms-1 rounded-full bg-sky/15 px-1.5 py-0.5 text-[10px] font-bold text-sky align-middle">{t('new')}</span>}
            </Link>
          ))}
        </div>

        <div className="relative z-10 hidden lg:flex items-center gap-3">
          <SoundToggle />
          <ThemeToggle />
          <LanguageSwitcher />
          <AccountButton />
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative z-10 lg:hidden w-10 h-10 flex items-center justify-center rounded-xl text-text-muted hover:text-text-body hover:bg-border/30 transition-all"
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
            className="lg:hidden mx-3 mt-2 rounded-3xl border border-border/50 glass-strong overflow-hidden shadow-xl"
          >
            <div className="px-4 py-5 space-y-1">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.key}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                >
                  <Link
                    href={hrefOf(link)}
                    onClick={() => setIsOpen(false)}
                    className="block text-base font-semibold text-text-muted hover:text-green transition-colors py-3 px-3 rounded-xl hover:bg-green/5"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              <div className="flex items-center gap-3 pt-4 px-3">
                <SoundToggle />
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

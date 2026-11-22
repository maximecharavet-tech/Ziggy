'use client';

import type { CSSProperties } from 'react';
import { motion } from 'motion/react';
import { Home } from 'lucide-react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { MascotCutout } from '@/components/ziggy/Mascot';
import { SayButton } from '@/components/arcade/read-aloud';
import { tr, type L } from '@/lib/i18n-text';
import { MagicBackdrop } from '@/components/sections/magic/MagicBackdrop';
import { useReducedMotion } from '@/lib/use-reduced-motion';

const T = {
  title: { fr: 'Oh ! Cette page joue à cache-cache.', en: 'Oh! This page is playing hide-and-seek.' },
  text: { fr: 'Pas grave : Ziggy connaît le chemin de la maison.', en: 'No problem: Ziggy knows the way home.' },
  home: { fr: 'Retour à l’accueil', en: 'Back home' },
} satisfies Record<string, L>;

/** A page that does not exist: Ziggy smiles and shows the way home (never a "failure" screen). */
export default function NotFound() {
  const locale = useLocale();
  const reduced = useReducedMotion();
  return (
    <div className="relative flex min-h-[80vh] items-center justify-center overflow-clip px-4 pb-12 pt-24">
      <MagicBackdrop variant="day" stars={12} clouds={3} seed={404} />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 max-w-md text-center"
      >
        <motion.div
          animate={reduced ? undefined : { y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-4 flex justify-center"
        >
          <MascotCutout pose="wave" width={150} className="w-[150px]" />
        </motion.div>

        <div className="mg-card mg-static p-8" style={{ '--tint': '#7FC85C' } as CSSProperties}>
          <p className="font-display text-6xl font-bold text-leaf-ink dark:text-leaf" aria-hidden="true">
            4<span className="inline-block -rotate-12">🌍</span>4
          </p>
          <div className="mt-3 flex items-start justify-center gap-2">
            <h1 className="font-display text-2xl font-bold text-text-body text-balance">{tr(T.title, locale)}</h1>
            <SayButton texts={[tr(T.title, locale), tr(T.text, locale)]} locale={locale} size="sm" className="mt-1" />
          </div>
          <p className="mb-6 mt-2 text-text-muted">{tr(T.text, locale)}</p>
          <Link href="/" className="mg-pill" style={{ '--tint': '#2f7a1f' } as CSSProperties}>
            <Home size={18} aria-hidden="true" />
            {tr(T.home, locale)}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

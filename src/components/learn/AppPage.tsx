'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { SplitWords } from '@/components/ui/motion-primitives';
import { EASE_OUT } from '@/lib/motion';

/** The shared frame of the learning apps: eyebrow, title rising word by word, intro, content. */
export function AppPage({
  eyebrow,
  title,
  subtitle,
  color,
  children,
}: {
  eyebrow: ReactNode;
  title: string;
  subtitle: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-clip px-4 pb-24 pt-28 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 drift" aria-hidden="true">
        <div className="absolute -top-32 left-1/4 h-[30rem] w-[30rem] rounded-full blur-3xl" style={{ backgroundColor: `${color}22` }} />
        <div className="absolute top-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-peach/35 blur-3xl dark:bg-peach/10" />
      </div>
      <div className="relative mx-auto max-w-6xl">
        <header className="text-center">
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold"
            style={{ color, borderColor: `${color}55`, backgroundColor: `${color}14` }}
          >
            {eyebrow}
          </motion.span>
          <h1 className="mt-5 font-display text-4xl font-bold text-text-body sm:text-6xl text-balance">
            <SplitWords text={title} />
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25, ease: EASE_OUT }}
            className="mx-auto mt-4 max-w-2xl text-lg text-text-muted"
          >
            {subtitle}
          </motion.p>
        </header>
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.3, ease: EASE_OUT }}
          className="mt-12"
        >
          {children}
        </motion.section>
      </div>
    </div>
  );
}

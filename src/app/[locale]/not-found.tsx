'use client';

import { motion } from 'framer-motion';
import { Home, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ZiggyRobot } from '@/components/ziggy/ZiggyRobot';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 gradient-hero">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md"
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="flex justify-center mb-6"
        >
          <ZiggyRobot size={140} />
        </motion.div>

        <div className="glass-strong rounded-2xl border border-border/50 p-8 shadow-lg">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles size={20} className="text-green" />
            <span className="text-6xl font-extrabold text-gradient-green">404</span>
            <Sparkles size={20} className="text-green" />
          </div>

          <h1 className="text-xl font-bold text-text-body mb-2">
            Oops! Ziggy got lost in space!
          </h1>
          <p className="text-sm text-text-muted mb-6">
            This page doesn&apos;t exist, but don&apos;t worry — Ziggy will guide you home.
          </p>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full gradient-green-cta text-white font-semibold text-sm shadow-md shadow-green/20 hover:shadow-lg hover:shadow-green/30 transition-all active:scale-95"
          >
            <Home size={16} />
            Go Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

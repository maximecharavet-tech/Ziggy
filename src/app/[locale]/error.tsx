'use client';

import { motion } from 'framer-motion';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-md"
      >
        <div className="glass-strong rounded-2xl border border-border/50 p-8 shadow-lg">
          <div className="w-16 h-16 rounded-2xl bg-yellow/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} className="text-yellow" />
          </div>

          <h1 className="text-xl font-bold text-text-body mb-2">
            Ziggy had a little hiccup!
          </h1>
          <p className="text-sm text-text-muted mb-6">
            Something went wrong, but don&apos;t worry — let&apos;s try again.
          </p>

          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full gradient-green-cta text-white font-semibold text-sm shadow-md shadow-green/20 hover:shadow-lg hover:shadow-green/30 transition-all active:scale-95"
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      </motion.div>
    </div>
  );
}

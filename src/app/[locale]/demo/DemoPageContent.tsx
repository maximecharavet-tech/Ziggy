'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Sparkles, Shield, Zap } from 'lucide-react';
import { ZiggyChat } from '@/components/ziggy/ZiggyChat';
import { ZiggyRobot } from '@/components/ziggy/ZiggyRobot';
import { ParticleField } from '@/components/ui/ParticleField';
import { FloatingEmoji } from '@/components/ui/FloatingEmoji';
import { Badge } from '@/components/ui/Badge';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6 },
  }),
};

export function DemoPageContent() {
  const t = useTranslations('demo');

  return (
    <section className="relative min-h-[calc(100dvh-4rem)] pt-28 pb-24 px-4 sm:px-6 lg:px-8 gradient-hero overflow-hidden">
      <ParticleField count={35} className="opacity-50" />
      <FloatingEmoji count={5} />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Header */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="text-center mb-10">
          <Badge className="gap-1.5 mb-4">
            <Sparkles size={14} />
            {t('title')}
          </Badge>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-text-body leading-tight tracking-tight">
            {t('title')}
          </h1>
          <p className="mt-4 text-text-muted text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </motion.div>

        {/* Main content */}
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 lg:gap-12">
          {/* Ziggy sidebar */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="hidden lg:flex flex-col items-center gap-6"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-green/10 rounded-full blur-3xl scale-150" />
              <div className="relative animate-float">
                <ZiggyRobot size={200} />
              </div>
            </div>

            {/* Trust badges */}
            <div className="glass rounded-2xl border border-border/50 p-4 space-y-3 w-52">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Shield size={14} className="text-green flex-shrink-0" />
                <span>GDPR & COPPA Safe</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Zap size={14} className="text-yellow flex-shrink-0" />
                <span>Powered by Claude AI</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Sparkles size={14} className="text-purple flex-shrink-0" />
                <span>Adaptive Learning</span>
              </div>
            </div>
          </motion.div>

          {/* Chat */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
            className="w-full max-w-lg mx-auto lg:mx-0 flex-1"
          >
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-green/5 via-blue/5 to-purple/5 rounded-3xl blur-xl" />
              <div className="relative">
                <ZiggyChat />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { ParticleField } from '@/components/ui/ParticleField';
import { FloatingEmoji } from '@/components/ui/FloatingEmoji';
import { ZiggyRobot } from '@/components/ziggy/ZiggyRobot';
import { ZiggyLogo } from '@/components/ziggy/ZiggyLogo';
import { StarBurst } from '@/components/ziggy/StarBurst';
import { STATS } from '@/lib/constants';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

export function HeroSection() {
  const [happy, setHappy] = useState(false);

  const cheer = () => {
    setHappy(true);
    setTimeout(() => setHappy(false), 900);
  };

  const t = useTranslations('hero');

  const stats = [
    { value: STATS.children, label: t('stats_children') },
    { value: STATS.sessions, label: t('stats_sessions') },
    { value: STATS.countries, label: t('stats_countries') },
    { value: STATS.rating, label: t('stats_rating') },
  ];

  return (
    <section className="relative min-h-[90dvh] flex items-center pt-24 pb-16 px-4 sm:px-6 lg:px-8 gradient-hero overflow-hidden">
      <ParticleField className="z-0" count={50} />
      <FloatingEmoji count={8} className="z-0" />

      <div className="relative z-10 max-w-7xl mx-auto w-full flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
        {/* Text content */}
        <div className="flex-1 text-center lg:text-left">
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
            <Badge className="gap-1.5">
              <Sparkles size={14} />
              {t('badge')}
            </Badge>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.5}
            className="mt-6 flex justify-center lg:justify-start"
          >
            <ZiggyLogo size={220} className="w-[170px] sm:w-[220px] h-auto" />
          </motion.div>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="mt-4 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-text-body leading-[1.1] tracking-tight text-balance"
          >
            {t('title')}
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
            className="mt-6 text-base sm:text-lg text-text-muted max-w-xl mx-auto lg:mx-0 leading-relaxed"
          >
            {t('subtitle')}
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
            className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
          >
            <Button href="/signup" size="lg" className="group relative overflow-hidden">
              <span className="relative z-10">{t('cta_primary')}</span>
              <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </Button>
            <Button href="/demo" variant="secondary" size="lg">
              {t('cta_secondary')}
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={4}
            className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-center lg:text-left">
                <AnimatedCounter
                  value={stat.value}
                  className="text-2xl sm:text-3xl font-extrabold text-gradient-green"
                />
                <div className="text-xs text-text-dim mt-1 font-medium">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Ziggy Robot */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6, rotate: -5 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay: 0.4, duration: 1, type: 'spring', stiffness: 100 }}
          className="flex-shrink-0 relative"
        >
          {/* Glow behind Ziggy */}
          <div className="absolute inset-0 bg-green/10 rounded-full blur-3xl scale-125" />
          <motion.button
            type="button"
            onClick={cheer}
            whileTap={{ scale: 0.94 }}
            animate={happy ? { rotate: [0, -6, 6, -3, 0] } : {}}
            transition={{ duration: 0.6 }}
            className="relative animate-float cursor-pointer rounded-full focus-visible:outline-none"
            aria-label="Say hello to Ziggy"
          >
            <ZiggyRobot size={240} excited={happy} className="sm:w-auto w-[180px]" />
            <StarBurst trigger={happy} x={120} y={90} />
          </motion.button>
        </motion.div>
      </div>

      {/* Bottom wave divider */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" preserveAspectRatio="none">
          <path d="M0 60V20C240 45 480 5 720 25C960 45 1200 5 1440 20V60H0Z" fill="var(--color-bg)" />
        </svg>
      </div>
    </section>
  );
}

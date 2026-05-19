'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ZiggyRobot } from '@/components/ziggy/ZiggyRobot';
import { STATS } from '@/lib/constants';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6 } }),
};

export function HeroSection() {
  const t = useTranslations('hero');

  const stats = [
    { value: STATS.children, label: t('stats_children') },
    { value: STATS.sessions, label: t('stats_sessions') },
    { value: STATS.countries, label: t('stats_countries') },
    { value: STATS.rating, label: t('stats_rating') },
  ];

  return (
    <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 gradient-green-soft overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1 text-center md:text-left">
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
            <Badge>{t('badge')}</Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp} initial="hidden" animate="visible" custom={1}
            className="mt-6 text-4xl md:text-5xl lg:text-6xl font-extrabold text-text-body leading-tight"
          >
            {t('title')}
          </motion.h1>

          <motion.p
            variants={fadeUp} initial="hidden" animate="visible" custom={2}
            className="mt-6 text-lg text-text-muted max-w-xl mx-auto md:mx-0"
          >
            {t('subtitle')}
          </motion.p>

          <motion.div
            variants={fadeUp} initial="hidden" animate="visible" custom={3}
            className="mt-8 flex flex-col sm:flex-row gap-4 justify-center md:justify-start"
          >
            <Button size="lg">{t('cta_primary')}</Button>
            <Button variant="secondary" size="lg">{t('cta_secondary')}</Button>
          </motion.div>

          <motion.div
            variants={fadeUp} initial="hidden" animate="visible" custom={4}
            className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-center md:text-left">
                <div className="text-2xl font-extrabold text-gradient-green">{stat.value}</div>
                <div className="text-xs text-text-dim mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.8, type: 'spring' }}
          className="hidden md:block flex-shrink-0"
        >
          <ZiggyRobot size={280} />
        </motion.div>
      </div>
    </section>
  );
}

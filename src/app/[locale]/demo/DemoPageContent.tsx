'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { ZiggyChat } from '@/components/ziggy/ZiggyChat';
import { ExpressTrial } from '@/components/trial/ExpressTrial';

const ease = [0.22, 1, 0.36, 1] as const;

export function DemoPageContent() {
  const t = useTranslations('trial');
  const td = useTranslations('demo');

  return (
    <div className="relative overflow-clip pt-28 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-40 -start-32 w-[34rem] h-[34rem] rounded-full bg-leaf/15 blur-3xl" />
        <div className="absolute top-40 -end-40 w-[30rem] h-[30rem] rounded-full bg-peach/40 blur-3xl dark:bg-peach/10" />
      </div>

      <div className="relative max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl sm:text-5xl font-bold text-text-body text-balance">{t('section_title')}</h1>
          <p className="mt-4 text-lg text-text-muted max-w-xl mx-auto leading-relaxed">{t('section_subtitle')}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.7, ease }}>
          <ExpressTrial />
        </motion.div>

        {/* Then, a real conversation */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease }}
          className="mt-20"
        >
          <div className="text-center mb-8">
            <span className="eyebrow text-green justify-center">
              <MessageCircle size={14} /> {t('chat_eyebrow')}
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-text-body">{td('title')}</h2>
            <p className="mt-3 text-text-muted max-w-lg mx-auto">{td('subtitle')}</p>
          </div>
          <ZiggyChat />
        </motion.section>
      </div>
    </div>
  );
}

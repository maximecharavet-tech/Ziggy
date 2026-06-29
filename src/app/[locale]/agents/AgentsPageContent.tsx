'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Users, Sparkles } from 'lucide-react';
import { AGENTS } from '@/lib/agents';
import { AgentCard } from '@/components/agents/AgentCard';
import { ParticleField } from '@/components/ui/ParticleField';

export function AgentsPageContent() {
  const t = useTranslations('agents');

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="relative overflow-hidden">
        <ParticleField count={30} />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-border/50 text-xs font-semibold text-green mb-6">
              <Users size={14} />
              {t('badge')}
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-text-body mb-4">
              {t('pageTitle')}
            </h1>
            <p className="text-lg text-text-muted max-w-2xl mx-auto">
              {t('pageSubtitle')}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {AGENTS.map((agent, i) => (
            <AgentCard
              key={agent.id}
              id={agent.id}
              name={t(`${agent.id}.name`)}
              description={t(`${agent.id}.description`)}
              icon={agent.icon}
              color={agent.color}
              index={i}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 text-center glass-strong rounded-2xl border border-border/50 p-8"
        >
          <Sparkles size={24} className="text-green mx-auto mb-3" />
          <p className="text-sm text-text-muted max-w-md mx-auto">
            {t('footer')}
          </p>
        </motion.div>
      </div>
    </div>
  );
}

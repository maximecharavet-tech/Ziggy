'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Sparkles, BookOpen } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getAgent } from '@/lib/agents';
import { AgentChat } from '@/components/agents/AgentChat';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { ParticleField } from '@/components/ui/ParticleField';

export function AgentPageContent({ agentId }: { agentId: string }) {
  const t = useTranslations('agents');
  const agent = getAgent(agentId)!;

  const suggestions: string[] = t.raw(`${agentId}.suggestions`);

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="relative overflow-hidden">
        <ParticleField count={20} />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
          <Link
            href="/agents"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-body transition-colors mb-8"
          >
            <ArrowLeft size={16} />
            {t('backToAgents')}
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div
                className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 animate-float"
                style={{ backgroundColor: `${agent.color}12`, boxShadow: `0 8px 32px ${agent.color}20` }}
              >
                <AgentAvatar agentId={agentId} color={agent.color} size={78} />
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold mb-3" style={{ color: agent.color }}>
                {t(`${agentId}.name`)}
              </h1>

              <p className="text-base text-text-muted leading-relaxed mb-6">
                {t(`${agentId}.longDescription`)}
              </p>

              <div className="space-y-3">
                {[
                  { icon: BookOpen, text: t(`${agentId}.learn1`) },
                  { icon: Sparkles, text: t(`${agentId}.learn2`) },
                  { icon: Shield, text: t(`${agentId}.learn3`) },
                ].map(({ icon: Icon, text }, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: `${agent.color}15` }}
                    >
                      <Icon size={16} style={{ color: agent.color }} />
                    </div>
                    <p className="text-sm text-text-muted">{text}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <AgentChat
                agentId={agentId}
                agentName={t(`${agentId}.name`)}
                agentIcon={agent.icon}
                color={agent.color}
                suggestions={suggestions}
                placeholder={t(`${agentId}.chatPlaceholder`)}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

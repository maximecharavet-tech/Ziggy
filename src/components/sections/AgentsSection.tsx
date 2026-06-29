'use client';

import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { AGENTS } from '@/lib/agents';
import { AgentCard } from '@/components/agents/AgentCard';
import { ScrollReveal } from '@/components/ui/ScrollReveal';

export function AgentsSection() {
  const t = useTranslations('agents');

  return (
    <section id="agents" className="py-20 sm:py-28 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green/10 mb-4">
              <Users size={28} className="text-green" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-text-body mb-3">{t('sectionTitle')}</h2>
            <p className="text-base text-text-muted max-w-2xl mx-auto">{t('sectionSubtitle')}</p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
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
      </div>
    </section>
  );
}

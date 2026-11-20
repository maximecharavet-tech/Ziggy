'use client';

import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { AGENTS } from '@/lib/agents';
import { AgentCard } from '@/components/agents/AgentCard';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Stagger } from '@/components/sections/magic/Stagger';

export function AgentsSection() {
  const t = useTranslations('agents');

  return (
    <section id="agents" className="relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(95,182,234,0.12),transparent_70%),radial-gradient(40%_40%_at_0%_100%,rgba(127,200,92,0.12),transparent_70%)]" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="mb-12 text-center">
            <span className="mg-icon mx-auto mb-5 h-16 w-16 rotate-[5deg]" style={{ '--tint': '#5FB6EA' } as CSSProperties}>
              <Users size={30} strokeWidth={2.4} aria-hidden="true" />
            </span>
            <h2 className="mb-3 font-display text-3xl font-bold text-text-body text-balance sm:text-5xl">{t('sectionTitle')}</h2>
            <p className="mx-auto max-w-2xl text-lg text-text-muted">{t('sectionSubtitle')}</p>
          </div>
        </ScrollReveal>

        {/* Five friends: two rows, the second one centred (no hole in the grid). */}
        <Stagger className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-7">
          {AGENTS.map((agent, i) => (
            <div key={agent.id} className="w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]">
              <AgentCard
                id={agent.id}
                name={t(`${agent.id}.name`)}
                description={t(`${agent.id}.description`)}
                icon={agent.icon}
                color={agent.color}
                index={i}
              />
            </div>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

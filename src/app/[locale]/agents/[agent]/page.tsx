import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AGENTS } from '@/lib/agents';
import { AgentPageContent } from './AgentPageContent';

export function generateStaticParams() {
  return AGENTS.map((agent) => ({ agent: agent.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; agent: string }> }): Promise<Metadata> {
  const { locale, agent: agentId } = await params;
  const agentConfig = AGENTS.find((a) => a.id === agentId);
  if (!agentConfig) return { title: 'Not Found' };

  const t = await getTranslations({ locale, namespace: 'agents' });
  return {
    title: `${t(`${agentId}.name`)} — Ziggy`,
    description: t(`${agentId}.description`),
  };
}

export default async function AgentPage({ params }: { params: Promise<{ locale: string; agent: string }> }) {
  const { locale, agent: agentId } = await params;
  const agentConfig = AGENTS.find((a) => a.id === agentId);

  if (!agentConfig) notFound();

  setRequestLocale(locale);

  return <AgentPageContent agentId={agentId} />;
}

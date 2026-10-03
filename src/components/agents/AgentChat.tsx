'use client';

import { useTranslations } from 'next-intl';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { AgentAvatar } from './AgentAvatar';

interface AgentChatProps {
  agentId: string;
  agentName: string;
  agentIcon: string;
  color: string;
  suggestions: string[];
  placeholder: string;
}

/** One of Ziggy's specialist friends, in the shared chat window. */
export function AgentChat({ agentId, agentName, color, suggestions, placeholder }: AgentChatProps) {
  const t = useTranslations('chat');
  return (
    <ChatWindow
      agentId={agentId}
      identity={{
        name: agentName,
        color,
        avatar: (size) => (
          <span
            className="inline-flex items-center justify-center rounded-full overflow-hidden"
            style={{ width: size, height: size, backgroundColor: `${color}18` }}
          >
            <AgentAvatar agentId={agentId} color={color} size={Math.round(size * 0.86)} />
          </span>
        ),
        portrait: (
          <span className="flex w-full h-full items-center justify-center" style={{ backgroundColor: `${color}22` }}>
            <AgentAvatar agentId={agentId} color={color} size={200} />
          </span>
        ),
        welcome: (
          <div className="animate-float">
            <AgentAvatar agentId={agentId} color={color} size={80} />
          </div>
        ),
      }}
      intro={placeholder}
      suggestions={suggestions}
      placeholder={t('ask', { name: agentName })}
    />
  );
}

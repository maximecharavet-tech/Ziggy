'use client';

import { useTranslations } from 'next-intl';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { MascotCutout, ZiggyAvatar } from './Mascot';

/** Ziggy himself: the official mascot, his voice, his colour. */
export function ZiggyChat() {
  const t = useTranslations('demo');
  return (
    <ChatWindow
      identity={{
        name: 'Ziggy',
        color: '#22C55E',
        avatar: (size) => <ZiggyAvatar size={size} ring={size > 30} />,
        welcome: (
          <div className="w-24 animate-float">
            <MascotCutout pose="wave" width={96} />
          </div>
        ),
      }}
      intro={t('subtitle')}
      suggestions={t.raw('suggestions') as string[]}
      placeholder={t('placeholder')}
    />
  );
}

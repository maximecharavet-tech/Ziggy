'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { useProfile } from './ProfileProvider';
import { avatarColor } from '@/lib/account';

/**
 * Navbar account control: a sign-up call to action until there is a profile,
 * then the child's avatar and name linking to their dashboard.
 */
export function AccountButton({ className = '' }: { className?: string }) {
  const t = useTranslations('nav');
  const { profile, ready } = useProfile();

  // Render the signed-out state during SSR so markup matches on hydration.
  if (!ready || !profile) {
    return (
      <Button href="/signup" size="sm" className={className}>
        {t('signup')}
      </Button>
    );
  }

  const color = avatarColor(profile.avatar);

  return (
    <Link
      href="/account"
      className={`inline-flex items-center gap-2 ps-1.5 pe-3.5 py-1.5 rounded-full glass border border-border/50 hover:border-green/40 transition-colors ${className}`}
    >
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        <AgentAvatar agentId={profile.avatar} color={color} size={26} />
      </span>
      <span className="text-sm font-bold text-text-body max-w-[7rem] truncate">{profile.name}</span>
    </Link>
  );
}

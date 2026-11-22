'use client';

import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { MessageCircle } from 'lucide-react';
import { AgentAvatar } from './AgentAvatar';
import { deepFor } from '@/components/sections/magic/color';
import { rise } from '@/components/sections/magic/rise';
import { useTapRipple } from '@/components/ui/fx/TapRipple';

interface AgentCardProps {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  index: number;
}

/** One of Ziggy's friends as a toy tile (lifts on hover, squishes when pressed). */
export function AgentCard({ id, name, description, color, index }: AgentCardProps) {
  const t = useTranslations('agents');
  const deep = deepFor(color);
  // A soft ripple and a pinch of sparkles from the finger (shared FX kit).
  const { onPointerDown, layer } = useTapRipple({ color });
  return (
    <div className="mg-rise h-full" style={rise(index)}>
      <Link
        href={`/agents/${id}` as '/agents/sales'}
        onPointerDown={onPointerDown}
        className="mg-card group flex h-full flex-col p-5 sm:p-6"
        style={{ '--tint': color, '--mg-tilt': index % 2 ? '0.6deg' : '-0.6deg' } as CSSProperties}
      >
        <div className="flex items-start justify-between">
          <span
            className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-[1.4rem] transition-transform duration-500 ease-toy group-hover:-rotate-6 group-hover:scale-105"
            style={{ background: `radial-gradient(circle at 35% 30%, #fff, ${color}22 70%)`, boxShadow: `inset 0 0 0 2px ${color}33, 0 4px 0 ${color}33` }}
          >
            <AgentAvatar agentId={id} color={color} size={56} />
          </span>
          <span className="grid h-9 w-9 place-items-center rounded-full" style={{ backgroundColor: `${color}1f`, color: deep }} aria-hidden="true">
            <MessageCircle size={16} />
          </span>
        </div>
        <h3 className="mt-4 font-display text-xl font-bold tracking-tight" style={{ color: deep }}>
          <span className="dark:text-text-body">{name}</span>
        </h3>
        <p className="mt-2 flex-1 text-[0.95rem] leading-relaxed text-text-muted">{description}</p>
        <span className="mg-pill mt-5 w-fit" style={{ '--tint': deep } as CSSProperties}>
          {t('try_now')}
          <span aria-hidden="true" className="rtl:rotate-180">→</span>
        </span>
        {layer}
      </Link>
    </div>
  );
}

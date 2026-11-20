'use client';

import type { CSSProperties } from 'react';
import { Link } from '@/i18n/navigation';
import {
  Brain,
  Calculator,
  Puzzle,
  Sparkles,
  Gamepad2,
  Zap,
  Bot,
  SearchCheck,
  Grid3x3,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { deepFor } from '@/components/sections/magic/color';
import { rise } from '@/components/sections/magic/rise';
import { useTapRipple } from '@/components/ui/fx/TapRipple';

const ICONS: Record<string, LucideIcon> = {
  Brain,
  Calculator,
  Puzzle,
  Sparkles,
  Gamepad2,
  Zap,
  Bot,
  SearchCheck,
  Grid3x3,
};

export function getGameIcon(name: string): LucideIcon {
  return ICONS[name] ?? Gamepad2;
}

interface GameCardProps {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  index: number;
  cta: string;
}

/**
 * A mini-game as a toy tile: moulded icon, readable title, a big "Play" pill.
 * Lifts on hover (mouse), squishes when pressed (finger). Inside a `Stagger`
 * it comes in after its neighbours; elsewhere it is simply there.
 */
export function GameCard({ id, name, description, icon, color, index, cta }: GameCardProps) {
  const Icon = getGameIcon(icon);
  const deep = deepFor(color);
  // A soft ripple and a pinch of sparkles from the finger (shared FX kit).
  const { onPointerDown, layer } = useTapRipple({ color });

  return (
    <div className="mg-rise h-full" style={rise(index)}>
      <Link
        href={`/games/${id}` as '/games/memory'}
        onPointerDown={onPointerDown}
        className="mg-card group flex h-full flex-col p-5 sm:p-6"
        style={{ '--tint': color, '--mg-tilt': index % 2 ? '0.6deg' : '-0.6deg' } as CSSProperties}
      >
        <span aria-hidden="true" className="pointer-events-none absolute end-2 top-2 h-24 w-24 rounded-full opacity-70" style={{ background: `radial-gradient(closest-side, ${color}33, transparent)` }} />
        <span className="mg-icon h-16 w-16" style={{ '--tint': color } as CSSProperties}>
          <Icon size={30} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <h3 className="mt-5 font-display text-xl font-bold leading-tight tracking-tight" style={{ color: deep }}>
          <span className="dark:text-text-body">{name}</span>
        </h3>
        <p className="mt-2 flex-1 text-[0.95rem] leading-relaxed text-text-muted">{description}</p>
        <span className="mg-pill mt-5 w-fit" style={{ '--tint': deep } as CSSProperties}>
          <span aria-hidden="true" className="text-[0.8em]">▶</span>
          {cta}
        </span>
        {layer}
      </Link>
    </div>
  );
}

'use client';

import { ReactNode } from 'react';

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  active?: boolean;
}

export function GlowCard({ children, className = '', glowColor = 'green', active = false }: GlowCardProps) {
  return (
    <div className={`group relative ${className}`}>
      <div
        className={`absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-${glowColor}/0 via-${glowColor}/30 to-${glowColor}/0 opacity-0 blur-sm transition-opacity duration-500 ${
          active ? 'opacity-100' : 'group-hover:opacity-100'
        }`}
      />
      <div className="relative bg-bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-6 transition-all duration-300 hover:border-green/30 hover:shadow-[0_8px_30px_rgba(34,197,94,0.08)]">
        {children}
      </div>
    </div>
  );
}

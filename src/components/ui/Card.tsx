'use client';

import { JuicySurface } from './fx/JuicySurface';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Springy hover lift with a light sheen (desktop) and a squish under a finger. */
  hover?: boolean;
}

const surface = 'bg-bg-card rounded-2xl border border-border p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]';

export function Card({ children, className = '', hover = false }: CardProps) {
  if (!hover) return <div className={`${surface} ${className}`}>{children}</div>;
  return (
    <JuicySurface
      className={`${surface} transition-[box-shadow,border-color] duration-200 hover:shadow-[0_10px_24px_-8px_rgba(0,0,0,0.12)] hover:border-green/30 ${className}`}
    >
      {children}
    </JuicySurface>
  );
}

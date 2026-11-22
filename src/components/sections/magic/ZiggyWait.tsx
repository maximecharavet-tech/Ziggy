'use client';

import type { CSSProperties } from 'react';
import { useLocale } from 'next-intl';
import { ZiggyAvatar } from '@/components/ziggy/Mascot';
import { tr, type L } from '@/lib/i18n-text';
import { Sparkle4 } from './Sparkle4';

const COMING: L = { fr: 'Ziggy arrive…', en: 'Ziggy is on his way…' };
const DOTS = ['#7FC85C', '#5FB6EA', '#F2647B'];

/**
 * Waiting with Ziggy: the real plush face, breathing, with three bouncing
 * dots. For loading states (and the first paint before a page wakes up).
 * `late` keeps it invisible for a moment, so a fast load shows nothing.
 */
export function ZiggyWait({
  label = COMING,
  size = 'md',
  late = false,
  className = '',
}: {
  label?: L | null;
  size?: 'sm' | 'md' | 'lg';
  /** Fade in only after this many ms (nothing flashes on a fast load). */
  late?: number | false;
  className?: string;
}) {
  const locale = useLocale();
  const face = size === 'lg' ? 112 : size === 'sm' ? 56 : 84;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 text-center ${late !== false ? 'mg-late' : ''} ${className}`}
      style={late !== false ? ({ '--late': `${late}ms` } as CSSProperties) : undefined}
    >
      <div className="relative">
        <span aria-hidden="true" className="absolute -inset-5 rounded-full bg-[radial-gradient(circle,rgba(255,217,160,0.75)_0%,rgba(251,201,196,0.35)_55%,transparent_72%)] dark:opacity-40" />
        <Sparkle4 className="mg-star absolute -end-4 -top-2" style={{ '--size': '16px', '--c': '#FBBF24' } as CSSProperties} />
        <Sparkle4 className="mg-star absolute -start-5 bottom-1" style={{ '--size': '11px', '--c': '#5FB6EA', '--delay': '-1.2s' } as CSSProperties} />
        <div className="mg-breathe relative">
          <ZiggyAvatar size={face} />
        </div>
      </div>
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {DOTS.map((c, i) => (
          <span key={c} className="mg-dot h-2.5 w-2.5 rounded-full" style={{ background: c, '--delay': `${i * 0.14}s` } as CSSProperties} />
        ))}
      </div>
      {label ? <p className="font-display text-base font-semibold text-ink-soft dark:text-text-muted">{tr(label, locale)}</p> : <span className="sr-only">{tr(COMING, locale)}</span>}
    </div>
  );
}

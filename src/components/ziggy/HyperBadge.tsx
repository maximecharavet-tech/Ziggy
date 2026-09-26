import { Cpu } from 'lucide-react';

/**
 * "Powered by Hyper™ AI Engine" — the signature from the gold Ziggy emblem.
 * `plate` is the gold nameplate shown under the mascot; `inline` is the quiet
 * version for footers and chat headers.
 */
export function HyperBadge({ variant = 'plate', className = '' }: { variant?: 'plate' | 'inline'; className?: string }) {
  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${className}`}>
        <Cpu size={13} className="text-[#C9971C]" aria-hidden="true" />
        <span className="text-text-dim">Powered by</span>
        <span className="text-gold font-bold">
          Hyper™ AI Engine
        </span>
      </span>
    );
  }

  return (
    <span
      className={`gold-plate inline-flex items-center gap-2 rounded-full border border-[#E9C46A]/50 px-4 py-2 text-xs sm:text-sm font-bold shadow-[0_10px_30px_-10px_rgba(154,116,20,0.7),inset_0_1px_0_rgba(255,236,170,0.25)] ${className}`}
    >
      <Cpu size={16} className="text-[#F3D27A]" aria-hidden="true" />
      <span className="text-[#E8D6A0]/80">Powered by</span>
      <span className="text-gold">
        Hyper™ AI Engine
      </span>
    </span>
  );
}

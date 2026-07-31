import { Laptop } from 'lucide-react';

/**
 * Calm, honest reminder that the Ziggy profile lives in this browser only —
 * it is not a server account.
 */
export function LocalOnlyNotice({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border border-border/50 bg-bg-card/60 px-4 py-3.5 ${className}`}
    >
      <Laptop size={18} className="text-green flex-shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-sm text-text-muted leading-relaxed">{text}</p>
    </div>
  );
}

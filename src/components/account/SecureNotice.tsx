import { ShieldCheck } from 'lucide-react';

export function SecureNotice({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-green/25 bg-green/5 px-4 py-3">
      <ShieldCheck size={18} className="text-green shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-sm text-text-muted leading-relaxed">{text}</p>
    </div>
  );
}

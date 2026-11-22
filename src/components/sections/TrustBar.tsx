import { useTranslations } from 'next-intl';
import { ShieldCheck, Lock, Ban, UserCheck } from 'lucide-react';

/**
 * Only promises we can stand behind. Certifications and "end-to-end
 * encryption" claims used to live here; neither was true.
 * Calm chips for parents: no motion, AA text.
 */
export function TrustBar() {
  const t = useTranslations('trust');
  const badges = [
    { icon: ShieldCheck, label: t('eu_storage'), color: '#2f7a1f', bg: 'rgb(127 200 92 / 0.18)' },
    { icon: Lock, label: t('encrypted'), color: '#1d6fa5', bg: 'rgb(95 182 234 / 0.18)' },
    { icon: Ban, label: t('no_ads'), color: '#b8324a', bg: 'rgb(242 100 123 / 0.16)' },
    { icon: UserCheck, label: t('parent_account'), color: '#8a5300', bg: 'rgb(249 190 124 / 0.25)' },
  ];

  return (
    <section className="border-y border-border/50 bg-bg-card/60 py-7">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <ul className="flex flex-wrap items-center justify-center gap-3">
          {badges.map((b) => (
            <li key={b.label} className="mg-chip text-sm font-semibold text-text-body">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ backgroundColor: b.bg, color: b.color }}>
                <b.icon size={17} strokeWidth={2.4} aria-hidden="true" />
              </span>
              {b.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

import { useTranslations } from 'next-intl';
import { ShieldCheck, Lock, Ban, UserCheck } from 'lucide-react';

/**
 * Only promises we can stand behind. Certifications and "end-to-end
 * encryption" claims used to live here; neither was true.
 */
export function TrustBar() {
  const t = useTranslations('trust');
  const badges = [
    { icon: ShieldCheck, label: t('eu_storage'), color: 'text-green' },
    { icon: Lock, label: t('encrypted'), color: 'text-sky' },
    { icon: Ban, label: t('no_ads'), color: 'text-coral' },
    { icon: UserCheck, label: t('parent_account'), color: 'text-apricot' },
  ];

  return (
    <section className="py-8 border-y border-border/50 bg-bg-card/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {badges.map((b) => (
            <li key={b.label} className="flex items-center gap-2 text-sm font-semibold text-text-muted">
              <b.icon size={18} className={b.color} />
              {b.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

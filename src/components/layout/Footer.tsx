import { useTranslations } from 'next-intl';
import { Heart } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ZiggyLogo } from '@/components/ziggy/ZiggyLogo';

export function Footer() {
  const t = useTranslations('footer');

  const productLinks = [
    { label: t('about'), href: '#' },
    { label: t('blog'), href: '#' },
  ];

  const companyLinks = [
    { label: t('careers'), href: '#' },
    { label: t('contact'), href: '#' },
  ];

  const legalLinks = [
    { label: t('privacy'), href: '/privacy' as const },
    { label: t('terms'), href: '/terms' as const },
    { label: t('cookies'), href: '/cookies' as const },
    { label: t('gdpr'), href: '/privacy' as const },
  ];

  return (
    <footer className="border-t border-border/50 bg-gradient-to-b from-bg to-bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          <div className="col-span-2 md:col-span-1">
            <ZiggyLogo size={132} className="mb-4" />
            <p className="text-sm text-text-muted leading-relaxed mb-4">{t('tagline')}</p>
            <div className="flex items-center gap-1 text-xs text-text-dim">
              <span>Made with</span>
              <Heart size={12} className="text-pink fill-pink" />
              <span>for kids</span>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-text-body text-sm mb-4 uppercase tracking-wider text-xs">{t('product')}</h4>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-text-muted hover:text-green transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-text-body text-sm mb-4 uppercase tracking-wider text-xs">{t('company')}</h4>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-text-muted hover:text-green transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-text-body text-sm mb-4 uppercase tracking-wider text-xs">{t('legal')}</h4>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-text-muted hover:text-green transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border/50 text-center text-sm text-text-dim">
          {t('copyright')}
        </div>
      </div>
    </footer>
  );
}

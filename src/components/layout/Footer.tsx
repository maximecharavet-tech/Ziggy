import { useTranslations } from 'next-intl';

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
    { label: t('privacy'), href: '#' },
    { label: t('terms'), href: '#' },
    { label: t('cookies'), href: '#' },
    { label: t('gdpr'), href: '#' },
  ];

  return (
    <footer className="border-t border-border bg-bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-1.5 font-extrabold text-xl text-text-body mb-3">
              Ziggy
              <span className="w-2 h-2 rounded-full bg-green" />
            </div>
            <p className="text-sm text-text-muted">{t('tagline')}</p>
          </div>

          <div>
            <h4 className="font-bold text-text-body text-sm mb-4">{t('product')}</h4>
            <ul className="space-y-2">
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
            <h4 className="font-bold text-text-body text-sm mb-4">{t('company')}</h4>
            <ul className="space-y-2">
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
            <h4 className="font-bold text-text-body text-sm mb-4">{t('legal')}</h4>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-text-muted hover:text-green transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-center text-sm text-text-dim">
          {t('copyright')}
        </div>
      </div>
    </footer>
  );
}

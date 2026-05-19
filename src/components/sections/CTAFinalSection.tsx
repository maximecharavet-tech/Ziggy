import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

export function CTAFinalSection() {
  const t = useTranslations('cta_final');

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center gradient-green-cta rounded-3xl p-12 md:p-16">
        <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">{t('title')}</h2>
        <p className="text-green-100 text-lg mb-8 max-w-2xl mx-auto opacity-90">{t('subtitle')}</p>
        <Button variant="secondary" size="lg" className="bg-white text-green hover:bg-white/90 border-0">
          {t('cta')}
        </Button>
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export function PricingSection() {
  const t = useTranslations('pricing');
  const [yearly, setYearly] = useState(false);

  const plans = [
    {
      name: t('free'),
      price: t('free_price'),
      period: t('free_period'),
      cta: t('free_cta'),
      variant: 'secondary' as const,
      features: [t('free_f1'), t('free_f2'), t('free_f3'), t('free_f4')],
    },
    {
      name: t('family'),
      price: yearly ? t('family_price_yearly') : t('family_price_monthly'),
      period: t('family_period'),
      cta: t('family_cta'),
      variant: 'primary' as const,
      popular: true,
      features: [t('family_f1'), t('family_f2'), t('family_f3'), t('family_f4'), t('family_f5')],
    },
    {
      name: t('school'),
      price: yearly ? t('school_price_yearly') : t('school_price_monthly'),
      period: t('school_period'),
      cta: t('school_cta'),
      variant: 'secondary' as const,
      features: [t('school_f1'), t('school_f2'), t('school_f3'), t('school_f4'), t('school_f5')],
    },
    {
      name: t('enterprise'),
      price: t('enterprise_price'),
      period: '',
      cta: t('enterprise_cta'),
      variant: 'secondary' as const,
      features: [t('enterprise_f1'), t('enterprise_f2'), t('enterprise_f3'), t('enterprise_f4'), t('enterprise_f5')],
    },
  ];

  return (
    <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />

        <div className="flex items-center justify-center gap-3 mb-12">
          <span className={`text-sm font-medium ${!yearly ? 'text-text-body' : 'text-text-dim'}`}>{t('monthly')}</span>
          <button
            onClick={() => setYearly(!yearly)}
            className={`relative w-12 h-6 rounded-full transition-colors ${yearly ? 'bg-green' : 'bg-border'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${yearly ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
          <span className={`text-sm font-medium ${yearly ? 'text-text-body' : 'text-text-dim'}`}>{t('yearly')}</span>
          {yearly && <Badge className="text-xs">{t('save')}</Badge>}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-bg-card rounded-2xl border p-6 flex flex-col ${
                plan.popular ? 'border-green shadow-[0_4px_20px_rgba(34,197,94,0.15)]' : 'border-border'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge>{t('popular')}</Badge>
                </div>
              )}
              <h3 className="text-lg font-bold text-text-body">{plan.name}</h3>
              <div className="mt-4 mb-6">
                <span className="text-3xl font-extrabold text-text-body">{plan.price}</span>
                {plan.period && <span className="text-text-muted text-sm">{plan.period}</span>}
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-text-muted">
                    <Check size={16} className="text-green mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant={plan.variant} size="sm" className="w-full">
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

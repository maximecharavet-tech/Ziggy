'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Sparkles } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
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
    <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        </ScrollReveal>

        {/* Toggle */}
        <ScrollReveal variant="fade" delay={100}>
          <div className="flex items-center justify-center gap-4 mb-14">
            <span className={`text-sm font-semibold transition-colors ${!yearly ? 'text-text-body' : 'text-text-dim'}`}>
              {t('monthly')}
            </span>
            <button
              onClick={() => setYearly(!yearly)}
              className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                yearly ? 'bg-green shadow-[0_0_12px_rgba(34,197,94,0.4)]' : 'bg-border'
              }`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
                  yearly ? 'translate-x-7' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span className={`text-sm font-semibold transition-colors ${yearly ? 'text-text-body' : 'text-text-dim'}`}>
              {t('yearly')}
            </span>
            {yearly && (
              <Badge className="text-xs animate-scale-in">
                <Sparkles size={12} className="mr-1" />
                {t('save')}
              </Badge>
            )}
          </div>
        </ScrollReveal>

        {/* Plans grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, i) => (
            <ScrollReveal key={plan.name} delay={i * 100} variant="fade-up">
              <div
                className={`relative glass rounded-2xl border p-6 flex flex-col h-full transition-all duration-300 hover:-translate-y-1 ${
                  plan.popular
                    ? 'border-green shadow-[0_4px_30px_rgba(34,197,94,0.15)] scale-[1.02]'
                    : 'border-border/50 hover:border-green/30 hover:shadow-lg'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <Badge className="shadow-lg shadow-green/20">
                      <Sparkles size={12} className="mr-1" />
                      {t('popular')}
                    </Badge>
                  </div>
                )}
                <h3 className="text-lg font-bold text-text-body">{plan.name}</h3>
                <div className="mt-4 mb-6">
                  <span className="text-4xl font-extrabold text-text-body">{plan.price}</span>
                  {plan.period && <span className="text-text-muted text-sm ml-1">{plan.period}</span>}
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-text-muted">
                      <div className="w-5 h-5 rounded-full bg-green/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check size={12} className="text-green" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <Button href="/signup" variant={plan.variant} size="sm" className="w-full">
                  {plan.cta}
                </Button>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

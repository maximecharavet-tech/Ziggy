'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ScrollReveal } from '@/components/ui/ScrollReveal';

function FAQItem({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <ScrollReveal delay={index * 80} variant="fade-up">
      <div className="border-b border-border/50 last:border-b-0">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between py-5 text-left group"
        >
          <span className="font-bold text-text-body pr-4 group-hover:text-green transition-colors">
            {question}
          </span>
          <div className={`w-8 h-8 rounded-full bg-green/10 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${open ? 'bg-green/20 rotate-180' : ''}`}>
            <ChevronDown size={18} className="text-green" />
          </div>
        </button>
        <div className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr] pb-5' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <p className="text-sm text-text-muted leading-relaxed">{answer}</p>
          </div>
        </div>
      </div>
    </ScrollReveal>
  );
}

export function FAQSection() {
  const t = useTranslations('faq');

  const faqs = [
    { q: t('q1'), a: t('a1') },
    { q: t('q2'), a: t('a2') },
    { q: t('q3'), a: t('a3') },
    { q: t('q4'), a: t('a4') },
    { q: t('q5'), a: t('a5') },
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-16">
            <div className="w-16 h-16 rounded-2xl bg-green/10 flex items-center justify-center mx-auto mb-6">
              <HelpCircle size={30} className="text-green" />
            </div>
            <SectionHeading title={t('title')} subtitle="" />
          </div>
        </ScrollReveal>
        <div className="glass rounded-2xl border border-border/50 px-6 sm:px-8 shadow-lg">
          {faqs.map((faq, i) => (
            <FAQItem key={faq.q} question={faq.q} answer={faq.a} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

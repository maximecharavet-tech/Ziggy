'use client';

import { useTranslations } from 'next-intl';
import { Star, Quote } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { GlowCard } from '@/components/ui/GlowCard';

export function ReviewsSection() {
  const t = useTranslations('reviews');

  const reviews = [
    { text: t('review1_text'), author: t('review1_author'), role: t('review1_role') },
    { text: t('review2_text'), author: t('review2_author'), role: t('review2_role') },
    { text: t('review3_text'), author: t('review3_author'), role: t('review3_role') },
  ];

  const avatarColors = ['bg-green/20 text-green', 'bg-blue/20 text-blue', 'bg-purple/20 text-purple'];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 gradient-mesh relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <ScrollReveal>
          <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        </ScrollReveal>
        <div className="grid md:grid-cols-3 gap-6">
          {reviews.map((r, i) => (
            <ScrollReveal key={r.author} delay={i * 120} variant="fade-up">
              <GlowCard className="h-full">
                <div className="flex flex-col h-full">
                  <Quote size={24} className="text-green/30 mb-4" />
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} size={16} className="fill-yellow text-yellow" />
                    ))}
                  </div>
                  <p className="text-sm text-text-body leading-relaxed mb-6 flex-1">
                    &ldquo;{r.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                    <div className={`w-10 h-10 rounded-full ${avatarColors[i]} flex items-center justify-center font-bold text-sm`}>
                      {r.author.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-text-body">{r.author}</div>
                      <div className="text-xs text-text-muted">{r.role}</div>
                    </div>
                  </div>
                </div>
              </GlowCard>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

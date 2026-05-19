import { useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Card } from '@/components/ui/Card';

export function ReviewsSection() {
  const t = useTranslations('reviews');

  const reviews = [
    { text: t('review1_text'), author: t('review1_author'), role: t('review1_role') },
    { text: t('review2_text'), author: t('review2_author'), role: t('review2_role') },
    { text: t('review3_text'), author: t('review3_author'), role: t('review3_role') },
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 gradient-green-soft">
      <div className="max-w-7xl mx-auto">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <div className="grid md:grid-cols-3 gap-6">
          {reviews.map((r) => (
            <Card key={r.author}>
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={16} className="fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm text-text-body mb-6 italic">&ldquo;{r.text}&rdquo;</p>
              <div>
                <div className="font-bold text-sm text-text-body">{r.author}</div>
                <div className="text-xs text-text-muted">{r.role}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

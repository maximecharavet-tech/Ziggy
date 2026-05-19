import { useTranslations } from 'next-intl';
import { Bot, ShieldCheck, Brain, Globe, Trophy, BookOpen } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Card } from '@/components/ui/Card';

export function FeaturesSection() {
  const t = useTranslations('features');

  const features = [
    { icon: Bot, title: t('ai_companion'), desc: t('ai_companion_desc') },
    { icon: ShieldCheck, title: t('safe_space'), desc: t('safe_space_desc') },
    { icon: Brain, title: t('cognitive_tracking'), desc: t('cognitive_tracking_desc') },
    { icon: Globe, title: t('multilingual'), desc: t('multilingual_desc') },
    { icon: Trophy, title: t('gamified'), desc: t('gamified_desc') },
    { icon: BookOpen, title: t('curriculum'), desc: t('curriculum_desc') },
  ];

  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <Card key={f.title} hover>
              <div className="w-12 h-12 rounded-xl bg-green/10 flex items-center justify-center mb-4">
                <f.icon size={24} className="text-green" />
              </div>
              <h3 className="text-lg font-bold text-text-body mb-2">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

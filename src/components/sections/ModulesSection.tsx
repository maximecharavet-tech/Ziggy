import { useTranslations } from 'next-intl';
import { Cpu, MessageSquare, Calculator, Palette, Sun } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function ModulesSection() {
  const t = useTranslations('modules');

  const modules = [
    { icon: Cpu, title: t('ai_basics'), desc: t('ai_basics_desc'), ages: t('ai_basics_ages') },
    { icon: MessageSquare, title: t('prompt_champion'), desc: t('prompt_champion_desc'), ages: t('prompt_champion_ages') },
    { icon: Calculator, title: t('math_logic'), desc: t('math_logic_desc'), ages: t('math_logic_ages') },
    { icon: Palette, title: t('creativity'), desc: t('creativity_desc'), ages: t('creativity_ages') },
    { icon: Sun, title: t('holiday'), desc: t('holiday_desc'), ages: t('holiday_ages') },
  ];

  return (
    <section id="modules" className="py-24 px-4 sm:px-6 lg:px-8 gradient-green-soft">
      <div className="max-w-7xl mx-auto">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((m) => (
            <Card key={m.title} hover>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-green/10 flex items-center justify-center">
                  <m.icon size={24} className="text-green" />
                </div>
                <Badge className="text-xs">{m.ages}</Badge>
              </div>
              <h3 className="text-lg font-bold text-text-body mb-2">{m.title}</h3>
              <p className="text-sm text-text-muted">{m.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

import { setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { ZiggyChat } from '@/components/ziggy/ZiggyChat';
import { ZiggyRobot } from '@/components/ziggy/ZiggyRobot';

export default async function DemoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <DemoContent />;
}

function DemoContent() {
  const t = useTranslations('demo');

  return (
    <section id="demo" className="pt-32 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <ZiggyRobot size={120} />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-text-body mb-4">{t('title')}</h1>
          <p className="text-text-muted text-lg">{t('subtitle')}</p>
        </div>
        <ZiggyChat />
      </div>
    </section>
  );
}

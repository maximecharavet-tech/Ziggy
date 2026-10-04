'use client';

import { useTranslations } from 'next-intl';
import { Castle } from 'lucide-react';
import { AppPage } from '@/components/learn/AppPage';
import { PalaceApp } from '@/components/palace/PalaceApp';

export function PalacePageContent() {
  const t = useTranslations('palace');
  return (
    <AppPage eyebrow={<><Castle size={15} /> {t('eyebrow')}</>} title={t('title')} subtitle={t('subtitle')} color="#F59E0B">
      <PalaceApp />
    </AppPage>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { Archive } from 'lucide-react';
import { AppPage } from '@/components/learn/AppPage';
import { MemoApp } from '@/components/memo/MemoApp';
import { ForgettingCurve } from '@/components/learn/ForgettingCurve';

export function MemoPageContent() {
  const t = useTranslations('memo');
  return (
    <AppPage eyebrow={<><Archive size={15} /> {t('eyebrow')}</>} title={t('title')} subtitle={t('subtitle')} color="#8B5CF6">
      <MemoApp />
      <div className="mx-auto mt-16 max-w-3xl">
        <ForgettingCurve />
      </div>
    </AppPage>
  );
}

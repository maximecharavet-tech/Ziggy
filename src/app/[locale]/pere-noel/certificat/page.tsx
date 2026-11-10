import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Certificate } from '@/components/santa/certificate/Certificate';
import { alternatesFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'fr' ? 'Certificat Enfant sage' : 'Kind Heart Certificate', description: locale === 'fr' ? 'Créez un diplôme à imprimer pour célébrer un moment de fierté.' : 'Create a printable certificate to celebrate a proud moment.', alternates: alternatesFor(locale, '/pere-noel/certificat') };
}

export default async function CertificatePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale); return <Certificate />;
}

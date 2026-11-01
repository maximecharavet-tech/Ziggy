import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { JsonLd } from './JsonLd';

export type LandingLink = { href: string; label: string; text?: string };

/** Simple, text-first layout shared by the French SEO landing pages. */
export function LandingShell({ h1, intro, sections, jsonLd, children }: {
  h1: string;
  intro: string[];
  sections: { title: string; links: LandingLink[] }[];
  jsonLd: object[];
  children?: ReactNode;
}) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <JsonLd data={jsonLd} />
      <h1 className="font-display text-3xl sm:text-5xl font-bold text-text-body mb-6">{h1}</h1>
      {intro.map((p) => (
        <p key={p} className="text-lg text-text-muted leading-relaxed mb-4">{p}</p>
      ))}
      {sections.map((s) => (
        <section key={s.title} className="mt-12">
          <h2 className="text-2xl font-bold text-text-body mb-4">{s.title}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {s.links.map((l) => (
              <li key={`${l.href}-${l.label}`} className="rounded-2xl border border-border/60 bg-bg-card p-4">
                <Link href={l.href as '/games'} className="font-semibold text-green hover:underline">{l.label}</Link>
                {l.text && <p className="mt-1 text-sm text-text-muted">{l.text}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {children}
    </div>
  );
}

import type { ReactNode } from 'react';

interface SectionHeadingProps {
  title: string;
  subtitle: string;
  /** Small coloured label above the title. */
  eyebrow?: ReactNode;
  align?: 'center' | 'start';
}

export function SectionHeading({ title, subtitle, eyebrow, align = 'center' }: SectionHeadingProps) {
  const centered = align === 'center';
  return (
    <div className={`mb-14 ${centered ? 'text-center' : 'text-start'}`}>
      {eyebrow && <div className={`eyebrow text-green mb-4 ${centered ? 'justify-center' : ''}`}>{eyebrow}</div>}
      <h2 className="text-3xl md:text-5xl font-bold text-text-body mb-4 text-balance leading-[1.1]">{title}</h2>
      <p className={`text-text-muted text-lg max-w-2xl leading-relaxed ${centered ? 'mx-auto' : ''}`}>{subtitle}</p>
    </div>
  );
}

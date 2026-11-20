import type { CSSProperties, ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { JsonLd } from './JsonLd';
import { MagicBackdrop } from '@/components/sections/magic/MagicBackdrop';
import { Stagger } from '@/components/sections/magic/Stagger';
import { rise } from '@/components/sections/magic/rise';

export type LandingLink = { href: string; label: string; text?: string };

const THEMES = {
  /** Daylight: clay blobs and sparkles. */
  day: { sky: 'day' as const, band: 'bg-[linear-gradient(160deg,#FFF4E2_0%,#FDE7DF_50%,#E8F4FF_100%)] dark:bg-[linear-gradient(160deg,#2b2016,#1b1630_60%,#10203a)]', h1: 'text-ink dark:text-text-body', intro: 'text-ink-soft dark:text-text-muted', tint: '#7FC85C', title: 'text-leaf-ink dark:text-leaf' },
  /** Bedtime: a night sky with the moon. */
  night: { sky: 'night' as const, band: 'bg-[radial-gradient(90%_70%_at_80%_0%,#3b2f8f_0%,#1b1650_45%,#0e1032_100%)]', h1: 'text-white', intro: 'text-[#e6e2ff]', tint: '#8B7CF6', title: 'text-grape-ink dark:text-[#c9c3ff]' },
};

/** A code-made moon (no image): warm disc, soft halo, three craters. */
function Moon() {
  return (
    <div className="absolute end-[7%] top-8 h-20 w-20 sm:end-[9%] sm:top-10 sm:h-28 sm:w-28" aria-hidden="true">
      <div className="absolute -inset-[70%] rounded-full bg-[radial-gradient(circle,rgba(255,226,160,0.3)_0%,rgba(255,214,140,0.1)_38%,transparent_68%)]" />
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_34%_32%,#fffaf0_0%,#ffefc4_38%,#f6d58f_72%,#e8bd72_100%)] shadow-[inset_-10px_-12px_24px_rgba(190,130,60,0.35)]" />
      <div className="absolute left-[56%] top-[24%] h-[16%] w-[16%] rounded-full bg-[#e9c37f]/45" />
      <div className="absolute left-[28%] top-[58%] h-[11%] w-[11%] rounded-full bg-[#e9c37f]/40" />
      <div className="absolute left-[62%] top-[64%] h-[8%] w-[8%] rounded-full bg-[#e9c37f]/35" />
    </div>
  );
}

/**
 * Text-first layout shared by the French SEO landing pages: a sky band with
 * the title, then every link as a big toy card (the whole card is the link).
 */
export function LandingShell({ h1, intro, sections, jsonLd, children, theme = 'day' }: {
  h1: string;
  intro: string[];
  sections: { title: string; links: LandingLink[] }[];
  jsonLd: object[];
  children?: ReactNode;
  theme?: keyof typeof THEMES;
}) {
  const th = THEMES[theme];
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-24 sm:px-6 sm:pb-24 sm:pt-28">
      <JsonLd data={jsonLd} />
      <header className={`relative isolate overflow-hidden rounded-[2.25rem] px-6 py-10 shadow-lifted sm:rounded-[2.75rem] sm:px-12 sm:py-14 ${th.band}`}>
        <MagicBackdrop variant={th.sky} stars={theme === 'night' ? 16 : 9} clouds={theme === 'night' ? 0 : 2} snow={theme === 'night'} seed={theme === 'night' ? 31 : 3} />
        {theme === 'night' ? <Moon /> : null}
        <div className="relative max-w-3xl">
          <h1 className={`mb-6 font-display text-3xl font-bold text-balance sm:text-5xl ${th.h1} ${theme === 'night' ? 'pe-24 sm:pe-32' : ''}`}>{h1}</h1>
          {intro.map((p) => (
            <p key={p} className={`mb-4 text-lg leading-relaxed last:mb-0 ${th.intro}`}>{p}</p>
          ))}
        </div>
      </header>
      {sections.map((s) => (
        <section key={s.title} className="mt-14">
          <h2 className="mb-6 font-display text-2xl font-bold text-text-body sm:text-3xl">{s.title}</h2>
          <Stagger as="ul" className="grid gap-x-5 gap-y-6 sm:grid-cols-2">
            {s.links.map((l, i) => (
              <li key={`${l.href}-${l.label}`} className="mg-rise" style={rise(i)}>
                <Link
                  href={l.href as '/games'}
                  className="mg-card flex h-full min-h-[5.5rem] flex-col justify-center px-5 py-4"
                  style={{ '--tint': th.tint, '--mg-tilt': i % 2 ? '0.5deg' : '-0.5deg' } as CSSProperties}
                >
                  <span className={`font-display text-lg font-semibold leading-snug ${th.title}`}>{l.label}</span>
                  {l.text && <span className="mt-1 text-[0.95rem] leading-snug text-text-muted">{l.text}</span>}
                </Link>
              </li>
            ))}
          </Stagger>
        </section>
      ))}
      {children}
    </div>
  );
}

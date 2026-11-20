'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import { FlaskConical, Database, ScanEye, Users, ShieldCheck } from 'lucide-react';
import { AiLab } from '@/components/lab/AiLab';
import { SayButton } from '@/components/arcade/read-aloud';
import { SplitWords, Spotlight } from '@/components/ui/motion-primitives';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { useSound } from '@/hooks/useSound';
import { tr, type L } from '@/lib/i18n-text';
import { EASE_OUT } from '@/lib/motion';
import { SOUND_NAMES, type SoundName } from '@/lib/sfx/catalog';
import { GROUP_LABELS, SOUND_LABELS, type SoundGroup } from '@/lib/sfx/labels';
import { playSound, setMuted } from '@/lib/sound';
import { useReducedMotion } from '@/lib/use-reduced-motion';

const HOW = [
  { key: 'data', icon: Database, color: '#F59E0B' },
  { key: 'see', icon: ScanEye, color: '#5FB6EA' },
  { key: 'vote', icon: Users, color: '#7FC85C' },
] as const;

export function LabPageContent() {
  const t = useTranslations('lab');
  return (
    <div className="relative min-h-screen overflow-clip pt-28 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-32 left-1/4 h-[30rem] w-[30rem] rounded-full bg-sky/15 blur-3xl" />
        <div className="absolute top-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-peach/40 blur-3xl dark:bg-peach/10" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <header className="text-center">
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="inline-flex items-center gap-2 rounded-full border border-sky/30 bg-sky/10 px-4 py-1.5 text-sm font-bold text-sky"
          >
            <FlaskConical size={15} /> {t('eyebrow')}
          </motion.span>
          <h1 className="mt-5 font-display text-4xl font-bold text-text-body sm:text-6xl text-balance">
            <SplitWords text={t('title')} />
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25, ease: EASE_OUT }}
            className="mx-auto mt-4 max-w-2xl text-lg text-text-muted"
          >
            {t('subtitle')}
          </motion.p>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.3, ease: EASE_OUT }}
          className="mt-12"
        >
          <AiLab />
        </motion.section>

        <section className="mt-20">
          <ScrollReveal>
            <h2 className="text-center font-display text-3xl font-bold text-text-body sm:text-4xl">{t('how_title')}</h2>
          </ScrollReveal>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {HOW.map((h, i) => (
              <ScrollReveal key={h.key} delay={i * 80}>
                <Spotlight color={h.color} className="h-full rounded-3xl border border-border/50 glass-strong p-6 lift">
                  <div
                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                    style={{ backgroundColor: h.color, boxShadow: `0 10px 24px -8px ${h.color}` }}
                  >
                    <h.icon size={22} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-text-dim">{i + 1}</p>
                  <h3 className="mt-1 font-display text-xl font-bold text-text-body">{t(`how.${h.key}.title`)}</h3>
                  <p className="mt-2 text-text-muted leading-relaxed">{t(`how.${h.key}.desc`)}</p>
                </Spotlight>
              </ScrollReveal>
            ))}
          </div>
          <p className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-text-dim">
            <ShieldCheck size={16} className="text-green" /> {t('private')}
          </p>
        </section>

        <SoundGallery />
      </div>
    </div>
  );
}

const SOUNDS_TITLE: L = { fr: 'Sons rigolos', en: 'Funny sounds' };
const SOUNDS_INTRO: L = {
  fr: 'Touche un bouton pour écouter un son de Ziggy. Ils sont tous fabriqués par l’ordinateur, en direct.',
  en: 'Tap a button to hear one of Ziggy’s sounds. The computer makes each one live.',
};
const MUTED_NOTE: L = { fr: 'Le son est coupé.', en: 'Sound is off.' };
const UNMUTE: L = { fr: 'Activer le son', en: 'Turn sound on' };

const GROUPS = (Object.keys(GROUP_LABELS) as SoundGroup[]).map((group) => ({
  group,
  names: SOUND_NAMES.filter((n) => SOUND_LABELS[n].group === group),
}));

/** Every sound effect of the site, one big button each, to listen to them all. */
function SoundGallery() {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const { muted } = useSound();
  const [last, setLast] = useState<SoundName | null>(null);
  const title = tr(SOUNDS_TITLE, locale);
  const intro = tr(SOUNDS_INTRO, locale);

  return (
    <section className="mt-20" aria-labelledby="funny-sounds" data-testid="sound-gallery">
      <ScrollReveal>
        <div className="flex items-center justify-center gap-3">
          <h2 id="funny-sounds" className="font-display text-3xl font-bold text-text-body sm:text-4xl">
            <span aria-hidden="true">🔔 </span>
            {title}
          </h2>
          <SayButton texts={[title, intro]} locale={locale} size="sm" />
        </div>
        <p className="mx-auto mt-3 max-w-2xl text-center text-text-muted">{intro}</p>
      </ScrollReveal>

      {muted && (
        <div role="status" className="mx-auto mt-6 flex max-w-md flex-wrap items-center justify-center gap-3 rounded-2xl border border-border/60 bg-bg-card/80 px-4 py-3 text-sm font-semibold text-text-muted">
          <span aria-hidden="true">🔇</span> {tr(MUTED_NOTE, locale)}
          <button type="button" onClick={() => setMuted(false)} className="press min-h-11 rounded-full bg-green px-4 font-bold text-white">
            {tr(UNMUTE, locale)}
          </button>
        </div>
      )}

      <div className="mt-8 space-y-8">
        {GROUPS.map(({ group, names }) => (
          <div key={group}>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-text-dim">{tr(GROUP_LABELS[group], locale)}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {names.map((name) => {
                const meta = SOUND_LABELS[name];
                return (
                  <motion.button
                    key={name}
                    type="button"
                    whileTap={reduced ? undefined : { scale: 0.93 }}
                    onClick={() => {
                      playSound(name);
                      setLast(name);
                    }}
                    title={tr(meta.about, locale)}
                    data-sound={name}
                    className={`flex min-h-[72px] min-w-0 items-center gap-3 rounded-2xl border px-3 py-2 text-start shadow-sm transition-colors glass-strong hover:border-green/50 hover:bg-green/5 ${last === name ? 'border-green/70 ring-2 ring-green/30' : 'border-border/60'}`}
                  >
                    <span aria-hidden="true" className="text-3xl leading-none">
                      {meta.emoji}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold leading-tight text-text-body">{tr(meta.label, locale)}</span>
                      <code className="block truncate text-[11px] text-text-dim" aria-hidden="true">
                        {name}
                      </code>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

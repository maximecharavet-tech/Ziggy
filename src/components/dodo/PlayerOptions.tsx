'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { tr, type L } from '@/lib/i18n-text';
import { KEEP_TITLE } from './KeepForTonight';
import { SPEEDS, TEXT_SIZES, updateDodo, type DodoSettings } from '@/lib/dodo/client';

const T = {
  title: { fr: 'Réglages', en: 'Settings' },
  close: { fr: 'Fermer les réglages', en: 'Close settings' },
  size: { fr: 'Taille du texte', en: 'Text size' },
  smaller: { fr: 'Texte plus petit', en: 'Smaller text' },
  bigger: { fr: 'Texte plus grand', en: 'Bigger text' },
  text: { fr: 'Texte à l’écran', en: 'Text on screen' },
  shown: { fr: 'Affiché', en: 'Shown' },
  hidden: { fr: 'Caché', en: 'Hidden' },
  highlight: { fr: 'Les mots s’allument', en: 'Words light up' },
  word: { fr: 'Mot à mot', en: 'Word by word' },
  line: { fr: 'Ligne par ligne', en: 'Line by line' },
  speed: { fr: 'Vitesse de la voix', en: 'Voice speed' },
  slow: { fr: 'Tout doux', en: 'Gentle' },
  normal: { fr: 'Normale', en: 'Normal' },
  fast: { fr: 'Un peu plus vite', en: 'A bit faster' },
  fallback: { fr: 'Sans enregistrement', en: 'Without a recording' },
  read: { fr: 'Lecture douce', en: 'Quiet reading' },
  device: { fr: 'Voix de l’appareil', en: 'Device voice' },
  narration: { fr: 'Comment écouter l’histoire', en: 'How to listen to the story' },
  voice: { fr: 'Voix qui lit', en: 'Reading voice' },
  voiceHint: { fr: 'Ziggy lit, les mots s’allument', en: 'Ziggy reads, the words light up' },
  music: { fr: 'Version musicale', en: 'Musical version' },
  musicHint: { fr: 'L’histoire chantée, les paroles s’allument', en: 'The story sung, the lyrics light up' },
  versions: { fr: 'Quelle chanson ?', en: 'Which song?' },
} satisfies Record<string, L>;

/** Grown-up settings, in a calm sheet (bottom sheet on phones, side panel on big screens). */
export function PlayerOptions({
  locale,
  settings,
  recorded,
  hasMusic = false,
  versions = [],
  version,
  onVersion,
  keep,
  onClose,
}: {
  locale: string;
  settings: DodoSettings;
  /** The story has Ziggy's recording (the fallback choice is hidden then). */
  recorded: boolean;
  /** The story has a "Version musicale" in this language (the choice is shown only then). */
  hasMusic?: boolean;
  /** The sung versions (the choice is shown when there are 2 or more). */
  versions?: { id: string; label: string }[];
  version?: string;
  onVersion?: (id: string) => void;
  /** The « Garder pour ce soir » block (offline listening), grown-up area. */
  keep?: ReactNode;
  onClose: () => void;
}) {
  const musical = hasMusic && settings.narration === 'music';
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('button')?.focus();
    return () => prev?.focus?.();
  }, []);
  const size = settings.textSize;
  return (
    <div className="absolute inset-0 z-[70] flex items-end justify-center landscape:items-stretch landscape:justify-end" role="presentation">
      <motion.button
        type="button"
        aria-label={tr(T.close, locale)}
        className="absolute inset-0 cursor-default bg-[#03040f]/55"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={tr(T.title, locale)}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative max-h-[86dvh] w-full overflow-y-auto rounded-t-[2rem] bg-[#0d1137] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white shadow-[0_-20px_60px_rgba(0,0,0,.5)] ring-1 ring-white/10 landscape:m-3 landscape:max-h-none landscape:w-[24rem] landscape:rounded-[1.75rem]"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20 landscape:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">⚙️ {tr(T.title, locale)}</h2>
          <button
            type="button"
            onClick={onClose}
            data-close=""
            aria-label={tr(T.close, locale)}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200"
          >
            ✕
          </button>
        </div>

        {hasMusic ? (
          <Group label={tr(T.narration, locale)}>
            <NarrationChoice locale={locale} value={settings.narration} />
          </Group>
        ) : null}

        {musical && versions.length > 1 && version && onVersion ? (
          <Group label={tr(T.versions, locale)}>
            <VersionChoice locale={locale} versions={versions} value={version} onChange={onVersion} />
          </Group>
        ) : null}

        {keep ? <Group label={tr(KEEP_TITLE, locale)}>{keep}</Group> : null}

        <Group label={tr(T.size, locale)}>
          <div className="flex items-center gap-3">
            <Round label={tr(T.smaller, locale)} disabled={size <= 0} onClick={() => updateDodo({ textSize: size - 1 })}>
              <span className="text-base">A−</span>
            </Round>
            <div className="flex flex-1 items-end justify-center gap-1.5" aria-hidden="true">
              {TEXT_SIZES.map((_, i) => (
                <span key={i} className={`rounded-full ${i <= size ? 'bg-amber-200' : 'bg-white/20'}`} style={{ width: 8, height: 10 + i * 5 }} />
              ))}
            </div>
            <Round label={tr(T.bigger, locale)} disabled={size >= TEXT_SIZES.length - 1} onClick={() => updateDodo({ textSize: size + 1 })}>
              <span className="text-xl">A+</span>
            </Round>
          </div>
        </Group>

        <Group label={tr(T.text, locale)}>
          <Choice
            value={settings.showText ? 'on' : 'off'}
            options={[
              { v: 'on', label: `👀 ${tr(T.shown, locale)}` },
              { v: 'off', label: `🙈 ${tr(T.hidden, locale)}` },
            ]}
            onChange={(v) => updateDodo({ showText: v === 'on' })}
            label={tr(T.text, locale)}
          />
        </Group>

        <Group label={tr(T.highlight, locale)}>
          <Choice
            value={settings.highlight}
            options={[
              { v: 'word', label: `✨ ${tr(T.word, locale)}` },
              { v: 'line', label: `〰️ ${tr(T.line, locale)}` },
            ]}
            onChange={(v) => updateDodo({ highlight: v })}
            label={tr(T.highlight, locale)}
          />
        </Group>

        {/* A song is not sped up: the voice speed is for Ziggy's reading only. */}
        {!musical ? (
          <>
            <Group label={tr(T.speed, locale)}>
              <Choice
                value={String(settings.speed)}
                options={SPEEDS.map((s) => ({ v: String(s), label: s < 1 ? `🐢 ${tr(T.slow, locale)}` : s > 1 ? `🐇 ${tr(T.fast, locale)}` : tr(T.normal, locale) }))}
                onChange={(v) => updateDodo({ speed: Number(v) })}
                label={tr(T.speed, locale)}
              />
            </Group>
          </>
        ) : null}

        {!recorded && !musical ? (
          <Group label={tr(T.fallback, locale)}>
            <Choice
              value={settings.fallback}
              options={[
                { v: 'read', label: `📖 ${tr(T.read, locale)}` },
                { v: 'device', label: `🗣️ ${tr(T.device, locale)}` },
              ]}
              onChange={(v) => updateDodo({ fallback: v })}
              label={tr(T.fallback, locale)}
            />
          </Group>
        ) : null}

      </motion.div>
    </div>
  );
}

/**
 * "Voix qui lit" / "Version musicale": two big cards a child can pick (saved on
 * this device). Shown only for stories that have a sung track.
 */
export function NarrationChoice({ locale, value, compact = false }: { locale: string; value: DodoSettings['narration']; compact?: boolean }) {
  // The song first: it has priority when the story has one.
  const options = [
    { v: 'music' as const, icon: '🎵', label: tr(T.music, locale), hint: tr(T.musicHint, locale) },
    { v: 'voice' as const, icon: '📖', label: tr(T.voice, locale), hint: tr(T.voiceHint, locale) },
  ];
  return (
    <div role="radiogroup" aria-label={tr(T.narration, locale)} className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const on = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => updateDodo({ narration: o.v })}
            className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-3 text-center font-bold ring-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 ${compact ? 'min-h-14 py-2' : 'min-h-24 py-3'} ${
              on ? 'bg-amber-200 text-[#24164a] shadow-[0_6px_24px_rgba(253,230,138,.3)] ring-amber-100' : 'bg-white/[0.06] text-white/85 ring-white/10 hover:bg-white/10'
            }`}
          >
            <span aria-hidden="true" className={compact ? 'text-2xl leading-none' : 'text-3xl leading-none'}>
              {o.icon}
            </span>
            <span className={compact ? 'text-sm' : 'text-base'}>{o.label}</span>
            {!compact ? <span className={`text-xs font-semibold ${on ? 'text-[#24164a]/75' : 'text-white/55'}`}>{o.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** « Version 1 » / « Version 2 »…: which sung version to play (saved per story on this device). */
export function VersionChoice({ locale, versions, value, onChange }: { locale: string; versions: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label={tr(T.versions, locale)} className="flex flex-wrap gap-1 rounded-2xl bg-white/[0.06] p-1 ring-1 ring-white/10">
      {versions.map((v) => (
        <button
          key={v.id}
          type="button"
          role="radio"
          aria-checked={value === v.id}
          onClick={() => onChange(v.id)}
          className={`min-h-11 flex-1 rounded-xl px-3 py-2 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 ${value === v.id ? 'bg-amber-200 text-[#24164a] shadow' : 'text-white/80 hover:bg-white/10'}`}
        >
          🎶 {v.label}
        </button>
      ))}
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-white/55">{label}</h3>
      {children}
    </section>
  );
}

function Round({ children, label, onClick, disabled }: { children: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-12 w-12 place-items-center rounded-full bg-white/10 font-display font-bold ring-1 ring-white/15 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function Choice<V extends string>({ value, options, onChange, label }: { value: string; options: { v: V; label: string }[]; onChange: (v: V) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-2xl bg-white/[0.06] p-1 ring-1 ring-white/10">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`min-h-11 flex-1 rounded-xl px-2 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 ${value === o.v ? 'bg-amber-200 text-[#24164a] shadow' : 'text-white/80 hover:bg-white/10'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

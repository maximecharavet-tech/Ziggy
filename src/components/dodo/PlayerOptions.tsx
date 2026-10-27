'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { tr, type L } from '@/lib/i18n-text';
import { SLEEP_SOUNDS } from '@/lib/dodo/sound/catalog';
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
  sounds: { fr: 'Sons du sommeil', en: 'Sleep sounds' },
  volume: { fr: 'Volume des sons', en: 'Sounds volume' },
  timer: { fr: 'Après l’histoire', en: 'After the story' },
  timerOff: { fr: 'S’arrêtent avec l’histoire', en: 'Stop with the story' },
} satisfies Record<string, L>;

export const TIMERS = [0, 10, 20, 30, 45] as const;

/** Grown-up settings, in a calm sheet (bottom sheet on phones, side panel on big screens). */
export function PlayerOptions({
  locale,
  settings,
  recorded,
  onClose,
  onSound,
  onVolume,
}: {
  locale: string;
  settings: DodoSettings;
  /** The story has Ziggy's recording (the fallback choice is hidden then). */
  recorded: boolean;
  onClose: () => void;
  onSound: (id: string) => void;
  onVolume: (v: number) => void;
}) {
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
            aria-label={tr(T.close, locale)}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200"
          >
            ✕
          </button>
        </div>

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

        <Group label={tr(T.speed, locale)}>
          <Choice
            value={String(settings.speed)}
            options={SPEEDS.map((s) => ({ v: String(s), label: s < 1 ? `🐢 ${tr(T.slow, locale)}` : s > 1 ? `🐇 ${tr(T.fast, locale)}` : tr(T.normal, locale) }))}
            onChange={(v) => updateDodo({ speed: Number(v) })}
            label={tr(T.speed, locale)}
          />
        </Group>

        {!recorded ? (
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

        <Group label={tr(T.sounds, locale)}>
          <SoundChips locale={locale} value={settings.sound} onChange={onSound} />
          <label className="mt-3 flex items-center gap-3 text-sm text-white/75">
            <span aria-hidden="true">🔉</span>
            <span className="sr-only">{tr(T.volume, locale)}</span>
            <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => onVolume(Number(e.target.value))} className="h-8 flex-1 accent-amber-200" />
            <span aria-hidden="true">🔊</span>
          </label>
        </Group>

        <Group label={tr(T.timer, locale)}>
          <TimerChips locale={locale} value={settings.timer} onChange={(timer) => updateDodo({ timer })} />
        </Group>
      </motion.div>
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

export function SoundChips({ locale, value, onChange, className = '' }: { locale: string; value: string; onChange: (id: string) => void; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`} role="radiogroup" aria-label={tr(T.sounds, locale)}>
      {SLEEP_SOUNDS.map((s) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={value === s.id}
          title={tr(s.about, locale)}
          onClick={() => onChange(s.id)}
          className={`min-h-10 rounded-full px-3 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 ${value === s.id ? 'bg-amber-200 text-[#24164a]' : 'bg-white/10 text-white/85 hover:bg-white/20'}`}
        >
          {s.emoji} {tr(s.name, locale)}
          {s.headphones ? <span className="ms-1 text-xs opacity-70">🎧</span> : null}
        </button>
      ))}
    </div>
  );
}

export function TimerChips({ locale, value, onChange, className = '' }: { locale: string; value: number; onChange: (v: (typeof TIMERS)[number]) => void; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`} role="radiogroup" aria-label={tr(T.timer, locale)}>
      {TIMERS.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          onClick={() => onChange(t)}
          className={`min-h-10 rounded-full px-3 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 ${value === t ? 'bg-white text-[#24164a]' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
        >
          {t === 0 ? tr(T.timerOff, locale) : `+${t} min`}
        </button>
      ))}
    </div>
  );
}

'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { tr } from '@/lib/i18n-text';
import { COLORS, MAGIC, luminance } from '@/coloring/palette';
import { T } from '@/coloring/text';

const css = (stops: string[], angle: number) => `linear-gradient(${angle + 90}deg, ${stops.join(', ')})`;

/** Big round crayons: 24 colours and the magic fills. */
export function Palette({ value, onPick, locale, disabled = false }: { value: string; onPick: (id: string) => void; locale: string; disabled?: boolean }) {
  const reduce = useReducedMotion();
  const swatch = (id: string, name: string, bg: string, dark: boolean, magic: boolean) => {
    const on = value === id;
    return (
      <motion.button
        key={id}
        type="button"
        onClick={() => onPick(id)}
        aria-label={name}
        aria-pressed={on}
        title={name}
        disabled={disabled}
        whileTap={reduce ? undefined : { scale: 0.86 }}
        animate={{ scale: on ? 1.08 : 1 }}
        transition={{ type: 'spring', duration: 0.35, bounce: 0.4 }}
        className={`relative h-14 w-14 shrink-0 rounded-full shadow-[inset_0_-5px_0_rgba(0,0,0,0.12),0_4px_10px_-4px_rgba(0,0,0,0.3)] outline-none transition-[box-shadow] focus-visible:ring-4 focus-visible:ring-sky disabled:opacity-40 ${
          on ? 'ring-4 ring-[#7C3AED] ring-offset-2 ring-offset-white dark:ring-offset-[#1b1640]' : id === 'white' ? 'ring-1 ring-black/15' : ''
        }`}
        style={{ background: bg }}
      >
        <span aria-hidden="true" className="absolute left-2.5 top-2 h-3 w-5 rotate-[-25deg] rounded-full bg-white/45" />
        {magic && !on && (
          <span aria-hidden="true" className="absolute -right-1 -top-1 text-sm drop-shadow">
            ✨
          </span>
        )}
        {on && (
          <span aria-hidden="true" className={`absolute inset-0 grid place-items-center text-xl font-black ${dark ? 'text-white' : 'text-[#2B2D42]'}`}>
            ✓
          </span>
        )}
      </motion.button>
    );
  };
  return (
    <div
      role="group"
      aria-label={tr(T.palette, locale)}
      className="grid auto-cols-max grid-flow-col grid-rows-2 gap-2 overflow-x-auto overscroll-contain p-1.5 [scrollbar-width:thin] landscape:h-full landscape:content-start landscape:grid-flow-row landscape:grid-cols-3 landscape:grid-rows-none landscape:overflow-x-hidden landscape:overflow-y-auto"
    >
      {COLORS.map((c) => swatch(c.id, tr(c.name, locale), c.hex, luminance(c.hex) < 0.35, false))}
      {MAGIC.map((m) => swatch(m.id, tr(m.name, locale), css(m.stops, m.angle), m.id === 'galaxy', true))}
    </div>
  );
}

'use client';

import type { CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { tr } from '@/lib/i18n-text';
import { COLORS, MAGIC, luminance } from '@/coloring/palette';
import { T } from '@/coloring/text';
import { fx, toy } from '@/components/create/fx/toy';

const css = (stops: string[], angle: number) => `linear-gradient(${angle + 90}deg, ${stops.join(', ')})`;

/** Big round crayons (glossy toy buttons that sink when chosen): 24 colours and the magic fills. */
export function Palette({ value, onPick, locale, disabled = false }: { value: string; onPick: (id: string) => void; locale: string; disabled?: boolean }) {
  const swatch = (id: string, name: string, solid: string, face: string | null, dark: boolean, magic: boolean) => {
    const on = value === id;
    const style = { ...toy(solid, { depth: 5, ring: '#7C3AED', ink: dark ? '#ffffff' : '#2B2D42' }), ...(face ? { '--face': face } : {}) } as CSSProperties;
    return (
      <button
        key={id}
        type="button"
        onClick={() => onPick(id)}
        aria-label={name}
        aria-pressed={on}
        title={name}
        disabled={disabled}
        className={`${fx.toy} ${on ? fx.on : ''} grid h-14 w-14 shrink-0 place-items-center rounded-full ${id === 'white' ? 'ring-1 ring-black/10' : ''}`}
        style={style}
      >
        {magic && !on && (
          <span aria-hidden="true" className="absolute -right-1 -top-1 text-sm drop-shadow">
            ✨
          </span>
        )}
        <AnimatePresence>
          {on && (
            <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }} aria-hidden="true" className="text-xl font-black">
              ✓
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    );
  };
  return (
    <div
      role="group"
      aria-label={tr(T.palette, locale)}
      className="grid auto-cols-max grid-flow-col grid-rows-2 gap-x-2.5 gap-y-3 overflow-x-auto overscroll-contain px-2 pb-3 pt-2 [scrollbar-width:thin] landscape:h-full landscape:content-start landscape:grid-flow-row landscape:grid-cols-3 landscape:grid-rows-none landscape:overflow-x-hidden landscape:overflow-y-auto"
    >
      {COLORS.map((c) => swatch(c.id, tr(c.name, locale), c.hex, null, luminance(c.hex) < 0.35, false))}
      {MAGIC.map((m) => swatch(m.id, tr(m.name, locale), m.solid, css(m.stops, m.angle), m.id === 'galaxy', true))}
    </div>
  );
}

'use client';

import { forwardRef, useCallback, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { motion, useMotionValue, useSpring, type HTMLMotionProps, type MotionStyle } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { darken, lighten, rgba, strong } from './color';
import css from './stage.module.css';

/** The press of a real toy: the face sinks onto its base, then springs back. */
export const PRESS = { type: 'spring', stiffness: 700, damping: 26, mass: 0.6 } as const;
export const SPRING_IN = { type: 'spring', stiffness: 260, damping: 20 } as const;

/**
 * Tilt towards the pointer (mouse and pen only — touch keeps scrolling).
 * Returns motion values and handlers to spread on the element.
 */
export function useTilt(max = 10) {
  const reduce = useReducedMotion();
  const rx = useSpring(useMotionValue(0), { stiffness: 260, damping: 20 });
  const ry = useSpring(useMotionValue(0), { stiffness: 260, damping: 20 });
  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (reduce || e.pointerType === 'touch') return;
      const r = e.currentTarget.getBoundingClientRect();
      ry.set(((e.clientX - r.left) / r.width - 0.5) * 2 * max);
      rx.set(-((e.clientY - r.top) / r.height - 0.5) * 2 * max);
    },
    [reduce, max, rx, ry],
  );
  const onPointerLeave = useCallback(() => {
    rx.set(0);
    ry.set(0);
  }, [rx, ry]);
  return { style: { rotateX: rx, rotateY: ry, transformPerspective: 700 }, onPointerMove, onPointerLeave };
}

type ToyButtonProps = {
  children: ReactNode;
  color: string;
  onClick?: () => void;
  variant?: 'solid' | 'soft' | 'white';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
  /** A light sweeps across it now and then (the big "play" buttons). */
  shine?: boolean;
  /** A soft ring pulses around it (the one thing to tap next). */
  halo?: boolean;
  /** On TV, the remote's focus lands here when the step opens. */
  tvAutofocus?: boolean;
  className?: string;
  faceClassName?: string;
  type?: 'button' | 'submit';
};

const SIZES = {
  sm: { depth: 4, face: 'min-h-[44px] px-4 text-sm rounded-2xl', r: '1rem' },
  md: { depth: 6, face: 'min-h-[56px] px-6 text-base rounded-[1.25rem]', r: '1.25rem' },
  lg: { depth: 7, face: 'min-h-[64px] px-8 text-lg sm:text-xl rounded-[1.5rem]', r: '1.5rem' },
  xl: { depth: 9, face: 'min-h-[76px] px-9 text-xl sm:text-2xl rounded-[2rem]', r: '2rem' },
} as const;

/**
 * A chunky, glossy toy button with real thickness: a darker base, a lit
 * face with a highlight, and a press that pushes the face down onto it.
 */
export function ToyButton({
  children,
  color,
  onClick,
  variant = 'solid',
  size = 'md',
  disabled,
  autoFocus,
  ariaLabel,
  shine,
  halo,
  tvAutofocus,
  className = '',
  faceClassName = '',
  type = 'button',
}: ToyButtonProps) {
  const s = SIZES[size];
  const base = strong(color);
  const solid = variant === 'solid';
  const face =
    variant === 'solid'
      ? `linear-gradient(180deg, ${lighten(base, 0.22)} 0%, ${base} 52%, ${darken(base, 0.08)} 100%)`
      : variant === 'soft'
        ? `linear-gradient(180deg, ${lighten(color, 0.9)} 0%, ${lighten(color, 0.74)} 100%)`
        : 'linear-gradient(180deg, #FFFFFF 0%, #F3F4F8 100%)';
  const edge = solid ? darken(base, 0.34) : variant === 'soft' ? lighten(color, 0.38) : '#D5D9E3';
  const ink = solid ? '#FFFFFF' : darken(strong(color), 0.18);
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      data-tv-autofocus={tvAutofocus ? '' : undefined}
      initial="rest"
      animate="rest"
      whileHover={disabled ? undefined : 'hover'}
      whileTap={disabled ? undefined : 'press'}
      className={`group relative inline-flex select-none rounded-[var(--r)] align-middle outline-none focus-visible:ring-4 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
      style={{ paddingBottom: s.depth, '--r': s.r, '--tw-ring-color': rgba(color, 0.55) } as CSSProperties}
    >
      {/* Contact shadow on the ground */}
      <span className="pointer-events-none absolute inset-x-3 -bottom-2 h-4 rounded-full opacity-60 blur-[6px]" style={{ background: rgba(darken(color, 0.5), 0.45) }} aria-hidden="true" />
      {/* Thickness */}
      <span className="absolute inset-x-0 bottom-0 rounded-[var(--r)]" style={{ top: s.depth, background: edge }} aria-hidden="true" />
      {halo && !disabled ? <span className={css.halo} style={{ '--halo': rgba(color, 0.6) } as CSSProperties} aria-hidden="true" /> : null}
      <motion.span
        variants={{ rest: { y: 0 }, hover: { y: -2 }, press: { y: s.depth - 1 } }}
        transition={PRESS}
        className={`relative flex w-full items-center justify-center gap-2 overflow-hidden font-extrabold ${s.face} ${faceClassName}`}
        style={{
          background: face,
          color: ink,
          textShadow: solid ? `0 2px 0 ${rgba(darken(base, 0.4), 0.45)}` : undefined,
          boxShadow: `inset 0 2px 0 rgba(255,255,255,${solid ? 0.45 : 0.9}), inset 0 -3px 0 ${rgba(edge, 0.25)}`,
        }}
      >
        <span className="pointer-events-none absolute inset-x-2 top-1 h-[46%] rounded-[inherit] bg-gradient-to-b from-white/45 to-white/0" aria-hidden="true" />
        {shine ? <span className={css.shine} aria-hidden="true" /> : null}
        <span className="relative inline-flex items-center gap-2">{children}</span>
      </motion.span>
    </motion.button>
  );
}

export type TileTone = 'idle' | 'lit' | 'picked' | 'right' | 'oops' | 'dim';

const TONES = {
  right: { top: '#ECFDF3', bottom: '#BBF7D0', rim: '#34D399', edge: '#16A34A' },
  oops: { top: '#FFFBEB', bottom: '#FDE7B0', rim: '#FBBF24', edge: '#D99A0B' },
} as const;

/** Colours of a light "candy" tile in the game's colour, for a given state. */
export function tileColors(color: string, tone: TileTone) {
  if (tone === 'right' || tone === 'oops') return TONES[tone];
  return {
    top: '#FFFFFF',
    bottom: lighten(color, tone === 'lit' || tone === 'picked' ? 0.78 : 0.88),
    rim: tone === 'lit' || tone === 'picked' ? color : lighten(color, 0.55),
    edge: tone === 'lit' || tone === 'picked' ? darken(color, 0.12) : lighten(color, 0.3),
  };
}

type ToyTileProps = Omit<HTMLMotionProps<'button'>, 'children' | 'color'> & {
  color: string;
  tone?: TileTone;
  depth?: number;
  radius?: string;
  tilt?: boolean;
  faceClassName?: string;
  faceStyle?: CSSProperties;
  children: ReactNode;
};

/**
 * A physical answer tile: a cream face on a coloured base, tilting towards
 * the pointer, sinking when pressed. Correct → minty green and a pop;
 * "not quite" → soft sunny yellow and a gentle wobble (never red).
 */
export const ToyTile = forwardRef<HTMLButtonElement, ToyTileProps>(function ToyTile(
  { color, tone = 'idle', depth = 7, radius = '1.5rem', tilt = true, faceClassName = '', faceStyle, className = '', children, disabled, style, ...rest },
  ref,
) {
  const t = useTilt(tilt && !disabled ? 9 : 0);
  const c = tileColors(color, tone);
  const lit = tone === 'lit' || tone === 'picked';
  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={disabled}
      initial={false}
      animate="rest"
      whileTap={disabled ? undefined : 'press'}
      onPointerMove={t.onPointerMove}
      onPointerLeave={t.onPointerLeave}
      className={`group relative block select-none text-[#2A2340] outline-none focus-visible:ring-4 focus-visible:ring-offset-2 disabled:cursor-default ${className}`}
      style={{ paddingBottom: depth, borderRadius: radius, '--tw-ring-color': rgba(color, 0.5), ...t.style, ...style } as MotionStyle}
      {...rest}
    >
      <span className="pointer-events-none absolute inset-x-4 -bottom-2.5 h-4 rounded-full opacity-50 blur-[7px]" style={{ background: rgba(darken(color, 0.4), 0.5) }} aria-hidden="true" />
      <span className="absolute inset-x-0 bottom-0" style={{ top: depth, borderRadius: radius, background: c.edge }} aria-hidden="true" />
      <motion.span
        variants={{ rest: { y: 0 }, press: { y: depth - 1 } }}
        transition={PRESS}
        className={`relative flex h-full w-full items-center justify-center overflow-hidden border-[3px] bg-white text-[#2A2340] ${faceClassName}`}
        style={{
          borderRadius: radius,
          borderColor: c.rim,
          backgroundImage: `linear-gradient(180deg, ${rgba(c.top, 0.0)} 0%, ${rgba(c.bottom, 0.95)} 100%)`,
          boxShadow: `${lit ? `0 0 0 4px ${rgba(color, 0.28)},` : ''} inset 0 3px 0 rgba(255,255,255,0.85), inset 0 -4px 10px ${rgba(c.edge, 0.12)}`,
          ...faceStyle,
        }}
      >
        <span className="pointer-events-none absolute inset-x-3 top-1.5 h-[38%] rounded-[inherit] bg-gradient-to-b from-white/70 to-white/0" aria-hidden="true" />
        {children}
      </motion.span>
    </motion.button>
  );
});

/** A bold "chip" face of the game's colour (letter tiles, sort tokens, slide blocks). */
export function chunkyFace(color: string): CSSProperties {
  const base = strong(color);
  return {
    background: `linear-gradient(160deg, ${lighten(base, 0.28)} 0%, ${base} 55%, ${darken(base, 0.1)} 100%)`,
    boxShadow: `inset 0 3px 0 rgba(255,255,255,0.5), inset 0 -4px 0 ${rgba(darken(base, 0.3), 0.35)}`,
    color: '#fff',
    textShadow: `0 2px 0 ${rgba(darken(base, 0.45), 0.5)}`,
  };
}

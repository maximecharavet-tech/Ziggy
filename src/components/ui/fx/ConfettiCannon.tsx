'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, type RefObject } from 'react';
import { confettiAt, confettiParty, centerOf } from './effects';
import { clearGroup, nextGroup, viewport } from './stage';
import { fxSound, type FxSound } from './sfx';
import type { ShapeKind } from './physics';
import { useTrigger } from './use-trigger';

export interface ConfettiCannonProps {
  /** Fires each time this becomes a new truthy value (a counter, a timestamp, `true`). */
  fire?: unknown;
  /** 'party': two cannons from the bottom corners. 'cannon': one shot from `origin` or `from`. */
  mode?: 'party' | 'cannon';
  /** Cannon position as fractions of the viewport (default: bottom middle). */
  origin?: { x: number; y: number };
  /** Or shoot from the centre of this element. */
  from?: RefObject<Element | null>;
  /** Cannon direction in degrees (−90 = up) and cone width. */
  angle?: number;
  spread?: number;
  /** Launch speed multiplier. */
  power?: number;
  /** Pieces requested (the stage trims to its budget; weak devices get about half). */
  count?: number;
  /** Shapes: 'rect' paper, 'ribbon', 'star', 'heart', 'ball' (Ziggy's antenna ball), 'sparkle', 'dot'. */
  kinds?: readonly ShapeKind[];
  colors?: readonly string[];
  /** Seconds, capped at 2. */
  life?: number;
  /** Sound with each shot (default 'confetti'; false for none). */
  sound?: FxSound | false;
  /** Called with the number of pieces actually fired. */
  onFire?: (pieces: number) => void;
}

export interface ConfettiCannonHandle {
  /** Fires now (with optional overrides). Returns the pieces fired. */
  fire(overrides?: Partial<Omit<ConfettiCannonProps, 'fire' | 'onFire'>>): number;
  /** Removes this cannon's pieces at once. */
  clear(): void;
}

/**
 * Canvas confetti on the shared effects stage: paper, ribbons, stars, hearts
 * and Ziggy-green antenna balls with drag, gravity, spin and flutter. Renders
 * nothing itself. Short (≤ 2 s), click-through, budgeted, paused with the tab,
 * and silent and still under reduced motion (no pieces at all).
 */
export const ConfettiCannon = forwardRef<ConfettiCannonHandle, ConfettiCannonProps>(function ConfettiCannon(props, ref) {
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });
  const group = useRef(0);

  const fire = useCallback((overrides: Partial<ConfettiCannonProps> = {}) => {
    const p = { ...propsRef.current, ...overrides };
    group.current ||= nextGroup();
    const common = { count: p.count, kinds: p.kinds, colors: p.colors, life: p.life, power: p.power, group: group.current };
    let n = 0;
    if ((p.mode ?? 'party') === 'party') {
      n = confettiParty(common);
    } else {
      const fromEl = p.from?.current ? centerOf(p.from.current) : null;
      const { width, height } = viewport();
      const at = fromEl ?? { x: (p.origin?.x ?? 0.5) * width, y: (p.origin?.y ?? 0.92) * height };
      n = confettiAt(at, { ...common, angle: p.angle, spread: p.spread });
    }
    if (n > 0) fxSound(p.sound === undefined ? 'confetti' : p.sound);
    p.onFire?.(n);
    return n;
  }, []);

  useImperativeHandle(ref, () => ({ fire, clear: () => group.current && clearGroup(group.current) }), [fire]);

  useTrigger(props.fire, () => fire());

  return null;
});

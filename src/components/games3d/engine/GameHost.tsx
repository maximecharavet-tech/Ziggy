'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import type { EventMap } from '@/games3d/engine/events';
import type { GameDefinition, GameHost as Host, GameHostOptions } from '@/games3d/engine/host';

/**
 * Generic React wrapper for an engine game: a positioned box with the canvas,
 * the hotspot layer (added by the host, over the canvas) and the fade overlay.
 *
 * - three.js and the game load lazily (`import()` in an effect, never during SSR).
 * - The host observes the box size itself (ResizeObserver).
 * - Reduced motion comes from '@/lib/use-reduced-motion' (never framer-motion's).
 * - Game events reach `onEvent`; commands go through the host given to `onReady`.
 *
 * The HUD (buttons, speech bubble, read-aloud) stays in the game's own player,
 * laid over or under this box.
 */

export interface GameHostProps<Evt extends EventMap, Cmd extends EventMap> {
  /** Lazy game module, e.g. `() => import('@/games3d/lutin-chaos/ChaosGame').then((m) => m.chaosGame)`. */
  load: () => Promise<GameDefinition<Evt, Cmd>>;
  locale: string;
  onEvent?: (name: keyof Evt, payload: Evt[keyof Evt]) => void;
  onReady?: (host: Host<Evt, Cmd>) => void;
  onError?: (error: unknown) => void;
  /** Extra host options (keymap, hotspot label, audio, exposeAs for tests…). */
  options?: Partial<Omit<GameHostOptions, 'canvas' | 'container' | 'locale' | 'reducedMotion'>>;
  className?: string;
  style?: CSSProperties;
}

export function GameHost<Evt extends EventMap, Cmd extends EventMap>({ load, locale, onEvent, onReady, onError, options, className, style }: GameHostProps<Evt, Cmd>) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const host = useRef<Host<Evt, Cmd> | null>(null);
  const reduce = useReducedMotion();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  // Latest callbacks without restarting the game.
  const cb = useRef({ onEvent, onReady, onError, load, options, locale, reduce });
  cb.current = { onEvent, onReady, onError, load, options, locale, reduce };

  useEffect(() => {
    let cancelled = false;
    let h: Host<Evt, Cmd> | null = null;
    (async () => {
      try {
        const [{ GameHost: HostClass }, def] = await Promise.all([import('@/games3d/engine/host'), cb.current.load()]);
        if (cancelled || !canvas.current || !box.current) return;
        const c = cb.current;
        h = new HostClass<Evt, Cmd>({ ...c.options, canvas: canvas.current, container: box.current, locale: c.locale, reducedMotion: c.reduce });
        host.current = h;
        h.bus.events.onAny((name, payload) => cb.current.onEvent?.(name, payload));
        h.signals.on('error', ({ error }) => cb.current.onError?.(error));
        await def.start(h);
        if (cancelled) return;
        h.start();
        setState('ready');
        cb.current.onReady?.(h);
      } catch (error) {
        if (cancelled) return;
        console.error('[GameHost]', error);
        setState('error');
        cb.current.onError?.(error);
      }
    })();
    return () => {
      cancelled = true;
      h?.dispose();
      host.current = null;
    };
  }, []);

  useEffect(() => host.current?.setReducedMotion(reduce), [reduce]);
  useEffect(() => host.current?.setLocale(locale), [locale]);

  return (
    <div ref={box} className={className} style={{ position: 'relative', overflow: 'hidden', ...style }} data-engine-host={state}>
      <canvas ref={canvas} aria-hidden="true" style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }} />
    </div>
  );
}

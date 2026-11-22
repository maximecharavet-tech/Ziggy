'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { hasFinePointer, hasUserGesture, idleMs, installActivity, now, onUserActivity } from '@/components/ui/fx/env';
import { fxSound } from '@/components/ui/fx/sfx';
import { heartsAt } from '@/components/ui/fx/effects';
import { createRateLimit } from '@/components/ui/fx/rate-limit';

/** Ziggy dozes off after this long without any tap, scroll or key (and wakes at the next one). */
export const SLEEP_AFTER_MS = 45_000;
/** At most this many snores per page visit, never closer than SNORE_GAP_MS. */
export const MAX_SNORES = 3;
export const SNORE_GAP_MS = 25_000;

// Page-wide: several mascots on one page share one voice.
let snores = 0;
let lastSnore = -Infinity;
const hoverVoice = createRateLimit({ perSecond: 1, minGapMs: 4000 });

/** Whether a snore may play now (pure rule, exported for tests). */
export function maySnore(count: number, last: number, t: number): boolean {
  return count < MAX_SNORES && t - last >= SNORE_GAP_MS;
}

/** Damped antenna bobble: degrees over ~1 s, sampled for Web Animations. */
export function bobbleFrames(amplitude: number, frames = 30, hz = 2.2, decay = 4): string[] {
  const out: string[] = [];
  for (let i = 0; i <= frames; i++) {
    const t = i / frames;
    const deg = i === frames ? 0 : amplitude * Math.exp(-decay * t) * Math.sin(2 * Math.PI * hz * t);
    out.push(`rotate(${Math.round(deg * 100) / 100}deg)`);
  }
  return out;
}

const BLINK: Keyframe[] = [
  { transform: 'scaleY(0)' },
  { transform: 'scaleY(1)', offset: 0.38 },
  { transform: 'scaleY(1)', offset: 0.55 },
  { transform: 'scaleY(0)' },
];

const WAVE: Keyframe[] = [
  { transform: 'rotate(0deg)' },
  { transform: 'rotate(-6deg) scale(1.02)' },
  { transform: 'rotate(5deg) scale(1.02)' },
  { transform: 'rotate(-3.5deg)' },
  { transform: 'rotate(2deg)' },
  { transform: 'rotate(0deg)' },
];

const TILT: Keyframe[] = [
  { transform: 'rotate(0deg) scale(1)' },
  { transform: 'rotate(-12deg) scale(1.1)', offset: 0.22 },
  { transform: 'rotate(9deg) scale(1.1)', offset: 0.45 },
  { transform: 'rotate(-5deg) scale(1.06)', offset: 0.65 },
  { transform: 'rotate(2deg) scale(1.02)', offset: 0.82 },
  { transform: 'rotate(0deg) scale(1)' },
];

function tapFrames(hop: number): Keyframe[] {
  return [
    { transform: 'translateY(0px) scale(1, 1) rotate(0deg)' },
    { transform: 'translateY(0px) scale(1.06, 0.93) rotate(0deg)', offset: 0.14 },
    { transform: `translateY(${-hop}px) scale(0.96, 1.05) rotate(-4deg)`, offset: 0.4 },
    { transform: `translateY(${-hop * 0.4}px) scale(0.99, 1.01) rotate(3deg)`, offset: 0.58 },
    { transform: 'translateY(0px) scale(1.04, 0.96) rotate(-1.5deg)', offset: 0.74 },
    { transform: 'translateY(0px) scale(1, 1) rotate(0deg)' },
  ];
}

export interface MascotLifeOptions {
  /** Blink and antenna bobble (needs the eyelid/antenna overlays to line up with the picture). */
  rig: boolean;
  /** Wave on hover, hop and hearts on tap. */
  interactive: boolean;
  /** Dozes off after a long idle. */
  sleepy: boolean;
  /** Hop height on tap, px. */
  hop: number;
  /** 'hop' for the full body; 'tilt' for a face in a round frame (no squash, the frame would show). */
  tap?: 'hop' | 'tilt';
  /** Rig pictures that must load before the rig shows (the antenna copies). */
  needsLoads?: number;
  sleepAfterMs?: number;
}

/**
 * Ziggy's idle life: blinks every few seconds, antennas that sway and
 * bobble, a little wave when the mouse comes by, a happy hop with hearts and a
 * giggle when tapped, and a rare nap (with a snore) after a long idle.
 *
 * - Transform and opacity only, on Ziggy's own wrappers (never on the
 *   caller's element, so their classes and animations keep working).
 * - Off screen or in a hidden tab, nothing runs.
 * - Reduced motion: nothing moves at all (the tap still giggles: sound is
 *   feedback, not motion).
 * - SSR: the first render is the plain picture; life starts after mount.
 */
export function useMascotLife({ rig, interactive, sleepy, hop, tap = 'hop', needsLoads = 0, sleepAfterMs = SLEEP_AFTER_MS }: MascotLifeOptions) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [asleep, setAsleep] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const bodyRef = useRef<HTMLSpanElement>(null);
  const lidRefs = [useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null)] as const;
  const antennaRefs = [useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null)] as const;
  const swayRefs = [useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null)] as const;
  const visible = useRef(false);
  const asleepRef = useRef(false);
  const lastWave = useRef(-Infinity);

  useEffect(() => {
    setMounted(true);
    installActivity();
  }, []);

  const moving = mounted && !reduced;
  const rigOn = moving && rig;
  const rigReady = rigOn && loaded >= needsLoads;
  const onRigLoad = useCallback(() => setLoaded((n) => n + 1), []);

  // On screen?
  useEffect(() => {
    const el = rootRef.current;
    if (!moving || !el) return;
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [moving]);

  const awake = () => visible.current && !document.hidden && !asleepRef.current;

  const bobble = useCallback((amplitude: number) => {
    antennaRefs.forEach((r, i) => {
      r.current?.animate(
        bobbleFrames(i === 0 ? amplitude : -amplitude * 0.85).map((transform) => ({ transform })),
        { duration: 1000, easing: 'linear' },
      );
    });
    // The refs are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Blink every few seconds, sometimes twice.
  useEffect(() => {
    if (!rigReady) return;
    let timer = 0;
    const blink = () => lidRefs.forEach((r) => r.current?.animate(BLINK, { duration: 190, easing: 'ease-in-out' }));
    const next = () => {
      timer = window.setTimeout(() => {
        if (awake()) {
          blink();
          if (Math.random() < 0.18) window.setTimeout(blink, 260);
        }
        next();
      }, 2600 + Math.random() * 3600);
    };
    next();
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rigReady]);

  // Antennas: a slow sway all the time (paused off screen), and a bobble now and then.
  useEffect(() => {
    if (!rigReady) return;
    const sways = swayRefs.map((r, i) =>
      r.current?.animate(
        [{ transform: 'rotate(0deg)' }, { transform: `rotate(${i ? -2.2 : 2.6}deg)` }, { transform: 'rotate(0deg)' }, { transform: `rotate(${i ? 1.8 : -2}deg)` }, { transform: 'rotate(0deg)' }],
        { duration: i ? 3900 : 3400, iterations: Infinity, easing: 'ease-in-out' },
      ),
    );
    let timer = 0;
    const tick = () => {
      const on = visible.current && !document.hidden;
      sways.forEach((a) => (on ? a?.play() : a?.pause()));
      if (on && !asleepRef.current && Math.random() < 0.3) bobble(7);
      timer = window.setTimeout(tick, 2200);
    };
    tick();
    return () => {
      window.clearTimeout(timer);
      sways.forEach((a) => a?.cancel());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rigReady, bobble]);

  const playBody = (frames: Keyframe[], duration: number, easing = 'ease-out') => bodyRef.current?.animate(frames, { duration, easing });

  const wake = useCallback(() => {
    if (!asleepRef.current) return;
    asleepRef.current = false;
    setAsleep(false);
    bodyRef.current?.getAnimations().forEach((a) => a.cancel());
    if (!reduced) {
      bodyRef.current?.animate([{ transform: 'scale(1, 1)' }, { transform: 'scale(0.97, 1.06)' }, { transform: 'scale(1.02, 0.98)' }, { transform: 'scale(1, 1)' }], { duration: 520, easing: 'ease-out' });
      bobble(9);
    }
  }, [reduced, bobble]);

  // Dozing off after a long idle; any activity wakes him.
  useEffect(() => {
    if (!moving || !sleepy) return;
    const check = window.setInterval(() => {
      if (asleepRef.current || !visible.current || document.hidden || idleMs() < sleepAfterMs) return;
      asleepRef.current = true;
      setAsleep(true);
      // Slow breathing while asleep (well under one cycle per second).
      bodyRef.current?.animate([{ transform: 'scale(1, 1)' }, { transform: 'scale(1.012, 0.99)' }, { transform: 'scale(1, 1)' }], { duration: 3200, iterations: Infinity, easing: 'ease-in-out' });
      const t = now();
      if (hasUserGesture() && maySnore(snores, lastSnore, t)) {
        snores += 1;
        lastSnore = t;
        fxSound('snore', { volume: 0.6 });
      }
    }, 2000);
    const off = onUserActivity(wake);
    return () => {
      window.clearInterval(check);
      off();
    };
  }, [moving, sleepy, sleepAfterMs, wake]);

  const insideControl = () => Boolean(rootRef.current?.parentElement?.closest('a,button,[role="button"]'));

  const onPointerEnter = useCallback(
    (e: React.PointerEvent) => {
      if (!interactive || !moving || e.pointerType !== 'mouse' || !hasFinePointer() || asleepRef.current) return;
      const t = now();
      if (t - lastWave.current < 1500) return;
      lastWave.current = t;
      playBody(WAVE, 760, 'ease-in-out');
      bobble(6);
      if (!insideControl() && hoverVoice.take(t)) fxSound('boing', { volume: 0.45 });
    },
    [interactive, moving, bobble],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!interactive || e.button !== 0) return;
      if (asleepRef.current) {
        wake();
        return;
      }
      if (!insideControl()) fxSound('giggle');
      if (!moving) return;
      lastWave.current = now();
      playBody(tap === 'tilt' ? TILT : tapFrames(hop), tap === 'tilt' ? 640 : 720);
      bobble(12);
      const r = rootRef.current?.getBoundingClientRect();
      if (r) heartsAt({ x: e.clientX || r.left + r.width / 2, y: e.clientY || r.top + r.height * 0.4 }, 6);
    },
    [interactive, moving, hop, tap, wake, bobble],
  );

  return { rootRef, bodyRef, lidRefs, antennaRefs, swayRefs, rigOn, rigReady, onRigLoad, asleep, moving, onPointerEnter, onPointerDown };
}

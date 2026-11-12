'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import type { ElfId, ElfPose, ElfReaction, LutinsSceneHandle, LutinsSceneMode, SheetLayout, StageCamera } from '@/games3d/lutins/types';

export type { LutinsSceneHandle };

export interface LutinsSceneProps {
  mode: LutinsSceneMode;
  /** Stage: which elves, left to right (default all three). */
  elves?: ElfId[];
  /** Initial poses. */
  poses?: Partial<Record<ElfId, ElfPose>>;
  /** Stage: orbit camera; changing it moves the camera in place. */
  camera?: StageCamera;
  /** Transparent background (stage overlay on a photo). */
  transparent?: boolean;
  /** Stage: the elves pop in one after the other (skipped under reduced motion). */
  popIn?: boolean;
  /** A tap on an elf: who and how it reacted (play a sound if you like). */
  onPoke?: (id: ElfId, reaction: ElfReaction) => void;
  /** Sheet mode only: what to render. */
  sheet?: SheetLayout;
  /** The box the scene fills; give it a size. */
  className?: string;
  /** Called once the 3D is up, with the handle (poses, camera, canvas…). */
  onReady?: (handle: LutinsSceneHandle) => void;
  /** Called when WebGL is not available (the soft placeholder stays). */
  onError?: () => void;
  /** Accessible name; decorative when omitted. */
  label?: string;
}

const PLACEHOLDER: Record<LutinsSceneMode, string> = {
  hero: 'radial-gradient(ellipse at 30% 60%, #6b3a22 0%, #2a1a3a 55%, #141029 100%)',
  stage: 'transparent',
  sheet: '#f6f4f1',
};

/**
 * The 3D felt elves (Pépin, Grelotte, Noisette) in any box: the landing-page
 * hero, the transparent "AR" stage, or a reference sheet. three.js and the
 * scene load on demand; a soft gradient shows until the first frames are
 * ready. Change `mode`, `elves` or `transparent` by remounting (use a `key`).
 */
export function LutinsScene({ mode, elves, poses, camera, transparent, sheet, popIn, onPoke, className = '', onReady, onError, label }: LutinsSceneProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<LutinsSceneHandle | null>(null);
  const [ready, setReady] = useState(false);
  const reduce = useReducedMotion();
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const errorRef = useRef(onError);
  errorRef.current = onError;
  // Read at mount only (remount to change them); kept in refs so the effect stays stable.
  const initRef = useRef({ elves, poses, camera, transparent, sheet, popIn });
  initRef.current = { elves, poses, camera, transparent, sheet, popIn };
  const pokeRef = useRef(onPoke);
  pokeRef.current = onPoke;
  const elvesKey = (elves ?? []).join(',');
  const wantsPoke = Boolean(onPoke);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    let alive = true;
    let handle: LutinsSceneHandle | null = null;
    const ro = new ResizeObserver(() => handle?.resize());

    (async () => {
      try {
        const { mountLutinsScene } = await import('@/games3d/lutins');
        if (!alive) return;
        const init = initRef.current;
        handle = mountLutinsScene(canvas, {
          mode,
          elves: init.elves,
          poses: init.poses,
          camera: init.camera,
          transparent: init.transparent ?? mode === 'stage',
          sheet: init.sheet,
          popIn: init.popIn,
          onPoke: wantsPoke ? (id, r) => pokeRef.current?.(id, r) : undefined,
          reducedMotion: reduce,
        });
        handleRef.current = handle;
        ro.observe(box);
        // Let a couple of frames draw before fading the canvas in.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (!alive || !handle) return;
            setReady(true);
            readyRef.current?.(handle);
          })
        );
      } catch {
        if (alive) errorRef.current?.();
      }
    })();

    return () => {
      alive = false;
      ro.disconnect();
      handle?.dispose();
      handleRef.current = null;
      setReady(false);
    };
    // The scene is rebuilt when the mode, the elves or the motion preference change.
  }, [mode, reduce, elvesKey, wantsPoke]);

  const camKey = camera ? `${camera.azimuth ?? ''}|${camera.elevation ?? ''}|${camera.zoom ?? ''}` : '';
  useEffect(() => {
    if (!ready || mode !== 'stage' || !initRef.current.camera) return;
    handleRef.current?.setCamera(initRef.current.camera);
  }, [camKey, ready, mode]);

  return (
    <div
      ref={boxRef}
      className={`${/\b(absolute|fixed|sticky)\b/.test(className) ? '' : 'relative '}overflow-hidden ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ background: PLACEHOLDER[mode] }}
    >
      <canvas ref={canvasRef} className={`absolute inset-0 block h-full w-full transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );
}

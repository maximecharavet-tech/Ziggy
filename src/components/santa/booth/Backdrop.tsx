'use client';

import { useEffect, useRef, useState } from 'react';
import { SantaScene } from '@/components/santa/SantaScene';
import type { BoothSceneId, SantaSceneHandle } from '@/lib/santa/types';
import { createFallbackBackdrop } from './fallback-backdrop';

/**
 * The booth backdrop: renders into a fixed-size box (BACKDROP_SIZE CSS px, so
 * the exported photo gets a sharp scene whatever the screen: 1080 × 1350 drawing
 * buffer at the 3D scene's 1.5 pixel ratio), which the booth scales down to fit
 * its stage. Hands the current SantaSceneHandle to `onReady`.
 *
 * The 3D scene (<SantaScene mode="booth">, three.js loaded lazily) is the real
 * backdrop; the 2D painted stand-in shows while it loads and stays when WebGL
 * is missing, fails, or loses its context.
 */
export const BACKDROP_SIZE = { w: 720, h: 900 };

type Props = { scene: BoothSceneId; onReady: (h: SantaSceneHandle) => void };

export function FallbackBackdrop({ scene, onReady }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<SantaSceneHandle | null>(null);
  const first = useRef(scene);
  const ready = useRef(onReady);
  ready.current = onReady;

  useEffect(() => {
    if (!host.current) return;
    const h = createFallbackBackdrop(host.current, first.current);
    h.setScene(first.current);
    handle.current = h;
    ready.current(h);
    return () => {
      h.dispose();
      handle.current = null;
    };
  }, []);

  useEffect(() => {
    handle.current?.setScene(scene);
  }, [scene]);

  return <div ref={host} className="absolute inset-0" />;
}

export function BoothBackdrop({ scene, onReady }: Props) {
  const [failed, setFailed] = useState(false);
  const [ready3d, setReady3d] = useState(false);
  return (
    <div className="relative h-full w-full">
      {(!ready3d || failed) && <FallbackBackdrop scene={scene} onReady={onReady} />}
      {!failed && (
        <SantaScene
          mode="booth"
          boothScene={scene}
          className="absolute inset-0"
          onReady={(h) => {
            h.canvas.addEventListener('webglcontextlost', () => setFailed(true), { once: true });
            setReady3d(true);
            onReady(h);
          }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

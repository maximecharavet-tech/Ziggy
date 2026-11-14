'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { prefersLowPower } from '@/games3d/kit/look';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { ArtSlot } from './ArtSlot';
import { santaArt } from '@/data/santa/art';

// three.js and the scene only download once the village is about to be seen.
const SantaScene = dynamic(() => import('@/components/santa/SantaScene').then((m) => m.SantaScene), { ssr: false });

/**
 * The village hero. The animated 3D scene mounts only when this box nears the
 * viewport (the render loop itself pauses off screen or in a hidden tab, see
 * mountSantaScene). Reduced motion or a weak device gets a still picture.
 */
export function VillageScene({ className = '' }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [near, setNear] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => { setStill(reduced || prefersLowPower()); }, [reduced]);

  useEffect(() => {
    const el = box.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) setNear(true); }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  return <div ref={box} className={`${className} bg-[radial-gradient(ellipse_at_50%_30%,#3b4a8f_0%,#1c2657_55%,#0b1238_100%)]`}>
    {still
      ? <ArtSlot asset={santaArt('traineau-nuit')} sizes="100vw" />
      : near && <SantaScene mode="village" className="absolute inset-0" />}
  </div>;
}

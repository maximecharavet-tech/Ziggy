'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { SantaArtSlot } from '@/data/santa/art';

export function ArtSlot({ asset, className = '', fallback = 'from-[#24205e] via-[#563d8e] to-[#102a42]' }: { asset: SantaArtSlot; className?: string; fallback?: string }) {
  const [failed, setFailed] = useState(false);
  if (!asset.available || failed) return <div aria-hidden="true" className={`absolute inset-0 bg-gradient-to-br ${fallback}`} />;
  if (asset.kind === 'video') return <video className={className} muted autoPlay loop playsInline poster={asset.poster} onError={() => setFailed(true)}><source src={asset.path} type="video/mp4" /></video>;
  return <Image className={className} src={asset.path} alt="" fill sizes="100vw" onError={() => setFailed(true)} />;
}

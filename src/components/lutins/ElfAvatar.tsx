'use client';

import { useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');

/**
 * An elf's portrait: the one approved by the owner (made with Agnes, stored in
 * the public bucket), else the 3D render shipped with the site, else nothing.
 */
export function ElfAvatar({ id, alt = '', className = '' }: { id: string; alt?: string; className?: string }) {
  const sources = [BASE ? `${BASE}/storage/v1/object/public/ziggy-dodo/lutins/${id}.png` : null, `/lutins/refs/avatars/${id}.png`].filter(Boolean) as string[];
  const [i, setI] = useState(0);
  if (i >= sources.length) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={sources[i]} alt={alt} className={className} onError={() => setI((n) => n + 1)} />;
}

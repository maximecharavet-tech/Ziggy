'use client';

import { memo } from 'react';
import { flatSvg, modelFills } from '@/coloring/svg';
import type { ColoringPage } from '@/coloring/types';

const cache = new Map<string, string>();
function svgFor(page: ColoringPage, model: boolean): string {
  const key = `${page.id}:${model ? 1 : 0}`;
  let s = cache.get(key);
  if (!s) {
    s = flatSvg(page, model ? modelFills(page) : {});
    cache.set(key, s);
  }
  return s;
}

/** A page drawn as static SVG (line art, or coloured like the model). */
export const PageArt = memo(function PageArt({ page, model = false, className = '' }: { page: ColoringPage; model?: boolean; className?: string }) {
  return <div aria-hidden="true" className={`[&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: svgFor(page, model) }} />;
});

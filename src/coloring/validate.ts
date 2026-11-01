import { knownColor } from './palette';
import type { ColoringPage } from './types';

const PATH_CHARS = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+\-eE]+$/;

/** Problems in a page's data (empty list = valid). Used by the tests. */
export function validatePage(page: ColoringPage): string[] {
  const errors: string[] = [];
  const vb = page.viewBox.trim().split(/\s+/).map(Number);
  if (vb.length !== 4 || vb.some((n) => !Number.isFinite(n)) || vb[2] <= 0 || vb[3] <= 0) errors.push(`${page.id}: bad viewBox "${page.viewBox}"`);
  if (!page.id || !/^[a-z0-9-]+$/.test(page.id)) errors.push(`bad page id "${page.id}"`);
  if (!page.title.fr.trim() || !page.title.en.trim()) errors.push(`${page.id}: missing title`);
  if (page.regions.length < 6) errors.push(`${page.id}: only ${page.regions.length} regions`);
  const seen = new Set<string>();
  for (const r of page.regions) {
    if (seen.has(r.id)) errors.push(`${page.id}: duplicate region id "${r.id}"`);
    seen.add(r.id);
    if (!r.d.trim()) errors.push(`${page.id}/${r.id}: empty path`);
    else if (!PATH_CHARS.test(r.d) || /NaN|Infinity/.test(r.d) || !/^M/.test(r.d.trim())) errors.push(`${page.id}/${r.id}: invalid path`);
    if (!/[Zz]\s*$/.test(r.d.trim())) errors.push(`${page.id}/${r.id}: region not closed`);
    if (!knownColor(r.c)) errors.push(`${page.id}/${r.id}: unknown model colour "${r.c}"`);
    for (const d of r.deco ?? []) if (!d.d.trim() || /NaN|Infinity/.test(d.d)) errors.push(`${page.id}/${r.id}: bad decoration`);
  }
  for (const d of page.details) if (!d.d.trim() || !PATH_CHARS.test(d.d) || /NaN|Infinity/.test(d.d)) errors.push(`${page.id}: bad detail "${d.d.slice(0, 30)}"`);
  return errors;
}

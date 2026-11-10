/**
 * The child's first name in Santa's own voice: the most common first names
 * (INSEE 2010–2022 for French, US SSA 1998–2008 for English) are recorded
 * offline with the same santa-v2 chain as every other clip, as full greetings
 * (public/santa/names/<locale>/<hello|bye>/<slug>.mp3). A name not in the list
 * gets a same-voice greeting without the name ("Bonjour à toi !"); the caption
 * still shows it. No other voice ever speaks in a call.
 */
import { SANTA_VOICE } from '@/data/santa/voice-clips';
import type { SantaLocale } from '@/data/santa/lines';

export type NameVariant = 'hello' | 'bye';
type NameIndex = { voice: string; fr: string[]; en: string[] };

/** `Léa` → `lea`, `Marie-Lou` → `marie-lou`, `Anne Sophie` → `anne-sophie` (same rule as voice-engine/santa_names.py). */
export function nameSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[' ’]+/g, '-')
    .replace(/[^a-z-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

let index: Promise<{ fr: Set<string>; en: Set<string> } | null> | null = null;

/** The list of recorded names (about 30 kB, fetched once, only when a call starts). */
export function loadNameIndex(fetcher: typeof fetch = fetch): Promise<{ fr: Set<string>; en: Set<string> } | null> {
  if (!index) {
    index = fetcher(`/santa/names/index.json?v=${encodeURIComponent(SANTA_VOICE.voice)}`)
      .then((r) => (r.ok ? (r.json() as Promise<NameIndex>) : null))
      .then((j) => (j ? { fr: new Set(j.fr), en: new Set(j.en) } : null))
      .catch(() => {
        index = null; // try again on the next call
        return null;
      });
  }
  return index;
}

/** For tests. */
export function resetNameIndex() {
  index = null;
}

/** The recorded greeting with this name, or null when the name is not recorded. */
export async function nameClipUrl(variant: NameVariant, name: string, locale: SantaLocale, fetcher?: typeof fetch): Promise<string | null> {
  const slug = nameSlug(name);
  if (!slug) return null;
  const idx = await loadNameIndex(fetcher);
  if (!idx?.[locale].has(slug)) return null;
  return `/santa/names/${locale}/${variant}/${slug}.mp3?v=${encodeURIComponent(SANTA_VOICE.voice)}`;
}

/** The same-voice greeting without the name. */
export const anonNameKey = (variant: NameVariant) => `line:name.${variant}`;

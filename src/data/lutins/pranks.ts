/**
 * The prank catalogue of Les Lutins Farceurs: ready-made ideas a parent picks
 * in one tap (or they describe their own). Gentle mischief only: nothing
 * broken, wasted, dangerous, dirty or mean; nothing a child should copy that
 * could hurt them (no climbing, no fire, no knives, no medicine, no electricity).
 *
 * The data lives in `pranks.json` (one source of truth, also embedded in the
 * Rust engine `rust/lutins-core`, like `bible.json`): after any change run
 * `npm run lutins:wasm`.
 *
 * `action` is the English sentence for the image model (the elves' names are
 * added by the prompt builder); `motion` is for the image-to-video model.
 */
import type { L } from '@/lib/i18n-text';
import data from './pranks.json';

export type PrankCategory =
  | 'partout'
  | 'cuisine'
  | 'salon'
  | 'chambre'
  | 'salle-de-bain'
  | 'sapin'
  | 'entree'
  | 'bureau'
  | 'salle-de-jeux'
  | 'jardin'
  | 'bibliotheque'
  | 'buanderie';

export type Prank = { id: string; emoji: string; cat: PrankCategory; title: L; action: string; motion: string };

type RawPlace = { id: string; emoji: string; fr: string; en: string };
type RawPrank = RawPlace & { cat: string; action: string; motion: string };

export const PRANK_CATEGORIES: { id: PrankCategory; emoji: string; label: L }[] = (data.places as RawPlace[]).map((c) => ({
  id: c.id as PrankCategory,
  emoji: c.emoji,
  label: { fr: c.fr, en: c.en },
}));

export const PRANKS: Prank[] = (data.pranks as RawPrank[]).map((x) => ({
  id: x.id,
  emoji: x.emoji,
  cat: x.cat as PrankCategory,
  title: { fr: x.fr, en: x.en },
  action: x.action,
  motion: x.motion,
}));

export const prankById = (id: string | null | undefined) => PRANKS.find((x) => x.id === id) ?? null;

/** What the parent may type: their own prank idea, short (the prompt template does the rest). */
export const MAX_PARENT_TEXT = 240;

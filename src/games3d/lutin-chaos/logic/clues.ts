/**
 * Who did it? Clues come from the elves' real features in the bible
 * (`src/data/lutins/bible.json`), so children can learn them:
 * - Pépin: long red-and-white striped hat with a golden bell, moss-green
 *   tunic with golden buttons, curly copper hair, curled-toe boots.
 * - Grelotte: round golden glasses, dark braids with red bows, mustard scarf
 *   and pompom hat, lavender tunic, pointy boots, a "hm-hm" inventor hum.
 * - Noisette: the tiniest (half height), acorn-cap hat, hazelnut cape with a
 *   green leaf, tiny squeak.
 *
 * A clue lists the elves it fits. "Sure" clues fit one elf; "partial" clues fit
 * two, so big kids combine them on an elimination grid. Every generated set is
 * validated: the elves fitting ALL clues are exactly the culprit.
 * Every sound clue also has an icon + caption (deaf and hard-of-hearing children);
 * every colour clue also has a pattern.
 */
import { pick, sample, shuffle, type Rng } from './rand';
import { ELF_IDS, type Band, type ElfId, type L } from './types';

export type ClueKind = 'footprint' | 'thread' | 'sound' | 'object';

export interface Clue {
  id: string;
  kind: ClueKind;
  icon: string;
  /** Pattern drawn with any colour clue (colour-blind safe). */
  pattern?: 'stripes' | 'zigzag' | 'dots';
  /** Elves this clue fits. */
  fits: readonly ElfId[];
  /** What the child sees / hears ("Tiny footprints!"). */
  label: L;
  /** The reasoning for the elimination grid ("Big footprints: not Noisette."). */
  reason: L;
}

const c = (id: string, kind: ClueKind, icon: string, fits: ElfId[], label: L, reason: L, pattern?: Clue['pattern']): Clue => ({
  id,
  kind,
  icon,
  fits,
  label,
  reason,
  ...(pattern ? { pattern } : {}),
});

export const CLUES: Clue[] = [
  // Noisette (sure)
  c('footprint-tiny', 'footprint', '👣', ['noisette'], { fr: 'Des toutes petites empreintes !', en: 'Teeny-tiny footprints!' }, { fr: 'Toutes petites : c’est la plus petite, Noisette !', en: 'So tiny: the smallest elf, Hazel!' }),
  c('acorn-cap', 'object', '🌰', ['noisette'], { fr: 'Un petit chapeau-gland tombé là !', en: 'A little acorn hat left behind!' }, { fr: 'Le chapeau-gland, c’est Noisette !', en: 'The acorn hat belongs to Hazel!' }),
  c('squeak-tiny', 'sound', '🐭', ['noisette'], { fr: 'Un tout petit « couic » !', en: 'A teeny little squeak!' }, { fr: 'Ce petit « couic », c’est Noisette !', en: 'That little squeak is Hazel!' }),
  c('thread-hazelnut', 'thread', '🧶', ['noisette'], { fr: 'Un fil couleur noisette, à pois !', en: 'A hazelnut-brown thread with dots!' }, { fr: 'La cape noisette, c’est Noisette !', en: 'The hazelnut cape is Hazel’s!' }, 'dots'),
  // Pépin (sure)
  c('bell-jingle', 'sound', '🔔', ['pepin'], { fr: 'Ding-ding ! Une clochette !', en: 'Jingle-jingle! A little bell!' }, { fr: 'La clochette au bout du bonnet, c’est Pépin !', en: 'The bell on the hat tip is Pip’s!' }),
  c('stripe-yarn', 'thread', '🧶', ['pepin'], { fr: 'Un fil rayé rouge et blanc !', en: 'A red-and-white striped thread!' }, { fr: 'Le grand bonnet rayé, c’est Pépin !', en: 'The long striped hat is Pip’s!' }, 'stripes'),
  c('golden-button', 'object', '🟡', ['pepin'], { fr: 'Un bouton doré tout rond !', en: 'A round golden button!' }, { fr: 'Les boutons dorés de la tunique verte : Pépin !', en: 'The golden buttons on the green tunic: Pip!' }),
  c('footprint-curly', 'footprint', '👢', ['pepin'], { fr: 'Des empreintes de bottes à bout recourbé !', en: 'Footprints of curly-toed boots!' }, { fr: 'Les bottes recourbées, c’est Pépin !', en: 'Curly-toed boots: that’s Pip!' }),
  c('copper-curl', 'object', '🧡', ['pepin'], { fr: 'Une petite boucle de laine cuivrée !', en: 'A little copper-coloured curl of yarn!' }, { fr: 'Les boucles cuivrées, c’est Pépin !', en: 'Copper curls: that’s Pip!' }),
  // Grelotte (sure)
  c('glasses-smudge', 'object', '👓', ['grelotte'], { fr: 'Une trace de lunettes rondes !', en: 'A round glasses mark!' }, { fr: 'Les lunettes rondes, c’est Grelotte !', en: 'Round glasses: that’s Jingle!' }),
  c('hum', 'sound', '🎶', ['grelotte'], { fr: '« Hm-hm-hmm… » quelqu’un fredonne !', en: '"Hm-hm-hmm…" someone is humming!' }, { fr: 'Elle fredonne quand elle invente : Grelotte !', en: 'She hums while inventing: Jingle!' }),
  c('mustard-scarf', 'thread', '🧣', ['grelotte'], { fr: 'Un brin de laine moutarde, en zigzag !', en: 'A wisp of mustard wool, zigzag!' }, { fr: 'L’écharpe moutarde, c’est Grelotte !', en: 'The mustard scarf is Jingle’s!' }, 'zigzag'),
  c('braid-bow', 'object', '🎀', ['grelotte'], { fr: 'Un petit nœud rouge de tresse !', en: 'A little red braid bow!' }, { fr: 'Les tresses à nœuds rouges, c’est Grelotte !', en: 'Braids with red bows: Jingle!' }),
  c('footprint-pointy', 'footprint', '🥿', ['grelotte'], { fr: 'Des empreintes de bottes pointues !', en: 'Pointy boot footprints!' }, { fr: 'Les bottes pointues, c’est Grelotte !', en: 'Pointy boots: that’s Jingle!' }),
  // partial clues (two elves) — for the elimination grid
  c('footprint-big', 'footprint', '👣', ['pepin', 'grelotte'], { fr: 'De grandes empreintes !', en: 'Big footprints!' }, { fr: 'Grandes empreintes : pas Noisette, elle est toute petite.', en: 'Big footprints: not Hazel, she is tiny.' }),
  c('high-shelf', 'object', '🪜', ['pepin', 'grelotte'], { fr: 'C’est arrivé tout en haut de l’étagère !', en: 'It happened right at the top of the shelf!' }, { fr: 'Tout en haut : pas Noisette, trop petite pour y grimper.', en: 'Right at the top: not Hazel, too small to reach.' }),
  c('red-fluff', 'thread', '🔴', ['pepin', 'grelotte'], { fr: 'Un peu de laine rouge, à pois !', en: 'A bit of red wool, with dots!' }, { fr: 'Du rouge : le bonnet de Pépin ou les nœuds de Grelotte. Pas Noisette !', en: 'Red: Pip’s hat or Jingle’s bows. Not Hazel!' }, 'dots'),
  c('no-bell', 'sound', '🤫', ['grelotte', 'noisette'], { fr: 'Pas un bruit de clochette…', en: 'Not a single jingle…' }, { fr: 'Pas de clochette : pas Pépin, il tinte partout !', en: 'No jingle: not Pip, he jingles everywhere!' }),
  c('short-hat', 'object', '🎩', ['grelotte', 'noisette'], { fr: 'La trace d’un petit chapeau tout court !', en: 'The print of a short little hat!' }, { fr: 'Un chapeau court : pas Pépin, son bonnet est très long.', en: 'A short hat: not Pip, his hat is very long.' }),
  c('green-fluff', 'thread', '🟢', ['pepin', 'noisette'], { fr: 'Un bout de feutre vert, en zigzag !', en: 'A scrap of green felt, zigzag!' }, { fr: 'Du vert : la tunique de Pépin ou la feuille de Noisette. Pas Grelotte !', en: 'Green: Pip’s tunic or Hazel’s leaf. Not Jingle!' }, 'zigzag'),
  c('no-glasses', 'object', '🔍', ['pepin', 'noisette'], { fr: 'Aucune trace de lunettes…', en: 'No glasses marks anywhere…' }, { fr: 'Pas de lunettes : pas Grelotte !', en: 'No glasses: not Jingle!' }),
];

const BY_ID = new Map(CLUES.map((x) => [x.id, x]));
export const clueById = (id: string) => BY_ID.get(id);

/** Elves that fit every clue. */
export function suspects(clues: readonly Clue[]): ElfId[] {
  return ELF_IDS.filter((e) => clues.every((cl) => cl.fits.includes(e)));
}

/** How many clues each band shows (design doc A2). */
export const CLUE_COUNT: Record<Band, { min: number; max: number }> = {
  little: { min: 1, max: 1 },
  middle: { min: 1, max: 2 },
  big: { min: 2, max: 3 },
};

/**
 * Is this clue set fair for the band? The suspects must be exactly the culprit;
 * big kids get only partial clues (real elimination), the others get one sure clue.
 */
export function cluesValid(clues: readonly Clue[], culprit: ElfId, band: Band): boolean {
  const s = suspects(clues);
  if (s.length !== 1 || s[0] !== culprit) return false;
  const { min, max } = CLUE_COUNT[band];
  if (clues.length < min || clues.length > max) return false;
  if (new Set(clues.map((x) => x.id)).size !== clues.length) return false;
  if (band === 'big') return clues.every((x) => x.fits.length === 2);
  return clues.some((x) => x.fits.length === 1);
}

const sureFor = (e: ElfId) => CLUES.filter((x) => x.fits.length === 1 && x.fits[0] === e);
const partialWith = (e: ElfId) => CLUES.filter((x) => x.fits.length === 2 && x.fits.includes(e));

/**
 * Seeded clue set for a culprit. `prefer` (prank kinds, e.g. footprints for a
 * hide prank) is tried first when it gives a valid set.
 */
export function makeClues(culprit: ElfId, band: Band, rng: Rng, prefer: readonly ClueKind[] = []): Clue[] {
  const preferFirst = (list: Clue[]) => {
    const sh = shuffle(rng, list);
    return [...sh.filter((x) => prefer.includes(x.kind)), ...sh.filter((x) => !prefer.includes(x.kind))];
  };
  let out: Clue[];
  if (band === 'big') {
    // two partial clues that exclude the two other elves, plus sometimes a third
    const partials = partialWith(culprit);
    const others = ELF_IDS.filter((e) => e !== culprit);
    const excl = (o: ElfId) => preferFirst(partials.filter((x) => !x.fits.includes(o)));
    out = [excl(others[0])[0], excl(others[1])[0]];
    if (rng() < 0.5) {
      const extra = partials.filter((x) => !out.includes(x));
      if (extra.length) out.push(pick(rng, extra));
    }
    out = shuffle(rng, out);
  } else {
    out = [preferFirst(sureFor(culprit))[0]];
    if (band === 'middle' && rng() < 0.4) {
      const [extra] = sample(rng, partialWith(culprit), 1);
      out.push(extra);
    }
  }
  if (!cluesValid(out, culprit, band)) throw new Error(`clue generation broke for ${culprit}/${band}`);
  return out;
}

/** Elimination grid rows for big kids: for each clue, which elves it rules out. */
export function eliminationGrid(clues: readonly Clue[]): { clue: string; out: ElfId[] }[] {
  return clues.map((cl) => ({ clue: cl.id, out: ELF_IDS.filter((e) => !cl.fits.includes(e)) }));
}

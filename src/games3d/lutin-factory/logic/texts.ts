/**
 * Every child-facing word of Lutin Factory's logic layer, in French and
 * English (the other locales fall back to English, like the rest of the
 * site). Read aloud by the player (SayButton / speakSequence).
 *
 * Tone rules (tested): always kind and playful, a toy that differs from the
 * letter is a SURPRISE, never a mistake; when something goes sideways an elf
 * takes the blame with a laugh, never the child; no sad / scolding words.
 * Templates use {placeholders} filled by `fill()`.
 */
import bible from '@/data/lutins/bible.json';
import type { Color, ElfId, L, Material, Pattern, Shape, Sticker } from './types';

export type Locale = 'fr' | 'en';
export type Gendered = { m: string; f: string; mp: string; fp: string };

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export function fillL(t: L, vars: { fr: Record<string, string | number>; en: Record<string, string | number> }): L {
  return { fr: fill(t.fr, vars.fr), en: fill(t.en, vars.en) };
}

/* ---------- the crew ---------- */

const ELVES = (bible as { elves: { id: string; name: L }[] }).elves;
export const ELF_NAMES: Record<ElfId, L> = {
  pepin: ELVES.find((e) => e.id === 'pepin')?.name ?? { fr: 'Pépin', en: 'Pip' },
  grelotte: ELVES.find((e) => e.id === 'grelotte')?.name ?? { fr: 'Grelotte', en: 'Jingle' },
  noisette: ELVES.find((e) => e.id === 'noisette')?.name ?? { fr: 'Noisette', en: 'Hazel' },
};
export const ZIGGY_NAME: L = { fr: 'Ziggy', en: 'Ziggy' };

/* ---------- vocabulary ---------- */

export const COLOR_NAMES: Record<Color, { fr: Gendered; en: string }> = {
  red: { fr: { m: 'rouge', f: 'rouge', mp: 'rouges', fp: 'rouges' }, en: 'red' },
  yellow: { fr: { m: 'jaune', f: 'jaune', mp: 'jaunes', fp: 'jaunes' }, en: 'yellow' },
  blue: { fr: { m: 'bleu', f: 'bleue', mp: 'bleus', fp: 'bleues' }, en: 'blue' },
  green: { fr: { m: 'vert', f: 'verte', mp: 'verts', fp: 'vertes' }, en: 'green' },
  purple: { fr: { m: 'violet', f: 'violette', mp: 'violets', fp: 'violettes' }, en: 'purple' },
  orange: { fr: { m: 'orange', f: 'orange', mp: 'orange', fp: 'orange' }, en: 'orange' },
  brown: { fr: { m: 'marron', f: 'marron', mp: 'marron', fp: 'marron' }, en: 'brown' },
};

/** Shapes as nouns (a lone wheel is not a toy, but it is a fine surprise). */
export const SHAPE_NAMES: Record<Shape, { fr: string; frPlural: string; gender: 'm' | 'f'; en: string; enPlural: string }> = {
  cube: { fr: 'cube', frPlural: 'cubes', gender: 'm', en: 'cube', enPlural: 'cubes' },
  ball: { fr: 'boule', frPlural: 'boules', gender: 'f', en: 'ball', enPlural: 'balls' },
  cylinder: { fr: 'cylindre', frPlural: 'cylindres', gender: 'm', en: 'cylinder', enPlural: 'cylinders' },
  cone: { fr: 'cône', frPlural: 'cônes', gender: 'm', en: 'cone', enPlural: 'cones' },
  star: { fr: 'étoile', frPlural: 'étoiles', gender: 'f', en: 'star', enPlural: 'stars' },
  wheel: { fr: 'roue', frPlural: 'roues', gender: 'f', en: 'wheel', enPlural: 'wheels' },
};

export const MATERIAL_NAMES: Record<Material, L> = {
  wood: { fr: 'bois', en: 'wood' },
  felt: { fr: 'feutrine', en: 'felt' },
  metal: { fr: 'fer-blanc', en: 'tin' },
  yarn: { fr: 'laine', en: 'yarn' },
};

/** "a little piece of …": a raw item that was never shaped. */
export const RAW_NOUN = { fr: 'petit bout de {material}', frPlural: 'petits bouts de {material}', gender: 'm' as const, en: 'little piece of {material}', enPlural: 'little pieces of {material}' };

export const PATTERN_NAMES: Record<Pattern, { name: L; paper: L }> = {
  stripes: { name: { fr: 'rayures', en: 'stripes' }, paper: { fr: 'du papier à rayures', en: 'striped paper' } },
  dots: { name: { fr: 'pois', en: 'dots' }, paper: { fr: 'du papier à pois', en: 'polka-dot paper' } },
  stars: { name: { fr: 'étoiles', en: 'stars' }, paper: { fr: 'du papier à étoiles', en: 'starry paper' } },
  snowflakes: { name: { fr: 'flocons', en: 'snowflakes' }, paper: { fr: 'du papier à flocons', en: 'snowflake paper' } },
  hearts: { name: { fr: 'cœurs', en: 'hearts' }, paper: { fr: 'du papier à cœurs', en: 'heart paper' } },
};

export const STICKER_NAMES: Record<Sticker, L> = {
  star: { fr: 'une gommette étoile', en: 'a star sticker' },
  heart: { fr: 'une gommette cœur', en: 'a heart sticker' },
  moon: { fr: 'une gommette lune', en: 'a moon sticker' },
  snowflake: { fr: 'une gommette flocon', en: 'a snowflake sticker' },
};

/** Funny, always-positive adjectives for surprise-toy names (FR after the colour, EN before). */
export const SURPRISE_ADJECTIVES: { fr: { m: string; f: string }; en: string }[] = [
  { fr: { m: 'rigolo', f: 'rigolote' }, en: 'giggly' },
  { fr: { m: 'magique', f: 'magique' }, en: 'magic' },
  { fr: { m: 'farceur', f: 'farceuse' }, en: 'cheeky' },
  { fr: { m: 'pétillant', f: 'pétillante' }, en: 'sparkly' },
  { fr: { m: 'joyeux', f: 'joyeuse' }, en: 'jolly' },
  { fr: { m: 'dansant', f: 'dansante' }, en: 'dancing' },
  { fr: { m: 'tout doux', f: 'toute douce' }, en: 'cuddly' },
  { fr: { m: 'gigoteur', f: 'gigoteuse' }, en: 'wiggly' },
];

/* ---------- machines ---------- */

export const MACHINE_TEXT: Record<string, { name: L; does: L; def: L; indef: L }> = {
  belt: { name: { fr: 'Tapis roulant', en: 'Conveyor belt' }, does: { fr: 'Il avance les objets, une case à la fois.', en: 'It carries things along, one tile at a time.' }, def: { fr: 'le tapis roulant', en: 'the conveyor belt' }, indef: { fr: 'un tapis roulant', en: 'a conveyor belt' } },
  chute: { name: { fr: 'Toboggan à matériaux', en: 'Material chute' }, does: { fr: 'Pépin y fait glisser le bois, la feutrine, le fer-blanc ou la laine. Le cadran dit combien.', en: 'Pip slides wood, felt, tin or yarn down it. The dial says how many.' }, def: { fr: 'le toboggan', en: 'the chute' }, indef: { fr: 'un toboggan', en: 'a chute' } },
  shaper: { name: { fr: 'Façonneuse', en: 'Shaper' }, does: { fr: 'Grelotte donne une forme : cube, boule, cylindre, cône, étoile ou roue.', en: 'Jingle gives it a shape: cube, ball, cylinder, cone, star or wheel.' }, def: { fr: 'la façonneuse', en: 'the shaper' }, indef: { fr: 'une façonneuse', en: 'a shaper' } },
  painter: { name: { fr: 'Machine à peindre', en: 'Painter' }, does: { fr: 'Pépin peint avec une des six couleurs.', en: 'Pip paints it with one of the six colours.' }, def: { fr: 'la machine à peindre', en: 'the painter' }, indef: { fr: 'une machine à peindre', en: 'a painter' } },
  mixer: { name: { fr: 'Mélangeur de couleurs', en: 'Colour mixer' }, does: { fr: 'Deux pots de peinture, une nouvelle couleur : rouge et jaune font orange !', en: 'Two paint pots, one new colour: red and yellow make orange!' }, def: { fr: 'le mélangeur', en: 'the mixer' }, indef: { fr: 'un mélangeur', en: 'a mixer' } },
  assembler: { name: { fr: 'Assembleuse', en: 'Assembler' }, does: { fr: 'Grelotte rassemble les pièces et construit le jouet.', en: 'Jingle gathers the parts and builds the toy.' }, def: { fr: 'l’assembleuse', en: 'the assembler' }, indef: { fr: 'une assembleuse', en: 'an assembler' } },
  counter: { name: { fr: 'Porte-compteur', en: 'Counter gate' }, does: { fr: 'Noisette compte les objets et envoie certains à droite.', en: 'Hazel counts things and sends some of them to the right.' }, def: { fr: 'le porte-compteur', en: 'the counter gate' }, indef: { fr: 'un porte-compteur', en: 'a counter gate' } },
  sorter: { name: { fr: 'Trieuse', en: 'Sorter' }, does: { fr: 'SI l’objet ressemble au modèle, il va à gauche, SINON à droite.', en: 'IF the thing matches the picture it goes left, ELSE it goes right.' }, def: { fr: 'la trieuse', en: 'the sorter' }, indef: { fr: 'une trieuse', en: 'a sorter' } },
  loop: { name: { fr: 'Boucle à répéter', en: 'Repeat loop' }, does: { fr: 'L’objet fait des tours de boucle : un objet entre, plusieurs pareils sortent.', en: 'The thing rides round the loop: one goes in, several the same come out.' }, def: { fr: 'la boucle', en: 'the loop' }, indef: { fr: 'une boucle', en: 'a loop' } },
  stamper: { name: { fr: 'Tampon à gommettes', en: 'Sticker stamper' }, does: { fr: 'Noisette colle une gommette : étoile, cœur, lune ou flocon.', en: 'Hazel presses on a sticker: star, heart, moon or snowflake.' }, def: { fr: 'le tampon à gommettes', en: 'the sticker stamper' }, indef: { fr: 'un tampon à gommettes', en: 'a sticker stamper' } },
  wrapper: { name: { fr: 'Emballeuse', en: 'Wrapper' }, does: { fr: 'Noisette emballe le jouet dans un joli papier.', en: 'Hazel wraps the toy in pretty paper.' }, def: { fr: 'l’emballeuse', en: 'the wrapper' }, indef: { fr: 'une emballeuse', en: 'a wrapper' } },
  arm: { name: { fr: 'Bras robot', en: 'Robot arm' }, does: { fr: 'Il suit les cartes une par une, puis recommence.', en: 'It follows the cards one by one, then starts again.' }, def: { fr: 'le bras robot', en: 'the robot arm' }, indef: { fr: 'un bras robot', en: 'a robot arm' } },
  sack: { name: { fr: 'Hotte du traîneau', en: 'Sleigh sack' }, does: { fr: 'Ziggy regarde chaque jouet et le compare à la lettre.', en: 'Ziggy looks at every toy and compares it with the letter.' }, def: { fr: 'la hotte', en: 'the sack' }, indef: { fr: 'une hotte', en: 'a sack' } },
};

/** Robot arm cards. */
export const CARD_TEXT: Record<string, L> = {
  pick: { fr: 'Prendre', en: 'Pick up' },
  shape: { fr: 'Donner la forme', en: 'Shape' },
  paint: { fr: 'Peindre', en: 'Paint' },
  sticker: { fr: 'Coller une gommette', en: 'Add a sticker' },
  stack: { fr: 'Empiler', en: 'Stack' },
  ship: { fr: 'Envoyer', en: 'Send' },
  repeat: { fr: 'Répéter', en: 'Repeat' },
};

export const HALL_NAMES: Record<string, L> = {
  'wood-shop': { fr: 'L’atelier du bois', en: 'The wood shop' },
  'paint-room': { fr: 'La salle de peinture', en: 'The paint room' },
  'assembly-line': { fr: 'La chaîne de montage', en: 'The assembly line' },
  'logic-room': { fr: 'La salle des astuces', en: 'The clever room' },
  dispatch: { fr: 'Le départ des traîneaux', en: 'Santa’s dispatch' },
  'christmas-eve': { fr: 'La nuit de Noël', en: 'Christmas Eve' },
};

/* ---------- HUD buttons ---------- */

export const UI: Record<string, L> = {
  go: { fr: 'C’est parti !', en: 'GO!' },
  pause: { fr: 'Pause', en: 'Pause' },
  step: { fr: 'Pas à pas', en: 'Step' },
  speed1: { fr: 'Vitesse ×1', en: 'Speed ×1' },
  speed2: { fr: 'Vitesse ×2', en: 'Speed ×2' },
  reset: { fr: 'On recommence le tapis', en: 'Run it again' },
  undo: { fr: 'Annuler', en: 'Undo' },
  redo: { fr: 'Refaire', en: 'Redo' },
  rotate: { fr: 'Tourner', en: 'Turn' },
  remove: { fr: 'Enlever', en: 'Take away' },
  hint: { fr: 'Une idée ?', en: 'An idea?' },
  replay: { fr: 'Réécouter', en: 'Listen again' },
  shelf: { fr: 'L’étagère surprise', en: 'The surprise shelf' },
  catalogue: { fr: 'Le Grand Catalogue', en: 'The Grand Catalogue' },
  sandbox: { fr: 'Atelier libre', en: 'Free workshop' },
  shareCopy: { fr: 'Copier le code de mon atelier', en: 'Copy my workshop code' },
  sharePaste: { fr: 'Coller un code d’atelier', en: 'Paste a workshop code' },
  shareBad: { fr: 'Hmm, ce code s’est emmêlé. Essaie de le copier encore une fois !', en: 'Hmm, this code got tangled. Try copying it once more!' },
  idea: { fr: 'L’idée de Grelotte (pour s’amuser, pas obligé)', en: 'Jingle’s idea (just for fun, not needed)' },
};

/** Why a tap did nothing (said kindly, the elves are in charge of that tile). */
export const EDIT_REFUSAL: Record<string, L> = {
  outside: { fr: 'Là, c’est le mur de l’atelier !', en: 'That’s the workshop wall!' },
  blocked: { fr: 'Cette case, c’est l’établi des lutins.', en: 'That tile is the elves’ workbench.' },
  occupied: { fr: 'Il y a déjà une machine ici.', en: 'There’s already a machine here.' },
  locked: { fr: 'Les lutins ont collé cette machine : elle reste là !', en: 'The elves glued this one down: it stays here!' },
  'dial-locked': { fr: 'Ce cadran-là, Grelotte l’a déjà réglé.', en: 'Jingle already set this dial.' },
  'unknown-machine': { fr: 'Cette machine n’est pas encore inventée !', en: 'That machine isn’t invented yet!' },
  'bad-dial': { fr: 'Le cadran ne va pas jusque-là.', en: 'The dial doesn’t go that far.' },
  empty: { fr: 'Cette case est vide.', en: 'This tile is empty.' },
};

/* ---------- check gate (Ziggy) ---------- */

export const CHECK_TEXT = {
  done: { fr: 'Bravo ! C’est exactement ce que demande la lettre !', en: 'Yes! That’s exactly what the letter asks for!' },
  doneShelfOne: { fr: 'Et en prime, un jouet surprise sur l’étagère !', en: 'And a bonus surprise toy on the shelf!' },
  doneShelfMany: { fr: 'Et en prime, {n} jouets surprise sur l’étagère !', en: 'And {n} bonus surprise toys on the shelf!' },
  notStarted: { fr: 'Appuie sur « C’est parti ! » pour lancer l’atelier.', en: 'Press GO to start the workshop.' },
  nothingYet: { fr: 'Rien n’est encore arrivé dans la hotte : suivons le chemin des objets !', en: 'Nothing has reached the sack yet: let’s follow the path of the things!' },
  surprise: { fr: 'Oh, {made} ! Direction l’étagère surprise !', en: 'Ooh, {made}! Off to the surprise shelf!' },
  wanted: { fr: 'La lettre demande {wanted}.', en: 'The letter asks for {wanted}.' },
  stillNeedOne: { fr: 'La lettre attend encore {toy}.', en: 'The letter is still waiting for {toy}.' },
  stillNeedMany: { fr: 'La lettre attend encore {toys}.', en: 'The letter still needs {toys}.' },
  extra: { fr: 'En plus : {toys} ! Direction l’étagère surprise. La lettre en demande {count}.', en: 'Bonus: {toys}! Off to the surprise shelf. The letter asks for {count}.' },
  wrongBay: { fr: 'Ce jouet est arrivé dans la hotte {got}, la lettre le veut dans la hotte {want}.', en: 'This toy landed in sack {got}; the letter wants it in sack {want}.' },
  anyBay: { fr: 'la hotte du milieu', en: 'the middle sack' },
} satisfies Record<string, L>;

/** The question Ziggy asks to point at the one step that differs. */
export const DIFF_QUESTION: Record<string, L> = {
  color: { fr: 'Quelle machine peint ?', en: 'Which machine paints?' },
  toy: { fr: 'Quelle machine donne la forme ou assemble le jouet ?', en: 'Which machine shapes or builds the toy?' },
  n: { fr: 'Combien de pièces ? Regarde le cadran de l’assembleuse.', en: 'How many parts? Look at the assembler’s dial.' },
  sticker: { fr: 'Quelle machine colle les gommettes ?', en: 'Which machine adds stickers?' },
  wrap: { fr: 'Quel papier choisit l’emballeuse ?', en: 'Which paper does the wrapper pick?' },
  material: { fr: 'Qu’est-ce qui glisse dans le toboggan ?', en: 'What slides down the chute?' },
  partColors: { fr: 'Dans quel ordre le bras peint-il les cubes ?', en: 'In which order does the arm paint the blocks?' },
  bay: { fr: 'Quel chemin mène à la bonne hotte ?', en: 'Which path leads to the right sack?' },
  order: { fr: 'Dans quel ordre les jouets arrivent-ils ?', en: 'In which order do the toys arrive?' },
};

/** The elf on duty takes the blame, with a laugh (never the child). */
export const ELF_BLAME: Record<string, L> = {
  color: { fr: 'Hihi, {elf} a attrapé le pot d’à côté !', en: 'Hee hee, {elf} grabbed the pot next to it!' },
  toy: { fr: 'Oups, {elf} a tourné la façonneuse en rêvant !', en: 'Oops, {elf} turned the shaper while daydreaming!' },
  n: { fr: 'Oh là là, {elf} a compté avec ses chaussettes !', en: 'Oh dear, {elf} was counting on their socks!' },
  sticker: { fr: 'Hihi, {elf} adore cette gommette-là !', en: 'Hee hee, {elf} just loves that sticker!' },
  wrap: { fr: 'Oups, {elf} a pris son papier préféré !', en: 'Oops, {elf} picked their favourite paper!' },
  material: { fr: 'Oups, {elf} a ouvert l’autre sac de matériaux ! Ha ha !', en: 'Oops, {elf} opened the other sack of materials! Ha ha!' },
  partColors: { fr: 'Hihi, {elf} a mélangé les cartes !', en: 'Hee hee, {elf} shuffled the cards!' },
  bay: { fr: 'Oups, {elf} a pris le virage trop vite !', en: 'Whoops, {elf} took the turn too fast!' },
  order: { fr: 'Hihi, {elf} a fait la ronde avec les jouets !', en: 'Hee hee, {elf} danced the toys round in a circle!' },
};

/* ---------- gentle hints (only after the child asks, or the glowing slot for little ones) ---------- */

export const HINT_TEXT = {
  done: { fr: 'Tout est prêt ! Appuie sur « C’est parti ! » et regarde.', en: 'All set! Press GO and watch.' },
  slot: { fr: 'Regarde la case qui brille : quelle machine va là ?', en: 'Look at the glowing tile: which machine goes there?' },
  place: { fr: 'Et si on mettait {machine} en {cell} ?', en: 'What if we put {machine} on {cell}?' },
  dial: { fr: '{Machine} en {cell} : essaie {value}.', en: '{Machine} on {cell}: try {value}.' },
  turn: { fr: '{Machine} en {cell} : un petit tour avec ↻, pour regarder vers {dir}.', en: '{Machine} on {cell}: give it a turn with ↻ so it faces {dir}.' },
  remove: { fr: '{Machine} en {cell} peut faire la sieste : tu peux l’enlever.', en: '{Machine} on {cell} can take a nap: you can take it away.' },
  stuck: { fr: 'Un objet attend en {cell} : le chemin s’arrête là. Un tapis vers {dir} ?', en: 'Something is waiting on {cell}: the path stops there. A belt going {dir}?' },
  basket: { fr: 'L’assembleuse en {cell} attend encore : {parts}.', en: 'The assembler on {cell} is still waiting for {parts}.' },
  run: { fr: 'Appuie sur « C’est parti ! » pour voir ce que fabrique l’atelier.', en: 'Press GO to see what the workshop makes.' },
} satisfies Record<string, L>;

export const DIR_NAMES: Record<string, L> = {
  N: { fr: 'le haut', en: 'up' },
  E: { fr: 'la droite', en: 'right' },
  S: { fr: 'le bas', en: 'down' },
  W: { fr: 'la gauche', en: 'left' },
};

/** Grammar words used when building phrases. */
export const GRAMMAR = {
  indef: { m: 'un', f: 'une', en: 'a', enVowel: 'an' },
  def: { m: 'le', f: 'la', elided: 'l’', en: 'the' },
  with: { fr: 'avec', en: 'with' },
  wrapped: { fr: { m: 'emballé dans', f: 'emballée dans' }, en: 'wrapped in' },
  and: { fr: 'et', en: 'and' },
};

/** Every L in this module (for the FR/EN and banned-word tests). */
export function allTexts(): L[] {
  const out: L[] = [];
  const push = (v: unknown) => {
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.fr === 'string' && typeof o.en === 'string') out.push({ fr: o.fr, en: o.en });
      else for (const x of Object.values(o)) push(x);
    }
  };
  push([ELF_NAMES, MATERIAL_NAMES, PATTERN_NAMES, STICKER_NAMES, MACHINE_TEXT, CARD_TEXT, HALL_NAMES, UI, EDIT_REFUSAL, CHECK_TEXT, DIFF_QUESTION, ELF_BLAME, HINT_TEXT, DIR_NAMES]);
  return out;
}

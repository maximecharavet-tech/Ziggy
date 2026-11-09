/**
 * FR + EN texts of the pure logic (HUD words, puzzle prompts and hints).
 * Spoken by the runtime (pre-baked voice or TTS) and shown for 7+.
 * Character lines (Ziggy, elves) live in `src/data/games/lutin-chaos/lines.json`.
 * Rules: always positive; a wrong try is "almost!" + help; the elf takes the
 * blame, never the child. `texts.test.ts` scans everything for banned words.
 */
import bible from '@/data/lutins/bible.json';
import type { ElfId, L } from './types';

const ELF_NAMES = Object.fromEntries(bible.elves.map((e) => [e.id, e.name])) as Record<ElfId, L>;
export const elfName = (e: ElfId): L => ELF_NAMES[e];

/** Join L parts. */
export const cat = (...parts: (L | string)[]): L => ({
  fr: parts.map((p) => (typeof p === 'string' ? p : p.fr)).join(''),
  en: parts.map((p) => (typeof p === 'string' ? p : p.en)).join(''),
});

/** Replace `{key}` placeholders in both languages. */
export function fill(text: L, vars: Record<string, L | string | number>): L {
  const rep = (s: string, lang: 'fr' | 'en') =>
    s.replace(/\{(\w+)\}/g, (m, k: string) => {
      const v = vars[k];
      if (v === undefined) return m;
      return typeof v === 'object' ? v[lang] : String(v);
    });
  return { fr: frContract(rep(text.fr, 'fr')), en: rep(text.en, 'en') };
}

/** French contractions after filling: « de le » → « du », « à le » → « au »… */
export const frContract = (s: string) =>
  s
    .replace(/\bde le /g, 'du ')
    .replace(/\bde les /g, 'des ')
    .replace(/(^|\s)à le /g, '$1au ')
    .replace(/(^|\s)à les /g, '$1aux ');

export const GAME_TITLE: L = { fr: 'Le Grand Chahut des Lutins', en: 'Elf Chaos' };

/** HUD and flow words. */
export const UI = {
  play: { fr: 'On joue !', en: 'Let’s play!' },
  anotherRoom: { fr: 'Une autre pièce', en: 'Another room' },
  seeYou: { fr: 'À bientôt !', en: 'See you soon!' },
  replayLine: { fr: 'Réécouter', en: 'Listen again' },
  magnifier: { fr: 'La loupe de Ziggy', en: 'Ziggy’s magnifier' },
  hint: { fr: 'Un indice', en: 'A clue' },
  findPranks: { fr: 'Qu’est-ce qui est rigolo ici ? Touche les farces !', en: 'What looks silly here? Tap the pranks!' },
  pranksLeft: { fr: 'Encore {n} farce(s) à trouver.', en: '{n} more prank(s) to find.' },
  whoDidIt: { fr: 'Qui a fait cette farce ?', en: 'Who played this prank?' },
  whereHiding: { fr: 'Où se cache {elf} ? Touche la cachette !', en: 'Where is {elf} hiding? Tap the hiding place!' },
  tickle: { fr: 'Chatouille {elf} !', en: 'Tickle {elf}!' },
  fixIt: { fr: 'On répare avec Ziggy !', en: 'Let’s fix it with Ziggy!' },
  showMe: { fr: 'On le fait ensemble !', en: 'Let’s do it together!' },
  roomFixed: { fr: 'Toute la pièce est réparée !', en: 'The whole room is fixed!' },
  finaleWatch: { fr: 'Oh oh… regarde bien ce qui se passe !', en: 'Uh-oh… watch what happens!' },
  finaleRewind: { fr: 'On rembobine ! Touche les étapes en commençant par la dernière.', en: 'Let’s rewind! Tap the steps, starting with the last one.' },
  finalePredict: { fr: 'Qu’est-ce qui va bouger ensuite ?', en: 'What will move next?' },
  photo: { fr: 'Tout le monde sourit pour la photo !', en: 'Everybody smile for the photo!' },
  nap: { fr: 'Les lutins font une petite sieste sur le canapé.', en: 'The elves curl up for a nap on the sofa.' },
  album: { fr: 'L’album des farces', en: 'The prank album' },
  sandbox: { fr: 'La Maison des Farces', en: 'The Prank House' },
  sandboxSetup: { fr: 'À toi de cacher les lutins et de préparer des farces !', en: 'Your turn: hide the elves and set up pranks!' },
  sandboxGo: { fr: 'Ziggy, à toi de chercher !', en: 'Ziggy, your turn to search!' },
  warmer: { fr: 'Plus chaud !', en: 'Warmer!' },
  colder: { fr: 'Plus froid !', en: 'Colder!' },
  here: { fr: 'C’est là !', en: 'Right here!' },
  tonight: { fr: 'Hé, c’est la farce qu’ils ont faite chez nous !', en: 'Hey, that’s the prank they played in our house!' },
} satisfies Record<string, L>;

/** Praise after a solved puzzle (picked by the runtime or the session). */
export const PRAISE: L[] = [
  { fr: 'Bravo ! C’est tout réparé !', en: 'Hooray! All fixed!' },
  { fr: 'Super ! Tu as trouvé !', en: 'Super! You got it!' },
  { fr: 'Youpi ! Exactement ça !', en: 'Yippee! Exactly right!' },
  { fr: 'Génial, merci de ton aide !', en: 'Brilliant, thanks for your help!' },
];

/** Generic hints by level (the fix plug-ins add specific ones). */
export const HINT = {
  almost: { fr: 'Presque ! On regarde encore une fois ensemble ?', en: 'Almost! Shall we look again together?' },
  together: { fr: 'On le fait ensemble, je te montre !', en: 'Let’s do it together, I’ll show you!' },
  more: { fr: 'Presque ! Il en faut un peu plus.', en: 'Almost! We need a few more.' },
  less: { fr: 'Presque ! Il en faut un peu moins.', en: 'Almost! We need a few less.' },
  countTogether: { fr: 'Comptons ensemble : un, deux, trois…', en: 'Let’s count together: one, two, three…' },
  lookAt: { fr: 'Regarde celui-ci de plus près !', en: 'Have a closer look at this one!' },
  firstStep: { fr: 'Suis la première empreinte avec moi !', en: 'Follow the first footprint with me!' },
  hourRight: { fr: 'La petite aiguille est bien ! Et la grande ?', en: 'The short hand is right! What about the long hand?' },
  minuteRight: { fr: 'La grande aiguille est bien ! Et la petite ?', en: 'The long hand is right! What about the short hand?' },
} satisfies Record<string, L>;

/** The elf takes the blame for a mix-up (design doc A8), never the child. */
export const ELF_BLAME: L[] = [
  { fr: 'Oups, c’est ma faute, j’ai tout mélangé !', en: 'Oops, my fault, I mixed them all up!' },
  { fr: 'Hi hi, j’ai trop bien caché, c’est de ma faute !', en: 'Tee-hee, I hid it too well, that’s on me!' },
  { fr: 'Pardon, mes farces sont vraiment trop farceuses !', en: 'Sorry, my pranks are just too pranky!' },
];

/** Spatial words (place / path puzzles). */
export const RELATION: Record<string, L> = {
  in: { fr: 'dans', en: 'in' },
  on: { fr: 'sur', en: 'on' },
  under: { fr: 'sous', en: 'under' },
  left: { fr: 'à gauche de', en: 'to the left of' },
  right: { fr: 'à droite de', en: 'to the right of' },
  behind: { fr: 'derrière', en: 'behind' },
  front: { fr: 'devant', en: 'in front of' },
  above: { fr: 'au-dessus de', en: 'above' },
  below: { fr: 'en dessous de', en: 'below' },
};

export const DIRECTION: Record<'up' | 'down' | 'left' | 'right', { icon: string; name: L }> = {
  up: { icon: '⬆️', name: { fr: 'en haut', en: 'up' } },
  down: { icon: '⬇️', name: { fr: 'en bas', en: 'down' } },
  left: { icon: '⬅️', name: { fr: 'à gauche', en: 'left' } },
  right: { icon: '➡️', name: { fr: 'à droite', en: 'right' } },
};

export const DAYS: L[] = [
  { fr: 'lundi', en: 'Monday' },
  { fr: 'mardi', en: 'Tuesday' },
  { fr: 'mercredi', en: 'Wednesday' },
  { fr: 'jeudi', en: 'Thursday' },
  { fr: 'vendredi', en: 'Friday' },
  { fr: 'samedi', en: 'Saturday' },
  { fr: 'dimanche', en: 'Sunday' },
];

export const ORDINALS: L[] = [
  { fr: '1er', en: '1st' },
  { fr: '2e', en: '2nd' },
  { fr: '3e', en: '3rd' },
  { fr: '4e', en: '4th' },
  { fr: '5e', en: '5th' },
  { fr: '6e', en: '6th' },
];

export const SIZE_WORDS: L[] = [
  { fr: 'tout petit', en: 'tiny' },
  { fr: 'petit', en: 'small' },
  { fr: 'moyen', en: 'medium' },
  { fr: 'grand', en: 'big' },
  { fr: 'très grand', en: 'very big' },
  { fr: 'géant', en: 'giant' },
];

/** Prompt templates of the fix puzzles (filled with `fill`). */
export const FIX_TEXT = {
  countBack: { fr: 'Combien de {items} faut-il remettre {target} ?', en: 'How many {items} go back {target}?' },
  countLeft: { fr: 'Il y avait {total} {items}. {done} sont déjà à leur place. Combien encore ?', en: 'There were {total} {items}. {done} are put away. How many more?' },
  countTwoPlaces: { fr: '{a} {items} ici et {b} là-bas : combien en tout ?', en: '{a} {items} here and {b} over there: how many altogether?' },
  countGroups: { fr: '{groups} piles de {size} {items} : combien en tout ?', en: '{groups} piles of {size} {items}: how many altogether?' },
  countExtra: { fr: 'Il y a {total} {items} pour {need} invités. Combien en trop ?', en: 'There are {total} {items} for {need} guests. How many extra?' },
  shareFair: { fr: 'Partage {total} {items} entre {plates} assiettes, pareil pour chacune. Combien par assiette ?', en: 'Share {total} {items} fairly on {plates} plates. How many on each plate?' },
  shareHalf: { fr: 'La moitié de {total} {items}, ça fait combien ?', en: 'Half of {total} {items} is how many?' },
  shareQuarter: { fr: 'Un quart de {total} {items}, ça fait combien ?', en: 'A quarter of {total} {items} is how many?' },
  sortOne: { fr: 'Range chaque objet dans le bon panier !', en: 'Put each thing in the right basket!' },
  sortTwo: { fr: 'Range par couleur ET par forme : chaque objet dans sa case !', en: 'Sort by colour AND shape: each thing in its box!' },
  oddOne: { fr: 'Un objet ne suit pas la règle des autres. Lequel ?', en: 'One thing doesn’t follow the others’ rule. Which one?' },
  pairMatch: { fr: 'Retrouve les paires de {items} !', en: 'Find the pairs of {items}!' },
  pairLeftRight: { fr: 'Fais les paires : un gauche avec un droit, de la même couleur !', en: 'Make pairs: one left with one right, same colour!' },
  pairTwoCriteria: { fr: 'Fais les paires : même couleur ET même motif !', en: 'Make pairs: same colour AND same pattern!' },
  pairShadow: { fr: 'Chaque objet retrouve son ombre !', en: 'Match each thing with its shadow!' },
  orderSize: { fr: 'Range du plus petit au plus grand !', en: 'Line them up from smallest to biggest!' },
  orderNumber: { fr: 'Range les numéros dans l’ordre, du plus petit au plus grand !', en: 'Put the numbers in order, smallest first!' },
  orderAlphabet: { fr: 'Range les lettres dans l’ordre de l’alphabet !', en: 'Put the letters in alphabetical order!' },
  orderDays: { fr: 'Range les jours de la semaine, à partir de lundi !', en: 'Put the days of the week in order, starting with Monday!' },
  orderSkip: { fr: 'Range les nombres : on compte de {step} en {step} !', en: 'Order the numbers: we count in {step}s!' },
  patternNext: { fr: 'Qu’est-ce qui vient ensuite dans la guirlande ?', en: 'What comes next in the garland?' },
  patternGaps: { fr: 'Complète les trous de la suite !', en: 'Fill the gaps in the pattern!' },
  placeIt: { fr: 'Mets {item} {relation} {anchor} !', en: 'Put {item} {relation} {anchor}!' },
  placeGrid: { fr: 'Mets {item} {rel1} {anchor}, {rel2} !', en: 'Put {item} {rel1} {anchor}, {rel2}!' },
  pathArrows: { fr: 'Suis les flèches des empreintes. Où arrives-tu ?', en: 'Follow the footprint arrows. Where do you end up?' },
  pathWords: { fr: 'Suis les empreintes : {steps}. Où arrives-tu ?', en: 'Follow the footprints: {steps}. Where do you end up?' },
  pathCoords: { fr: 'Départ en {start}. Puis {steps}. Quelle case ?', en: 'Start at {start}. Then {steps}. Which square?' },
  rotateTurn: { fr: 'Fais tourner {item} pour tout remettre à l’endroit !', en: 'Turn {item} the right way up!' },
  rotateMatch: { fr: 'Quelle image est la même forme, juste tournée ?', en: 'Which picture is the same shape, just turned?' },
  nameFind: { fr: 'Où est {item} ? Montre-moi !', en: 'Where is {item}? Show me!' },
  nameWord: { fr: 'Trouve : « {word} »', en: 'Find: "{word}"' },
  clockOclock: { fr: 'Remets l’horloge à {h} heures !', en: 'Set the clock back to {h} o’clock!' },
  clockSet: { fr: 'Remets l’horloge à {time} !', en: 'Set the clock to {time}!' },
  clockAhead: { fr: 'L’horloge avance de {delta}. Elle montre {shown}. Quelle est la vraie heure ?', en: 'The clock is {delta} fast. It shows {shown}. What is the real time?' },
} satisfies Record<string, L>;

/**
 * The elves' letters: the arrival letter (first morning), a short morning note
 * for every prank of the catalogue (src/data/lutins/pranks.ts) plus one for the
 * parents' own ideas, and the departure letter (Christmas morning).
 *
 * Always warm and funny: no behaviour conditions, no "be good or else", no
 * guilt, the elves are never sad (even when they leave, they are happy and
 * coming back). The notes say "we": the elves who actually did the prank sign
 * them (the entry's elves), so a note never names an elf who wasn't there.
 */
import type { L } from '@/lib/i18n-text';

export type LetterKind = 'arrival' | 'morning' | 'departure';

/** One short note per prank id. Tested: every prank has one, in FR and EN. */
export const MORNING_NOTES: Record<string, L> = {
  'papier-toilette': {
    fr: 'On voulait décorer pour Noël… mais on n’a trouvé que du papier toilette ! Joli, non ?',
    en: 'We wanted to decorate for Christmas… but all we found was toilet paper! Pretty, right?',
  },
  'cache-cache': {
    fr: 'On a joué à cache-cache toute la nuit. Chut… on est peut-être encore cachés !',
    en: 'We played hide-and-seek all night. Shh… we might still be hiding!',
  },
  'course-voitures': {
    fr: 'Grande course de nuit ! Le gagnant a eu droit à une miette de biscuit. Tu veux ta revanche ?',
    en: 'Big night-time race! The winner got a cookie crumb. Fancy a rematch?',
  },
  tente: {
    fr: 'Cette nuit, on a fait du camping chez toi. Les meilleures histoires se racontent sous la tente !',
    en: 'Last night we went camping at your place. The best stories are told in a tent!',
  },
  'post-it': {
    fr: 'On avait plein de petits papiers de couleur… alors on t’a fait un GRAND sourire !',
    en: 'We had loads of little sticky notes… so we made you a BIG smile!',
  },
  bulles: {
    fr: 'Pop ! Pop ! Pop ! Fête des bulles ! On en a attrapé cent douze… ou peut-être trois.',
    en: 'Pop! Pop! Pop! Bubble party! We caught a hundred and twelve… or maybe three.',
  },
  'photo-lutins': {
    fr: 'Ouistiti ! On voulait une photo souvenir de notre visite. Tu nous trouves beaux ?',
    en: 'Say cheese! We wanted a souvenir photo of our visit. Don’t we look great?',
  },
  dominos: {
    fr: 'Clac, clac, clac ! Toute la nuit pour les aligner, et trois secondes pour tout faire tomber !',
    en: 'Click, clack, click! All night to line them up, and three seconds to knock them all down!',
  },
  peluches: {
    fr: 'Grande réunion avec tes doudous : on a voté pour plus de câlins. Adopté par tout le monde !',
    en: 'Big meeting with your cuddly toys: we voted for more hugs. Everybody said yes!',
  },
  livres: {
    fr: 'Tes livres font des toboggans géniaux ! On a glissé jusqu’au matin. Wiiiii !',
    en: 'Your books make brilliant slides! We slid all the way to morning. Wheee!',
  },
  'farine-anges': {
    fr: 'Il a neigé dans la cuisine ! On a fait des anges… un tout petit peu farinés.',
    en: 'It snowed in the kitchen! We made angels… just a little bit floury.',
  },
  guimauves: {
    fr: 'Rien de tel qu’un bain de guimauves après une longue nuit de farces. Tout doux, tout moelleux !',
    en: 'Nothing beats a marshmallow bath after a long night of pranks. So soft and squishy!',
  },
  cereales: {
    fr: 'On a plongé dans tes céréales. Ça fait une super piscine… qui croustille !',
    en: 'We dived into your cereal. It makes a super pool… a crunchy one!',
  },
  pancakes: {
    fr: 'Une tour de pancakes plus haute que nous ! La fraise tout en haut, c’est la touche du chef.',
    en: 'A pancake tower taller than us! The strawberry on top is the chef’s special touch.',
  },
  'visages-fruits': {
    fr: 'Tes fruits avaient l’air de s’ennuyer, alors on leur a dessiné un sourire !',
    en: 'Your fruit looked a bit bored, so we drew them some smiles!',
  },
  'peche-bonbons': {
    fr: 'Partie de pêche ! Pas un seul poisson… mais des bonbons, c’est encore mieux.',
    en: 'Fishing trip! Not a single fish… but sweets are even better.',
  },
  biscuits: {
    fr: 'Atelier biscuits ! On en a décoré plein… et goûté un tout petit bout. Juste pour vérifier.',
    en: 'Cookie workshop! We decorated loads… and tasted a teeny bit. Just to check.',
  },
  origami: {
    fr: 'On plie, on replie… Voici la grande parade des cygnes et des bateaux en papier !',
    en: 'Fold, fold again… Here comes the grand parade of paper swans and boats!',
  },
  'canape-fort': {
    fr: 'Ce château de coussins est à nous ! Le mot de passe pour entrer : « chaussette ».',
    en: 'This cushion castle is ours! The password to get in: “sock”.',
  },
  telecommande: {
    fr: 'On t’a fait un cadeau : la télécommande ! Bon… on l’a juste emballée.',
    en: 'We got you a present: the remote! Well… we just wrapped it up.',
  },
  cinema: {
    fr: 'Soirée cinéma ! On a partagé le pop-corn… enfin, presque tout.',
    en: 'Movie night! We shared the popcorn… well, almost all of it.',
  },
  chaussettes: {
    fr: 'Bataille de chaussettes ! Personne n’a gagné, et tout le monde a rigolé.',
    en: 'Sock fight! Nobody won, and everybody laughed.',
  },
  bonhomme: {
    fr: 'Pas de neige dehors ? Pas grave : voici un bonhomme de neige en papier. Lui, il ne fond jamais !',
    en: 'No snow outside? No problem: here’s a paper snowman. This one never melts!',
  },
  'coton-neige': {
    fr: 'Bataille de boules de neige… en coton ! Toutes douces, et pas froides du tout.',
    en: 'Snowball fight… with cotton balls! All soft, and not cold at all.',
  },
  chaussures: {
    fr: 'Tchou-tchou ! Le train des chaussures va partir. Tout le monde à bord !',
    en: 'Choo-choo! The shoe train is leaving. All aboard!',
  },
  dessin: {
    fr: 'On a ouvert une galerie d’art ! L’entrée est gratuite et les artistes sont très mignons.',
    en: 'We opened an art gallery! Entry is free and the artists are very cute.',
  },
  'cabane-draps': {
    fr: 'On a construit une cabane pour lire avec une lampe. Il reste de la place pour toi !',
    en: 'We built a fort for reading by torchlight. There’s room for you too!',
  },
  dentifrice: {
    fr: 'Concours de brossage de dents ! Regarde nos sourires : ils brillent comme des étoiles.',
    en: 'Tooth-brushing contest! Look at our smiles: they shine like stars.',
  },
  canard: {
    fr: 'Course de canards ! Coin-coin, à vos marques… partez !',
    en: 'Rubber-duck race! Quack-quack, ready, steady… go!',
  },
  mousse: {
    fr: 'Petite pause au spa des lutins : des bulles, du concombre et beaucoup de détente. Ahhh !',
    en: 'A little break at the elves’ spa: bubbles, cucumber and lots of relaxing. Ahhh!',
  },
  'sapin-decoration': {
    fr: 'Surprise ! Cette année, les nouvelles décorations du sapin… c’est nous !',
    en: 'Surprise! This year’s new tree decorations… are us!',
  },
  'cadeaux-tour': {
    fr: 'On a construit une pyramide de cadeaux. Et tout en haut, la plus belle des étoiles !',
    en: 'We built a gift pyramid. And right at the top, the most beautiful star!',
  },
  guirlande: {
    fr: 'On voulait juste vérifier que la guirlande marchait… et on s’est un peu emmêlés !',
    en: 'We only wanted to check the fairy lights worked… and we got a little tangled!',
  },
  'boules-jonglage': {
    fr: 'Mesdames et messieurs, le grand cirque des lutins ! Hop, hop, hop, les boules s’envolent !',
    en: 'Ladies and gentlemen, the great elf circus! Hop, hop, hop, the baubles fly!',
  },
  'lettre-pere-noel': {
    fr: 'On a écrit une grande lettre au Père Noël pour lui raconter nos farces chez toi. Il va bien rire !',
    en: 'We wrote a big letter to Santa all about our pranks at your place. He’ll have a good laugh!',
  },
  'chocolat-chaud': {
    fr: 'Pause chocolat chaud ! Regarde nos moustaches de chantilly : très chic, non ?',
    en: 'Hot-chocolate break! Look at our whipped-cream moustaches: very fancy, right?',
  },
  reveil: {
    fr: 'Pouet ! Boum ! Debout, c’est le matin ! Notre fanfare te souhaite une journée magique.',
    en: 'Toot! Boom! Rise and shine! Our little band wishes you a magical day.',
  },
};

/** The note for the parents' own prank ideas (and any unknown id). */
export const GENERIC_NOTE: L = {
  fr: 'Cette nuit, on a encore fait des nôtres ! On espère que notre farce t’a bien fait rire.',
  en: 'Last night we got up to mischief again! We hope our prank made you laugh.',
};

export function morningNote(prankId: string | null | undefined): L {
  return (prankId && MORNING_NOTES[prankId]) || GENERIC_NOTE;
}

export type Letter = {
  kind: LetterKind;
  title: string;
  greeting: string;
  paragraphs: string[];
  signoff: string;
  /** The elves who sign it (bible ids). */
  elves: string[];
};

const ALL = ['pepin', 'grelotte', 'noisette'];

const TEXT = {
  hello: { fr: 'Coucou {name} !', en: 'Hello {name}!' },
  helloAnon: { fr: 'Coucou !', en: 'Hello!' },
  morningTitle: { fr: 'Le mot des lutins', en: 'A note from the elves' },
  morningSign: { fr: 'Tes lutins farceurs', en: 'Your prankster elves' },
  arrivalTitle: { fr: 'Nous sommes arrivés du Pôle Nord !', en: 'We’ve arrived from the North Pole!' },
  arrival: [
    {
      fr: 'Après un long voyage en traîneau, à travers les nuages et les flocons, nous voilà enfin chez toi !',
      en: 'After a long sleigh ride through the clouds and the snowflakes, here we are at your place at last!',
    },
    {
      fr: 'Nous sommes Pépin, Grelotte et Noisette, les lutins farceurs de Ziggy. Jusqu’à Noël, chaque nuit, pendant que tu dors, nous préparerons une petite farce rien que pour toi.',
      en: 'We’re Pip, Jingle and Hazel, Ziggy’s prankster elves. Every night until Christmas, while you sleep, we’ll get up to a little prank just for you.',
    },
    {
      fr: 'Chaque matin, ouvre le journal des lutins pour découvrir ce que nous avons fait. Et regarde bien : nous adorons nous cacher !',
      en: 'Every morning, open the elves’ journal to see what we’ve been up to. And look closely: we love to hide!',
    },
    {
      fr: 'Nous sommes tellement contents d’être là. Ça va être le plus joyeux des mois de décembre !',
      en: 'We’re so happy to be here. This is going to be the jolliest December ever!',
    },
  ],
  arrivalSign: { fr: 'Avec des paillettes plein les poches,', en: 'With pockets full of glitter,' },
  departureTitle: { fr: 'À l’année prochaine !', en: 'See you next year!' },
  departure: [
    {
      fr: 'C’est le grand jour : le Père Noël a besoin de nous au Pôle Nord pour sa grande tournée.',
      en: 'Today is the big day: Santa needs us back at the North Pole for his big trip.',
    },
    {
      fr: 'Merci pour ce mois de décembre plein de rires. On a adoré chaque nuit chez toi : les cachettes, les farces, et les matins tout pétillants.',
      en: 'Thank you for a December full of laughter. We loved every night at your place: the hiding spots, the pranks, and the sparkly mornings.',
    },
    {
      fr: 'On emporte tous ces souvenirs dans notre sac à paillettes. Ils vont nous tenir chaud tout l’hiver !',
      en: 'We’re packing all these memories into our glitter bag. They’ll keep us warm all winter!',
    },
    {
      fr: 'Joyeux Noël ! On reviendra l’année prochaine, promis juré.',
      en: 'Merry Christmas! We’ll be back next year, cross our hearts.',
    },
  ],
  departureSign: { fr: 'Gros bisous givrés,', en: 'Big frosty hugs,' },
} satisfies Record<string, L | L[]>;

/** French typography: a non-breaking space before ! ? : ; » and after « (no lonely "!" on a new line). */
const frSpaces = (x: string) => x.replace(/ ([!?:;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');
const t = (l: L, locale: string) => (locale === 'fr' ? frSpaces(l.fr) : l.en);

export function greeting(name: string | null | undefined, locale: string): string {
  const n = name?.trim();
  return n ? t(TEXT.hello, locale).replace('{name}', n) : t(TEXT.helloAnon, locale);
}

/** A letter ready to show, print and read aloud. */
export function buildLetter(kind: LetterKind, locale: string, opts: { name?: string | null; prankId?: string | null; elves?: string[] } = {}): Letter {
  const elves = opts.elves?.length ? ALL.filter((id) => opts.elves!.includes(id)) : ALL;
  const g = greeting(opts.name, locale);
  if (kind === 'morning') {
    return { kind, title: t(TEXT.morningTitle, locale), greeting: g, paragraphs: [t(morningNote(opts.prankId), locale)], signoff: t(TEXT.morningSign, locale), elves };
  }
  if (kind === 'arrival') {
    return { kind, title: t(TEXT.arrivalTitle, locale), greeting: g, paragraphs: TEXT.arrival.map((p) => t(p, locale)), signoff: t(TEXT.arrivalSign, locale), elves: ALL };
  }
  return { kind, title: t(TEXT.departureTitle, locale), greeting: g, paragraphs: TEXT.departure.map((p) => t(p, locale)), signoff: t(TEXT.departureSign, locale), elves: ALL };
}

/** What the read-aloud button says, in order. */
export function letterLines(l: Letter): string[] {
  return [l.title, l.greeting, ...l.paragraphs];
}

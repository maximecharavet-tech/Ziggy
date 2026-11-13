import type { L } from '@/lib/i18n-text';

export type AdventKind = 'message' | 'challenge' | 'story' | 'riddle' | 'coloring' | 'game';
export type AdventEntry = { day: number; kind: AdventKind; title: L; text: L; answer?: L; href?: string };
const e = (day: number, kind: AdventKind, titleFr: string, textFr: string, titleEn: string, textEn: string, extras: Pick<AdventEntry, 'answer' | 'href'> = {}): AdventEntry => ({ day, kind, title: { fr: titleFr, en: titleEn }, text: { fr: textFr, en: textEn }, ...extras });

/** Original, gentle daily activities for children aged three to nine. */
export const SANTA_ADVENT: AdventEntry[] = [
  e(1,'message','Bonjour du Pôle Nord','Je t’envoie un sourire plein de flocons. Quel joli mois commence !','Hello from the North Pole','I’m sending you a smile full of snowflakes. What a lovely month begins!'),
  e(2,'challenge','Le compliment doux','Dis une chose gentille à quelqu’un que tu aimes.','A kind compliment','Say one kind thing to someone you love.'),
  e(3,'story','La moufle rouge','Une petite moufle rouge tomba dans la neige. Un moineau s’y abrita, puis une souris vint partager sa chaleur. Au matin, leurs traces formaient un cœur dans la poudre blanche.','The red mitten','A little red mitten fell into the snow. A sparrow sheltered inside, then a mouse came to share its warmth. In the morning, their tracks made a heart in the white powder.'),
  e(4,'riddle','La devinette blanche','Je tombe du ciel sans me faire mal. Je fonds dans ta main. Qui suis-je ?','A white riddle','I fall from the sky without getting hurt. I melt in your hand. What am I?',{ answer:{fr:'Un flocon de neige !',en:'A snowflake!'} }),
  e(5,'challenge','La danse des rennes','Fais trois petits bonds de renne, puis un grand étirement.','Reindeer dance','Do three little reindeer hops, then a big stretch.'),
  e(6,'message','Un merci qui réchauffe','Pense à une personne qui t’a aidé. Un merci peut illuminer sa journée.','A thank-you that warms','Think of someone who helped you. A thank-you can brighten their day.'),
  e(7,'game','La forêt enneigée','Partons explorer le monde de Noël de Ziggy !','Snowy forest','Let’s explore Ziggy’s Christmas world!',{href:'/monde/3d/noel'}),
  e(8,'story','La clochette timide','Dans l’atelier, une minuscule clochette n’osait pas sonner. Un lutin lui dit : « Ton tintement est à toi, il n’a pas besoin d’être fort. » La clochette essaya. Son doux ding guida tout le monde vers le chocolat chaud.','The shy bell','In the workshop, a tiny bell was afraid to ring. An elf said, “Your sound is yours; it doesn’t have to be loud.” The bell tried. Its gentle ding led everyone to hot chocolate.'),
  e(9,'riddle','La devinette du sapin','Je porte des lumières et des boules, et je garde mes aiguilles en hiver. Qui suis-je ?','The tree riddle','I wear lights and baubles, and keep my needles in winter. What am I?',{answer:{fr:'Un sapin !',en:'A fir tree!'}}),
  e(10,'challenge','Une place à table','Aide à poser une serviette ou une cuillère pour le prochain repas.','A place at the table','Help put out a napkin or a spoon for the next meal.'),
  e(11,'coloring','Les étoiles à colorier','Choisis des couleurs pour inventer un ciel de Noël.','Color the stars','Choose colors to invent a Christmas sky.',{href:'/coloriage'}),
  e(12,'message','Le courage tranquille','Essayer quelque chose de nouveau, même doucement, c’est déjà courageux.','Quiet courage','Trying something new, even gently, is already brave.'),
  e(13,'story','Le biscuit partagé','Un bonhomme en pain d’épices trouva un biscuit un peu cassé. Il en donna un morceau à son ami lapin. Le biscuit semblait encore meilleur partagé, et les deux amis inventèrent ensuite une recette de biscuits en forme de lune.','The shared cookie','A gingerbread friend found a slightly broken cookie. He gave a piece to his rabbit friend. It tasted even better shared, and together they invented moon-shaped cookies.'),
  e(14,'challenge','Le dessin secret','Dessine un cadeau imaginaire et offre ton dessin à quelqu’un.','A secret drawing','Draw an imaginary gift and give your picture to someone.'),
  e(15,'riddle','La devinette du nez','J’ai un nez rouge qui brille, et je guide le traîneau. Qui suis-je ?','The nose riddle','I have a glowing red nose and guide the sleigh. Who am I?',{answer:{fr:'Rudolph le renne !',en:'Rudolph the reindeer!'}}),
  e(16,'game','Le village de Noël','Une petite promenade dans le village t’attend.','Christmas village','A little walk through the village is waiting for you.',{href:'/monde/3d/noel'}),
  e(17,'message','Une pensée pour toi','Tu as ta façon bien à toi de rendre le monde plus doux.','A thought for you','You have your own special way of making the world kinder.'),
  e(18,'coloring','Le sapin à colorier','Le sapin peut être violet, doré ou même bleu. À toi de choisir !','Color the tree','The tree can be purple, gold or even blue. You choose!',{href:'/coloriage'}),
  e(19,'challenge','La minute calme','Écoute les sons autour de toi pendant une minute, comme un lutin curieux.','A quiet minute','Listen to the sounds around you for one minute, like a curious elf.'),
  e(20,'story','Le petit renne et la lune','Un jeune renne regardait la lune reflétée dans un lac. Il croyait qu’une étoile était tombée dans l’eau. Sa grand-mère lui montra le reflet et ils admirèrent ensemble le ciel, sans se presser.','The little reindeer and the moon','A young reindeer watched the moon reflected in a lake. He thought a star had fallen into the water. His grandmother showed him the reflection, and they admired the sky together.'),
  e(21,'riddle','La devinette des lumières','Je scintille tout en haut du sapin et je ressemble à un astre. Qui suis-je ?','The lights riddle','I sparkle at the top of the tree and look like a star. What am I?',{answer:{fr:'L’étoile du sapin !',en:'The tree’s star!'}}),
  e(22,'challenge','Le petit coup de main','Choisis une petite chose pour aider quelqu’un aujourd’hui.','A little helping hand','Choose one little way to help someone today.'),
  e(23,'message','La veille approche','Les lumières brillent, les histoires se racontent. Profite de ce joli moment.','The eve is near','The lights are glowing and stories are being told. Enjoy this lovely moment.'),
  e(24,'story','La nuit scintillante','Au Pôle Nord, les lutins se souhaitèrent une belle soirée. Le ciel brillait doucement. Chacun pensa à un souvenir heureux, puis s’installa près du feu pour écouter une dernière histoire.','The sparkling night','At the North Pole, the elves wished one another a lovely evening. The sky glowed softly. Each thought of a happy memory, then settled by the fire for one last story.'),
];

/** Calendar dates are evaluated in Paris so every family opens a door together. */
export function parisCalendarDate(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  return { year: Number(parts.find((p) => p.type === 'year')?.value), month: Number(parts.find((p) => p.type === 'month')?.value), day: Number(parts.find((p) => p.type === 'day')?.value) };
}

export function canOpenAdventDay(day: number, now = new Date()): boolean {
  if (!Number.isInteger(day) || day < 1 || day > 24) return false;
  const { month, day: today } = parisCalendarDate(now);
  if (month === 11) return day === 1;
  if (month === 12) return day <= today;
  return month > 12;
}

export function adventNeedsPass(day: number): boolean { return day >= 4 && day <= 24; }

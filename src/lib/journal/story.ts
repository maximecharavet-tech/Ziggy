/**
 * « Ziggy raconte ma journée »: a short, calm bedtime story about up to three
 * things the child found, built ONLY from the hand-written sentences below
 * (no AI, nothing generated): the same choices give the same story, and a new
 * story avoids every sentence of the one before it.
 *
 * Every sentence is fixed text in French and English, without a name or a
 * slot, so each can be pre-recorded once. The chosen item's own title is
 * read as its own line between them. Ziggy is always happy, curious or
 * sleepy; nothing is ever lost, missing, wrong or sad (story.test.ts checks).
 */
import type { L } from '@/lib/i18n-text';
import type { JournalEntry, JournalWorld, StoryItem, StoryLine, StoryPage, StorySpec } from './types';

export type Template = L & { id: string };

const T = (id: string, fr: string, en: string): Template => ({ id, fr, en });

export const TITLES: Template[] = [
  T('title-1', 'La journée aux mille étoiles', 'The day of a thousand stars'),
  T('title-2', 'Les petites merveilles du jour', 'Today’s little wonders'),
  T('title-3', 'Le carnet qui brille dans la nuit', 'The notebook that glows at night'),
  T('title-4', 'Ziggy se souvient', 'Ziggy remembers'),
  T('title-5', 'Une journée pleine de trésors', 'A day full of treasures'),
  T('title-6', 'L’histoire douce de ma journée', 'The gentle story of my day'),
  T('title-7', 'Le voyage avant le dodo', 'The journey before sleep'),
  T('title-8', 'Les souvenirs dorés', 'The golden memories'),
];

export const OPENINGS: Template[] = [
  T('open-1', 'Il était une fois une journée toute pleine de surprises.', 'Once upon a time, there was a day full of surprises.'),
  T('open-2', 'Ce soir, Ziggy ouvre le carnet tout doucement.', 'Tonight, Ziggy opens the notebook very gently.'),
  T('open-3', 'La lune se lève, et Ziggy a une histoire à te raconter.', 'The moon is rising, and Ziggy has a story to tell you.'),
  T('open-4', 'Chut… écoute bien, c’est l’histoire de ta journée.', 'Shh… listen closely, this is the story of your day.'),
  T('open-5', 'Les étoiles s’allument une à une dans le ciel.', 'The stars light up one by one in the sky.'),
  T('open-6', 'Ziggy s’installe sur un nuage tout doux pour te raconter ta journée.', 'Ziggy settles on a soft cloud to tell you about your day.'),
  T('open-7', 'Quand la nuit arrive, les beaux souvenirs viennent danser.', 'When night comes, lovely memories come out to dance.'),
  T('open-8', 'Il était une fois quelqu’un de très curieux… et c’était toi !', 'Once upon a time there was someone very curious… and it was you!'),
  T('open-9', 'Le soleil est parti se coucher, et Ziggy se souvient de tout.', 'The sun has gone to bed, and Ziggy remembers everything.'),
  T('open-10', 'Dans le grand ciel bleu nuit, une petite étoile écoute avec nous.', 'In the big midnight-blue sky, a little star is listening with us.'),
  T('open-11', 'Ziggy feuillette le carnet, et ses antennes s’illuminent.', 'Ziggy leafs through the notebook, and his antennas glow.'),
  T('open-12', 'Voici l’histoire d’une journée pas comme les autres.', 'Here is the story of a day like no other.'),
];

export const SNUGGLES: Template[] = [
  T('snug-1', 'Installe-toi bien sous ta couette.', 'Snuggle up under your blanket.'),
  T('snug-2', 'Pose ta tête sur l’oreiller tout doux.', 'Rest your head on your soft pillow.'),
  T('snug-3', 'Prends ton doudou contre toi.', 'Hold your cuddly toy close.'),
  T('snug-4', 'Respire tout doucement, comme une petite vague.', 'Breathe very slowly, like a little wave.'),
  T('snug-5', 'Ferme les yeux si tu veux, et écoute.', 'Close your eyes if you like, and listen.'),
  T('snug-6', 'Ziggy remonte ta couverture jusqu’au menton.', 'Ziggy tucks your blanket up to your chin.'),
  T('snug-7', 'La veilleuse brille d’une lumière toute douce.', 'The night light glows softly.'),
  T('snug-8', 'Tout est calme dans la maison.', 'Everything is calm in the house.'),
];

export const LINKS: Template[] = [
  T('link-1', 'Un peu plus tard…', 'A little later…'),
  T('link-2', 'Et puis, surprise !', 'And then, surprise!'),
  T('link-3', 'Mais ce n’est pas tout !', 'But that’s not all!'),
  T('link-4', 'Ensuite, l’aventure a continué.', 'Next, the adventure carried on.'),
  T('link-5', 'Et tu sais quoi ?', 'And guess what?'),
  T('link-6', 'Après ça, il s’est passé autre chose de joli.', 'After that, something else lovely happened.'),
  T('link-7', 'Un peu plus loin sur le chemin…', 'A little further along the way…'),
  T('link-8', 'Et quand le soleil a tourné dans le ciel…', 'And as the sun moved across the sky…'),
];

/** Families of the story sentences (the album's worlds; stories themselves are not told again). */
export type StoryFamily = Exclude<JournalWorld, 'stories'>;

/** The sentence before an item's title, per world. */
export const LEADS: Record<StoryFamily, Template[]> = {
  sandbox: [
    T('lead-sandbox-1', 'Dans le bac à sable magique, tu as fait une découverte de savant.', 'In the magic sandbox, you made a real scientist’s discovery.'),
    T('lead-sandbox-2', 'Les petits grains du bac à sable t’ont montré un secret.', 'The little grains of the sandbox showed you a secret.'),
    T('lead-sandbox-3', 'Tu as mélangé, versé, attendu… et la magie de la science est arrivée.', 'You mixed, poured, waited… and the magic of science appeared.'),
    T('lead-sandbox-4', 'Avec tes mains de chercheur, tu as observé le monde de tout près.', 'With your explorer’s hands, you looked at the world up close.'),
    T('lead-sandbox-5', 'Le bac à sable a fait « pouf », et une merveille est apparue.', 'The sandbox went “poof”, and a wonder appeared.'),
    T('lead-sandbox-6', 'Comme un vrai scientifique, tu as essayé une idée.', 'Like a real scientist, you tried out an idea.'),
  ],
  creatures: [
    T('lead-creatures-1', 'Dans l’usine à créatures, une nouvelle amie est née.', 'In the creature factory, a new friend was born.'),
    T('lead-creatures-2', 'Les machines ont fait bip, bip, bloup… et une créature est sortie.', 'The machines went beep, beep, bloop… and a creature came out.'),
    T('lead-creatures-3', 'Tu as assemblé des formes, des yeux et beaucoup d’imagination.', 'You put together shapes, eyes and lots of imagination.'),
    T('lead-creatures-4', 'Une drôle de petite créature a ouvert les yeux pour la première fois.', 'A funny little creature opened its eyes for the first time.'),
    T('lead-creatures-5', 'Dans la parade des créatures, une nouvelle est venue danser.', 'In the creature parade, a new one came to dance.'),
    T('lead-creatures-6', 'Ta créature t’a fait un grand sourire.', 'Your creature gave you a big smile.'),
  ],
  lutins: [
    T('lead-lutins-1', 'Pendant la nuit, les lutins sont passés en cachette.', 'During the night, the elves sneaked by.'),
    T('lead-lutins-2', 'Les lutins farceurs ont laissé une drôle de surprise.', 'The cheeky elves left a funny surprise.'),
    T('lead-lutins-3', 'Sur la pointe des pieds, les lutins ont préparé une blague.', 'On tiptoe, the elves prepared a joke.'),
    T('lead-lutins-4', 'Hi hi ! Les lutins ont encore fait des leurs.', 'Hee hee! The elves were up to their tricks again.'),
    T('lead-lutins-5', 'Une petite farce de lutin attendait au réveil.', 'A little elf prank was waiting when you woke up.'),
    T('lead-lutins-6', 'Les lutins ont ri tout bas en préparant leur surprise.', 'The elves giggled quietly as they set up their surprise.'),
  ],
  adventure: [
    T('lead-adventure-1', 'Dans Ziggy World, tu as trouvé quelque chose de précieux.', 'In Ziggy World, you found something precious.'),
    T('lead-adventure-2', 'Au bout d’un joli chemin, une belle surprise t’attendait.', 'At the end of a pretty path, a lovely surprise was waiting.'),
    T('lead-adventure-3', 'L’aventure a ouvert une nouvelle porte.', 'The adventure opened a new door.'),
    T('lead-adventure-4', 'Pas à pas, tu as exploré un monde plein de couleurs.', 'Step by step, you explored a world full of colours.'),
    T('lead-adventure-5', 'Sur la grande carte, une nouvelle étoile s’est allumée.', 'On the big map, a new star lit up.'),
    T('lead-adventure-6', 'Les habitants de Ziggy World ont applaudi tout doucement.', 'The people of Ziggy World clapped softly.'),
  ],
  games: [
    T('lead-games-1', 'Tu as joué, réfléchi et beaucoup ri.', 'You played, thought hard and laughed a lot.'),
    T('lead-games-2', 'Une partie pleine de rebondissements t’attendait.', 'A game full of twists was waiting for you.'),
    T('lead-games-3', 'Tes doigts agiles ont fait de jolies choses.', 'Your nimble fingers did lovely things.'),
    T('lead-games-4', 'Ziggy a regardé ta partie avec de grands yeux.', 'Ziggy watched your game with wide eyes.'),
    T('lead-games-5', 'Le jeu a commencé, et ton cerveau s’est mis à briller.', 'The game began, and your brain started to sparkle.'),
    T('lead-games-6', 'Tu as essayé, encore et encore, avec le sourire.', 'You tried again and again, with a smile.'),
  ],
  art: [
    T('lead-art-1', 'Avec tes couleurs, tu as fait naître un dessin.', 'With your colours, you brought a drawing to life.'),
    T('lead-art-2', 'Ton crayon a dansé sur la page.', 'Your pencil danced across the page.'),
    T('lead-art-3', 'Tu as choisi tes couleurs préférées, une par une.', 'You picked your favourite colours, one by one.'),
    T('lead-art-4', 'Une œuvre d’artiste est sortie de tes mains.', 'An artist’s masterpiece came from your hands.'),
    T('lead-art-5', 'La page blanche est devenue toute colorée.', 'The blank page became full of colour.'),
    T('lead-art-6', 'Ziggy a accroché ton œuvre dans son musée imaginaire.', 'Ziggy hung your artwork in his imaginary museum.'),
  ],
  music: [
    T('lead-music-1', 'Tu as inventé une petite musique.', 'You made up a little tune.'),
    T('lead-music-2', 'Les notes ont sautillé comme des grenouilles.', 'The notes hopped like little frogs.'),
    T('lead-music-3', 'L’orchestre des animaux a joué ta chanson.', 'The animal band played your song.'),
    T('lead-music-4', 'Ta mélodie s’est envolée comme un papillon.', 'Your melody flew away like a butterfly.'),
    T('lead-music-5', 'Boum, ding, la la la : tu as composé une chanson.', 'Boom, ding, la la la: you composed a song.'),
    T('lead-music-6', 'Même les oiseaux ont écouté ta musique.', 'Even the birds listened to your music.'),
  ],
  moments: [
    T('lead-moments-1', 'Aujourd’hui, il s’est passé quelque chose de joli.', 'Today, something lovely happened.'),
    T('lead-moments-2', 'Ziggy a gardé ce moment précieux dans son cœur.', 'Ziggy kept this precious moment in his heart.'),
    T('lead-moments-3', 'Voici un petit souvenir tout doux.', 'Here is a sweet little memory.'),
    T('lead-moments-4', 'Ce moment-là brillait comme une étoile.', 'That moment shone like a star.'),
    T('lead-moments-5', 'Tu as vécu un instant plein de magie.', 'You lived a moment full of magic.'),
    T('lead-moments-6', 'Un joli souvenir s’est glissé dans ton carnet.', 'A lovely memory slipped into your notebook.'),
  ],
};

/** The sentence after an item's title: how Ziggy (or the world) took it. Always joyful or calm. */
export const REACTIONS: Record<StoryFamily, Template[]> = {
  sandbox: [
    T('react-sandbox-1', 'Ziggy a trouvé ça merveilleux.', 'Ziggy found it marvellous.'),
    T('react-sandbox-2', 'Le monde est plein de secrets, et tu en as trouvé un.', 'The world is full of secrets, and you found one.'),
    T('react-sandbox-3', 'Ziggy a fait « oooh ! » avec ses antennes toutes droites.', 'Ziggy went “oooh!” with his antennas standing tall.'),
    T('react-sandbox-4', 'Les savants du monde entier seraient fiers de toi.', 'Scientists all over the world would be proud of you.'),
    T('react-sandbox-5', 'Quelle belle chose à comprendre !', 'What a lovely thing to understand!'),
    T('react-sandbox-6', 'Le petit escargot du jardin a cligné des yeux, émerveillé.', 'The little garden snail blinked, amazed.'),
  ],
  creatures: [
    T('react-creatures-1', 'Elle a fait un petit bruit rigolo pour te dire merci.', 'It made a funny little noise to say thank you.'),
    T('react-creatures-2', 'Ziggy lui a fait un gros câlin de bienvenue.', 'Ziggy gave it a big welcome hug.'),
    T('react-creatures-3', 'Maintenant, elle fait partie de la grande parade.', 'Now it is part of the big parade.'),
    T('react-creatures-4', 'Ce soir, elle dort elle aussi, bien au chaud.', 'Tonight, it’s sleeping too, all warm and cosy.'),
    T('react-creatures-5', 'Elle ne ressemble à aucune autre, et c’est ce qui la rend si spéciale.', 'It is like no other, and that makes it so special.'),
    T('react-creatures-6', 'Ziggy a ri de bonheur en la voyant.', 'Ziggy laughed with joy when he saw it.'),
  ],
  lutins: [
    T('react-lutins-1', 'Ziggy a éclaté de rire en la découvrant.', 'Ziggy burst out laughing when he found it.'),
    T('react-lutins-2', 'Les lutins aiment beaucoup te faire sourire.', 'The elves love making you smile.'),
    T('react-lutins-3', 'Ce soir, ils rêvent peut-être déjà d’une nouvelle idée.', 'Tonight, they may already be dreaming up a new idea.'),
    T('react-lutins-4', 'Quelle drôle d’idée ! Ziggy en rit encore.', 'What a funny idea! Ziggy is still giggling.'),
    T('react-lutins-5', 'Les lutins ont fait un clin d’œil avant de repartir.', 'The elves gave a wink before slipping away.'),
    T('react-lutins-6', 'Une farce toute gentille, pour bien commencer la journée.', 'A kind little prank, to start the day well.'),
  ],
  adventure: [
    T('react-adventure-1', 'Ziggy a sauté de joie.', 'Ziggy jumped for joy.'),
    T('react-adventure-2', 'Ton chemin brille un peu plus fort maintenant.', 'Your path shines a little brighter now.'),
    T('react-adventure-3', 'Le monde de Ziggy est encore plus beau grâce à toi.', 'Ziggy’s world is even more beautiful thanks to you.'),
    T('react-adventure-4', 'Une petite brise douce a soufflé sur la carte.', 'A soft breeze blew across the map.'),
    T('react-adventure-5', 'Tout le monde a dit : « Bravo, et merci ! »', 'Everyone said: “Well done, and thank you!”'),
    T('react-adventure-6', 'C’était un très beau moment d’aventure.', 'It was a wonderful moment of adventure.'),
  ],
  games: [
    T('react-games-1', 'Ziggy a applaudi avec ses petites mains.', 'Ziggy clapped his little hands.'),
    T('react-games-2', 'Chaque essai a fait grandir tes idées.', 'Every try made your ideas grow.'),
    T('react-games-3', 'Qu’est-ce que c’était amusant !', 'That was so much fun!'),
    T('react-games-4', 'Ton cerveau a fait de la gymnastique joyeuse.', 'Your brain did some happy gymnastics.'),
    T('react-games-5', 'Jouer ensemble, c’est ce que Ziggy préfère.', 'Playing together is Ziggy’s favourite thing.'),
    T('react-games-6', 'Il y avait des rires partout.', 'There was laughter everywhere.'),
  ],
  art: [
    T('react-art-1', 'Ziggy a trouvé ça magnifique.', 'Ziggy thought it was beautiful.'),
    T('react-art-2', 'Les couleurs brillaient comme un arc-en-ciel.', 'The colours shone like a rainbow.'),
    T('react-art-3', 'Chaque trait raconte une petite histoire.', 'Every line tells a little story.'),
    T('react-art-4', 'Les étoiles aimeraient bien l’accrocher dans le ciel.', 'The stars would love to hang it in the sky.'),
    T('react-art-5', 'C’est une œuvre unique au monde, comme toi.', 'It’s one of a kind in the whole world, just like you.'),
    T('react-art-6', 'Ziggy a souri jusqu’aux antennes.', 'Ziggy smiled all the way up to his antennas.'),
  ],
  music: [
    T('react-music-1', 'Ziggy a dansé en remuant ses antennes.', 'Ziggy danced, wiggling his antennas.'),
    T('react-music-2', 'La musique flotte encore doucement dans l’air.', 'The music still floats softly in the air.'),
    T('react-music-3', 'Même la lune fredonne ta chanson ce soir.', 'Even the moon is humming your song tonight.'),
    T('react-music-4', 'Quelle jolie mélodie !', 'What a pretty melody!'),
    T('react-music-5', 'Les notes sont allées se coucher dans les nuages.', 'The notes went to sleep in the clouds.'),
    T('react-music-6', 'Ta chanson a rendu tout le monde joyeux.', 'Your song made everyone happy.'),
  ],
  moments: [
    T('react-moments-1', 'Ziggy a souri tout doucement.', 'Ziggy smiled softly.'),
    T('react-moments-2', 'C’était simple, et c’était beau.', 'It was simple, and it was beautiful.'),
    T('react-moments-3', 'Ce souvenir te tient chaud ce soir.', 'This memory keeps you warm tonight.'),
    T('react-moments-4', 'Ziggy est content de l’avoir vécu avec toi.', 'Ziggy is happy he shared it with you.'),
    T('react-moments-5', 'Un petit bonheur, tout léger.', 'A little bit of happiness, light as a feather.'),
    T('react-moments-6', 'Ce moment restera dans ton carnet pour toujours.', 'This moment will stay in your notebook forever.'),
  ],
};

/** A day without a chosen discovery is a gentle day, never an empty one. */
export const QUIET: Template[] = [
  T('quiet-1', 'Aujourd’hui était une journée tranquille, et c’est très bien comme ça.', 'Today was a quiet day, and that’s just fine.'),
  T('quiet-2', 'Parfois, les plus belles journées sont toutes simples.', 'Sometimes the loveliest days are the simplest.'),
  T('quiet-3', 'Tu as respiré, rêvé et regardé le ciel.', 'You breathed, dreamed and looked at the sky.'),
  T('quiet-4', 'Ziggy a aimé passer cette journée douce avec toi.', 'Ziggy loved spending this gentle day with you.'),
  T('quiet-5', 'Les nuages ont flotté lentement au-dessus de la maison.', 'The clouds floated slowly over the house.'),
  T('quiet-6', 'Demain, de nouvelles découvertes t’attendent peut-être.', 'Tomorrow, new discoveries may be waiting for you.'),
  T('quiet-7', 'Le carnet garde une page toute neuve pour la suite.', 'The notebook keeps a brand-new page for what comes next.'),
  T('quiet-8', 'Même les journées calmes sont pleines de petites merveilles.', 'Even calm days are full of little wonders.'),
];

export const ENDINGS: Template[] = [
  T('end-1', 'Toutes ces belles choses se sont rangées dans ton carnet.', 'All these lovely things are tucked away in your notebook.'),
  T('end-2', 'Quelle journée bien remplie !', 'What a full and happy day!'),
  T('end-3', 'Ziggy referme le carnet, tout doucement.', 'Ziggy closes the notebook, very gently.'),
  T('end-4', 'Tes souvenirs brillent comme de petites lanternes.', 'Your memories glow like little lanterns.'),
  T('end-5', 'Ce soir, ton carnet est plein de lumière.', 'Tonight, your notebook is full of light.'),
  T('end-6', 'Les étoiles ont écouté toute l’histoire en souriant.', 'The stars listened to the whole story, smiling.'),
  T('end-7', 'Tout ce que tu as découvert reste bien au chaud ici.', 'Everything you discovered stays safe and warm here.'),
  T('end-8', 'La lune fait un petit clin d’œil à ton carnet.', 'The moon gives your notebook a little wink.'),
  T('end-9', 'C’était une très jolie journée, rien qu’à toi.', 'It was a lovely day, all your own.'),
  T('end-10', 'Ziggy garde chaque souvenir comme un trésor.', 'Ziggy keeps every memory like a treasure.'),
];

export const SLEEPY: Template[] = [
  T('sleepy-1', 'Ziggy bâille tout doucement… Aaaah.', 'Ziggy yawns very softly… Aaaah.'),
  T('sleepy-2', 'Ses antennes brillent une dernière fois, puis tout bas, tout bas.', 'His antennas glow one last time, then softly dim.'),
  T('sleepy-3', 'Le vent chuchote une berceuse dans les arbres.', 'The wind whispers a lullaby in the trees.'),
  T('sleepy-4', 'Les paupières deviennent lourdes, lourdes, toutes douces.', 'Eyelids grow heavy, heavy and soft.'),
  T('sleepy-5', 'Le petit nuage s’endort au-dessus de la maison.', 'The little cloud falls asleep above the house.'),
  T('sleepy-6', 'Tout le monde se blottit pour la nuit.', 'Everyone snuggles in for the night.'),
  T('sleepy-7', 'Une étoile filante passe pour veiller sur toi.', 'A shooting star passes by to watch over you.'),
  T('sleepy-8', 'Ziggy se roule en boule sur son coussin préféré.', 'Ziggy curls up on his favourite cushion.'),
  T('sleepy-9', 'Dans le silence, on entend juste ton souffle tranquille.', 'In the quiet, there’s only your calm breathing.'),
  T('sleepy-10', 'La lune allume sa veilleuse dans le ciel.', 'The moon turns on her night light in the sky.'),
];

export const GOODNIGHTS: Template[] = [
  T('night-1', 'Bonne nuit, petite étoile.', 'Good night, little star.'),
  T('night-2', 'Fais de beaux rêves.', 'Sweet dreams.'),
  T('night-3', 'Dors bien, à demain.', 'Sleep tight, see you tomorrow.'),
  T('night-4', 'Bonne nuit, et plein de rêves doux.', 'Good night, and lots of gentle dreams.'),
  T('night-5', 'Chut… c’est l’heure de rêver.', 'Shh… it’s time to dream.'),
  T('night-6', 'Bonne nuit, petit cœur.', 'Good night, sweetheart.'),
  T('night-7', 'Dors bien, Ziggy veille sur tes rêves.', 'Sleep well, Ziggy watches over your dreams.'),
  T('night-8', 'Doux rêves, jusqu’au matin.', 'Sweet dreams until morning.'),
];

/** Every story sentence, for lookups, tests and pre-recording. */
export const ALL_TEMPLATES: Template[] = [
  ...TITLES,
  ...OPENINGS,
  ...SNUGGLES,
  ...LINKS,
  ...Object.values(LEADS).flat(),
  ...Object.values(REACTIONS).flat(),
  ...QUIET,
  ...ENDINGS,
  ...SLEEPY,
  ...GOODNIGHTS,
];

const BY_ID = new Map(ALL_TEMPLATES.map((t) => [t.id, t]));

export function templateById(id: string): Template | undefined {
  return BY_ID.get(id);
}

/* ── Choosing, deterministically ── */

/** Small seeded generator (mulberry32): same seed, same story. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable number from text (FNV-1a). */
export function hashText(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Picks one sentence not used in this story nor the previous one (when the pool allows it). */
function pick(pool: Template[], rand: () => number, used: Set<string>, avoid: Set<string>): Template {
  const fresh = pool.filter((t) => !used.has(t.id) && !avoid.has(t.id));
  const unused = pool.filter((t) => !used.has(t.id));
  const list = fresh.length ? fresh : unused.length ? unused : pool;
  const t = list[Math.floor(rand() * list.length) % list.length];
  used.add(t.id);
  return t;
}

const familyOf = (w: JournalWorld): StoryFamily => (w === 'stories' ? 'moments' : w);

/** The seed of a story: the day, the chosen things, and how many stories came before. */
export function storySeed(day: string, refs: string[], count: number): number {
  return hashText(`${day}|${refs.join(',')}|${count}`);
}

export function toStoryItem(e: JournalEntry): StoryItem {
  return { ref: e.id, world: e.world, kind: e.kind, title: e.title, emoji: e.emoji, ...(e.personal ? { personal: true } : {}) };
}

/**
 * Builds a story (3 or 4 pages) from 0 to 3 items.
 * - 0 items: a quiet day (intro, two calm pages… then sleep);
 * - 1 item: intro · the item · good night;
 * - 2 items: intro · item · item · good night;
 * - 3 items: intro with the first item · item · item · good night.
 * `previous` holds the template ids of the last story: none of them is used
 * again while the pool has another choice.
 */
export function buildStory(items: StoryItem[], seed: number, previous: readonly string[] = []): StorySpec {
  const chosen = items.slice(0, 3);
  const rand = rng(seed);
  const used = new Set<string>();
  const avoid = new Set(previous);
  const p = (pool: Template[]) => ({ t: pick(pool, rand, used, avoid).id });
  const title = pick(TITLES, rand, used, avoid).id;
  const intro: StoryLine[] = [p(OPENINGS), p(SNUGGLES)];
  const itemLines = (i: number, link: boolean): StoryLine[] => {
    const f = familyOf(chosen[i].world);
    return [...(link ? [p(LINKS)] : []), p(LEADS[f]), { item: i }, p(REACTIONS[f])];
  };
  const end: StoryPage = { scene: 'end', lines: [p(ENDINGS), p(SLEEPY), p(GOODNIGHTS)] };

  let pages: StoryPage[];
  if (!chosen.length) {
    pages = [
      { scene: 'intro', lines: intro },
      { scene: 'intro', lines: [p(QUIET), p(QUIET)] },
      { scene: 'end', lines: [p(QUIET), ...end.lines.slice(1)] },
    ];
  } else if (chosen.length === 3) {
    pages = [
      { scene: 'item', item: 0, lines: [...intro, ...itemLines(0, false)] },
      { scene: 'item', item: 1, lines: itemLines(1, true) },
      { scene: 'item', item: 2, lines: itemLines(2, true) },
      end,
    ];
  } else {
    pages = [{ scene: 'intro', lines: intro }, ...chosen.map((_, i) => ({ scene: 'item' as const, item: i, lines: itemLines(i, i > 0) })), end];
  }
  return { v: 1, seed, title, items: chosen, pages };
}

/** The sentences of a page, in a language. Unknown template ids (an older story) are skipped. */
export function pageText(story: StorySpec, page: StoryPage, locale: string): string[] {
  const fr = locale === 'fr';
  const out: string[] = [];
  for (const line of page.lines) {
    if ('t' in line) {
      const t = templateById(line.t);
      if (t) out.push(fr ? t.fr : t.en);
    } else {
      const item = story.items[line.item];
      if (item) out.push(fr ? item.title.fr : item.title.en);
    }
  }
  return out;
}

export function storyTitle(story: StorySpec): L {
  const t = templateById(story.title) ?? TITLES[0];
  return { fr: t.fr, en: t.en };
}

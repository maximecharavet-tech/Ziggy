/**
 * Mode dodo — bedtime stories, part 3 (d21–d30).
 * Hand-written in French and English, 6 calm scenes each.
 */
import type { DodoStory } from './types';

const ZIGGY = 'a small soft green plush robot with big round eyes and two tiny antennas';

export const STORIES_3: DodoStory[] = [
  // ───────────────────────────── d21 · humility ─────────────────────────────
  {
    id: 'd21',
    title: { fr: 'Le paon et le moineau', en: 'The Peacock and the Sparrow' },
    teaser: {
      fr: 'Un paon très fier découvre le cadeau caché d’un tout petit moineau.',
      en: 'A very proud peacock discovers the hidden gift of a tiny sparrow.',
    },
    value: 'humility',
    moral: {
      fr: 'Pas besoin d’être le plus beau ou le plus fort : chacun a un cadeau à partager.',
      en: 'You don’t need to be the most beautiful or the strongest: everyone has a gift to share.',
    },
    emoji: '🦚',
    age: 5,
    scenes: [
      {
        text: {
          fr: 'Dans un grand jardin plein de roses vivait un paon nommé Léopold. Chaque matin, il ouvrait sa queue comme un éventail bleu et vert. « Regardez-moi ! Je suis le plus beau du jardin ! » disait-il. Tout près, sur une branche de lilas, un petit moineau brun gazouillait doucement. Il s’appelait Pipo. Il ne disait rien. Il souriait, simplement.',
          en: 'In a big garden full of roses lived a peacock named Leopold. Every morning, he opened his tail like a blue and green fan. “Look at me! I am the most beautiful one in the garden!” he said. Close by, on a lilac branch, a little brown sparrow chirped softly. His name was Pipo. He said nothing. He simply smiled.',
        },
        art: { sky: 'rose', hero: '🦚', props: ['🌹', '🐦', '🌸', '🌳'], ambience: 'petals' },
        prompt:
          'A proud peacock with a shimmering blue and green tail fanned open in a rose garden, a small round brown sparrow smiling on a lilac branch nearby, soft pink evening light.',
      },
      {
        text: {
          fr: 'Un soir, le ciel devint tout rose. Sous le grand chêne, une petite cane pleurait doucement. « Je ne retrouve plus ma mare », disait Lulu, la petite cane. Léopold s’approcha et ouvrit sa queue magnifique. « Ne pleure pas, regarde comme je brille ! » Mais Lulu regardait partout autour d’elle. Les belles plumes ne lui montraient pas le chemin.',
          en: 'One evening, the sky turned all pink. Under the big oak tree, a little duckling was softly crying. “I can’t find my pond anymore,” said Lulu, the little duckling. Leopold came closer and opened his magnificent tail. “Don’t cry, look how I shine!” But Lulu kept looking all around her. The beautiful feathers did not show her the way.',
        },
        art: { sky: 'rose', hero: '🐥', props: ['🦚', '🌳', '🌹'], ambience: 'stars' },
        prompt:
          'A tiny yellow duckling sitting sadly under a big oak tree at dusk, the proud peacock with a shimmering blue and green tail showing off his feathers beside her, pink sky with first stars.',
      },
      {
        text: {
          fr: 'Léopold essaya de voler pour voir plus loin. Il battit des ailes, une fois, deux fois. Mais sa longue queue était lourde, si lourde ! Il ne monta pas plus haut que la haie. Alors Pipo le moineau descendit de sa branche. « Je peux aider, si tu veux », dit-il tout doucement. Et hop ! Il s’envola très haut, au-dessus des arbres.',
          en: 'Leopold tried to fly to see farther. He flapped his wings, once, twice. But his long tail was heavy, so heavy! He rose no higher than the hedge. Then Pipo the sparrow came down from his branch. “I can help, if you like,” he said very gently. And hop! He flew up high, above the trees.',
        },
        art: { sky: 'violet', hero: '🐦', props: ['🦚', '🌳', '🌿', '🐥'], ambience: 'stars' },
        prompt:
          'The small round brown sparrow flying high above garden trees in a violet evening sky, the peacock with a long blue and green tail and a tiny yellow duckling looking up from beside a hedge.',
      },
      {
        text: {
          fr: 'Là-haut, Pipo vit la mare qui brillait sous la lune. « Par ici ! Suivez-moi ! » chanta-t-il. Pipo volait devant, Lulu trottinait derrière, et Léopold marchait à côté. Le vent soufflait un peu frais. Alors Léopold ouvrit sa grande queue comme un paravent, pour protéger la petite cane. Ses plumes ne servaient plus à briller. Elles servaient à aider.',
          en: 'Up high, Pipo saw the pond shining under the moon. “This way! Follow me!” he chirped. Pipo flew in front, Lulu trotted behind, and Leopold walked beside her. The wind was a little chilly. So Leopold opened his big tail like a screen, to shelter the little duckling. His feathers were no longer for shining. They were for helping.',
        },
        art: { sky: 'indigo', hero: '🦚', props: ['🐥', '🐦', '🌙', '🌾'], ambience: 'moon' },
        prompt:
          'Moonlit garden path, the small brown sparrow leading the way in the air, a tiny yellow duckling trotting along, the peacock gently spreading his blue and green tail like a shelter around her, calm indigo night.',
      },
      {
        text: {
          fr: 'Au bord de la mare, la maman cane attendait. « Lulu ! » Quel câlin tout doux ! Léopold se tourna vers Pipo. « Tu es petit, mais tu as vu plus loin que moi. Merci, Pipo. » Le moineau gonfla ses plumes brunes, un peu gêné. « Et toi, tu as gardé Lulu au chaud. Chacun son cadeau. » Léopold sourit. Il n’avait plus besoin d’être le plus beau.',
          en: 'At the edge of the pond, mother duck was waiting. “Lulu!” What a soft, warm hug! Leopold turned to Pipo. “You are small, but you saw farther than me. Thank you, Pipo.” The sparrow fluffed up his brown feathers, a little shy. “And you kept Lulu warm. Each of us has a gift.” Leopold smiled. He no longer needed to be the most beautiful.',
        },
        art: { sky: 'indigo', hero: '🦆', props: ['🐥', '🦚', '🐦', '💧'], ambience: 'moon' },
        prompt:
          'A mother duck hugging a tiny yellow duckling at the edge of a moonlit pond, the peacock with a blue and green tail and the small round brown sparrow smiling at each other nearby, warm gentle mood.',
      },
      {
        text: {
          fr: 'La lune monta dans le ciel du jardin. Léopold replia sa queue tout doucement. Pipo se blottit sur la branche de lilas, juste au-dessus de lui. « Bonne nuit, mon ami », chuchota le paon. « Bonne nuit », répondit le moineau. Les roses se fermèrent, une à une. Et toi aussi, ferme les yeux, comme les roses du jardin.',
          en: 'The moon rose in the garden sky. Leopold folded his tail very gently. Pipo snuggled up on the lilac branch, just above him. “Goodnight, my friend,” whispered the peacock. “Goodnight,” answered the sparrow. The roses closed, one by one. And you too, close your eyes, like the roses in the garden.',
        },
        art: { sky: 'indigo', hero: '🦚', props: ['🐦', '🌙', '🌹', '🌿'], ambience: 'stars' },
        prompt:
          'The peacock asleep with his blue and green tail folded under a lilac bush, the small round brown sparrow sleeping on a branch just above him, closed roses, big moon and soft stars.',
      },
    ],
  },

  // ───────────────────────────── d22 · family ─────────────────────────────
  {
    id: 'd22',
    title: { fr: 'La cabane de Mamie Marmotte', en: 'Granny Marmot’s Burrow' },
    teaser: {
      fr: 'Toute la famille marmotte prépare son grand dodo d’hiver, ensemble.',
      en: 'The whole marmot family gets ready for their long winter sleep, together.',
    },
    value: 'family',
    moral: {
      fr: 'La famille, c’est un endroit tout chaud où chacun a sa place.',
      en: 'A family is a warm place where everyone has their own spot.',
    },
    emoji: '🦫',
    age: 3,
    scenes: [
      {
        text: {
          fr: 'Tout en haut de la montagne, il y avait une cabane sous la terre. C’était la cabane de Mamie Marmotte. Dehors, l’herbe devenait dorée et les feuilles tombaient doucement. Le vent sentait déjà le froid. « L’hiver arrive bientôt », dit Mamie en souriant. « Il est temps de préparer notre grand dodo d’hiver, tous ensemble. »',
          en: 'High up on the mountain, there was a cozy home under the ground. It was Granny Marmot’s burrow. Outside, the grass was turning golden and the leaves were gently falling. The wind already smelled of cold. “Winter is coming soon,” said Granny with a smile. “It’s time to get ready for our long winter sleep, all together.”',
        },
        art: { sky: 'gold', hero: '🦫', props: ['⛰️', '🍂', '🌾', '🏡'], ambience: 'petals' },
        prompt:
          'A cozy burrow entrance on a golden autumn mountainside, a plump grandmother marmot with a knitted shawl and little round glasses smiling at the door, falling leaves, warm late afternoon light.',
      },
      {
        text: {
          fr: 'Toute la famille arriva. Papa, Maman, et les deux petits, Tilou et Nina. Chacun avait un travail. Papa portait l’herbe sèche. Maman secouait les coussins de mousse. Tilou et Nina ramassaient les feuilles les plus douces. « Pourquoi on fait tout ça ? » demanda Tilou. « Pour que notre lit d’hiver soit chaud et moelleux », répondit Mamie.',
          en: 'The whole family arrived. Dad, Mom, and the two little ones, Tilou and Nina. Everyone had a job. Dad carried the dry grass. Mom shook out the moss cushions. Tilou and Nina gathered the softest leaves. “Why are we doing all this?” asked Tilou. “So that our winter bed will be warm and soft,” answered Granny.',
        },
        art: { sky: 'gold', hero: '🦫', props: ['🌾', '🍂', '🍃', '🧺'], ambience: 'petals' },
        prompt:
          'A marmot family working together outside their burrow on an autumn mountain: dad carrying dry grass, mom shaking moss cushions, two small marmot children gathering soft leaves, grandmother marmot with a knitted shawl watching, golden light.',
      },
      {
        text: {
          fr: 'Mais Nina avait l’air triste. « Je n’aime pas l’hiver. C’est long, et il fait tout noir. » Mamie la prit sur ses genoux. « Tu sais, ma petite, en hiver, on n’est jamais seuls. On dort tous serrés, comme des petits pains chauds. Et avant de dormir, il y a notre tradition. » Les yeux de Nina se mirent à briller.',
          en: 'But Nina looked sad. “I don’t like winter. It’s long, and it’s all dark.” Granny took her onto her lap. “You know, my little one, in winter we are never alone. We all sleep snuggled together, like warm little rolls of bread. And before we sleep, there is our tradition.” Nina’s eyes began to sparkle.',
        },
        art: { sky: 'violet', hero: '🦫', props: ['🕯️', '🧶', '🍂'], ambience: 'stars' },
        prompt:
          'Inside a warm underground burrow lit by a small lamp, the grandmother marmot with a knitted shawl holding a small marmot girl on her lap, the little one looking up with curious shining eyes, cozy mood.',
      },
      {
        text: {
          fr: 'Mamie ouvrit un vieux coffre en bois. Dedans, il y avait une couverture faite de petits carrés de laine. Un carré rouge pour Papa. Un carré jaune pour Maman. Un carré vert pour Tilou. « Et cette année, voici un carré bleu tout neuf, pour toi, Nina. » Nina caressa la laine bleue. Elle faisait partie de la grande couverture.',
          en: 'Granny opened an old wooden chest. Inside, there was a blanket made of little squares of wool. A red square for Dad. A yellow square for Mom. A green square for Tilou. “And this year, here is a brand-new blue square, just for you, Nina.” Nina stroked the blue wool. She was part of the big blanket.',
        },
        art: { sky: 'violet', hero: '🧶', props: ['🦫', '🟥', '🟨', '🟩', '🟦'], ambience: 'stars' },
        prompt:
          'The grandmother marmot opening an old wooden chest in the cozy burrow, showing a patchwork blanket of red, yellow, green and new blue wool squares, the small marmot girl gently touching the blue square, warm lamplight.',
      },
      {
        text: {
          fr: 'Puis vint la chanson d’hiver. Mamie la chantait déjà quand elle était petite. « Dors, dors, sous la neige, la famille te protège… » Papa tapait doucement le rythme. Maman fredonnait. Tilou bâillait déjà. Nina chantait les mots qu’elle connaissait, et inventait les autres. Tout le monde riait tout bas. Dehors, les premiers flocons tombaient sur la montagne.',
          en: 'Then came the winter song. Granny already knew it when she was little. “Sleep, sleep, under the snow, your family keeps you safe and warm…” Dad gently tapped the rhythm. Mom hummed along. Tilou was already yawning. Nina joined in with the words she knew, and made up the others. Everyone laughed very softly. Outside, the first snowflakes were falling on the mountain.',
        },
        art: { sky: 'snow', hero: '🎶', props: ['🦫', '❄️', '⛰️', '🕯️'], ambience: 'snow' },
        prompt:
          'The whole marmot family sitting in a circle in their cozy burrow, singing softly together, grandmother marmot with a knitted shawl leading, little ones yawning, first snowflakes falling outside the round entrance.',
      },
      {
        text: {
          fr: 'Toute la famille se blottit sous la grande couverture. Le carré rouge, le carré jaune, le carré vert, le carré bleu, et le vieux carré violet de Mamie. Tout le monde était au chaud. Nina posa sa tête contre Mamie. « Bonne nuit d’hiver », murmura-t-elle. Dehors, la neige tombait, tombait. Et toi aussi, blottis-toi bien au chaud.',
          en: 'The whole family snuggled under the big blanket. The red square, the yellow square, the green square, the blue square, and Granny’s old purple square. Everyone was warm. Nina rested her head against Granny. “Good winter night,” she whispered. Outside, the snow kept falling and falling. And you too, snuggle up nice and warm.',
        },
        art: { sky: 'snow', hero: '🦫', props: ['🧶', '❄️', '🌙'], ambience: 'snow' },
        prompt:
          'A marmot family asleep in a tight cozy pile under a colorful patchwork wool blanket in their underground burrow, the small marmot girl resting her head on the grandmother, snow falling softly outside, peaceful night.',
      },
    ],
  },

  // ───────────────────────────── d23 · helping ─────────────────────────────
  {
    id: 'd23',
    title: { fr: 'Le petit dragon allumeur d’étoiles', en: 'The Little Dragon Who Lit the Stars' },
    teaser: {
      fr: 'Un petit dragon au souffle tout doux allume les lanternes du village.',
      en: 'A little dragon with a gentle glowing breath lights the village lanterns.',
    },
    value: 'helping',
    moral: {
      fr: 'Même une toute petite aide peut allumer beaucoup de lumière.',
      en: 'Even a very small help can bring a lot of light.',
    },
    emoji: '🐉',
    age: 3,
    scenes: [
      {
        text: {
          fr: 'Au bord d’une rivière, il y avait un petit village aux toits ronds. Dans chaque rue, des lanternes de papier pendaient aux fenêtres. Chaque soir, Madame Yuna, l’allumeuse de lanternes, passait avec sa longue perche et sa petite lumière. Une à une, les lanternes s’allumaient. Et le village brillait doucement, comme un ciel plein d’étoiles.',
          en: 'By a river, there was a little village with round roofs. In every street, paper lanterns hung by the windows. Every evening, Madame Yuna, the lantern lighter, walked by with her long pole and her little light. One by one, the lanterns glowed. And the village shone softly, like a sky full of stars.',
        },
        art: { sky: 'violet', hero: '🏮', props: ['🏘️', '🌉', '👵', '✨'], ambience: 'stars' },
        prompt:
          'A cozy riverside village with round roofs at dusk, glowing paper lanterns hanging by the windows, a kind older woman with a long pole lighting them one by one, violet evening sky with stars.',
      },
      {
        text: {
          fr: 'Sur la colline vivait Tiko, un petit dragon orange aux ailes minuscules. Les grands dragons soufflaient de grandes flammes. Mais Tiko, lui, ne soufflait qu’une toute petite lumière dorée, tiède comme un chocolat chaud. « Mon souffle est trop petit, il ne sert à rien », soupirait-il. Et il regardait le village s’allumer, tout seul sur sa colline.',
          en: 'On the hill lived Tiko, a little orange dragon with tiny wings. The big dragons breathed big flames. But Tiko could only breathe a tiny golden glow, as warm as hot cocoa. “My breath is too small, it’s good for nothing,” he sighed. And he watched the village light up, all alone on his hill.',
        },
        art: { sky: 'violet', hero: '🐉', props: ['⛰️', '✨', '🏘️'], ambience: 'stars' },
        prompt:
          'A small round orange dragon with tiny wings sitting alone on a grassy hill, a little golden glow at his mouth, looking down at a lantern-lit village by a river, gentle violet twilight.',
      },
      {
        text: {
          fr: 'Un soir, les rues restèrent sombres. Tiko descendit la colline sur la pointe des pattes. Devant sa porte, Madame Yuna était assise, enroulée dans une couverture. « Atchoum ! J’ai un gros rhume, et mes jambes sont fatiguées », dit-elle. « Ce soir, je ne peux pas allumer les lanternes. » Les enfants du village regardaient le noir, un peu inquiets.',
          en: 'One evening, the streets stayed dark. Tiko tiptoed down the hill. In front of her door, Madame Yuna was sitting, wrapped in a blanket. “Achoo! I have a big cold, and my legs are tired,” she said. “Tonight, I can’t light the lanterns.” The village children looked at the dark, a little worried.',
        },
        art: { sky: 'indigo', hero: '👵', props: ['🐉', '🧣', '🏮', '🧒'], ambience: 'moon' },
        prompt:
          'A quiet village street at night with unlit paper lanterns, the kind older woman wrapped in a blanket on her doorstep with a cold, a few children nearby, the small round orange dragon peeking shyly around a corner.',
      },
      {
        text: {
          fr: 'Tiko prit une grande inspiration. « Moi, je peux essayer », dit-il tout timidement. Il s’approcha d’une lanterne et souffla, tout doux. Fff… Une petite lumière dorée se posa dedans, comme une luciole. La lanterne brilla ! « Bravo ! » crièrent les enfants. Tiko n’en revenait pas. Son petit souffle était juste de la bonne taille pour les lanternes.',
          en: 'Tiko took a deep breath. “I can try,” he said very shyly. He went up to a lantern and blew, very softly. Fff… A little golden light settled inside, like a firefly. The lantern glowed! “Hooray!” cried the children. Tiko could hardly believe it. His little breath was just the right size for the lanterns.',
        },
        art: { sky: 'indigo', hero: '🐉', props: ['🏮', '✨', '🧒', '👧'], ambience: 'fireflies' },
        prompt:
          'The small round orange dragon with tiny wings gently breathing a tiny golden glow into a paper lantern, the lantern softly lighting up, delighted children clapping around him, warm cozy night street.',
      },
      {
        text: {
          fr: 'Alors Tiko voleta de rue en rue. Une lanterne à la fenêtre du boulanger. Une lanterne au-dessus du pont. Une lanterne près de l’école. Les enfants le suivaient en riant, et le petit Malik lui montrait les lanternes oubliées. Bientôt, tout le village brillait. Madame Yuna souriait. « Merci, petit allumeur d’étoiles. Tu nous as beaucoup aidés. »',
          en: 'So Tiko fluttered from street to street. A lantern at the baker’s window. A lantern above the bridge. A lantern near the school. The children followed him, laughing, and little Malik pointed out the lanterns he had missed. Soon, the whole village was glowing. Madame Yuna smiled. “Thank you, little star lighter. You helped us so much.”',
        },
        art: { sky: 'gold', hero: '🐉', props: ['🏮', '🌉', '🏫', '🧒'], ambience: 'fireflies' },
        prompt:
          'The small round orange dragon fluttering over a riverside village, glowing paper lanterns everywhere, on a little bridge and by a bakery window, a boy pointing up happily, the kind older woman smiling from her doorway.',
      },
      {
        text: {
          fr: 'Tiko remonta sur sa colline, le cœur tout chaud. En bas, le village scintillait comme un ciel posé sur la terre. Là-haut, les vraies étoiles s’allumaient aussi. Tiko enroula sa queue autour de lui et souffla une dernière petite lumière, juste pour lui. « Bonne nuit, village », chuchota-t-il. Bonne nuit à toi aussi, petite étoile.',
          en: 'Tiko climbed back up his hill, his heart all warm. Below, the village twinkled like a sky resting on the ground. Up above, the real stars were lighting up too. Tiko curled his tail around himself and breathed one last little glow, just for him. “Goodnight, village,” he whispered. Goodnight to you too, little star.',
        },
        art: { sky: 'indigo', hero: '🐉', props: ['⛰️', '🏮', '⭐', '🌙'], ambience: 'stars' },
        prompt:
          'The small round orange dragon curled up asleep on a grassy hilltop with a tiny golden glow beside him, the lantern-lit village twinkling below, a sky full of real stars above, peaceful night.',
      },
    ],
  },

  // ───────────────────────────── d24 · trust ─────────────────────────────
  {
    id: 'd24',
    title: { fr: 'Le chaton et le pont de lianes', en: 'The Kitten and the Vine Bridge' },
    teaser: {
      fr: 'Pour voir les fleurs de lune, un chaton apprend à faire confiance.',
      en: 'To see the moonflowers, a kitten learns to trust a friend.',
    },
    value: 'trust',
    moral: {
      fr: 'Quand on a un ami sur qui compter, les grands pas deviennent plus faciles.',
      en: 'When you have a friend you can count on, big steps become easier.',
    },
    emoji: '🐱',
    age: 5,
    scenes: [
      {
        text: {
          fr: 'Dans une forêt chaude et verte, entre deux grands arbres, il y avait un pont de lianes. Il se balançait doucement au-dessus d’un ruisseau qui chantait. D’un côté vivait Pilou, un petit chaton tigré. De l’autre côté vivait son ami Bako, un petit singe aux grandes oreilles. Chaque jour, Bako traversait le pont en sautillant pour venir jouer.',
          en: 'In a warm green forest, between two tall trees, there was a vine bridge. It swayed gently above a singing stream. On one side lived Pilou, a little striped kitten. On the other side lived his friend Bako, a little monkey with big ears. Every day, Bako hopped across the bridge to come and play.',
        },
        art: { sky: 'forest', hero: '🐱', props: ['🐒', '🌴', '🌿', '💧'], ambience: 'fireflies' },
        prompt:
          'A lush green jungle with a gently swaying vine bridge between two tall trees over a sparkling stream, a little striped tabby kitten on one side, a small monkey with big ears on the other, soft evening light.',
      },
      {
        text: {
          fr: 'Un soir, Bako arriva tout joyeux. « Pilou ! Ce soir, chez moi, les fleurs de lune vont s’ouvrir. Elles brillent comme des lampes ! Viens les voir avec moi ! » Pilou regarda le pont. Il bougeait, il grinçait, il se balançait. Son cœur se mit à battre très vite. « Je… je n’ai jamais traversé », murmura-t-il. Ses petites oreilles se couchèrent.',
          en: 'One evening, Bako arrived full of joy. “Pilou! Tonight, at my place, the moonflowers are going to open. They glow like lamps! Come and see them with me!” Pilou looked at the bridge. It moved, it creaked, it swayed. His heart started to beat very fast. “I… I have never crossed it,” he whispered. His little ears folded back.',
        },
        art: { sky: 'forest', hero: '🐱', props: ['🐒', '🌉', '🌿'], ambience: 'fireflies' },
        prompt:
          'The little striped tabby kitten with ears folded back looking nervously at a swaying vine bridge, the small monkey with big ears smiling and pointing across the stream, green jungle at dusk, fireflies.',
      },
      {
        text: {
          fr: 'Bako s’assit à côté de lui. « Tu as peur, et c’est normal. Moi, je connais ce pont par cœur. Je sais où il est solide. » Il tendit sa longue queue. « Tiens-toi à moi. Pose tes pattes là où je pose les miennes. Je ne te lâcherai pas. » Pilou regarda son ami. Bako ne s’était jamais moqué de lui. Pas une seule fois.',
          en: 'Bako sat down beside him. “You’re scared, and that’s okay. I know this bridge by heart. I know where it’s strong.” He held out his long tail. “Hold on to me. Put your paws where I put mine. I won’t let go of you.” Pilou looked at his friend. Bako had never laughed at him. Not even once.',
        },
        art: { sky: 'forest', hero: '🐒', props: ['🐱', '🌿', '💚'], ambience: 'fireflies' },
        prompt:
          'The small monkey with big ears sitting beside the little striped tabby kitten at the start of a vine bridge, kindly offering his long curly tail to hold, gentle reassuring mood, glowing fireflies in the jungle.',
      },
      {
        text: {
          fr: 'Alors Pilou attrapa la queue de Bako. Un pas. Le pont se balança. « Je suis là », dit Bako. Deux pas. Le ruisseau chantait en dessous. « Respire avec moi. » Trois pas, quatre pas. Pilou ne regardait plus en bas. Il regardait le dos de son ami, devant lui. Et petit à petit, ses pattes tremblaient moins.',
          en: 'So Pilou took hold of Bako’s tail. One step. The bridge swayed. “I’m here,” said Bako. Two steps. The stream babbled below. “Breathe with me.” Three steps, four steps. Pilou wasn’t looking down anymore. He was looking at his friend’s back, in front of him. And little by little, his paws trembled less.',
        },
        art: { sky: 'ocean', hero: '🐱', props: ['🐒', '🌉', '💧', '🌿'], ambience: 'moon' },
        prompt:
          'The little striped tabby kitten carefully crossing a swaying vine bridge, holding the long tail of the small monkey with big ears walking just ahead, a stream shimmering below under the moon, calm and brave mood.',
      },
      {
        text: {
          fr: '« On est arrivés ! » dit Bako. Pilou ouvrit grand les yeux. Il avait traversé tout le pont ! Juste à ce moment, les fleurs de lune s’ouvrirent, une par une, toutes blanches et lumineuses. « C’est magnifique », souffla Pilou. « Merci, Bako. Tout seul, je n’aurais pas osé. » Bako sourit. « Tu m’as fait confiance. Et tu as été courageux. »',
          en: '“We made it!” said Bako. Pilou opened his eyes wide. He had crossed the whole bridge! Just then, the moonflowers opened, one by one, all white and glowing. “It’s beautiful,” breathed Pilou. “Thank you, Bako. On my own, I wouldn’t have dared.” Bako smiled. “You trusted me. And you were brave.”',
        },
        art: { sky: 'forest', hero: '🌼', props: ['🐱', '🐒', '🌙', '✨'], ambience: 'fireflies' },
        prompt:
          'Glowing white moonflowers opening one by one in a jungle clearing, the little striped tabby kitten and the small monkey with big ears watching them in wonder side by side, magical soft night light.',
      },
      {
        text: {
          fr: 'Les deux amis s’installèrent dans un hamac de feuilles, près des fleurs qui brillaient. Le pont se balançait tout doucement, comme un berceau. Bako bâilla. Pilou ronronna. Le ruisseau chantait sa chanson du soir, toujours la même, toujours si douce. Et bientôt, le petit chaton et le petit singe dormaient. Toi aussi, laisse-toi bercer, tout doucement.',
          en: 'The two friends settled into a hammock of leaves, near the glowing flowers. The bridge swayed very gently, like a cradle. Bako yawned. Pilou purred. The stream hummed its evening song, always the same, always so soft. And soon, the little kitten and the little monkey were asleep. You too, let yourself be rocked, very gently.',
        },
        art: { sky: 'indigo', hero: '🐱', props: ['🐒', '🍃', '🌼', '🌙'], ambience: 'stars' },
        prompt:
          'The little striped tabby kitten and the small monkey with big ears curled up asleep together in a hammock of big leaves, glowing white moonflowers around them, a vine bridge in the background, starry jungle night.',
      },
    ],
  },

  // ───────────────────────────── d25 · kindness ─────────────────────────────
  {
    id: 'd25',
    title: { fr: 'Ziggy et le petit robot rouillé', en: 'Ziggy and the Little Rusty Robot' },
    teaser: {
      fr: 'Au fond du jardin, Ziggy rencontre un petit robot tout seul.',
      en: 'At the end of the garden, Ziggy meets a lonely little robot.',
    },
    value: 'kindness',
    moral: {
      fr: 'Un sourire et une main tendue suffisent pour que quelqu’un se sente le bienvenu.',
      en: 'A smile and a helping hand are enough to make someone feel welcome.',
    },
    emoji: '🤖',
    age: 3,
    scenes: [
      {
        text: {
          fr: 'Ce soir, je vais te raconter une histoire à moi. Oui, à moi, Ziggy ! Un soir, je me promenais au fond du jardin, près de la vieille cabane à outils. Les grillons chantaient. L’herbe sentait bon. Et soudain, j’entendis un petit bruit : « Gri… gri… » Mes deux antennes se dressèrent. Quelqu’un était caché là, derrière un vieil arrosoir.',
          en: 'Tonight, I’m going to tell you a story about me. Yes, me, Ziggy! One evening, I was walking at the end of the garden, near the old tool shed. The crickets were singing. The grass smelled lovely. And suddenly, I heard a little sound: “Squeak… squeak…” My two antennas stood straight up. Someone was hiding there, behind an old watering can.',
        },
        art: { sky: 'forest', hero: '🤖', props: ['🏚️', '🌿', '🦗', '🪣'], ambience: 'fireflies' },
        prompt: `${ZIGGY}, walking curiously at the end of a garden near an old wooden tool shed at dusk, antennas raised, an old watering can in the grass, crickets and soft fireflies.`,
      },
      {
        text: {
          fr: 'Je m’approchai tout doucement. Derrière l’arrosoir, il y avait un petit robot. Il était tout orange de rouille, et ses bras grinçaient quand il bougeait. « Ne me regarde pas », dit-il. « Je suis vieux, je suis rouillé, et je fais du bruit. Personne ne veut jouer avec moi. » Il s’appelait Gribouille, et il avait l’air si seul.',
          en: 'I came closer, very gently. Behind the watering can, there was a little robot. He was all orange with rust, and his arms squeaked when he moved. “Don’t look at me,” he said. “I’m old, I’m rusty, and I make noise. Nobody wants to play with me.” His name was Gribouille, and he looked so lonely.',
        },
        art: { sky: 'forest', hero: '🤖', props: ['🪣', '🔩', '🌿'], ambience: 'fireflies' },
        prompt: `A small shy old robot covered in soft orange rust hiding behind a watering can in tall grass, ${ZIGGY} gently peeking at him with a kind face, quiet garden at dusk.`,
      },
      {
        text: {
          fr: 'Je m’assis à côté de lui. « Bonjour, Gribouille. Moi, c’est Ziggy. Tu sais, moi aussi, parfois, je fais des bruits bizarres. Bip ! Blop ! » Gribouille fit un tout petit sourire. Alors je sortis ma petite burette d’huile. « Tu veux que je t’aide ? » Une goutte sur le bras. Une goutte sur le genou. Gribouille bougea… sans grincer !',
          en: 'I sat down beside him. “Hello, Gribouille. I’m Ziggy. You know, sometimes I make funny noises too. Beep! Bloop!” Gribouille gave a tiny little smile. So I took out my little oil can. “Would you like me to help?” A drop on his arm. A drop on his knee. Gribouille moved… without squeaking!',
        },
        art: { sky: 'violet', hero: '🤖', props: ['🛢️', '💧', '🌿', '😊'], ambience: 'fireflies' },
        prompt: `${ZIGGY}, beside a small shy robot covered in soft orange rust, oiling his elbow with a tiny oil can, the rusty robot starting to smile, violet evening garden.`,
      },
      {
        text: {
          fr: 'Avec un chiffon doux, je frottai ses joues de métal. Elles brillaient un peu, comme de vieilles pièces de cuivre. Puis je lui dis : « Tu sais, Gribouille, tu étais déjà très bien avant. Je voulais juste que tes bras ne grincent plus. » Gribouille me regarda longtemps. Puis il rit, un petit rire tout clair, sous les premières étoiles.',
          en: 'With a soft cloth, I polished his metal cheeks. They shone a little, like old copper coins. Then I said to him: “You know, Gribouille, you were already just right before. I only wanted your arms to stop squeaking.” Gribouille looked at me for a long time. Then he laughed, a bright little laugh, under the first stars.',
        },
        art: { sky: 'violet', hero: '🤖', props: ['🧽', '✨', '⭐'], ambience: 'stars' },
        prompt: `${ZIGGY}, gently polishing the cheek of a small robot with soft orange rust and copper patches, using a soft cloth, both laughing together under the first evening stars in a garden.`,
      },
      {
        text: {
          fr: 'Puis je l’emmenai voir mes amis : le hérisson, la chouette et les lucioles. « Voici Gribouille ! » Le hérisson lui fit une place sur la mousse. La chouette lui chanta bonjour. Et quand Gribouille fit « gri, gri » en riant, les lucioles se mirent à danser. « Ta musique est jolie ! » dirent-elles. Gribouille n’était plus caché. Il était avec nous.',
          en: 'Then I took him to meet my friends: the hedgehog, the owl, and the fireflies. “This is Gribouille!” The hedgehog made room for him on the moss. The owl hooted a soft hello. And when Gribouille went “squeak, squeak” while laughing, the fireflies began to dance. “Your music is lovely!” they said. Gribouille wasn’t hiding anymore. He was with us.',
        },
        art: { sky: 'forest', hero: '🤖', props: ['🦔', '🦉', '🍄', '✨'], ambience: 'fireflies' },
        prompt: `${ZIGGY} introducing a small robot with soft orange rust to a friendly hedgehog on soft moss and an owl on a branch, fireflies dancing happily around them, warm welcoming night garden.`,
      },
      {
        text: {
          fr: 'La nuit était douce. Gribouille et moi, nous étions assis côte à côte sur la mousse. Mes antennes clignotaient tout doucement : bleu, puis vert, puis bleu. « Merci, Ziggy », chuchota Gribouille. « Merci à toi d’être venu », répondis-je. Ses yeux s’éteignirent, tout doux. Les miens aussi. Et toi, ferme les tiens… je reste tout près.',
          en: 'The night was soft. Gribouille and I sat side by side on the moss. My antennas blinked very gently: blue, then green, then blue. “Thank you, Ziggy,” whispered Gribouille. “Thank you for coming,” I answered. His eyes dimmed, very softly. Mine did too. And you, close yours… I’m staying right here.',
        },
        art: { sky: 'indigo', hero: '🤖', props: ['🤖', '🌙', '🍃', '⭐'], ambience: 'stars' },
        prompt: `${ZIGGY} and a small robot with soft orange rust sitting side by side on moss, both falling asleep, Ziggy's antennas glowing faintly blue, a calm starry night sky over the garden.`,
      },
    ],
  },

  // ───────────────────────────── d26 · sharing ─────────────────────────────
  {
    id: 'd26',
    title: { fr: 'Le marchand de rêves', en: 'The Dream Seller' },
    teaser: {
      fr: 'Chaque soir, Sélim partage ses rêves… et un soir, on lui en offre un.',
      en: 'Every evening, Selim shares his dreams… and one night, he receives one.',
    },
    value: 'sharing',
    moral: {
      fr: 'Plus on partage ce qu’on aime, plus notre cœur se remplit.',
      en: 'The more we share what we love, the fuller our heart becomes.',
    },
    emoji: '🌙',
    age: 7,
    scenes: [
      {
        text: {
          fr: 'Dans une petite ville aux rues pavées, quand le soleil se couchait, on entendait une clochette. Ding, ding. C’était Sélim, le marchand de rêves. Il poussait une charrette de bois remplie de petits pots en verre. Dans chaque pot brillait un rêve : un rêve bleu, un rêve doré, un rêve couleur de fraise. Et tous les enfants couraient à leur fenêtre.',
          en: 'In a little town with cobbled streets, when the sun went down, you could hear a little bell. Ding, ding. It was Selim, the dream seller. He pushed a wooden cart full of little glass jars. In each jar, a dream was glowing: a blue dream, a golden dream, a strawberry-colored dream. And all the children ran to their windows.',
        },
        art: { sky: 'gold', hero: '🛒', props: ['🫙', '🔔', '🏘️', '✨'], ambience: 'stars' },
        prompt:
          'A gentle man with a long scarf and a soft hat pushing a wooden cart full of glowing glass jars down a cobbled town street at sunset, children smiling at their windows, warm golden light.',
      },
      {
        text: {
          fr: 'Mais Sélim n’était pas un marchand comme les autres. Il ne demandait jamais de pièces. « Un rêve, ça ne se vend pas, ça se partage », disait-il en souriant. Il donna à Inès un rêve où l’on vole avec les oies sauvages. À Paolo, le boulanger, un rêve de vagues et de bateaux. À la petite Hana, un rêve plein de chats qui chantent.',
          en: 'But Selim was not like other sellers. He never asked for coins. “A dream isn’t for selling, it’s for sharing,” he would say with a smile. He gave Ines a dream of flying with the wild geese. To Paolo, the baker, a dream of waves and boats. To little Hana, a dream full of singing cats.',
        },
        art: { sky: 'violet', hero: '🫙', props: ['👧', '🪿', '⛵', '🐈'], ambience: 'stars' },
        prompt:
          'The gentle dream seller with a long scarf handing a glowing glass jar to a smiling girl at her window, a baker and a little girl waiting nearby, tiny dream images of geese, boats and cats glowing in the jars.',
      },
      {
        text: {
          fr: 'Rue après rue, maison après maison, Sélim partageait ses rêves. Pour chacun, il choisissait le bon. Un rêve doux pour ceux qui étaient fatigués. Un rêve drôle pour ceux qui étaient tristes. Un rêve tout calme pour le bébé de la boulangerie. La lune montait, la charrette devenait légère, légère. Et Sélim fredonnait une petite chanson.',
          en: 'Street after street, house after house, Selim shared his dreams. For each person, he chose the right one. A soft dream for those who were tired. A funny dream for those who were sad. A very calm dream for the baby at the bakery. The moon rose, and the cart grew lighter and lighter. And Selim hummed a little song.',
        },
        art: { sky: 'indigo', hero: '🛒', props: ['🫙', '🌙', '🏠', '🎶'], ambience: 'moon' },
        prompt:
          'The gentle dream seller with a long scarf pushing his wooden cart through quiet moonlit streets, only a few glowing jars left, soft lights in the windows of sleeping houses, peaceful blue night.',
      },
      {
        text: {
          fr: 'Au bout de la dernière rue, Sélim regarda sa charrette. Elle était vide. Plus un seul pot brillant. « Tiens, il n’en reste plus pour moi », dit-il doucement. Il n’était pas fâché. Il pensait à tous les enfants qui dormaient en souriant. Mais il bâilla, et il se demanda quel rêve il ferait, cette nuit, sans son petit pot.',
          en: 'At the end of the last street, Selim looked at his cart. It was empty. Not a single glowing jar left. “Well, there are none left for me,” he said softly. He wasn’t upset. He was thinking of all the children sleeping with a smile. But he yawned, and he wondered what dream he would have tonight, without his little jar.',
        },
        art: { sky: 'indigo', hero: '🛒', props: ['🌙', '🏠', '⭐'], ambience: 'stars' },
        prompt:
          'The gentle dream seller with a long scarf standing beside his empty wooden cart at the end of a cobbled street, looking calm and a little sleepy, starry sky and sleeping houses around him.',
      },
      {
        text: {
          fr: 'Alors une fenêtre s’ouvrit. C’était Inès, en pyjama, avec un pot vide dans les mains. « Monsieur Sélim, je vous ai fait un rêve, moi aussi ! » Elle ferma les yeux et souffla dans le pot. Une petite lumière apparut, verte et rose. « C’est un rêve où tous les gens de la ville vous font un grand câlin. » Les yeux de Sélim brillèrent.',
          en: 'Then a window opened. It was Ines, in her pajamas, with an empty jar in her hands. “Mister Selim, I made a dream for you too!” She closed her eyes and blew into the jar. A little light appeared, green and pink. “It’s a dream where everyone in town gives you a big hug.” Selim’s eyes began to shine.',
        },
        art: { sky: 'rose', hero: '👧', props: ['🫙', '💚', '🩷', '🪟'], ambience: 'stars' },
        prompt:
          'A girl in pajamas leaning out of her window, holding a glass jar with a soft green and pink glow, offering it to the gentle dream seller with a long scarf, who looks touched and happy, starry night.',
      },
      {
        text: {
          fr: 'Sélim rentra chez lui, dans sa petite maison au bout de la ville. Il posa le pot d’Inès sur sa table de nuit. La lumière verte et rose dansait doucement au plafond. Il s’allongea, tira sa couverture, et sourit. Pour la première fois, quelqu’un lui avait offert un rêve. Chut… le marchand de rêves s’endort. À ton tour de rêver.',
          en: 'Selim went home, to his little house at the edge of town. He placed Ines’s jar on his bedside table. The green and pink light danced softly on the ceiling. He lay down, pulled up his blanket, and smiled. For the very first time, someone had given him a dream. Shh… the dream seller is falling asleep. Now it’s your turn to dream.',
        },
        art: { sky: 'violet', hero: '🫙', props: ['🛏️', '🌙', '✨'], ambience: 'moon' },
        prompt:
          'The gentle dream seller asleep and smiling in a cozy little bedroom, a glass jar on the bedside table casting soft green and pink lights dancing on the ceiling, moon in the window, peaceful night.',
      },
    ],
  },

  // ───────────────────────────── d27 · courage ─────────────────────────────
  {
    id: 'd27',
    title: { fr: 'La petite sirène et le grand plongeon', en: 'The Little Mermaid’s Big Dive' },
    teaser: {
      fr: 'Pour aider son amie la tortue, Maïa ose plonger tout au fond.',
      en: 'To help her turtle friend, Maia dares to dive all the way down.',
    },
    value: 'courage',
    moral: {
      fr: 'Le courage, c’est avancer doucement, même avec un peu de peur, pour aider quelqu’un qu’on aime.',
      en: 'Courage means moving forward gently, even when you’re a little scared, to help someone you love.',
    },
    emoji: '🧜‍♀️',
    age: 5,
    scenes: [
      {
        text: {
          fr: 'Au fond de la mer bleue, près d’un récif de corail rose, vivait une petite sirène nommée Maïa. Elle avait une queue couleur turquoise et des cheveux bouclés pleins de bulles. Maïa aimait nager près de la surface, là où la lumière dansait. Mais le grand trou bleu, tout au fond, lui faisait un peu peur. Elle n’y allait jamais.',
          en: 'Deep in the blue sea, near a pink coral reef, lived a little mermaid named Maia. She had a turquoise tail and curly hair full of bubbles. Maia loved swimming near the surface, where the light danced. But the big blue hole, way down deep, made her feel a little scared. She never went there.',
        },
        art: { sky: 'ocean', hero: '🧜‍♀️', props: ['🪸', '🐠', '🐚', '🫧'], ambience: 'bubbles' },
        prompt:
          'A little mermaid with a turquoise tail and curly dark hair full of tiny bubbles swimming near a pink coral reef, sunlight dancing through the water above, a deep blue hole far below, gentle underwater scene.',
      },
      {
        text: {
          fr: 'Un soir, son amie Tao, la petite tortue, arriva en pleurant. « Ma perle de lune est tombée dans le grand trou bleu ! Sans elle, je n’arrive pas à m’endormir. » La perle de Tao brillait doucement toutes les nuits, comme une veilleuse. Maïa regarda le grand trou bleu. Il était profond, et sombre, et silencieux. Son cœur fit boum, boum.',
          en: 'One evening, her friend Tao, the little turtle, arrived in tears. “My moon pearl fell into the big blue hole! Without it, I can’t fall asleep.” Tao’s pearl glowed softly every night, like a night-light. Maia looked at the big blue hole. It was deep, and dark, and silent. Her heart went thump, thump.',
        },
        art: { sky: 'ocean', hero: '🐢', props: ['🧜‍♀️', '🪸', '🫧'], ambience: 'bubbles' },
        prompt:
          'A small green sea turtle with teary eyes talking to the little mermaid with a turquoise tail and curly dark hair at the edge of a coral reef, both looking down at a deep blue hole, soft evening underwater light.',
      },
      {
        text: {
          fr: 'Tao était trop petite pour plonger si loin. Maïa prit une grande inspiration. « J’ai peur », dit-elle. « Mais je vais y aller quand même, pour toi. » Sa maman, qui passait par là, lui caressa les cheveux. « Avoir du courage, ce n’est pas ne jamais avoir peur. C’est avancer doucement, même avec un peu de peur. » Maïa hocha la tête.',
          en: 'Tao was too little to dive so far. Maia took a deep breath. “I’m scared,” she said. “But I’ll go anyway, for you.” Her mother, who was swimming by, stroked her hair. “Being brave doesn’t mean never being scared. It means moving forward gently, even with a little fear.” Maia nodded.',
        },
        art: { sky: 'ocean', hero: '🧜‍♀️', props: ['🧜', '🐢', '🐚', '🫧'], ambience: 'bubbles' },
        prompt:
          'A kind mother mermaid gently stroking the curly hair of the little mermaid with a turquoise tail, the small green sea turtle watching hopefully, coral reef around them, tender reassuring underwater mood.',
      },
      {
        text: {
          fr: 'Et hop ! Le grand plongeon ! Maïa descendit, plus bas, encore plus bas. L’eau devint bleu foncé, puis bleu nuit. Mais soudain, des petites lumières apparurent autour d’elle. Des méduses roses, des poissons lanternes, des étoiles de mer qui brillaient. « Bonsoir, petite sirène », chuchotaient-ils. Le fond de la mer n’était pas effrayant. Il était doux et lumineux.',
          en: 'And hop! The big dive! Maia swam down, lower, and lower still. The water turned dark blue, then midnight blue. But suddenly, little lights appeared all around her. Pink jellyfish, lantern fish, glowing starfish. “Good evening, little mermaid,” they whispered. The bottom of the sea wasn’t frightening at all. It was soft and full of light.',
        },
        art: { sky: 'ocean', hero: '🧜‍♀️', props: ['🪼', '🐟', '⭐', '🫧'], ambience: 'bubbles' },
        prompt:
          'The little mermaid with a turquoise tail diving into deep midnight-blue water, surrounded by friendly glowing pink jellyfish, small lantern fish and shining starfish, magical soft bioluminescent light.',
      },
      {
        text: {
          fr: 'Tout au fond, entre deux algues, Maïa vit une lumière blanche. La perle de lune ! Elle la prit dans ses mains et remonta, remonta, jusqu’au récif de corail. « Tao ! Je l’ai trouvée ! » La petite tortue fit une pirouette de joie. « Merci, Maïa ! Tu as plongé dans le grand trou bleu pour moi ! » Maïa souriait, toute fière.',
          en: 'All the way at the bottom, between two strands of seaweed, Maia saw a white light. The moon pearl! She held it in her hands and swam up, up, all the way to the coral reef. “Tao! I found it!” The little turtle did a happy somersault. “Thank you, Maia! You dived into the big blue hole for me!” Maia smiled, feeling very proud.',
        },
        art: { sky: 'ocean', hero: '🐢', props: ['🧜‍♀️', '🫧', '🪸', '⚪'], ambience: 'bubbles' },
        prompt:
          'The little mermaid with a turquoise tail holding up a softly glowing white pearl, the small green sea turtle doing a happy somersault beside her, pink coral reef, joyful underwater evening light.',
      },
      {
        text: {
          fr: 'Ce soir-là, Tao posa sa perle de lune entre deux coraux. Maïa s’allongea tout près, dans un coquillage doux comme un nuage. La perle brillait pour elles deux. Les vagues, là-haut, berçaient la mer tout entière. « Bonne nuit, Tao. » « Bonne nuit, courageuse Maïa. » Et toi, laisse les vagues te bercer, tout doucement, jusqu’au pays des rêves.',
          en: 'That night, Tao placed her moon pearl between two corals. Maia lay down close by, in a shell as soft as a cloud. The pearl glowed for both of them. The waves, far above, rocked the whole sea. “Goodnight, Tao.” “Goodnight, brave Maia.” And you, let the waves rock you, very gently, all the way to dreamland.',
        },
        art: { sky: 'ocean', hero: '🐚', props: ['🧜‍♀️', '🐢', '⚪', '🪸'], ambience: 'bubbles' },
        prompt:
          'The little mermaid with a turquoise tail asleep in a big soft seashell, the small green sea turtle sleeping beside her, a glowing white pearl resting between corals, calm dark blue water with drifting bubbles.',
      },
    ],
  },

  // ───────────────────────────── d28 · friendship ─────────────────────────────
  {
    id: 'd28',
    title: {
      fr: 'Le bonhomme de neige qui voulait voir le printemps',
      en: 'The Snowman Who Wanted to See Spring',
    },
    teaser: {
      fr: 'Léna et Amadou trouvent une jolie façon d’offrir le printemps à leur ami.',
      en: 'Lena and Amadou find a lovely way to give spring to their friend.',
    },
    value: 'friendship',
    moral: {
      fr: 'Les vrais amis trouvent toujours une façon de partager ce qu’ils aiment.',
      en: 'True friends always find a way to share what they love.',
    },
    emoji: '☃️',
    age: 3,
    scenes: [
      {
        text: {
          fr: 'Dans un village tout blanc, au pied d’une grande montagne, Léna et Amadou avaient fait un bonhomme de neige. Il avait une écharpe rouge, un nez de carotte et deux boutons de bois pour les yeux. Ils l’appelèrent Flocon. Chaque jour, Flocon regardait les enfants glisser sur la colline. Et il riait de tout son cœur de neige.',
          en: 'In an all-white village, at the foot of a big mountain, Lena and Amadou had made a snowman. He had a red scarf, a carrot nose, and two wooden buttons for eyes. They named him Flocon. Every day, Flocon watched the children slide down the hill. And he laughed with all his snowy heart.',
        },
        art: { sky: 'snow', hero: '☃️', props: ['🧣', '🥕', '🛷', '⛰️'], ambience: 'snow' },
        prompt:
          'A cheerful snowman with a red scarf, a carrot nose and wooden button eyes standing in a snowy village at the foot of a big mountain, a girl with a pom-pom hat and a boy in a blue coat sledding nearby.',
      },
      {
        text: {
          fr: 'Un soir, Flocon soupira. « Les oiseaux parlent du printemps. Ils disent qu’il y a des fleurs partout, jaunes, roses, violettes. J’aimerais tant les voir ! » Léna et Amadou se regardèrent. Ils savaient qu’un bonhomme de neige aime le froid. Au printemps, il fait trop chaud pour lui. Comment faire pour que leur ami voie quand même les fleurs ?',
          en: 'One evening, Flocon sighed. “The birds talk about spring. They say there are flowers everywhere, yellow, pink, purple. I would love to see them so much!” Lena and Amadou looked at each other. They knew that a snowman loves the cold. In spring, it is too warm for him. How could their friend still see the flowers?',
        },
        art: { sky: 'snow', hero: '☃️', props: ['🐦', '🌷', '👧', '👦'], ambience: 'snow' },
        prompt:
          'The snowman with a red scarf and carrot nose looking dreamily at a small bird on a branch, the girl with a pom-pom hat and the boy in a blue coat thinking beside him, soft snowy evening light.',
      },
      {
        text: {
          fr: 'Les enfants réfléchirent très fort, sous la lune. Puis Amadou eut une idée. « Là-haut, sur la montagne, la neige reste toute l’année. Flocon pourra y dormir au frais, bien tranquille. » Léna sourit. « Et au printemps, on lui enverra les fleurs ! » Flocon agita ses bras de brindilles. « Vous êtes les meilleurs amis du monde ! »',
          en: 'The children thought very hard, under the moon. Then Amadou had an idea. “Up there, on the mountain, the snow stays all year long. Flocon can sleep there in the cool air, nice and peaceful.” Lena smiled. “And in spring, we’ll send him the flowers!” Flocon waved his twig arms. “You are the best friends in the whole world!”',
        },
        art: { sky: 'indigo', hero: '👦', props: ['☃️', '👧', '🌙', '⛰️'], ambience: 'moon' },
        prompt:
          'Under a bright moon, the boy in a blue coat pointing up at a snowy mountain peak, the girl with a pom-pom hat smiling, the snowman with a red scarf happily waving his twig arms, snowy village night.',
      },
      {
        text: {
          fr: 'Le lendemain, tout le village aida. On posa Flocon sur une grande luge. Léna tirait, Amadou poussait, et un petit lapin blanc sautillait devant pour montrer le chemin. Ils montèrent, montèrent, jusqu’à un joli creux plein de neige, tout près du ciel. « Ici, tu seras bien », dit Léna en arrangeant son écharpe rouge.',
          en: 'The next day, the whole village helped. They placed Flocon on a big sled. Lena pulled, Amadou pushed, and a little white rabbit hopped ahead to show the way. They climbed and climbed, up to a pretty hollow full of snow, very close to the sky. “You’ll be happy here,” said Lena, straightening his red scarf.',
        },
        art: { sky: 'snow', hero: '🛷', props: ['☃️', '🐇', '👧', '👦', '🏔️'], ambience: 'snow' },
        prompt:
          'The girl with a pom-pom hat pulling a big wooden sled carrying the snowman with a red scarf up a snowy mountain path, the boy in a blue coat pushing from behind, a little white rabbit hopping ahead, bright crisp air.',
      },
      {
        text: {
          fr: 'Au printemps, la vallée se couvrit de fleurs. Léna et Amadou fabriquèrent une carte postale. Ils dessinèrent des tulipes, des marguerites et des coquelicots, et collèrent dessus de vrais pétales. Puis une hirondelle prit la carte dans son bec et s’envola vers la montagne. Quand Flocon la reçut, il ouvrit de grands yeux. « Les fleurs ! Mes amis ne m’ont pas oublié ! »',
          en: 'In spring, the valley was covered in flowers. Lena and Amadou made a postcard. They drew tulips, daisies, and poppies, and glued real petals onto it. Then a swallow took the card in its beak and flew toward the mountain. When Flocon received it, he opened his eyes wide. “The flowers! My friends haven’t forgotten me!”',
        },
        art: { sky: 'dawn', hero: '🐦', props: ['💌', '🌷', '🌼', '☃️'], ambience: 'petals' },
        prompt:
          'A swallow flying from a flowery spring valley up to a snowy mountain hollow, carrying a postcard decorated with drawn tulips and real petals, the snowman with a red scarf looking delighted, soft dawn colors.',
      },
      {
        text: {
          fr: 'Flocon posa la carte tout contre son écharpe rouge. Là-haut, l’air était frais et doux. Les étoiles brillaient tout près, comme des fleurs de lumière. Flocon regarda les tulipes de la carte, puis il ferma ses yeux de bois. Il dormait, bien au frais, en rêvant du printemps. L’hiver prochain, ses amis viendront le voir. Chut… toi aussi, rêve aux fleurs.',
          en: 'Flocon held the card close against his red scarf. Up there, the air was cool and gentle. The stars shone very close, like flowers made of light. Flocon looked at the tulips on the card, then he closed his wooden eyes. He slept, nice and cool, dreaming of spring. Next winter, his friends will come to visit. Shh… you too, dream of flowers.',
        },
        art: { sky: 'snow', hero: '☃️', props: ['💌', '🌷', '⭐', '🏔️'], ambience: 'stars' },
        prompt:
          'The snowman with a red scarf peacefully sleeping in a snowy mountain hollow, a flowery postcard tucked against his scarf, a sky full of bright close stars, calm and tender night.',
      },
    ],
  },

  // ───────────────────────────── d29 · patience ─────────────────────────────
  {
    id: 'd29',
    title: { fr: 'La chenille pressée', en: 'The Caterpillar in a Hurry' },
    teaser: {
      fr: 'Zélie veut devenir papillon tout de suite. Mais les belles choses prennent du temps.',
      en: 'Zelie wants to be a butterfly right now. But good things take time.',
    },
    value: 'patience',
    moral: {
      fr: 'Les belles choses prennent du temps : il faut savoir attendre.',
      en: 'Good things take time: it’s worth learning to wait.',
    },
    emoji: '🐛',
    age: 3,
    scenes: [
      {
        text: {
          fr: 'Dans un jardin plein de trèfles et de pâquerettes vivait une petite chenille verte nommée Zélie. Elle avait de petites pattes rapides et de grands yeux curieux. Chaque matin, elle regardait les papillons danser au-dessus des fleurs. Bleus, jaunes, orange… « Un jour, je serai comme eux », disait-elle. « Mais je voudrais que ce soit aujourd’hui ! »',
          en: 'In a garden full of clover and daisies lived a little green caterpillar named Zelie. She had quick little feet and big curious eyes. Every morning, she watched the butterflies dance above the flowers. Blue ones, yellow ones, orange ones… “One day, I’ll be like them,” she said. “But I wish it could be today!”',
        },
        art: { sky: 'dawn', hero: '🐛', props: ['🦋', '🌼', '☘️', '🌸'], ambience: 'sunrise' },
        prompt:
          'A little green caterpillar with big curious eyes on a clover leaf, watching colorful butterflies dance above daisies in a sunny garden, soft morning light.',
      },
      {
        text: {
          fr: 'Zélie grimpa tout en haut d’une feuille. « Je vais voler, tout de suite ! » Elle sauta en agitant ses petites pattes. Pouf ! Elle tomba tout doucement dans un pétale de rose. Le pétale était moelleux, heureusement. Zélie se releva, un peu vexée. « Bon. Alors je vais me faire des ailes ! » Elle avait plein d’idées, Zélie la pressée.',
          en: 'Zelie climbed to the very top of a leaf. “I’m going to fly, right now!” She jumped, waving her little feet. Poof! She landed very softly in a rose petal. Luckily, the petal was soft and cushy. Zelie got back up, a little grumpy. “Fine. Then I’ll make myself some wings!” She had lots of ideas, Zelie in a hurry.',
        },
        art: { sky: 'dawn', hero: '🐛', props: ['🌹', '🍃', '🦋'], ambience: 'petals' },
        prompt:
          'The little green caterpillar with big curious eyes landing softly and safely in a large pink rose petal after a tiny hop from a leaf, looking a little grumpy and funny, sunny garden.',
      },
      {
        text: {
          fr: 'Elle colla deux pétales de pâquerette sur son dos. Elle courut, courut… mais les pétales s’envolèrent sans elle. Zélie s’assit sur un champignon et soupira très fort. Madame Escargot passait par là, lentement, tout lentement. « Pourquoi es-tu si pressée, petite chenille ? » « Parce que je veux être un papillon maintenant ! » dit Zélie.',
          en: 'She stuck two daisy petals on her back. She ran and ran… but the petals flew away without her. Zelie sat down on a mushroom and sighed very loudly. Madame Snail was passing by, slowly, very slowly. “Why are you in such a hurry, little caterpillar?” “Because I want to be a butterfly now!” said Zelie.',
        },
        art: { sky: 'gold', hero: '🐌', props: ['🐛', '🍄', '🌼'], ambience: 'petals' },
        prompt:
          'The little green caterpillar with big curious eyes sitting on a red mushroom with two daisy petals floating away, a kind old snail with a spiral shell slowly approaching, warm golden afternoon garden.',
      },
      {
        text: {
          fr: 'Madame Escargot sourit. « Les belles choses prennent du temps. D’abord, tu manges de bonnes feuilles. Ensuite, tu grandis. Puis tu t’enroules dans un petit cocon, et tu dors longtemps, longtemps. Pendant ce temps, tes ailes poussent en secret. » Zélie ouvrit de grands yeux. « Alors, pour devenir papillon… il faut attendre et dormir ? » « Exactement. »',
          en: 'Madame Snail smiled. “Good things take time. First, you eat good leaves. Then, you grow. Then you wrap yourself in a little cocoon, and you sleep for a long, long time. Meanwhile, your wings grow in secret.” Zelie opened her eyes wide. “So, to become a butterfly… I just have to wait and sleep?” “Exactly.”',
        },
        art: { sky: 'gold', hero: '🐌', props: ['🐛', '🍃', '🦋'], ambience: 'fireflies' },
        prompt:
          'The kind old snail with a spiral shell talking gently to the little green caterpillar with wide amazed eyes, both on a big leaf in a garden at golden hour, a faint dreamy butterfly shape in the air.',
      },
      {
        text: {
          fr: 'Alors Zélie mangea de bonnes feuilles. Elle grandit, jour après jour. Puis, un soir, elle s’accrocha sous une branche et s’enroula dans un cocon tout doux. Le soleil se leva et se coucha, encore et encore. La pluie chanta, le vent souffla. Madame Escargot passait parfois et murmurait : « Patience, petite Zélie. Tout va bien. »',
          en: 'So Zelie ate good leaves. She grew, day after day. Then, one evening, she hung beneath a branch and wrapped herself in a soft cocoon. The sun rose and set, again and again. The rain pattered, the wind blew. Madame Snail sometimes passed by and whispered: “Patience, little Zelie. All is well.”',
        },
        art: { sky: 'violet', hero: '🌿', props: ['🐌', '🌧️', '🌙', '🍃'], ambience: 'moon' },
        prompt:
          'A soft green cocoon hanging peacefully under a leafy branch at night, the kind old snail with a spiral shell resting below and looking up tenderly, a gentle rain cloud and the moon, calm violet sky.',
      },
      {
        text: {
          fr: 'Un beau matin, le cocon s’ouvrit. Zélie déplia deux grandes ailes orange, avec des points bleus. Elle vola toute la journée, de fleur en fleur, en riant. Puis le soir arriva. Zélie se posa sur une grande marguerite, replia ses ailes et ferma les yeux, toute contente. Elle n’était plus pressée du tout. Et toi, prends ton temps… et dors bien.',
          en: 'One fine morning, the cocoon opened. Zelie unfolded two big orange wings with blue dots. She flew all day long, from flower to flower, laughing. Then evening came. Zelie settled on a big daisy, folded her wings, and closed her eyes, very happy. She wasn’t in a hurry at all anymore. And you, take your time… and sleep well.',
        },
        art: { sky: 'rose', hero: '🦋', props: ['🌼', '🐌', '🌙', '⭐'], ambience: 'stars' },
        prompt:
          'A beautiful butterfly with orange wings and blue dots sleeping on a big white daisy with folded wings, the kind old snail with a spiral shell resting nearby, soft pink evening sky with first stars.',
      },
    ],
  },

  // ───────────────────────────── d30 · gratitude ─────────────────────────────
  {
    id: 'd30',
    title: { fr: 'Le voyage de la goutte d’eau', en: 'The Journey of the Water Drop' },
    teaser: {
      fr: 'Du nuage à la mer, Plic la goutte d’eau fait un grand voyage.',
      en: 'From cloud to sea, Plic the water drop goes on a great journey.',
    },
    value: 'gratitude',
    moral: {
      fr: 'Chaque goutte d’eau est un cadeau : prenons-en soin et disons-lui merci.',
      en: 'Every drop of water is a gift: let’s take care of it and say thank you.',
    },
    emoji: '💧',
    age: 7,
    scenes: [
      {
        text: {
          fr: 'Tout là-haut, dans un gros nuage blanc, vivait une petite goutte d’eau nommée Plic. Elle était ronde et brillante, et elle aimait regarder la terre, tout en bas. Un matin, le nuage devint gris et lourd. « C’est l’heure du voyage ! » chantèrent toutes les gouttes. Et Plic se laissa tomber, doucement, avec des milliers d’amies.',
          en: 'High up, in a big white cloud, lived a little water drop named Plic. She was round and shiny, and she loved looking at the earth far below. One morning, the cloud became gray and heavy. “It’s time for the journey!” called all the drops. And Plic let herself fall, gently, with thousands of friends.',
        },
        art: { sky: 'dawn', hero: '💧', props: ['☁️', '🌧️', '🌍'], ambience: 'sunrise' },
        prompt:
          'A tiny round shiny water drop with a happy little face inside a big fluffy cloud, many other little drops beginning to fall as gentle rain over green hills, soft sunrise colors.',
      },
      {
        text: {
          fr: 'Plic atterrit sur une feuille de pommier. Quelle glissade ! Puis elle tomba dans la terre, près des racines. « Merci, petite goutte », murmura le pommier. « Grâce à toi, mes pommes vont grandir. » Plic était surprise. Elle ne savait pas qu’elle était si utile ! Puis elle se faufila sous la terre et rejoignit un petit ruisseau qui riait.',
          en: 'Plic landed on an apple tree leaf. What a slide! Then she dropped into the soil, near the roots. “Thank you, little drop,” murmured the apple tree. “Thanks to you, my apples will grow.” Plic was surprised. She didn’t know she was so useful! Then she slipped under the ground and joined a little laughing stream.',
        },
        art: { sky: 'forest', hero: '💧', props: ['🍎', '🌳', '🌱', '🍃'], ambience: 'sunrise' },
        prompt:
          'The tiny round shiny water drop with a happy little face sliding down a green apple tree leaf toward the roots, a friendly apple tree with red apples, a little stream sparkling nearby, fresh morning light.',
      },
      {
        text: {
          fr: 'Le ruisseau courait entre les cailloux. Plic passa près d’un cerf qui buvait. « Merci, l’eau fraîche ! » dit le cerf. Elle passa sous un petit pont de bois, où des canards nageaient. Elle arrosa les joncs, les nénuphars et les grenouilles. Le ruisseau devint une rivière, large et calme. Et partout où elle passait, la vie disait merci.',
          en: 'The stream ran between the pebbles. Plic passed by a deer who was drinking. “Thank you, fresh water!” said the deer. She flowed under a little wooden bridge, where ducks were swimming. She watered the reeds, the water lilies, and the frogs. The stream became a river, wide and calm. And everywhere she went, life said thank you.',
        },
        art: { sky: 'forest', hero: '🦌', props: ['💧', '🦆', '🐸', '🪷'], ambience: 'fireflies' },
        prompt:
          'A calm winding river through a green meadow, a gentle deer drinking at the edge, ducks swimming under a small wooden bridge, frogs on water lilies, the tiny shiny water drop with a happy face sparkling in the water.',
      },
      {
        text: {
          fr: 'Un soir, la rivière arriva à la mer. Tout était grand, bleu et salé ! Plic dansa dans les vagues avec les poissons, les dauphins et les algues. Puis le soleil la réchauffa doucement, si doucement qu’elle devint légère, légère. Elle monta dans le ciel comme une plume invisible, et retrouva un nuage tout neuf. Le voyage recommençait.',
          en: 'One evening, the river reached the sea. Everything was big, blue, and salty! Plic danced in the waves with the fish, the dolphins, and the seaweed. Then the sun warmed her gently, so gently that she became light, so light. She rose into the sky like an invisible feather and found a brand-new cloud. The journey was starting again.',
        },
        art: { sky: 'ocean', hero: '🌊', props: ['💧', '🐬', '🐟', '☁️'], ambience: 'sunrise' },
        prompt:
          'A wide blue sea at sunset where a river flows in, playful dolphins and fish in the waves, the tiny shiny water drop with a happy face floating gently up toward a fluffy new cloud, warm glowing sky.',
      },
      {
        text: {
          fr: 'Le nuage glissa au-dessus d’une maison avec un jardin. Plic tomba dans un grand tonneau de pluie, près des tomates. Le lendemain, un petit garçon nommé Noé remplit son arrosoir, et Plic coula sur un tournesol. Puis Noé but un grand verre d’eau fraîche. Sa grand-mère lui raconta le voyage de l’eau : le nuage, la pluie, la rivière, la mer… « Waouh », dit Noé.',
          en: 'The cloud drifted over a house with a garden. Plic fell into a big rain barrel, near the tomatoes. The next day, a little boy named Noe filled his watering can, and Plic trickled onto a sunflower. Then Noe drank a big glass of fresh water. His grandmother told him about the journey of water: the cloud, the rain, the river, the sea… “Wow,” said Noe.',
        },
        art: { sky: 'gold', hero: '👦', props: ['🌻', '🍅', '💧', '👵'], ambience: 'sunrise' },
        prompt:
          'A little boy with curly hair watering a tall sunflower with a small watering can in a cozy vegetable garden, his grandmother smiling beside him, a wooden rain barrel near tomato plants, warm golden light.',
      },
      {
        text: {
          fr: 'Le soir, Noé regarda par la fenêtre. Il pleuvait tout doucement. Plic, plic, plic, faisaient les gouttes sur le toit. « Merci, la pluie. Merci, la rivière. Merci, la mer et les nuages », chuchota Noé. Puis il se glissa sous sa couette. La pluie chantait une berceuse sur les carreaux. Écoute-la, toi aussi… plic, plic… et ferme les yeux.',
          en: 'In the evening, Noe looked out of the window. It was raining very gently. Plic, plic, plic, went the drops on the roof. “Thank you, rain. Thank you, river. Thank you, sea and clouds,” whispered Noe. Then he slipped under his duvet. The rain hummed a lullaby on the windowpanes. Listen to it too… plic, plic… and close your eyes.',
        },
        art: { sky: 'indigo', hero: '🌧️', props: ['🏠', '🛏️', '💧', '🌙'], ambience: 'moon' },
        prompt:
          'The little boy with curly hair snuggled in bed under a cozy duvet, looking at gentle raindrops sliding down his bedroom window, soft night-light glow, calm rainy night outside with a hint of moon.',
      },
    ],
  },
];

import type { DodoStory } from './types';

/**
 * Princesse Lili — le royaume des mille secrets. Lili, her purple baby dragon
 * Mauve and Pousse, the little garden robot, as on the official visual
 * (public/dodo/lili). The visual is also the reference picture for every
 * generated scene, so Lili looks the same everywhere.
 */
const LILI =
  'Princess Lili, a smiling girl with shoulder-length brown hair, a small golden tiara and big brown starry eyes, wearing a blue bodice with red laces, puffy silver sleeves with red dots and a sparkly yellow tulle skirt';
const FRIENDS = 'Mauve, a cute purple baby dragon with golden horns and a heart necklace, and Pousse, a small round lime-green robot with a black screen face, a glowing blue smile and a leaf sprout on its head';

export const LILI_STORY: DodoStory = {
  id: 'lili',
  title: { fr: 'Princesse Lili et le royaume des mille secrets', en: 'Princess Lili and the Kingdom of a Thousand Secrets' },
  teaser: { fr: 'Chaque secret cache une aventure… et une petite gentillesse.', en: 'Every secret hides an adventure… and a little kindness.' },
  value: 'kindness',
  moral: {
    fr: 'Les plus beaux secrets sont les gentillesses que l’on fait sans bruit.',
    en: 'The most beautiful secrets are the kindnesses we do quietly.',
  },
  emoji: '👑',
  age: 3,
  cover: '/dodo/lili/cover.webp',
  reference: '/dodo/lili/lili-ref.jpg',
  scenes: [
    {
      text: {
        fr: 'Il était une fois, tout en haut des montagnes bleues, un château aux tours pointues et aux fenêtres dorées. Là vivait la princesse Lili, avec sa petite couronne qui brillait comme un rayon de soleil. Ses deux meilleurs amis ne la quittaient jamais : Mauve, un bébé dragon tout violet, et Pousse, un petit robot jardinier avec une feuille sur la tête.',
        en: 'Once upon a time, high up in the blue mountains, there was a castle with pointed towers and golden windows. Princess Lili lived there, with her little crown that shone like a sunbeam. Her two best friends never left her side: Mauve, a little purple baby dragon, and Pousse, a small gardening robot with a leaf on his head.',
      },
      art: { sky: 'gold', hero: '👸', props: ['🏰', '🐉', '🤖', '🌸'], ambience: 'sunrise' },
      prompt: `${LILI}, standing on a flowery castle balcony with ${FRIENDS}, a fairytale castle with blue roofs and waterfalls behind them, warm golden late-afternoon light`,
    },
    {
      text: {
        fr: 'Un soir, la vieille bibliothécaire du château murmura : « On dit que notre royaume cache mille secrets. » Les yeux de Lili s’allumèrent comme deux étoiles. « Mille secrets ? Allons les chercher ! » Mauve battit de ses petites ailes, et Pousse fit clignoter son sourire bleu. Les trois amis prirent une lanterne et partirent sur la pointe des pieds.',
        en: 'One evening, the castle’s old librarian whispered: “They say our kingdom hides a thousand secrets.” Lili’s eyes lit up like two stars. “A thousand secrets? Let’s go and find them!” Mauve flapped his little wings, and Pousse made his blue smile twinkle. The three friends took a lantern and set off on tiptoe.',
      },
      art: { sky: 'violet', hero: '👸', props: ['📚', '🏮', '🐉', '🤖'], ambience: 'stars' },
      prompt: `${LILI} holding a glowing lantern in a cozy castle library full of books, listening to a kind old librarian, with ${FRIENDS} beside her, soft candlelight`,
    },
    {
      text: {
        fr: 'Dans le jardin, sous la lune, ils trouvèrent un premier secret : un petit pot de fleurs posé devant la porte du vieux jardinier, avec un mot qui disait « Merci ». Plus loin, quelqu’un avait réparé en silence la balançoire cassée. « Oh ! » chuchota Lili. « Ces secrets-là, ce sont des gentillesses cachées ! »',
        en: 'In the garden, under the moon, they found the first secret: a little flowerpot left at the old gardener’s door, with a note that said “Thank you.” Further on, someone had quietly mended the broken swing. “Oh!” whispered Lili. “These secrets are hidden kindnesses!”',
      },
      art: { sky: 'forest', hero: '🪴', props: ['👸', '🌙', '🐉', '🤖'], ambience: 'fireflies' },
      prompt: `${LILI} kneeling in a moonlit castle garden, discovering a small flowerpot left on a doorstep, a mended wooden swing nearby, ${FRIENDS} peeking curiously, fireflies glowing`,
    },
    {
      text: {
        fr: 'Toute la nuit, les trois amis découvrirent d’autres secrets : une couverture posée sur les épaules d’une statue frileuse, des graines laissées pour les oiseaux, un dessin glissé sous la porte d’un enfant malade. Partout dans le royaume, des gens faisaient du bien sans le dire à personne. Le cœur de Lili devint tout chaud.',
        en: 'All night long, the three friends discovered more secrets: a blanket laid on the shoulders of a chilly statue, seeds left out for the birds, a drawing slipped under the door of a child who was feeling unwell. All over the kingdom, people were doing good without telling anyone. Lili’s heart grew all warm.',
      },
      art: { sky: 'indigo', hero: '💝', props: ['🐦', '🌾', '🖍️', '👸'], ambience: 'stars' },
      prompt: `${LILI} walking through a sleeping fairytale village at night with ${FRIENDS}, noticing seeds left for little birds on a windowsill and a child's drawing slipped under a door, gentle blue moonlight`,
    },
    {
      text: {
        fr: '« Et si nous aussi, nous ajoutions un secret ? » proposa Lili. Mauve souffla une petite flamme toute douce pour allumer la lanterne du pont. Pousse planta une fleur qui s’ouvrirait au matin. Et Lili laissa un ruban doré sur la porte de la bibliothécaire, avec trois mots : « Merci pour l’histoire. » Personne ne les vit. C’était parfait.',
        en: '“What if we added a secret too?” said Lili. Mauve breathed a tiny, gentle flame to light the lantern on the bridge. Pousse planted a flower that would open in the morning. And Lili left a golden ribbon on the librarian’s door, with three words: “Thanks for the story.” Nobody saw them. It was perfect.',
      },
      art: { sky: 'rose', hero: '🎀', props: ['🏮', '🌷', '🐉', '🤖'], ambience: 'fireflies' },
      prompt: `${LILI} tying a golden ribbon on a wooden door at night, Mauve the purple baby dragon softly lighting a lantern on a stone bridge, Pousse the lime-green robot planting a flower, warm glowing light`,
    },
    {
      text: {
        fr: 'De retour dans sa chambre, Lili se blottit sous sa couette étoilée. Mauve se roula en boule à ses pieds, et la feuille de Pousse se replia doucement. « Mille secrets », souffla Lili en bâillant, « et maintenant mille et un. » Dehors, la lune souriait. Toi aussi, pense à une petite gentillesse que tu feras demain… et ferme doucement les yeux.',
        en: 'Back in her room, Lili snuggled under her starry duvet. Mauve curled up into a ball at her feet, and Pousse’s leaf gently folded down. “A thousand secrets,” Lili breathed with a yawn, “and now a thousand and one.” Outside, the moon was smiling. You too, think of a little kindness you will do tomorrow… and gently close your eyes.',
      },
      art: { sky: 'indigo', hero: '😴', props: ['👸', '🐉', '🤖', '🌙'], ambience: 'moon' },
      prompt: `${LILI} asleep in a cozy canopy bed with a starry duvet in a castle bedroom, Mauve the purple baby dragon curled up at her feet, Pousse the lime-green robot resting with its screen dimmed, crescent moon in the window`,
    },
  ],
};

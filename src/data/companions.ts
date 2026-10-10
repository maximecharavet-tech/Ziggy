/**
 * Ziggy World companions: the little friends who play alongside the child.
 * Every line is kind and growth-minded: mistakes are part of learning.
 */
import type { CompanionProfile } from './types';

export const COMPANIONS: CompanionProfile[] = [
  {
    id: 'dragon',
    name: { fr: 'Pépin le dragon', en: 'Pip the Dragon' },
    emoji: '🐉',
    color: '#4CAF50',
    personality: {
      fr: 'Un petit dragon tout doux, curieux et plein d’énergie, qui crache des bulles au lieu du feu.',
      en: 'A gentle little dragon, curious and full of energy, who blows bubbles instead of fire.',
    },
    reactions: {
      success: [
        { fr: 'Bravo ! Mes ailes en frétillent !', en: 'Hooray! My wings are wiggling!' },
        { fr: 'Super réponse, champion des bulles !', en: 'Great answer, bubble champion!' },
        { fr: 'Tu as trouvé ! Je fais une bulle de joie !', en: 'You found it! I’m blowing a happy bubble!' },
      ],
      failure: [
        { fr: 'Pas encore ! On réessaie ensemble ?', en: 'Not yet! Shall we try again together?' },
        { fr: 'Oups, ce n’est pas grave. Ton cerveau grandit !', en: 'Oops, that’s okay. Your brain is growing!' },
        { fr: 'Presque ! Prends ton temps, je suis là.', en: 'Almost! Take your time, I’m right here.' },
      ],
      hint: [
        { fr: 'Regarde bien, l’indice se cache tout près…', en: 'Look closely, the clue is hiding nearby…' },
        { fr: 'Et si on y allait pas à pas ?', en: 'What if we go one step at a time?' },
        { fr: 'Psst… relis la question doucement.', en: 'Psst… read the question again slowly.' },
      ],
      levelUp: [
        { fr: 'Niveau suivant ! On vole plus haut !', en: 'Next level! We’re flying higher!' },
        { fr: 'Tu progresses à toute vitesse !', en: 'You’re getting better so fast!' },
        { fr: 'Waouh, un nouveau niveau ! Tu t’es entraîné et ça marche !', en: 'Wow, a new level! Your practice is paying off!' },
      ],
      questComplete: [
        { fr: 'Quête terminée ! On fait une danse de dragon ?', en: 'Quest complete! Time for a dragon dance?' },
        { fr: 'Mission accomplie, héros des bulles !', en: 'Mission done, bubble hero!' },
        { fr: 'Tu as réussi la quête ! Je suis si fier de toi !', en: 'You finished the quest! I’m so proud of you!' },
      ],
    },
    unlockStars: 0,
  },
  {
    id: 'fox',
    name: { fr: 'Filou le renard', en: 'Finn the Fox' },
    emoji: '🦊',
    color: '#FF8A50',
    personality: {
      fr: 'Un renard malin et rigolo qui adore les énigmes et les petits trucs pour réfléchir.',
      en: 'A clever, funny fox who loves riddles and little thinking tricks.',
    },
    reactions: {
      success: [
        { fr: 'Malin ! Tu as tout compris !', en: 'Clever! You got it!' },
        { fr: 'Ma queue fait des tourbillons de joie !', en: 'My tail is swishing with joy!' },
        { fr: 'Bien joué, futé comme un renard !', en: 'Well played, clever as a fox!' },
      ],
      failure: [
        { fr: 'Pas encore ! On cherche un autre chemin ?', en: 'Not yet! Shall we find another way?' },
        { fr: 'Les erreurs, ce sont des indices. On réessaie !', en: 'Mistakes are clues. Let’s try again!' },
        { fr: 'Hmm, presque ! Je suis sûr que tu vas trouver.', en: 'Hmm, almost! I’m sure you’ll find it.' },
      ],
      hint: [
        { fr: 'Astuce de renard : élimine d’abord ce qui ne va pas.', en: 'Fox trick: first rule out what doesn’t fit.' },
        { fr: 'Renifle bien… il y a un indice dans l’image !', en: 'Sniff around… there’s a clue in the picture!' },
        { fr: 'Essaie de compter sur tes doigts.', en: 'Try counting on your fingers.' },
      ],
      levelUp: [
        { fr: 'Niveau supérieur ! Tu deviens un vrai pro !', en: 'Level up! You’re becoming a real pro!' },
        { fr: 'Encore plus fort ! J’adore ton courage.', en: 'Even stronger! I love your courage.' },
        { fr: 'Un nouveau défi t’attend, tu es prêt !', en: 'A new challenge awaits, you’re ready!' },
      ],
      questComplete: [
        { fr: 'Quête réussie ! On garde le secret ? Non, on le crie !', en: 'Quest done! Keep it secret? No, let’s shout it!' },
        { fr: 'Une aventure de plus dans ton sac !', en: 'One more adventure in your bag!' },
        { fr: 'Quête terminée, bravo l’explorateur !', en: 'Quest complete, well done explorer!' },
      ],
    },
    unlockStars: 0,
  },
  {
    id: 'owl',
    name: { fr: 'Plume la chouette', en: 'Hoot the Owl' },
    emoji: '🦉',
    color: '#8D6E63',
    personality: {
      fr: 'Une chouette calme et sage qui aime les livres et rappelle qu’on apprend en essayant.',
      en: 'A calm, wise owl who loves books and reminds you that we learn by trying.',
    },
    reactions: {
      success: [
        { fr: 'Hou hou ! Très bonne réponse !', en: 'Hoo hoo! Very good answer!' },
        { fr: 'Tu as bien réfléchi, ça se voit !', en: 'You thought it through, I can tell!' },
        { fr: 'Excellent ! Ta curiosité t’a guidé.', en: 'Excellent! Your curiosity led the way.' },
      ],
      failure: [
        { fr: 'Pas encore ! On réessaie ensemble ?', en: 'Not yet! Shall we try again together?' },
        { fr: 'Se tromper, c’est apprendre. Continue !', en: 'Making mistakes is how we learn. Keep going!' },
        { fr: 'Respire doucement, et regarde à nouveau.', en: 'Take a slow breath and look again.' },
      ],
      hint: [
        { fr: 'Lis chaque réponse, une par une.', en: 'Read each answer, one by one.' },
        { fr: 'Pense à ce que tu sais déjà…', en: 'Think about what you already know…' },
        { fr: 'Un petit indice : la bonne réponse a du sens.', en: 'A little clue: the right answer makes sense.' },
      ],
      levelUp: [
        { fr: 'Un nouveau niveau de sagesse ! Hou hou !', en: 'A new level of wisdom! Hoo hoo!' },
        { fr: 'Tes efforts portent leurs fruits.', en: 'Your hard work is paying off.' },
        { fr: 'Tu grandis à chaque partie. Bravo !', en: 'You grow with every game. Well done!' },
      ],
      questComplete: [
        { fr: 'Quête accomplie ! Je l’écris dans mon grand livre.', en: 'Quest complete! I’m writing it in my big book.' },
        { fr: 'Quelle belle aventure tu as vécue !', en: 'What a lovely adventure you had!' },
        { fr: 'Bravo, cette page de l’histoire est à toi.', en: 'Well done, this page of the story is yours.' },
      ],
    },
    unlockStars: 0,
  },
  {
    id: 'unicorn',
    name: { fr: 'Étincelle la licorne', en: 'Sparkle the Unicorn' },
    emoji: '🦄',
    color: '#CE93D8',
    personality: {
      fr: 'Une licorne joyeuse qui sème des paillettes et croit très fort en toi.',
      en: 'A cheerful unicorn who spreads glitter and believes in you very much.',
    },
    reactions: {
      success: [
        { fr: 'Pluie de paillettes pour toi !', en: 'A shower of glitter for you!' },
        { fr: 'Magique ! Tu as trouvé !', en: 'Magical! You found it!' },
        { fr: 'Tu brilles comme un arc-en-ciel !', en: 'You shine like a rainbow!' },
      ],
      failure: [
        { fr: 'Pas encore ! On réessaie ensemble ?', en: 'Not yet! Shall we try again together?' },
        { fr: 'Même les licornes se trompent. On continue !', en: 'Even unicorns make mistakes. Let’s keep going!' },
        { fr: 'Ce n’est rien, ta magie grandit à chaque essai.', en: 'That’s fine, your magic grows with every try.' },
      ],
      hint: [
        { fr: 'Ferme les yeux, imagine… puis regarde encore.', en: 'Close your eyes, imagine… then look again.' },
        { fr: 'Une étincelle d’indice : regarde les couleurs !', en: 'A sparkle of a clue: look at the colours!' },
        { fr: 'Prends ton temps, la magie n’est jamais pressée.', en: 'Take your time, magic is never in a hurry.' },
      ],
      levelUp: [
        { fr: 'Niveau suivant ! Ta corne magique brille !', en: 'Next level! Your magic horn is glowing!' },
        { fr: 'Tu galopes vers de nouveaux défis !', en: 'You’re galloping towards new challenges!' },
        { fr: 'Un nouveau niveau, plein de surprises !', en: 'A new level, full of surprises!' },
      ],
      questComplete: [
        { fr: 'Quête terminée ! Un arc-en-ciel pour fêter ça !', en: 'Quest complete! A rainbow to celebrate!' },
        { fr: 'Tu as rendu le royaume encore plus beau !', en: 'You made the kingdom even more beautiful!' },
        { fr: 'Magnifique aventure, bravo !', en: 'Wonderful adventure, well done!' },
      ],
    },
    unlockStars: 3,
  },
  {
    id: 'cat',
    name: { fr: 'Moustache le chat', en: 'Whiskers the Cat' },
    emoji: '🐱',
    color: '#FFB74D',
    personality: {
      fr: 'Un chat câlin et un peu paresseux qui ronronne quand tu apprends quelque chose.',
      en: 'A cuddly, slightly sleepy cat who purrs whenever you learn something.',
    },
    reactions: {
      success: [
        { fr: 'Rrrron rrrron… c’est parfait !', en: 'Purr purr… that’s perfect!' },
        { fr: 'Miaou ! Bien joué !', en: 'Meow! Nicely done!' },
        { fr: 'Tu retombes toujours sur tes pattes !', en: 'You always land on your feet!' },
      ],
      failure: [
        { fr: 'Pas encore ! On réessaie ensemble ?', en: 'Not yet! Shall we try again together?' },
        { fr: 'Pas de souci, on s’étire et on recommence.', en: 'No worries, let’s stretch and try again.' },
        { fr: 'Presque ! Ma moustache sent que tu vas y arriver.', en: 'Almost! My whiskers say you’ll get it.' },
      ],
      hint: [
        { fr: 'Observe comme un chat : tout doucement.', en: 'Watch like a cat: slowly and quietly.' },
        { fr: 'Le bon choix se cache peut-être là…', en: 'The right choice might be hiding right there…' },
        { fr: 'Essaie de dire la question à voix haute.', en: 'Try saying the question out loud.' },
      ],
      levelUp: [
        { fr: 'Niveau suivant ! Je saute de joie… enfin, après ma sieste.', en: 'Next level! I’m jumping for joy… after my nap.' },
        { fr: 'Tu grimpes plus haut que moi sur l’arbre !', en: 'You’re climbing higher than me up the tree!' },
        { fr: 'Rrron, tu progresses si bien !', en: 'Purr, you’re improving so well!' },
      ],
      questComplete: [
        { fr: 'Quête terminée ! Câlin de victoire ?', en: 'Quest complete! Victory cuddle?' },
        { fr: 'Bravo ! Je ronronne de fierté.', en: 'Well done! I’m purring with pride.' },
        { fr: 'Encore une aventure réussie, miaou !', en: 'Another adventure done, meow!' },
      ],
    },
    unlockStars: 6,
  },
  {
    id: 'panda',
    name: { fr: 'Bambou le panda', en: 'Bamboo the Panda' },
    emoji: '🐼',
    color: '#78909C',
    personality: {
      fr: 'Un panda paisible et patient qui adore grignoter du bambou et faire des roulades.',
      en: 'A peaceful, patient panda who loves munching bamboo and doing roly-polies.',
    },
    reactions: {
      success: [
        { fr: 'Roulade de joie ! C’est juste !', en: 'A happy roly-poly! That’s right!' },
        { fr: 'Super ! Ça mérite un bout de bambou !', en: 'Great! That deserves a piece of bamboo!' },
        { fr: 'Tranquille et juste, bravo !', en: 'Calm and correct, well done!' },
      ],
      failure: [
        { fr: 'Pas encore ! On réessaie ensemble ?', en: 'Not yet! Shall we try again together?' },
        { fr: 'Doucement, on a tout le temps. Essaie encore.', en: 'Gently, we have all the time we need. Try again.' },
        { fr: 'Chaque essai te rend plus fort, comme le bambou qui pousse.', en: 'Every try makes you stronger, like growing bamboo.' },
      ],
      hint: [
        { fr: 'Respire comme un panda : lentement…', en: 'Breathe like a panda: slowly…' },
        { fr: 'Commence par la réponse qui te semble la plus simple.', en: 'Start with the answer that seems simplest.' },
        { fr: 'Petit indice : regarde le début.', en: 'Little clue: look at the beginning.' },
      ],
      levelUp: [
        { fr: 'Niveau suivant ! Tu pousses comme un bambou !', en: 'Next level! You’re growing like bamboo!' },
        { fr: 'Patience et entraînement, ça marche !', en: 'Patience and practice really work!' },
        { fr: 'Encore un niveau, quelle belle progression !', en: 'Another level, what lovely progress!' },
      ],
      questComplete: [
        { fr: 'Quête terminée ! Pique-nique de bambou pour fêter ça !', en: 'Quest complete! Bamboo picnic to celebrate!' },
        { fr: 'Bravo, aventurier tout en douceur !', en: 'Well done, gentle adventurer!' },
        { fr: 'Tu as réussi, je suis tellement content !', en: 'You did it, I’m so happy!' },
      ],
    },
    unlockStars: 10,
  },
  {
    id: 'robot',
    name: { fr: 'Boulon le robot', en: 'Bolt the Robot' },
    emoji: '🤖',
    color: '#4FC3F7',
    personality: {
      fr: 'Un robot gentil qui aime les calculs, les étapes et les bips joyeux.',
      en: 'A friendly robot who loves sums, steps and happy beeps.',
    },
    reactions: {
      success: [
        { fr: 'Bip bip ! Réponse correcte !', en: 'Beep beep! Correct answer!' },
        { fr: 'Calcul validé : tu es génial !', en: 'Calculation confirmed: you’re brilliant!' },
        { fr: 'Mes voyants clignotent de joie !', en: 'My lights are blinking with joy!' },
      ],
      failure: [
        { fr: 'Pas encore ! On réessaie ensemble ?', en: 'Not yet! Shall we try again together?' },
        { fr: 'Bip… petite erreur, grand apprentissage !', en: 'Beep… small mistake, big learning!' },
        { fr: 'Les robots aussi recommencent. Nouvel essai !', en: 'Robots try again too. New attempt!' },
      ],
      hint: [
        { fr: 'Analyse : découpe le problème en petits morceaux.', en: 'Analysis: break the problem into small pieces.' },
        { fr: 'Conseil robot : vérifie chaque étape.', en: 'Robot tip: check each step.' },
        { fr: 'Mon capteur dit : compte encore une fois.', en: 'My sensor says: count one more time.' },
      ],
      levelUp: [
        { fr: 'Mise à jour installée : niveau suivant !', en: 'Upgrade installed: next level!' },
        { fr: 'Puissance augmentée ! Tu progresses !', en: 'Power boosted! You’re improving!' },
        { fr: 'Bip bip, nouveau niveau débloqué !', en: 'Beep beep, new level unlocked!' },
      ],
      questComplete: [
        { fr: 'Quête terminée à 100 % !', en: 'Quest 100% complete!' },
        { fr: 'Mission réussie, partenaire !', en: 'Mission accomplished, partner!' },
        { fr: 'Bip bip hourra ! Bravo !', en: 'Beep beep hooray! Well done!' },
      ],
    },
    unlockStars: 14,
  },
  {
    id: 'dolphin',
    name: { fr: 'Vaguelette le dauphin', en: 'Splash the Dolphin' },
    emoji: '🐬',
    color: '#29B6F6',
    personality: {
      fr: 'Un dauphin joueur qui fait des sauts dans les vagues et adore les découvertes.',
      en: 'A playful dolphin who leaps through the waves and loves discoveries.',
    },
    reactions: {
      success: [
        { fr: 'Plouf ! Un saut de joie pour toi !', en: 'Splash! A happy leap for you!' },
        { fr: 'Bien nagé ! C’est la bonne réponse !', en: 'Nice swimming! That’s the right answer!' },
        { fr: 'Tu fais des vagues de génie !', en: 'You’re making waves of genius!' },
      ],
      failure: [
        { fr: 'Pas encore ! On réessaie ensemble ?', en: 'Not yet! Shall we try again together?' },
        { fr: 'Pas grave, on replonge !', en: 'No problem, let’s dive in again!' },
        { fr: 'Chaque vague t’apprend quelque chose. Encore une ?', en: 'Every wave teaches you something. One more?' },
      ],
      hint: [
        { fr: 'Écoute bien, comme un dauphin sous l’eau.', en: 'Listen carefully, like a dolphin underwater.' },
        { fr: 'Nage doucement vers chaque réponse.', en: 'Swim slowly towards each answer.' },
        { fr: 'Un indice remonte à la surface : regarde l’image !', en: 'A clue is floating up: look at the picture!' },
      ],
      levelUp: [
        { fr: 'Niveau suivant ! On plonge plus profond !', en: 'Next level! We’re diving deeper!' },
        { fr: 'Tu nages de plus en plus vite !', en: 'You’re swimming faster and faster!' },
        { fr: 'Un nouveau niveau, quelle belle vague !', en: 'A new level, what a great wave!' },
      ],
      questComplete: [
        { fr: 'Quête terminée ! Tout l’océan applaudit !', en: 'Quest complete! The whole ocean is cheering!' },
        { fr: 'Bravo, explorateur des mers !', en: 'Well done, sea explorer!' },
        { fr: 'Super aventure ! Saut périlleux de victoire !', en: 'Super adventure! Victory somersault!' },
      ],
    },
    unlockStars: 18,
  },
];

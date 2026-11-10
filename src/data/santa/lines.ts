/**
 * Everything Santa says in the guided calls and the free voice message.
 * The voice route (/api/santa/voice) only ever speaks these texts (plus a
 * validated first name), so each clip is generated once and then served from
 * the CDN cache: a guided call costs nothing to run.
 *
 * Santa's French avoids gendered adjectives about the child ("formidable",
 * "plein de…"), and he is always cheerful (never sad, no "naughty list").
 */
import type { L } from '@/lib/i18n-text';
import { giftById } from './gifts';
import { proudById } from './proud';
import { NAME_RE } from '@/lib/santa/name';
import { SANTA_ADVENT } from './advent';

export type SantaLocale = 'fr' | 'en';

export const SANTA_LINES = {
  // Opening
  'open.hohoho': { fr: 'Ho ho ho ! Allô ? Ici le Père Noël, depuis mon bureau au Pôle Nord !', en: 'Ho ho ho! Hello? This is Santa Claus, calling from my office at the North Pole!' },
  'sched.open': { fr: 'Comme promis, je t’appelle à l’heure pile ! Mes rennes m’ont rappelé que c’était le moment.', en: 'Just as I promised, I’m calling right on time! My reindeer reminded me it was the moment.' },
  'open.hear': { fr: 'Est-ce que tu m’entends bien ?', en: 'Can you hear me well?' },
  'open.hear.react': { fr: 'Parfait ! Moi, je t’entends très bien. Mes oreilles magiques entendent tout !', en: 'Perfect! I can hear you very well. My magic ears hear everything!' },
  'open.age.ask': { fr: 'Dis-moi, comment ça va aujourd’hui ?', en: 'Tell me, how are you today?' },
  // Letter and wishes
  'list.letter': { fr: 'Ziggy, mon petit lutin, m’a apporté ta lettre. Je l’ai juste ici, devant moi.', en: 'Ziggy, my little elf, brought me your letter. I have it right here in front of me.' },
  'list.read': { fr: 'Voyons voir ce que tu as demandé…', en: 'Let’s see what you asked for…' },
  'list.noLetter': { fr: 'Je n’ai pas encore reçu ta lettre ! Dis-moi, qu’est-ce qui te ferait très plaisir sous le sapin ?', en: 'I haven’t received your letter yet! Tell me, what would make you very happy under the tree?' },
  'list.noLetter.react': { fr: 'Oh, quelle belle idée ! Je l’écris tout de suite dans mon grand livre.', en: 'Oh, what a lovely idea! I’m writing it in my big book right away.' },
  'list.more': { fr: 'Et il y a encore d’autres belles choses sur ta liste !', en: 'And there are more lovely things on your list!' },
  'list.which': { fr: 'Et toi, parmi tout ça, qu’est-ce qui te fait le plus envie ?', en: 'And of all these, which one would you like the most?' },
  'list.which.react': { fr: 'Ho ho ho ! Je vais le dire tout de suite aux lutins de l’atelier.', en: 'Ho ho ho! I’ll tell the elves in the workshop right away.' },
  'gift.react.1': { fr: 'Excellente idée !', en: 'Excellent idea!' },
  'gift.react.2': { fr: 'Mes lutins adorent fabriquer ça !', en: 'My elves love making that!' },
  'gift.react.3': { fr: 'Je le note avec ma plume magique.', en: 'I’m writing it down with my magic quill.' },
  'gift.react.4': { fr: 'Oh, ça me plaît beaucoup !', en: 'Oh, I like that very much!' },
  // Heart wish
  'heart.ask': { fr: 'Et si tu avais un vœu magique, pas pour toi, mais pour quelqu’un que tu aimes… ce serait quoi ?', en: 'And if you had one magic wish, not for you but for someone you love… what would it be?' },
  'heart.react': { fr: 'Comme c’est gentil… Tu as un très grand cœur. Ça me rend tout joyeux !', en: 'How kind… You have a very big heart. That makes me so happy!' },
  // Proud moment
  'proud.intro': { fr: 'Oh, et mes lutins m’ont raconté quelque chose…', en: 'Oh, and my elves told me something…' },
  'proud.bravo': { fr: 'Bravo ! Je suis très fier de toi.', en: 'Well done! I’m very proud of you.' },
  // Ziggy and reindeer
  'ziggy.hello': { fr: 'Oh ! Ziggy, mon petit lutin, est juste à côté de moi. Il te fait un grand coucou avec ses antennes !', en: 'Oh! Ziggy, my little elf, is right here next to me. He’s waving hello with his antennas!' },
  'reindeer.ask': { fr: 'Avant de partir, tu veux entendre mes rennes ? Écoute bien…', en: 'Before I go, would you like to hear my reindeer? Listen…' },
  'reindeer.after': { fr: 'Ho ho ho ! Tu les as entendus ? Ils s’entraînent pour la grande nuit de Noël.', en: 'Ho ho ho! Did you hear them? They’re practising for the big Christmas night.' },
  // Closing
  'close.work': { fr: 'Bon, je dois retourner aider les lutins à l’atelier. Il y a tellement de jouets à préparer !', en: 'Well, I must go back and help the elves in the workshop. There are so many toys to get ready!' },
  'close.keep': { fr: 'Continue d’être aussi formidable. Je pense très fort à toi.', en: 'Keep being as wonderful as you are. I’m thinking of you.' },
  'close.hohoho': { fr: 'Ho ho ho ! À bientôt !', en: 'Ho ho ho! See you soon!' },
  // Free preview end
  'preview.sleigh': { fr: 'Oh ! Mon traîneau m’appelle, il faut que j’aille voir les rennes. On se reparle très vite !', en: 'Oh! My sleigh is calling me, I have to go and see the reindeer. Let’s talk again very soon!' },
  // Generic reactions after the child spoke
  'react.1': { fr: 'Ho ho ho ! Merveilleux !', en: 'Ho ho ho! Marvellous!' },
  'react.2': { fr: 'Oh, comme c’est intéressant !', en: 'Oh, how interesting!' },
  'react.3': { fr: 'Ça alors ! J’adore !', en: 'Well I never! I love it!' },
  'react.4': { fr: 'Ha ha ! Tu me fais bien rire !', en: 'Ha ha! You make me laugh!' },
  'react.5': { fr: 'Formidable ! C’est noté dans mon grand livre.', en: 'Wonderful! It’s written in my big book.' },
  'react.6': { fr: 'Oh oh ! Quelle bonne nouvelle !', en: 'Oh ho! What good news!' },
  // Call 2: news from the North Pole
  'news.open': { fr: 'J’avais tellement de nouvelles du Pôle Nord à te raconter !', en: 'I had so much news from the North Pole to tell you!' },
  'news.snow': { fr: 'Ici, il a neigé toute la nuit. Les lutins ont fait une bataille de boules de neige… et c’est moi qui ai gagné ! Ho ho ho !', en: 'Here it snowed all night. The elves had a snowball fight… and I won! Ho ho ho!' },
  'news.color.ask': { fr: 'Dis-moi, quelle est ta couleur préférée ? Je vais choisir le papier cadeau.', en: 'Tell me, what is your favourite colour? I’m choosing the wrapping paper.' },
  'news.color.react': { fr: 'Très joli choix ! Les lutins vont s’en souvenir.', en: 'Lovely choice! The elves will remember that.' },
  'news.reindeer': { fr: 'Mes rennes vont très bien. Comète a encore mangé toutes les carottes, et Tornade s’entraîne à voler la tête en bas !', en: 'My reindeer are very well. Comet ate all the carrots again, and Dasher is practising flying upside down!' },
  'news.cookie.ask': { fr: 'Et toi, tu préfères les biscuits au chocolat ou à la cannelle ?', en: 'And you, do you prefer chocolate cookies or cinnamon ones?' },
  'news.cookie.react': { fr: 'Miam ! Mère Noël en fait justement ce soir. Elle te fait un gros bisou !', en: 'Yum! Mrs Claus is baking some tonight. She sends you a big hug!' },
  'news.joke.ask': { fr: 'Tu connais une blague ? Raconte-la-moi, j’adore rire !', en: 'Do you know a joke? Tell me, I love to laugh!' },
  'news.joke.react': { fr: 'Ho ho ho ho ! Elle est très drôle ! Je la raconterai aux lutins.', en: 'Ho ho ho ho! That’s very funny! I’ll tell it to the elves.' },
  // Call 3: Christmas Eve
  'eve.open': { fr: 'Ce soir, c’est le grand soir ! Le traîneau est presque prêt.', en: 'Tonight is the big night! The sleigh is almost ready.' },
  'eve.list': { fr: 'J’ai bien rangé ta liste dans ma poche, juste ici.', en: 'I’ve put your list safely in my pocket, right here.' },
  'eve.carrot.ask': { fr: 'Est-ce que tu vas laisser quelque chose pour mes rennes ? Une carotte, peut-être ?', en: 'Will you leave something for my reindeer? A carrot, maybe?' },
  'eve.carrot.react': { fr: 'Merci ! Ils vont être ravis. Ils ont besoin de forces pour voler autour du monde.', en: 'Thank you! They’ll be delighted. They need energy to fly around the world.' },
  'eve.sleep': { fr: 'Et tu sais, je ne passe que quand les enfants dorment. Alors ce soir, au lit de bonne heure, d’accord ?', en: 'And you know, I only come when children are asleep. So tonight, early to bed, all right?' },
  'eve.sleep.react': { fr: 'Ho ho ho ! Parfait. Fais de beaux rêves.', en: 'Ho ho ho! Perfect. Sweet dreams.' },
  'eve.close': { fr: 'Il faut que je parte, la nuit commence. Chut… à tout à l’heure !', en: 'I must go, the night is starting. Shhh… see you later!' },
  // Free voice message
  'msg.open': { fr: 'Ho ho ho ! Ici le Père Noël. Je voulais te faire un petit coucou depuis le Pôle Nord.', en: 'Ho ho ho! This is Santa Claus. I wanted to say a little hello from the North Pole.' },
  'msg.letter': { fr: 'Ziggy, mon petit lutin, m’a apporté ta lettre. Merci, elle est magnifique !', en: 'Ziggy, my little elf, brought me your letter. Thank you, it’s beautiful!' },
  'msg.noLetter': { fr: 'Ziggy, mon petit lutin, me dit que tu prépares ta lettre. J’ai hâte de la lire !', en: 'Ziggy, my little elf, tells me you’re writing your letter. I can’t wait to read it!' },
  'msg.busy': { fr: 'Ici, les lutins fabriquent des jouets jour et nuit, et les rennes s’entraînent à voler.', en: 'Here, the elves are making toys day and night, and the reindeer are practising their flying.' },
  'msg.close': { fr: 'Je t’appellerai bientôt pour parler de ta liste. Gros bisous du Pôle Nord !', en: 'I’ll call you soon to talk about your list. Big hugs from the North Pole!' },
  // Live AI call (Pack magique): fixed lines around the free conversation
  'ai.intro': { fr: 'Et maintenant, si tu veux, tu peux me poser toutes tes questions ! Appuie sur le gros bouton pour me parler.', en: 'And now, if you like, you can ask me all your questions! Press the big button to talk to me.' },
  'ai.again': { fr: 'Pardon, je n’ai pas bien entendu. Tu peux répéter ?', en: 'Sorry, I didn’t quite hear. Can you say it again?' },
  'ai.busy': { fr: 'Oh, les lutins m’appellent pour une petite minute. Tu peux me reposer ta question ?', en: 'Oh, the elves need me for a minute. Can you ask me again?' },
  'ai.timeup': { fr: 'Oh là là, comme le temps passe vite avec toi ! Je dois retourner à l’atelier.', en: 'My my, time flies with you! I must go back to the workshop.' },
} satisfies Record<string, L>;

export type SantaLineId = keyof typeof SANTA_LINES;
export const isLineId = (id: string): id is SantaLineId => Object.prototype.hasOwnProperty.call(SANTA_LINES, id);

const cap = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/**
 * A clip key → the exact words. Keys:
 *  line:<id> · gift:<giftId> · proud:<proudId> · age:<2–12> · advent:<1–24> · name:<hello|bye|plain>:<first name>
 * Returns null for anything else (the voice route speaks nothing it doesn't know).
 */
export function santaText(key: string, locale: SantaLocale): string | null {
  const [kind, a, ...rest] = key.split(':');
  if (kind === 'line' && a && isLineId(a)) return SANTA_LINES[a][locale];
  if (kind === 'gift' && a) {
    const gift = giftById(a);
    return gift ? (locale === 'fr' ? `${cap(gift.say.fr)} !` : `${cap(gift.say.en)}!`) : null;
  }
  if (kind === 'proud' && a) {
    const p = proudById(a);
    return p ? (locale === 'fr' ? `Il paraît que tu ${p.say.fr}.` : `I heard that you ${p.say.en}.`) : null;
  }
  if (kind === 'age' && a) {
    const n = Number(a);
    if (!Number.isInteger(n) || n < 2 || n > 12) return null;
    return locale === 'fr' ? `Si je me souviens bien, tu as ${n} ans maintenant. Comme tu grandis vite !` : `If I remember well, you’re ${n} now. You’re growing up so fast!`;
  }
  if (kind === 'advent' && a) {
    // What the Advent door's "listen" button reads: title, text, then the riddle's answer.
    const e = SANTA_ADVENT.find((x) => String(x.day) === a);
    if (!e) return null;
    const title = e.title[locale].replace(/[.!?…]?$/, (m) => m || '.');
    return [title, e.text[locale], e.answer?.[locale]].filter(Boolean).join(' ');
  }
  if (kind === 'name' && a && rest.length) {
    const name = rest.join(':');
    if (!NAME_RE.test(name)) return null;
    if (a === 'hello') return locale === 'fr' ? `Bonjour ${name} !` : `Hello ${name}!`;
    if (a === 'bye') return locale === 'fr' ? `Joyeux Noël, ${name} !` : `Merry Christmas, ${name}!`;
    if (a === 'plain') return `${name} !`;
  }
  return null;
}

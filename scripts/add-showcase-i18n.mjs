// Adds the `showcase` namespace (the mascot film section) to every locale.
// Idempotent: re-running overwrites the same keys and touches nothing else.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const messagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'messages');

const T = {
  fr: {
    badge: 'Rencontre Ziggy',
    title: 'Voici Ziggy, le copain robot de ton enfant',
    subtitle:
      "Il rit, il encourage, il ne juge jamais. Ziggy transforme les maths, la logique et l'IA en jeu — et son cœur s'illumine à chaque bonne réponse.",
    cta: 'Essayer gratuitement',
    cta_games: 'Voir les jeux',
    play: 'Regarder Ziggy',
  },
  en: {
    badge: 'Meet Ziggy',
    title: "Meet Ziggy, your child's robot friend",
    subtitle:
      'He laughs, he cheers, he never judges. Ziggy turns maths, logic and AI into play — and his heart lights up with every right answer.',
    cta: 'Try it free',
    cta_games: 'See the games',
    play: 'Watch Ziggy',
  },
  es: {
    badge: 'Conoce a Ziggy',
    title: 'Este es Ziggy, el amigo robot de tu hijo',
    subtitle:
      'Se ríe, anima y nunca juzga. Ziggy convierte las mates, la lógica y la IA en un juego, y su corazón se ilumina con cada acierto.',
    cta: 'Probar gratis',
    cta_games: 'Ver los juegos',
    play: 'Ver a Ziggy',
  },
  de: {
    badge: 'Lerne Ziggy kennen',
    title: 'Das ist Ziggy, der Roboterfreund deines Kindes',
    subtitle:
      'Er lacht, er feuert an, er urteilt nie. Ziggy macht aus Mathe, Logik und KI ein Spiel — und sein Herz leuchtet bei jeder richtigen Antwort.',
    cta: 'Kostenlos testen',
    cta_games: 'Spiele ansehen',
    play: 'Ziggy ansehen',
  },
  pt: {
    badge: 'Conhece o Ziggy',
    title: 'Este é o Ziggy, o amigo robô do teu filho',
    subtitle:
      'Ele ri, incentiva e nunca julga. O Ziggy transforma matemática, lógica e IA em brincadeira — e o seu coração acende a cada resposta certa.',
    cta: 'Experimentar grátis',
    cta_games: 'Ver os jogos',
    play: 'Ver o Ziggy',
  },
  it: {
    badge: 'Incontra Ziggy',
    title: 'Ecco Ziggy, l’amico robot di tuo figlio',
    subtitle:
      'Ride, incoraggia e non giudica mai. Ziggy trasforma matematica, logica e IA in un gioco — e il suo cuore si illumina a ogni risposta giusta.',
    cta: 'Prova gratis',
    cta_games: 'Guarda i giochi',
    play: 'Guarda Ziggy',
  },
  nl: {
    badge: 'Maak kennis met Ziggy',
    title: 'Dit is Ziggy, het robotvriendje van je kind',
    subtitle:
      'Hij lacht, moedigt aan en oordeelt nooit. Ziggy maakt van rekenen, logica en AI een spel — en zijn hart licht op bij elk goed antwoord.',
    cta: 'Gratis proberen',
    cta_games: 'Bekijk de spellen',
    play: 'Ziggy bekijken',
  },
  tr: {
    badge: 'Ziggy ile tanış',
    title: 'Bu Ziggy, çocuğunuzun robot arkadaşı',
    subtitle:
      'Güler, cesaretlendirir, asla yargılamaz. Ziggy matematiği, mantığı ve yapay zekâyı oyuna dönüştürür — her doğru cevapta kalbi ışıldar.',
    cta: 'Ücretsiz dene',
    cta_games: 'Oyunları gör',
    play: "Ziggy'yi izle",
  },
  ja: {
    badge: 'ジギーに会おう',
    title: 'ジギーは、お子さまのロボットの友だちです',
    subtitle:
      '笑って、応援して、けっして否定しません。ジギーは算数も論理もAIも遊びに変えます。正解するたびに、胸のハートが光ります。',
    cta: '無料で試す',
    cta_games: 'ゲームを見る',
    play: 'ジギーを見る',
  },
  ko: {
    badge: '지기를 만나보세요',
    title: '아이의 로봇 친구, 지기예요',
    subtitle:
      '웃고, 응원하고, 절대 다그치지 않아요. 지기는 수학과 논리, AI를 놀이로 바꿔줍니다. 정답을 맞힐 때마다 가슴의 하트가 빛나요.',
    cta: '무료로 시작하기',
    cta_games: '게임 보기',
    play: '지기 보기',
  },
  zh: {
    badge: '认识 Ziggy',
    title: '这是 Ziggy，孩子的机器人朋友',
    subtitle:
      '它会笑、会鼓励，从不评判。Ziggy 把数学、逻辑和人工智能变成游戏——每答对一次，它胸口的爱心就会亮起来。',
    cta: '免费试用',
    cta_games: '查看游戏',
    play: '观看 Ziggy',
  },
  ar: {
    badge: 'تعرّف على زيجي',
    title: 'هذا زيجي، صديق طفلك الآلي',
    subtitle:
      'يضحك ويشجّع ولا ينتقد أبدًا. يحوّل زيجي الرياضيات والمنطق والذكاء الاصطناعي إلى لعبة، ويضيء قلبه مع كل إجابة صحيحة.',
    cta: 'جرّب مجانًا',
    cta_games: 'شاهد الألعاب',
    play: 'شاهد زيجي',
  },
};

let n = 0;
for (const file of readdirSync(messagesDir).filter((f) => f.endsWith('.json'))) {
  const locale = file.replace('.json', '');
  const path = join(messagesDir, file);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  data.showcase = T[locale] ?? T.en;
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  n++;
}
console.log(`showcase namespace written to ${n} locale files`);

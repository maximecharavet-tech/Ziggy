#!/usr/bin/env node
/**
 * Adds the `games` namespace (and `nav.games`) to every messages/*.json file.
 *
 *   node scripts/add-games-i18n.mjs
 *
 * Idempotent: re-running simply overwrites the `games` namespace with the
 * canonical content below.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = join(__dirname, '..', 'messages');

/* ─────────────────────────────────────────
   Quiz — full English source of truth.
   fr has its own; the other locales reuse EN.
   ───────────────────────────────────────── */

const QUIZ_EN = [
  {
    q: 'What is artificial intelligence (AI)?',
    options: [
      'A computer program that learns from lots of examples',
      'A tiny robot that lives inside the screen',
      'A kind of magic only grown-ups understand',
      'A new video game console',
    ],
    answer: 0,
    explanation:
      'AI is a computer program that learns by looking at heaps of examples — a bit like you learn to recognise cats after seeing lots of them!',
  },
  {
    q: 'How does an AI learn to recognise a cat?',
    options: [
      'Someone whispers the answer in its ear',
      'It looks at thousands of pictures of cats',
      'It was born already knowing',
      'It asks the cat',
    ],
    answer: 1,
    explanation:
      'An AI is shown thousands and thousands of images. Little by little it spots what cats have in common: whiskers, pointy ears, a tail!',
  },
  {
    q: 'Can an AI make mistakes?',
    options: [
      'Never, it is always right',
      'Only on Mondays',
      'Yes, quite often — that is why we check',
      'Only if you are mean to it',
    ],
    answer: 2,
    explanation:
      'Yes! An AI can sound very sure of itself and still be wrong. Always double-check important answers with a grown-up or a book.',
  },
  {
    q: 'Is an AI alive, like an animal?',
    options: [
      'Yes, it eats and sleeps',
      'No, it is a program — it has no feelings',
      'Yes, it has a heart made of wires',
      'It is alive only while the computer is on',
    ],
    answer: 1,
    explanation:
      'An AI is not alive. It feels neither joy nor sadness, even when it writes "I am happy". It is a very clever program, nothing more.',
  },
  {
    q: 'Online, somebody asks for your home address. What do you do?',
    options: [
      'Give it, to be polite',
      'Give it, but only the street name',
      'Say nothing and tell a grown-up you trust',
      'Post it so everyone can see',
    ],
    answer: 2,
    explanation:
      'Your address, your school and your phone number are private. Never share them online, and always tell a grown-up you trust.',
  },
  {
    q: 'Where do an AI’s answers come from?',
    options: [
      'From texts and images created by people',
      'From outer space',
      'From the AI’s own imagination',
      'From a secret library nobody can read',
    ],
    answer: 0,
    explanation:
      'AI learns from words and pictures made by people. That is also why it can repeat their mistakes — and why humans still matter so much.',
  },
  {
    q: 'A friend says a chatbot is their best friend. What is true?',
    options: [
      'It is a real friend who loves them',
      'It is a useful tool, but not a real friend',
      'It is better than a real friend',
      'It remembers their birthday because it cares',
    ],
    answer: 1,
    explanation:
      'A chatbot can be fun and helpful, but it does not feel friendship. Real friends are people (and pets!) who truly care about you.',
  },
  {
    q: 'What is the best way to use AI for your homework?',
    options: [
      'Copy its answer word for word',
      'Ask it to explain what you do not understand, then do the work yourself',
      'Never use it, it is forbidden',
      'Ask it to do everything while you watch TV',
    ],
    answer: 1,
    explanation:
      'AI makes a great tutor: ask it to explain! But your brain only grows when YOU do the work — and that is the best part.',
  },
];

const QUIZ_FR = [
  {
    q: "C'est quoi, l'intelligence artificielle (IA) ?",
    options: [
      "Un programme d'ordinateur qui apprend à partir de plein d'exemples",
      "Un petit robot qui habite dans l'écran",
      'Une magie que seuls les adultes comprennent',
      'Une nouvelle console de jeux vidéo',
    ],
    answer: 0,
    explanation:
      "L'IA est un programme qui apprend en regardant des tonnes d'exemples — un peu comme toi qui reconnais les chats après en avoir vu beaucoup !",
  },
  {
    q: 'Comment une IA apprend-elle à reconnaître un chat ?',
    options: [
      "Quelqu'un lui souffle la réponse à l'oreille",
      'Elle regarde des milliers de photos de chats',
      'Elle est née en le sachant',
      'Elle demande au chat',
    ],
    answer: 1,
    explanation:
      'On lui montre des milliers et des milliers d’images. Petit à petit, elle repère ce que les chats ont en commun : les moustaches, les oreilles pointues, la queue !',
  },
  {
    q: 'Est-ce qu’une IA peut se tromper ?',
    options: [
      'Jamais, elle a toujours raison',
      'Seulement le lundi',
      'Oui, assez souvent — c’est pour ça qu’on vérifie',
      'Seulement si on est méchant avec elle',
    ],
    answer: 2,
    explanation:
      'Oui ! Une IA peut avoir l’air très sûre d’elle et se tromper quand même. Vérifie toujours les réponses importantes avec un adulte ou dans un livre.',
  },
  {
    q: 'Une IA est-elle vivante, comme un animal ?',
    options: [
      'Oui, elle mange et elle dort',
      'Non, c’est un programme : elle n’a pas de sentiments',
      'Oui, elle a un cœur en fils électriques',
      'Elle est vivante seulement quand l’ordinateur est allumé',
    ],
    answer: 1,
    explanation:
      'Une IA n’est pas vivante. Elle ne ressent ni joie ni tristesse, même quand elle écrit « je suis content ». C’est un programme très malin, rien de plus.',
  },
  {
    q: 'Sur Internet, quelqu’un te demande ton adresse. Que fais-tu ?',
    options: [
      'Tu la donnes, pour être poli',
      'Tu la donnes, mais juste la rue',
      'Tu ne réponds pas et tu préviens un adulte de confiance',
      'Tu la publies pour que tout le monde la voie',
    ],
    answer: 2,
    explanation:
      'Ton adresse, ton école et ton numéro de téléphone sont privés. Ne les partage jamais en ligne et parles-en toujours à un adulte de confiance.',
  },
  {
    q: 'D’où viennent les réponses d’une IA ?',
    options: [
      'De textes et d’images créés par des humains',
      'De l’espace',
      'De l’imagination de l’IA',
      'D’une bibliothèque secrète que personne ne peut lire',
    ],
    answer: 0,
    explanation:
      'L’IA apprend à partir de textes et d’images faits par des humains. C’est pour ça qu’elle peut aussi répéter leurs erreurs — et que les humains comptent autant.',
  },
  {
    q: 'Un copain dit qu’un chatbot est son meilleur ami. Qu’en penses-tu ?',
    options: [
      'C’est un vrai ami qui l’aime',
      'C’est un outil pratique, mais pas un vrai ami',
      'C’est mieux qu’un vrai ami',
      'Il retient son anniversaire parce qu’il tient à lui',
    ],
    answer: 1,
    explanation:
      'Un chatbot peut être amusant et utile, mais il ne ressent pas d’amitié. Les vrais amis sont des personnes (et des animaux !) qui tiennent vraiment à toi.',
  },
  {
    q: 'Quelle est la meilleure façon d’utiliser l’IA pour tes devoirs ?',
    options: [
      'Recopier sa réponse mot pour mot',
      'Lui demander d’expliquer ce que tu ne comprends pas, puis faire le travail toi-même',
      'Ne jamais s’en servir, c’est interdit',
      'Lui demander de tout faire pendant que tu regardes la télé',
    ],
    answer: 1,
    explanation:
      'L’IA est un super prof particulier : demande-lui d’expliquer ! Mais c’est en faisant le travail TOI-MÊME que ton cerveau grandit. Et c’est ça le plus chouette.',
  },
];

/* ─────────────────────────────────────────
   Per-locale content
   ───────────────────────────────────────── */

const NAV_GAMES = {
  fr: 'Jeux',
  en: 'Games',
  es: 'Juegos',
  de: 'Spiele',
  pt: 'Jogos',
  it: 'Giochi',
  nl: 'Spelletjes',
  tr: 'Oyunlar',
  ja: 'ゲーム',
  ko: '게임',
  zh: '游戏',
  ar: 'الألعاب',
};

const GAMES = {
  fr: {
    badge: 'Mini-jeux',
    pageTitle: "L'arcade de Ziggy",
    pageSubtitle:
      "Quatre mini-jeux rigolos pour muscler ta mémoire, ton calcul et ta logique — et tout comprendre à l'IA !",
    sectionTitle: 'Jouer et apprendre',
    sectionSubtitle:
      "On retient beaucoup mieux quand on s'amuse. Choisis un jeu et c'est parti !",
    backToGames: 'Retour aux jeux',
    start: 'Jouer',
    playAgain: 'Rejouer',
    score: 'Score',
    time: 'Temps',
    moves: 'Coups',
    streak: 'Série',
    correct: 'Bien vu !',
    wrong: 'Presque !',
    wellDone: 'Bravo !',
    yourScore: 'Ton score',
    tryAgain: 'Bel essai !',
    next: 'Suivant',
    memory: {
      name: 'Jeu de mémoire',
      description:
        'Retourne les cartes et retrouve les six paires. En combien de coups vas-tu y arriver ?',
      howTo:
        'Touche une carte pour la retourner, puis une deuxième. Si les deux images sont identiques, elles restent ! Trouve les 6 paires.',
    },
    math: {
      name: 'Calcul éclair',
      description:
        "Résous un maximum d'opérations en 60 secondes. Plus ta série est longue, plus ça se corse !",
      howTo:
        "Choisis la bonne réponse parmi quatre. Chaque bonne réponse allonge ta série — et les calculs montent d'un cran avec toi.",
    },
    logic: {
      name: 'Suite logique',
      description:
        'Observe la file de formes, devine la règle cachée et choisis celle qui vient ensuite.',
      howTo:
        'Chaque file suit une règle : une répétition, une alternance ou quelque chose qui grandit. Choisis la forme qui remplit la case vide. 10 manches !',
    },
    quiz: {
      name: "Explorateur d'IA",
      description:
        "Huit questions pour devenir un vrai expert de l'intelligence artificielle.",
      howTo:
        "Choisis une réponse, puis lis l'explication pour apprendre quelque chose de nouveau. Il n'y a pas de mauvaise réponse, seulement des découvertes !",
      questions: QUIZ_FR,
    },
  },

  en: {
    badge: 'Mini-games',
    pageTitle: 'The Ziggy Arcade',
    pageSubtitle:
      'Four fun mini-games to train your memory, your maths and your logic — and learn all about AI!',
    sectionTitle: 'Play and learn',
    sectionSubtitle:
      'Learning sticks so much better when it feels like playing. Pick a game and go!',
    backToGames: 'Back to games',
    start: 'Play',
    playAgain: 'Play again',
    score: 'Score',
    time: 'Time',
    moves: 'Moves',
    streak: 'Streak',
    correct: 'Well spotted!',
    wrong: 'Almost!',
    wellDone: 'Well done!',
    yourScore: 'Your score',
    tryAgain: 'Good try!',
    next: 'Next',
    memory: {
      name: 'Memory Match',
      description:
        'Flip the cards and find all six matching pairs. How few moves will you need?',
      howTo:
        'Tap a card to turn it over, then tap another one. If the two pictures match, they stay! Find all 6 pairs.',
    },
    math: {
      name: 'Speed Maths',
      description:
        'Solve as many sums as you can in 60 seconds. The longer your streak, the trickier they get!',
      howTo:
        'Pick the right answer out of four. Every correct answer grows your streak — and the questions level up with you.',
    },
    logic: {
      name: 'Pattern Quest',
      description:
        'Look at the row of shapes, work out the hidden rule and pick the one that comes next.',
      howTo:
        'Each row follows a rule: a repeat, an alternation, or something that grows. Choose the shape that fills the empty slot. 10 rounds!',
    },
    quiz: {
      name: 'AI Explorer',
      description: 'Eight questions to turn you into a real artificial-intelligence expert.',
      howTo:
        'Pick an answer, then read the explanation to learn something new. There are no bad answers — only new things to discover!',
      questions: QUIZ_EN,
    },
  },

  es: {
    badge: 'Minijuegos',
    pageTitle: 'El arcade de Ziggy',
    pageSubtitle:
      '¡Cuatro minijuegos divertidos para entrenar tu memoria, tu cálculo y tu lógica, y descubrirlo todo sobre la IA!',
    sectionTitle: 'Juega y aprende',
    sectionSubtitle:
      'Se aprende mucho mejor cuando uno se divierte. ¡Elige un juego y a jugar!',
    backToGames: 'Volver a los juegos',
    start: 'Jugar',
    playAgain: 'Jugar otra vez',
    score: 'Puntos',
    time: 'Tiempo',
    moves: 'Jugadas',
    streak: 'Racha',
    correct: '¡Muy bien!',
    wrong: '¡Casi!',
    wellDone: '¡Genial!',
    yourScore: 'Tu puntuación',
    tryAgain: '¡Buen intento!',
    next: 'Siguiente',
    memory: {
      name: 'Juego de memoria',
      description:
        'Da la vuelta a las cartas y encuentra las seis parejas. ¿En cuántas jugadas lo conseguirás?',
      howTo:
        'Toca una carta para darle la vuelta y luego otra. Si las dos imágenes son iguales, ¡se quedan! Encuentra las 6 parejas.',
    },
    math: {
      name: 'Cálculo relámpago',
      description:
        'Resuelve todas las operaciones que puedas en 60 segundos. ¡Cuanto más larga sea tu racha, más difícil se pone!',
      howTo:
        'Elige la respuesta correcta entre cuatro. Cada acierto alarga tu racha y las operaciones suben de nivel contigo.',
    },
    logic: {
      name: 'Serie lógica',
      description:
        'Observa la fila de formas, descubre la regla escondida y elige la que viene después.',
      howTo:
        'Cada fila sigue una regla: una repetición, una alternancia o algo que crece. Elige la forma que llena el hueco. ¡10 rondas!',
    },
    quiz: {
      name: 'Explorador de IA',
      description:
        'Ocho preguntas para convertirte en un auténtico experto en inteligencia artificial.',
      howTo:
        'Elige una respuesta y luego lee la explicación para aprender algo nuevo. ¡No hay respuestas malas, solo descubrimientos!',
      questions: QUIZ_EN,
    },
  },

  de: {
    badge: 'Minispiele',
    pageTitle: 'Ziggys Spielhalle',
    pageSubtitle:
      'Vier lustige Minispiele für dein Gedächtnis, dein Kopfrechnen und deine Logik — und alles über KI!',
    sectionTitle: 'Spielen und lernen',
    sectionSubtitle:
      "Man lernt viel besser, wenn es Spaß macht. Wähl ein Spiel und los geht's!",
    backToGames: 'Zurück zu den Spielen',
    start: 'Spielen',
    playAgain: 'Nochmal spielen',
    score: 'Punkte',
    time: 'Zeit',
    moves: 'Züge',
    streak: 'Serie',
    correct: 'Gut erkannt!',
    wrong: 'Fast!',
    wellDone: 'Super gemacht!',
    yourScore: 'Dein Ergebnis',
    tryAgain: 'Guter Versuch!',
    next: 'Weiter',
    memory: {
      name: 'Memory-Spiel',
      description:
        'Dreh die Karten um und finde alle sechs Paare. Wie wenige Züge brauchst du?',
      howTo:
        'Tippe auf eine Karte, um sie umzudrehen, dann auf eine zweite. Sind beide Bilder gleich, bleiben sie offen! Finde alle 6 Paare.',
    },
    math: {
      name: 'Blitzrechnen',
      description:
        'Löse in 60 Sekunden so viele Aufgaben wie möglich. Je länger deine Serie, desto kniffliger wird es!',
      howTo:
        'Wähle aus vier Möglichkeiten die richtige Antwort. Jede richtige Antwort verlängert deine Serie — und die Aufgaben wachsen mit dir mit.',
    },
    logic: {
      name: 'Muster-Rätsel',
      description:
        'Schau dir die Reihe aus Formen an, finde die versteckte Regel und wähle, was als Nächstes kommt.',
      howTo:
        'Jede Reihe folgt einer Regel: eine Wiederholung, ein Wechsel oder etwas, das wächst. Wähle die Form für das leere Feld. 10 Runden!',
    },
    quiz: {
      name: 'KI-Entdecker',
      description: 'Acht Fragen, mit denen du zum echten KI-Profi wirst.',
      howTo:
        'Wähle eine Antwort und lies danach die Erklärung, um etwas Neues zu lernen. Es gibt keine falschen Antworten — nur Entdeckungen!',
      questions: QUIZ_EN,
    },
  },

  pt: {
    badge: 'Minijogos',
    pageTitle: 'O arcade do Ziggy',
    pageSubtitle:
      'Quatro minijogos divertidos para treinar a memória, o cálculo e a lógica — e descobrir tudo sobre a IA!',
    sectionTitle: 'Jogar e aprender',
    sectionSubtitle:
      'Aprende-se muito melhor quando é divertido. Escolhe um jogo e vamos lá!',
    backToGames: 'Voltar aos jogos',
    start: 'Jogar',
    playAgain: 'Jogar de novo',
    score: 'Pontos',
    time: 'Tempo',
    moves: 'Jogadas',
    streak: 'Sequência',
    correct: 'Boa!',
    wrong: 'Quase!',
    wellDone: 'Parabéns!',
    yourScore: 'A tua pontuação',
    tryAgain: 'Boa tentativa!',
    next: 'Seguinte',
    memory: {
      name: 'Jogo da memória',
      description:
        'Vira as cartas e encontra os seis pares. Em quantas jogadas vais conseguir?',
      howTo:
        'Toca numa carta para a virar e depois noutra. Se as duas imagens forem iguais, ficam viradas! Encontra os 6 pares.',
    },
    math: {
      name: 'Cálculo relâmpago',
      description:
        'Resolve o máximo de contas que conseguires em 60 segundos. Quanto maior a sequência, mais difícil fica!',
      howTo:
        'Escolhe a resposta certa entre quatro. Cada acerto aumenta a tua sequência — e as contas sobem de nível contigo.',
    },
    logic: {
      name: 'Sequência lógica',
      description:
        'Observa a fila de formas, descobre a regra escondida e escolhe a que vem a seguir.',
      howTo:
        'Cada fila segue uma regra: uma repetição, uma alternância ou algo que cresce. Escolhe a forma que preenche o espaço vazio. 10 rondas!',
    },
    quiz: {
      name: 'Explorador de IA',
      description:
        'Oito perguntas para te tornares um verdadeiro especialista em inteligência artificial.',
      howTo:
        'Escolhe uma resposta e depois lê a explicação para aprenderes algo novo. Não há respostas más — só descobertas!',
      questions: QUIZ_EN,
    },
  },

  it: {
    badge: 'Mini-giochi',
    pageTitle: 'La sala giochi di Ziggy',
    pageSubtitle:
      'Quattro mini-giochi divertenti per allenare memoria, calcolo e logica — e scoprire tutto sull’IA!',
    sectionTitle: 'Gioca e impara',
    sectionSubtitle:
      'Si impara molto meglio quando ci si diverte. Scegli un gioco e via!',
    backToGames: 'Torna ai giochi',
    start: 'Gioca',
    playAgain: 'Gioca di nuovo',
    score: 'Punti',
    time: 'Tempo',
    moves: 'Mosse',
    streak: 'Serie',
    correct: 'Ottimo!',
    wrong: 'Quasi!',
    wellDone: 'Bravissimo!',
    yourScore: 'Il tuo punteggio',
    tryAgain: 'Bel tentativo!',
    next: 'Avanti',
    memory: {
      name: 'Gioco di memoria',
      description:
        'Gira le carte e trova tutte e sei le coppie. In quante mosse ce la farai?',
      howTo:
        'Tocca una carta per girarla, poi toccane un’altra. Se le due immagini sono uguali, restano scoperte! Trova le 6 coppie.',
    },
    math: {
      name: 'Calcolo lampo',
      description:
        'Risolvi più operazioni che puoi in 60 secondi. Più lunga è la serie, più diventa difficile!',
      howTo:
        'Scegli la risposta giusta fra quattro. Ogni risposta corretta allunga la serie — e i calcoli salgono di livello con te.',
    },
    logic: {
      name: 'Sequenza logica',
      description:
        'Guarda la fila di forme, scopri la regola nascosta e scegli quella che viene dopo.',
      howTo:
        'Ogni fila segue una regola: una ripetizione, un’alternanza o qualcosa che cresce. Scegli la forma che riempie la casella vuota. 10 turni!',
    },
    quiz: {
      name: 'Esploratore di IA',
      description:
        'Otto domande per diventare un vero esperto di intelligenza artificiale.',
      howTo:
        'Scegli una risposta, poi leggi la spiegazione per imparare qualcosa di nuovo. Non ci sono risposte sbagliate — solo scoperte!',
      questions: QUIZ_EN,
    },
  },

  nl: {
    badge: 'Minispelletjes',
    pageTitle: 'De speelhal van Ziggy',
    pageSubtitle:
      'Vier leuke minispelletjes om je geheugen, je rekenen en je logica te trainen — en alles over AI te leren!',
    sectionTitle: 'Spelen en leren',
    sectionSubtitle: 'Je leert veel beter als het leuk is. Kies een spel en gaan!',
    backToGames: 'Terug naar de spelletjes',
    start: 'Spelen',
    playAgain: 'Opnieuw spelen',
    score: 'Punten',
    time: 'Tijd',
    moves: 'Beurten',
    streak: 'Reeks',
    correct: 'Goed gezien!',
    wrong: 'Bijna!',
    wellDone: 'Goed gedaan!',
    yourScore: 'Jouw score',
    tryAgain: 'Goed geprobeerd!',
    next: 'Volgende',
    memory: {
      name: 'Geheugenspel',
      description:
        'Draai de kaarten om en vind alle zes de paren. In hoe weinig beurten lukt het jou?',
      howTo:
        'Tik op een kaart om hem om te draaien en dan op nog een. Zijn de twee plaatjes hetzelfde, dan blijven ze liggen! Vind alle 6 de paren.',
    },
    math: {
      name: 'Bliksemrekenen',
      description:
        'Los zoveel mogelijk sommen op in 60 seconden. Hoe langer je reeks, hoe lastiger het wordt!',
      howTo:
        'Kies het juiste antwoord uit vier. Elk goed antwoord maakt je reeks langer — en de sommen groeien met je mee.',
    },
    logic: {
      name: 'Patroonpuzzel',
      description:
        'Bekijk de rij vormen, ontdek de verborgen regel en kies wat er daarna komt.',
      howTo:
        'Elke rij volgt een regel: een herhaling, een afwisseling of iets dat groeit. Kies de vorm die in het lege vakje past. 10 rondes!',
    },
    quiz: {
      name: 'AI-ontdekker',
      description:
        'Acht vragen om een echte expert in kunstmatige intelligentie te worden.',
      howTo:
        'Kies een antwoord en lees daarna de uitleg om iets nieuws te leren. Er zijn geen foute antwoorden — alleen ontdekkingen!',
      questions: QUIZ_EN,
    },
  },

  tr: {
    badge: 'Mini oyunlar',
    pageTitle: "Ziggy'nin oyun salonu",
    pageSubtitle:
      'Hafızanı, zihinden işlem becerini ve mantığını güçlendiren dört eğlenceli mini oyun — üstelik yapay zekayı da öğren!',
    sectionTitle: 'Oyna ve öğren',
    sectionSubtitle: 'Eğlenirken çok daha iyi öğrenilir. Bir oyun seç ve başla!',
    backToGames: 'Oyunlara dön',
    start: 'Oyna',
    playAgain: 'Tekrar oyna',
    score: 'Puan',
    time: 'Süre',
    moves: 'Hamle',
    streak: 'Seri',
    correct: 'Harika!',
    wrong: 'Az kaldı!',
    wellDone: 'Bravo!',
    yourScore: 'Puanın',
    tryAgain: 'Güzel deneme!',
    next: 'Sonraki',
    memory: {
      name: 'Hafıza oyunu',
      description: 'Kartları çevir ve altı eşi de bul. Kaç hamlede başaracaksın?',
      howTo:
        'Bir karta dokunup çevir, sonra bir kart daha çevir. İki resim aynıysa açık kalır! 6 eşin hepsini bul.',
    },
    math: {
      name: 'Şimşek matematik',
      description:
        '60 saniyede olabildiğince çok işlem çöz. Serin uzadıkça sorular da zorlaşır!',
      howTo:
        'Dört seçenek arasından doğru cevabı seç. Her doğru cevap serini uzatır — sorular da seninle birlikte zorlaşır.',
    },
    logic: {
      name: 'Mantık dizisi',
      description: 'Şekil sırasına bak, gizli kuralı bul ve sıradakini seç.',
      howTo:
        'Her sıra bir kurala uyar: bir tekrar, bir değişim ya da büyüyen bir şey. Boş kutuya gelecek şekli seç. 10 tur!',
    },
    quiz: {
      name: 'Yapay zeka kâşifi',
      description: 'Gerçek bir yapay zeka uzmanı olmak için sekiz soru.',
      howTo:
        'Bir cevap seç, sonra açıklamayı okuyup yeni bir şey öğren. Yanlış cevap yok — sadece keşifler var!',
      questions: QUIZ_EN,
    },
  },

  ja: {
    badge: 'ミニゲーム',
    pageTitle: 'Ziggyのゲームセンター',
    pageSubtitle:
      '記憶力・計算力・論理力をきたえる4つの楽しいミニゲーム。AIのこともまるごと学べます！',
    sectionTitle: '遊んで学ぼう',
    sectionSubtitle: '楽しいほうがずっとよく身につきます。ゲームを選んでスタート！',
    backToGames: 'ゲーム一覧に戻る',
    start: 'あそぶ',
    playAgain: 'もう一度あそぶ',
    score: 'スコア',
    time: 'タイム',
    moves: 'てかず',
    streak: 'れんぞく',
    correct: 'せいかい！',
    wrong: 'おしい！',
    wellDone: 'よくできました！',
    yourScore: 'あなたのスコア',
    tryAgain: 'いいちょうせん！',
    next: 'つぎへ',
    memory: {
      name: '神経衰弱',
      description: 'カードをめくって6つのペアを全部見つけよう。何手でクリアできるかな？',
      howTo:
        'カードをタップしてめくり、もう1枚めくります。2枚の絵が同じならそのまま残ります！6つのペアを見つけよう。',
    },
    math: {
      name: 'いなずま計算',
      description:
        '60秒でできるだけ多くの計算を解こう。連続で正解するほど問題は難しくなります！',
      howTo:
        '4つの中から正しい答えを選びます。正解するたびに連続記録がのび、問題もレベルアップ！',
    },
    logic: {
      name: 'パターンクエスト',
      description: 'ならんだ形をよく見て、かくれたルールを見つけ、次に来るものを選ぼう。',
      howTo:
        'それぞれの列にはルールがあります。くりかえし、こうご、だんだん増える形など。空いたマスに入る形を選ぼう。全10問！',
    },
    quiz: {
      name: 'AIたんけんたい',
      description: '8つの質問で、人工知能のほんものの物知りになろう。',
      howTo:
        '答えを選んだら、解説を読んで新しいことを学ぼう。まちがいなんてありません。あるのは発見だけ！',
      questions: QUIZ_EN,
    },
  },

  ko: {
    badge: '미니 게임',
    pageTitle: 'Ziggy 오락실',
    pageSubtitle:
      '기억력, 암산, 논리력을 길러주는 재미있는 미니 게임 네 가지. AI에 대해서도 모두 배워요!',
    sectionTitle: '놀면서 배워요',
    sectionSubtitle: '즐거우면 훨씬 잘 기억돼요. 게임을 골라 시작해 보세요!',
    backToGames: '게임 목록으로',
    start: '놀기',
    playAgain: '다시 하기',
    score: '점수',
    time: '시간',
    moves: '횟수',
    streak: '연속',
    correct: '정답이에요!',
    wrong: '아쉬워요!',
    wellDone: '참 잘했어요!',
    yourScore: '내 점수',
    tryAgain: '멋진 도전이었어요!',
    next: '다음',
    memory: {
      name: '기억력 짝맞추기',
      description: '카드를 뒤집어 여섯 쌍을 모두 찾아보세요. 몇 번 만에 성공할까요?',
      howTo:
        '카드를 눌러 뒤집고, 다른 카드도 뒤집어요. 두 그림이 같으면 그대로 남아요! 6쌍을 모두 찾아보세요.',
    },
    math: {
      name: '번개 암산',
      description:
        '60초 동안 최대한 많은 문제를 풀어요. 연속 정답이 길어질수록 문제도 어려워져요!',
      howTo:
        '네 개 중에서 정답을 고르세요. 맞힐 때마다 연속 기록이 늘어나고 문제도 함께 어려워져요.',
    },
    logic: {
      name: '패턴 찾기',
      description: '도형이 늘어선 줄을 보고 숨은 규칙을 찾아 다음에 올 것을 고르세요.',
      howTo:
        '각 줄에는 규칙이 있어요. 반복, 번갈아 나오기, 점점 커지기. 빈칸에 들어갈 도형을 고르세요. 10라운드!',
    },
    quiz: {
      name: 'AI 탐험가',
      description: '여덟 개의 질문으로 인공지능 척척박사가 되어 보세요.',
      howTo:
        '답을 고른 뒤 설명을 읽으며 새로운 것을 배워요. 틀린 답은 없어요. 발견만 있을 뿐이에요!',
      questions: QUIZ_EN,
    },
  },

  zh: {
    badge: '小游戏',
    pageTitle: 'Ziggy 游戏厅',
    pageSubtitle: '四款有趣的小游戏，锻炼记忆力、心算和逻辑，还能全面了解人工智能！',
    sectionTitle: '边玩边学',
    sectionSubtitle: '玩得开心，才记得更牢。选一个游戏开始吧！',
    backToGames: '返回游戏列表',
    start: '开始玩',
    playAgain: '再玩一次',
    score: '得分',
    time: '时间',
    moves: '步数',
    streak: '连对',
    correct: '答对啦！',
    wrong: '差一点！',
    wellDone: '太棒了！',
    yourScore: '你的得分',
    tryAgain: '很不错的尝试！',
    next: '下一题',
    memory: {
      name: '记忆翻牌',
      description: '翻开卡片，找出全部六对相同的图案。你能用多少步完成？',
      howTo: '点一张卡片翻开，再点另一张。如果两张图案相同，它们就会留在正面！找出全部 6 对。',
    },
    math: {
      name: '闪电心算',
      description: '在 60 秒内尽量多做对题目。连对越多，题目就越难！',
      howTo: '从四个选项中选出正确答案。每答对一题连对数就增加，题目也会跟着升级。',
    },
    logic: {
      name: '找规律',
      description: '看看这排图形，找出隐藏的规律，再选出接下来应该出现的那一个。',
      howTo: '每一排都有规律：重复、交替，或者不断变多。选出填进空格的图形。共 10 轮！',
    },
    quiz: {
      name: 'AI 小探索家',
      description: '八道题，让你成为真正的人工智能小专家。',
      howTo: '选好答案后读一读解释，学到新知识。没有答错这回事，只有新发现！',
      questions: QUIZ_EN,
    },
  },

  ar: {
    badge: 'ألعاب صغيرة',
    pageTitle: 'صالة ألعاب Ziggy',
    pageSubtitle:
      'أربع ألعاب صغيرة ممتعة تقوّي ذاكرتك وحسابك الذهني ومنطقك — وتعلّمك كل شيء عن الذكاء الاصطناعي!',
    sectionTitle: 'العب وتعلّم',
    sectionSubtitle: 'نتعلّم أفضل بكثير حين نستمتع. اختر لعبة وابدأ!',
    backToGames: 'العودة إلى الألعاب',
    start: 'العب',
    playAgain: 'العب من جديد',
    score: 'النقاط',
    time: 'الوقت',
    moves: 'المحاولات',
    streak: 'سلسلة',
    correct: 'أحسنت!',
    wrong: 'اقتربت!',
    wellDone: 'رائع!',
    yourScore: 'نتيجتك',
    tryAgain: 'محاولة جميلة!',
    next: 'التالي',
    memory: {
      name: 'لعبة الذاكرة',
      description: 'اقلب البطاقات وابحث عن الأزواج الستة. في كم محاولة ستنجح؟',
      howTo:
        'المس بطاقة لتقلبها، ثم المس بطاقة أخرى. إذا تطابقت الصورتان تبقيان مكشوفتين! ابحث عن الأزواج الستة كلها.',
    },
    math: {
      name: 'حساب البرق',
      description:
        'حل أكبر عدد ممكن من المسائل في 60 ثانية. كلما طالت سلسلتك صارت المسائل أصعب!',
      howTo:
        'اختر الإجابة الصحيحة من بين أربع. كل إجابة صحيحة تطيل سلسلتك، والمسائل ترتقي معك.',
    },
    logic: {
      name: 'متتالية المنطق',
      description: 'انظر إلى صف الأشكال، واكتشف القاعدة الخفية، ثم اختر الشكل التالي.',
      howTo:
        'كل صف يتبع قاعدة: تكرار، أو تناوب، أو شيء يكبر شيئًا فشيئًا. اختر الشكل الذي يملأ الخانة الفارغة. عشر جولات!',
    },
    quiz: {
      name: 'مستكشف الذكاء الاصطناعي',
      description: 'ثمانية أسئلة تجعل منك خبيرًا حقيقيًا في الذكاء الاصطناعي.',
      howTo:
        'اختر إجابة، ثم اقرأ الشرح لتتعلم شيئًا جديدًا. لا توجد إجابات سيئة — بل اكتشافات فقط!',
      questions: QUIZ_EN,
    },
  },
};

/* ─────────────────────────────────────────
   Apply
   ───────────────────────────────────────── */

const locales = Object.keys(GAMES);
let touched = 0;

for (const locale of locales) {
  const file = join(MESSAGES_DIR, `${locale}.json`);
  const json = JSON.parse(readFileSync(file, 'utf8'));

  json.nav = { ...json.nav, games: NAV_GAMES[locale] };
  json.games = GAMES[locale];

  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  touched++;
  console.log(`  ✓ ${locale}.json — games namespace + nav.games`);
}

console.log(`\nDone. ${touched} locale files updated.`);

// Strings for the 2026 redesign: the express trial, the hero speech bubble
// and trust line, and section eyebrows. Idempotent.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'messages');

const L = {
  fr: {
    hero: { bubble: 'Salut, moi c’est Ziggy ! 👋', bubble_happy: 'Hihi, ça chatouille ! 💚', trust_1: 'Sans publicité', trust_2: 'Données hébergées en Europe', trust_3: 'Jouable sans compte' },
    features: { eyebrow: 'Pourquoi Ziggy' },
    how_it_works: { eyebrow: 'En 3 étapes' },
    trial: {
      eyebrow: 'Essai express', section_title: 'Essaie Ziggy en une minute', section_subtitle: 'Trois petites questions, aucune inscription. De quoi gagner ses premières étoiles.',
      badge: 'Essai express · 1 minute', title: 'On joue tout de suite ?', subtitle: '3 questions, zéro inscription. Gagne tes premières étoiles !', start: 'C’est parti !',
      step: 'Question {n} sur 3', q1: 'Quelle couleur vient ensuite ?', q2: 'Combien de pommes en tout ?', q3: 'Comment une IA apprend-elle ?',
      q3_a: 'Avec plein d’exemples', q3_b: 'Par magie ✨', q3_c: 'En mangeant des biscuits 🍪',
      explain1: 'Rouge, bleu, rouge, bleu… le motif se répète !', explain2: '3 pommes + 2 pommes = 5 pommes.', explain3: 'Une IA regarde des milliers d’exemples pour repérer des motifs — un peu comme toi quand tu t’entraînes !',
      correct: 'Bravo !', wrong: 'Presque !', next: 'Suivant', finish: 'Voir mon score',
      result_title: '{stars, plural, one {Tu as gagné # étoile !} other {Tu as gagné # étoiles !}}',
      result_text: 'Crée ton profil pour garder tes étoiles et débloquer les 8 jeux de Ziggy.', result_text_member: 'Tes étoiles sont enregistrées dans ton compte.',
      keep: 'Garder mes étoiles', trophies: 'Voir mes trophées', more: 'Découvrir les jeux', again: 'Rejouer', chat_eyebrow: 'Et maintenant, discute',
    },
  },
  en: {
    hero: { bubble: 'Hi, I’m Ziggy! 👋', bubble_happy: 'Hehe, that tickles! 💚', trust_1: 'No ads', trust_2: 'Data hosted in Europe', trust_3: 'Play without an account' },
    features: { eyebrow: 'Why Ziggy' },
    how_it_works: { eyebrow: 'In 3 steps' },
    trial: {
      eyebrow: 'Express trial', section_title: 'Try Ziggy in one minute', section_subtitle: 'Three little questions, no sign-up. Just enough to win your first stars.',
      badge: 'Express trial · 1 minute', title: 'Shall we play right now?', subtitle: '3 questions, zero sign-up. Win your first stars!', start: 'Let’s go!',
      step: 'Question {n} of 3', q1: 'Which colour comes next?', q2: 'How many apples altogether?', q3: 'How does an AI learn?',
      q3_a: 'From lots of examples', q3_b: 'By magic ✨', q3_c: 'By eating cookies 🍪',
      explain1: 'Red, blue, red, blue… the pattern repeats!', explain2: '3 apples + 2 apples = 5 apples.', explain3: 'An AI looks at thousands of examples to spot patterns — a bit like you when you practise!',
      correct: 'Well done!', wrong: 'Almost!', next: 'Next', finish: 'See my score',
      result_title: '{stars, plural, one {You won # star!} other {You won # stars!}}',
      result_text: 'Create your profile to keep your stars and unlock all 8 Ziggy games.', result_text_member: 'Your stars are saved to your account.',
      keep: 'Keep my stars', trophies: 'See my trophies', more: 'Explore the games', again: 'Play again', chat_eyebrow: 'Now, have a chat',
    },
  },
  es: {
    hero: { bubble: '¡Hola, soy Ziggy! 👋', bubble_happy: '¡Jiji, me haces cosquillas! 💚', trust_1: 'Sin anuncios', trust_2: 'Datos alojados en Europa', trust_3: 'Se juega sin cuenta' },
    features: { eyebrow: 'Por qué Ziggy' },
    how_it_works: { eyebrow: 'En 3 pasos' },
    trial: {
      eyebrow: 'Prueba exprés', section_title: 'Prueba Ziggy en un minuto', section_subtitle: 'Tres preguntitas, sin registro. Lo justo para ganar tus primeras estrellas.',
      badge: 'Prueba exprés · 1 minuto', title: '¿Jugamos ahora mismo?', subtitle: '3 preguntas, cero registro. ¡Gana tus primeras estrellas!', start: '¡Vamos!',
      step: 'Pregunta {n} de 3', q1: '¿Qué color va después?', q2: '¿Cuántas manzanas hay en total?', q3: '¿Cómo aprende una IA?',
      q3_a: 'Con muchísimos ejemplos', q3_b: 'Por arte de magia ✨', q3_c: 'Comiendo galletas 🍪',
      explain1: 'Rojo, azul, rojo, azul… ¡el patrón se repite!', explain2: '3 manzanas + 2 manzanas = 5 manzanas.', explain3: 'Una IA mira miles de ejemplos para encontrar patrones, ¡un poco como tú cuando practicas!',
      correct: '¡Bravo!', wrong: '¡Casi!', next: 'Siguiente', finish: 'Ver mi puntuación',
      result_title: '{stars, plural, one {¡Has ganado # estrella!} other {¡Has ganado # estrellas!}}',
      result_text: 'Crea tu perfil para guardar tus estrellas y desbloquear los 8 juegos de Ziggy.', result_text_member: 'Tus estrellas se guardan en tu cuenta.',
      keep: 'Guardar mis estrellas', trophies: 'Ver mis trofeos', more: 'Descubrir los juegos', again: 'Jugar otra vez', chat_eyebrow: 'Y ahora, charla',
    },
  },
  de: {
    hero: { bubble: 'Hallo, ich bin Ziggy! 👋', bubble_happy: 'Hihi, das kitzelt! 💚', trust_1: 'Keine Werbung', trust_2: 'Daten in Europa gehostet', trust_3: 'Spielbar ohne Konto' },
    features: { eyebrow: 'Warum Ziggy' },
    how_it_works: { eyebrow: 'In 3 Schritten' },
    trial: {
      eyebrow: 'Schnelltest', section_title: 'Teste Ziggy in einer Minute', section_subtitle: 'Drei kleine Fragen, keine Anmeldung. Genug für die ersten Sterne.',
      badge: 'Schnelltest · 1 Minute', title: 'Sollen wir gleich spielen?', subtitle: '3 Fragen, keine Anmeldung. Hol dir deine ersten Sterne!', start: 'Los geht’s!',
      step: 'Frage {n} von 3', q1: 'Welche Farbe kommt als Nächstes?', q2: 'Wie viele Äpfel sind es zusammen?', q3: 'Wie lernt eine KI?',
      q3_a: 'Mit ganz vielen Beispielen', q3_b: 'Durch Zauberei ✨', q3_c: 'Indem sie Kekse isst 🍪',
      explain1: 'Rot, blau, rot, blau … das Muster wiederholt sich!', explain2: '3 Äpfel + 2 Äpfel = 5 Äpfel.', explain3: 'Eine KI schaut sich Tausende Beispiele an, um Muster zu finden – ein bisschen wie du beim Üben!',
      correct: 'Super!', wrong: 'Fast!', next: 'Weiter', finish: 'Mein Ergebnis',
      result_title: '{stars, plural, one {Du hast # Stern gewonnen!} other {Du hast # Sterne gewonnen!}}',
      result_text: 'Erstelle dein Profil, um deine Sterne zu behalten und alle 8 Ziggy-Spiele freizuschalten.', result_text_member: 'Deine Sterne sind in deinem Konto gespeichert.',
      keep: 'Sterne behalten', trophies: 'Meine Trophäen', more: 'Spiele entdecken', again: 'Nochmal spielen', chat_eyebrow: 'Und jetzt: plaudern',
    },
  },
  pt: {
    hero: { bubble: 'Olá, eu sou o Ziggy! 👋', bubble_happy: 'Hihi, fazes-me cócegas! 💚', trust_1: 'Sem publicidade', trust_2: 'Dados alojados na Europa', trust_3: 'Joga-se sem conta' },
    features: { eyebrow: 'Porquê o Ziggy' },
    how_it_works: { eyebrow: 'Em 3 passos' },
    trial: {
      eyebrow: 'Teste rápido', section_title: 'Experimenta o Ziggy num minuto', section_subtitle: 'Três perguntinhas, sem registo. O suficiente para ganhar as primeiras estrelas.',
      badge: 'Teste rápido · 1 minuto', title: 'Vamos jogar já?', subtitle: '3 perguntas, zero registo. Ganha as tuas primeiras estrelas!', start: 'Vamos lá!',
      step: 'Pergunta {n} de 3', q1: 'Que cor vem a seguir?', q2: 'Quantas maçãs há ao todo?', q3: 'Como aprende uma IA?',
      q3_a: 'Com muitos exemplos', q3_b: 'Por magia ✨', q3_c: 'A comer bolachas 🍪',
      explain1: 'Vermelho, azul, vermelho, azul… o padrão repete-se!', explain2: '3 maçãs + 2 maçãs = 5 maçãs.', explain3: 'Uma IA observa milhares de exemplos para encontrar padrões — um pouco como tu quando treinas!',
      correct: 'Boa!', wrong: 'Quase!', next: 'Seguinte', finish: 'Ver a minha pontuação',
      result_title: '{stars, plural, one {Ganhaste # estrela!} other {Ganhaste # estrelas!}}',
      result_text: 'Cria o teu perfil para guardar as estrelas e desbloquear os 8 jogos do Ziggy.', result_text_member: 'As tuas estrelas ficam guardadas na tua conta.',
      keep: 'Guardar as estrelas', trophies: 'Ver os meus troféus', more: 'Descobrir os jogos', again: 'Jogar outra vez', chat_eyebrow: 'E agora, conversa',
    },
  },
  it: {
    hero: { bubble: 'Ciao, sono Ziggy! 👋', bubble_happy: 'Hihi, mi fai il solletico! 💚', trust_1: 'Senza pubblicità', trust_2: 'Dati ospitati in Europa', trust_3: 'Si gioca senza account' },
    features: { eyebrow: 'Perché Ziggy' },
    how_it_works: { eyebrow: 'In 3 passi' },
    trial: {
      eyebrow: 'Prova lampo', section_title: 'Prova Ziggy in un minuto', section_subtitle: 'Tre domandine, nessuna registrazione. Quanto basta per le prime stelle.',
      badge: 'Prova lampo · 1 minuto', title: 'Giochiamo subito?', subtitle: '3 domande, zero registrazioni. Vinci le tue prime stelle!', start: 'Via!',
      step: 'Domanda {n} di 3', q1: 'Quale colore viene dopo?', q2: 'Quante mele in tutto?', q3: 'Come impara un’IA?',
      q3_a: 'Con tantissimi esempi', q3_b: 'Per magia ✨', q3_c: 'Mangiando biscotti 🍪',
      explain1: 'Rosso, blu, rosso, blu… lo schema si ripete!', explain2: '3 mele + 2 mele = 5 mele.', explain3: 'Un’IA guarda migliaia di esempi per scoprire degli schemi — un po’ come te quando ti alleni!',
      correct: 'Bravo!', wrong: 'Quasi!', next: 'Avanti', finish: 'Vedi il punteggio',
      result_title: '{stars, plural, one {Hai vinto # stella!} other {Hai vinto # stelle!}}',
      result_text: 'Crea il tuo profilo per tenere le stelle e sbloccare tutti gli 8 giochi di Ziggy.', result_text_member: 'Le tue stelle sono salvate nel tuo account.',
      keep: 'Tieni le mie stelle', trophies: 'Vedi i miei trofei', more: 'Scopri i giochi', again: 'Gioca ancora', chat_eyebrow: 'E ora, chiacchiera',
    },
  },
  nl: {
    hero: { bubble: 'Hoi, ik ben Ziggy! 👋', bubble_happy: 'Hihi, dat kietelt! 💚', trust_1: 'Zonder reclame', trust_2: 'Gegevens in Europa', trust_3: 'Spelen zonder account' },
    features: { eyebrow: 'Waarom Ziggy' },
    how_it_works: { eyebrow: 'In 3 stappen' },
    trial: {
      eyebrow: 'Snelle test', section_title: 'Probeer Ziggy in één minuut', section_subtitle: 'Drie kleine vragen, geen aanmelding. Genoeg voor je eerste sterren.',
      badge: 'Snelle test · 1 minuut', title: 'Zullen we meteen spelen?', subtitle: '3 vragen, nul aanmelding. Verdien je eerste sterren!', start: 'Daar gaan we!',
      step: 'Vraag {n} van 3', q1: 'Welke kleur komt hierna?', q2: 'Hoeveel appels samen?', q3: 'Hoe leert een AI?',
      q3_a: 'Met heel veel voorbeelden', q3_b: 'Door toverkracht ✨', q3_c: 'Door koekjes te eten 🍪',
      explain1: 'Rood, blauw, rood, blauw… het patroon herhaalt zich!', explain2: '3 appels + 2 appels = 5 appels.', explain3: 'Een AI bekijkt duizenden voorbeelden om patronen te vinden — een beetje zoals jij als je oefent!',
      correct: 'Goed zo!', wrong: 'Bijna!', next: 'Volgende', finish: 'Mijn score',
      result_title: '{stars, plural, one {Je hebt # ster gewonnen!} other {Je hebt # sterren gewonnen!}}',
      result_text: 'Maak je profiel om je sterren te bewaren en alle 8 Ziggy-spellen te ontgrendelen.', result_text_member: 'Je sterren staan in je account.',
      keep: 'Mijn sterren bewaren', trophies: 'Mijn trofeeën', more: 'Ontdek de spellen', again: 'Opnieuw spelen', chat_eyebrow: 'En nu: kletsen',
    },
  },
  tr: {
    hero: { bubble: 'Merhaba, ben Ziggy! 👋', bubble_happy: 'Hihi, gıdıklanıyorum! 💚', trust_1: 'Reklamsız', trust_2: 'Veriler Avrupa’da', trust_3: 'Hesapsız oynanır' },
    features: { eyebrow: 'Neden Ziggy' },
    how_it_works: { eyebrow: '3 adımda' },
    trial: {
      eyebrow: 'Hızlı deneme', section_title: 'Ziggy’yi bir dakikada dene', section_subtitle: 'Üç küçük soru, kayıt yok. İlk yıldızlarını kazanmaya yeter.',
      badge: 'Hızlı deneme · 1 dakika', title: 'Hemen oynayalım mı?', subtitle: '3 soru, sıfır kayıt. İlk yıldızlarını kazan!', start: 'Hadi başlayalım!',
      step: 'Soru {n} / 3', q1: 'Sırada hangi renk var?', q2: 'Toplam kaç elma var?', q3: 'Yapay zekâ nasıl öğrenir?',
      q3_a: 'Çok sayıda örnekle', q3_b: 'Sihirle ✨', q3_c: 'Kurabiye yiyerek 🍪',
      explain1: 'Kırmızı, mavi, kırmızı, mavi… desen tekrar ediyor!', explain2: '3 elma + 2 elma = 5 elma.', explain3: 'Yapay zekâ desenleri bulmak için binlerce örneğe bakar — tıpkı senin alıştırma yapman gibi!',
      correct: 'Harika!', wrong: 'Az kaldı!', next: 'Sonraki', finish: 'Puanımı gör',
      result_title: '{stars, plural, one {# yıldız kazandın!} other {# yıldız kazandın!}}',
      result_text: 'Yıldızlarını saklamak ve Ziggy’nin 8 oyununu açmak için profilini oluştur.', result_text_member: 'Yıldızların hesabına kaydedildi.',
      keep: 'Yıldızlarımı sakla', trophies: 'Kupalarımı gör', more: 'Oyunları keşfet', again: 'Tekrar oyna', chat_eyebrow: 'Şimdi sohbet zamanı',
    },
  },
  ja: {
    hero: { bubble: 'やあ、ぼくジギー！👋', bubble_happy: 'えへへ、くすぐったい！💚', trust_1: '広告なし', trust_2: 'データはヨーロッパで保管', trust_3: 'アカウントなしで遊べる' },
    features: { eyebrow: 'ジギーの特長' },
    how_it_works: { eyebrow: '3ステップ' },
    trial: {
      eyebrow: 'かんたん体験', section_title: '1分でジギーを体験', section_subtitle: '3つの小さな質問、登録なし。はじめての星をゲットしよう。',
      badge: 'かんたん体験・1分', title: 'さっそくあそぶ？', subtitle: '3問だけ、登録なし。はじめての星をゲットしよう！', start: 'はじめる！',
      step: '第{n}問（全3問）', q1: 'つぎにくる色はどれ？', q2: 'りんごはぜんぶでいくつ？', q3: 'AIはどうやって学ぶ？',
      q3_a: 'たくさんの例から', q3_b: 'まほうで ✨', q3_c: 'クッキーを食べて 🍪',
      explain1: 'あか、あお、あか、あお…くりかえしのきまりだね！', explain2: 'りんご3こ + 2こ = 5こ。', explain3: 'AIは何千もの例を見て、きまりを見つけるよ。きみが練習するのと少しにているね！',
      correct: 'すごい！', wrong: 'おしい！', next: 'つぎへ', finish: 'けっかを見る',
      result_title: '{stars, plural, other {星を#こゲット！}}',
      result_text: 'プロフィールをつくると、星をのこしてジギーの8つのゲームがあそべるよ。', result_text_member: '星はアカウントに保存されたよ。',
      keep: '星をのこす', trophies: 'トロフィーを見る', more: 'ゲームを見る', again: 'もういちど', chat_eyebrow: 'つぎは、おしゃべり',
    },
  },
  ko: {
    hero: { bubble: '안녕, 나는 지기야! 👋', bubble_happy: '히히, 간지러워! 💚', trust_1: '광고 없음', trust_2: '데이터는 유럽에 보관', trust_3: '계정 없이 플레이' },
    features: { eyebrow: '왜 지기일까요' },
    how_it_works: { eyebrow: '3단계로' },
    trial: {
      eyebrow: '빠른 체험', section_title: '1분 만에 지기 체험하기', section_subtitle: '짧은 질문 세 개, 가입 없이. 첫 별을 모으기에 딱 좋아요.',
      badge: '빠른 체험 · 1분', title: '지금 바로 놀아 볼까?', subtitle: '질문 3개, 가입 없이. 첫 별을 모아 봐!', start: '시작!',
      step: '질문 {n} / 3', q1: '다음에 올 색깔은?', q2: '사과는 모두 몇 개일까?', q3: 'AI는 어떻게 배울까?',
      q3_a: '아주 많은 예시로', q3_b: '마법으로 ✨', q3_c: '쿠키를 먹어서 🍪',
      explain1: '빨강, 파랑, 빨강, 파랑… 규칙이 반복돼!', explain2: '사과 3개 + 2개 = 5개.', explain3: 'AI는 수천 개의 예시를 보고 규칙을 찾아. 네가 연습할 때랑 비슷하지!',
      correct: '잘했어!', wrong: '아깝다!', next: '다음', finish: '점수 보기',
      result_title: '{stars, plural, other {별 #개를 모았어!}}',
      result_text: '프로필을 만들면 별을 간직하고 지기의 게임 8개를 모두 열 수 있어.', result_text_member: '별이 계정에 저장됐어.',
      keep: '별 간직하기', trophies: '트로피 보기', more: '게임 둘러보기', again: '다시 하기', chat_eyebrow: '이제 대화해 봐',
    },
  },
  zh: {
    hero: { bubble: '你好，我是 Ziggy！👋', bubble_happy: '嘻嘻，好痒！💚', trust_1: '无广告', trust_2: '数据存放在欧洲', trust_3: '无需账户即可玩' },
    features: { eyebrow: '为什么选 Ziggy' },
    how_it_works: { eyebrow: '只需 3 步' },
    trial: {
      eyebrow: '快速体验', section_title: '一分钟体验 Ziggy', section_subtitle: '三个小问题，无需注册，足够赢得第一颗星星。',
      badge: '快速体验 · 1 分钟', title: '现在就来玩吧？', subtitle: '3 个问题，无需注册。赢得你的第一颗星星！', start: '出发！',
      step: '第 {n} 题 / 共 3 题', q1: '下一个是什么颜色？', q2: '一共有几个苹果？', q3: '人工智能是怎么学习的？',
      q3_a: '通过大量的例子', q3_b: '靠魔法 ✨', q3_c: '靠吃饼干 🍪',
      explain1: '红、蓝、红、蓝……规律在重复！', explain2: '3 个苹果 + 2 个苹果 = 5 个苹果。', explain3: '人工智能会看成千上万个例子来发现规律——有点像你练习的时候！',
      correct: '太棒了！', wrong: '差一点！', next: '下一题', finish: '查看得分',
      result_title: '{stars, plural, other {你赢得了 # 颗星星！}}',
      result_text: '创建档案，保存你的星星，并解锁 Ziggy 的全部 8 个游戏。', result_text_member: '你的星星已保存到账户。',
      keep: '保存我的星星', trophies: '查看我的奖杯', more: '探索游戏', again: '再玩一次', chat_eyebrow: '现在，聊聊天吧',
    },
  },
  ar: {
    hero: { bubble: 'مرحبًا، أنا زيجي! 👋', bubble_happy: 'هيهي، هذا يدغدغني! 💚', trust_1: 'بلا إعلانات', trust_2: 'بيانات مستضافة في أوروبا', trust_3: 'اللعب بدون حساب' },
    features: { eyebrow: 'لماذا زيجي' },
    how_it_works: { eyebrow: 'في 3 خطوات' },
    trial: {
      eyebrow: 'تجربة سريعة', section_title: 'جرّب زيجي في دقيقة', section_subtitle: 'ثلاثة أسئلة صغيرة بلا تسجيل، تكفي لربح نجومك الأولى.',
      badge: 'تجربة سريعة · دقيقة واحدة', title: 'هل نلعب الآن؟', subtitle: '3 أسئلة بلا تسجيل. اربح نجومك الأولى!', start: 'هيا بنا!',
      step: 'السؤال {n} من 3', q1: 'ما اللون التالي؟', q2: 'كم تفاحة في المجموع؟', q3: 'كيف يتعلّم الذكاء الاصطناعي؟',
      q3_a: 'من أمثلة كثيرة جدًا', q3_b: 'بالسحر ✨', q3_c: 'بأكل البسكويت 🍪',
      explain1: 'أحمر، أزرق، أحمر، أزرق… النمط يتكرّر!', explain2: '3 تفاحات + تفاحتان = 5 تفاحات.', explain3: 'يرى الذكاء الاصطناعي آلاف الأمثلة ليكتشف الأنماط — تمامًا مثلك عندما تتدرّب!',
      correct: 'أحسنت!', wrong: 'اقتربت!', next: 'التالي', finish: 'اعرض نتيجتي',
      result_title: '{stars, plural, one {ربحت نجمة واحدة!} two {ربحت نجمتين!} few {ربحت # نجوم!} other {ربحت # نجمة!}}',
      result_text: 'أنشئ ملفك لتحتفظ بنجومك وتفتح ألعاب زيجي الثمانية.', result_text_member: 'نجومك محفوظة في حسابك.',
      keep: 'احتفظ بنجومي', trophies: 'اعرض جوائزي', more: 'اكتشف الألعاب', again: 'العب مجددًا', chat_eyebrow: 'والآن، لنتحدّث',
    },
  },
};

let n = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const locale = file.replace('.json', '');
  const path = join(dir, file);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const src = L[locale] ?? L.en;
  data.hero = { ...data.hero, ...src.hero };
  data.features = { ...data.features, ...src.features };
  data.how_it_works = { ...data.how_it_works, ...src.how_it_works };
  data.trial = src.trial;
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  n++;
}
console.log(`redesign strings written to ${n} locales`);

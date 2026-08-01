// Adds the four newer games (simon, coding, oddone, puzzle) under the existing
// `games` namespace, leaving every other key untouched. Idempotent.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'messages');

// One line per category set in OddOneGame, indexed by set id.
const REASONS = {
  fr: ['Les autres sont des animaux.','Les autres sont des fruits.','Les autres roulent ou volent.','Les autres vivent dans la mer.','Les autres se portent.','Les autres sont des ballons.','Les autres sont des instruments.','Les autres viennent du ciel.','Les autres sont des insectes.','Les autres se boivent.','Les autres servent à l’école.','Les autres brillent dans le ciel.','Les autres sont des plantes.','Les autres sont des parties du corps.','Les autres servent à cuisiner.','Les autres sont des oiseaux.'],
  en: ['The others are animals.','The others are fruit.','The others are vehicles.','The others live in the sea.','The others are clothes.','The others are balls.','The others are instruments.','The others come from the sky.','The others are insects.','The others are drinks.','The others belong at school.','The others shine in the sky.','The others are plants.','The others are body parts.','The others are for cooking.','The others are birds.'],
  es: ['Los demás son animales.','Los demás son frutas.','Los demás son vehículos.','Los demás viven en el mar.','Los demás son ropa.','Los demás son pelotas.','Los demás son instrumentos.','Los demás vienen del cielo.','Los demás son insectos.','Los demás son bebidas.','Los demás son del colegio.','Los demás brillan en el cielo.','Los demás son plantas.','Los demás son partes del cuerpo.','Los demás sirven para cocinar.','Los demás son aves.'],
  de: ['Die anderen sind Tiere.','Die anderen sind Obst.','Die anderen sind Fahrzeuge.','Die anderen leben im Meer.','Die anderen sind Kleidung.','Die anderen sind Bälle.','Die anderen sind Instrumente.','Die anderen kommen vom Himmel.','Die anderen sind Insekten.','Die anderen sind Getränke.','Die anderen gehören in die Schule.','Die anderen leuchten am Himmel.','Die anderen sind Pflanzen.','Die anderen sind Körperteile.','Die anderen sind zum Kochen.','Die anderen sind Vögel.'],
  pt: ['Os outros são animais.','Os outros são frutas.','Os outros são veículos.','Os outros vivem no mar.','Os outros são roupas.','Os outros são bolas.','Os outros são instrumentos.','Os outros vêm do céu.','Os outros são insetos.','Os outros são bebidas.','Os outros são da escola.','Os outros brilham no céu.','Os outros são plantas.','Os outros são partes do corpo.','Os outros servem para cozinhar.','Os outros são aves.'],
  it: ['Gli altri sono animali.','Gli altri sono frutti.','Gli altri sono veicoli.','Gli altri vivono nel mare.','Gli altri sono vestiti.','Gli altri sono palloni.','Gli altri sono strumenti.','Gli altri vengono dal cielo.','Gli altri sono insetti.','Gli altri sono bevande.','Gli altri servono a scuola.','Gli altri brillano nel cielo.','Gli altri sono piante.','Gli altri sono parti del corpo.','Gli altri servono per cucinare.','Gli altri sono uccelli.'],
  nl: ['De andere zijn dieren.','De andere zijn fruit.','De andere zijn voertuigen.','De andere leven in zee.','De andere zijn kleren.','De andere zijn ballen.','De andere zijn instrumenten.','De andere komen uit de lucht.','De andere zijn insecten.','De andere zijn drankjes.','De andere horen op school.','De andere schijnen aan de hemel.','De andere zijn planten.','De andere zijn lichaamsdelen.','De andere zijn om te koken.','De andere zijn vogels.'],
  tr: ['Diğerleri hayvan.','Diğerleri meyve.','Diğerleri taşıt.','Diğerleri denizde yaşar.','Diğerleri giysi.','Diğerleri top.','Diğerleri müzik aleti.','Diğerleri gökyüzünden gelir.','Diğerleri böcek.','Diğerleri içecek.','Diğerleri okul eşyası.','Diğerleri gökyüzünde parlar.','Diğerleri bitki.','Diğerleri vücut parçası.','Diğerleri mutfak eşyası.','Diğerleri kuş.'],
  ja: ['ほかは動物だよ。','ほかはくだものだよ。','ほかは乗りものだよ。','ほかは海にすんでいるよ。','ほかは着るものだよ。','ほかはボールだよ。','ほかは楽器だよ。','ほかは空から来るよ。','ほかは昆虫だよ。','ほかは飲みものだよ。','ほかは学校で使うよ。','ほかは空で光るよ。','ほかは植物だよ。','ほかは体の一部だよ。','ほかは料理に使うよ。','ほかは鳥だよ。'],
  ko: ['나머지는 동물이에요.','나머지는 과일이에요.','나머지는 탈것이에요.','나머지는 바다에 살아요.','나머지는 옷이에요.','나머지는 공이에요.','나머지는 악기예요.','나머지는 하늘에서 와요.','나머지는 곤충이에요.','나머지는 마실 것이에요.','나머지는 학교 물건이에요.','나머지는 하늘에서 빛나요.','나머지는 식물이에요.','나머지는 몸의 일부예요.','나머지는 요리 도구예요.','나머지는 새예요.'],
  zh: ['其他都是动物。','其他都是水果。','其他都是交通工具。','其他都生活在海里。','其他都是衣服。','其他都是球。','其他都是乐器。','其他都来自天空。','其他都是昆虫。','其他都是饮料。','其他都是学校用品。','其他都在天上发光。','其他都是植物。','其他都是身体部位。','其他都是厨房用具。','其他都是鸟。'],
  ar: ['الباقي حيوانات.','الباقي فواكه.','الباقي مركبات.','الباقي يعيش في البحر.','الباقي ملابس.','الباقي كرات.','الباقي آلات موسيقية.','الباقي يأتي من السماء.','الباقي حشرات.','الباقي مشروبات.','الباقي أدوات مدرسية.','الباقي يلمع في السماء.','الباقي نباتات.','الباقي أجزاء من الجسم.','الباقي أدوات طبخ.','الباقي طيور.'],
};

const T = {
  fr: {
    simon: { name: 'Ziggy dit', description: 'Regarde la suite de couleurs, puis répète-la. Elle s’allonge à chaque tour !', howTo: 'Mémorise l’ordre des couleurs et appuie dessus dans le même ordre.', round: 'Tour', watch: 'Regarde bien…', yourTurn: 'À toi !' },
    coding: { name: 'Le chemin du robot', description: 'Programme Ziggy avec des flèches pour qu’il atteigne l’étoile.', howTo: 'Ajoute des flèches, puis appuie sur Lancer. Attention aux obstacles !', level: 'Niveau', run: 'Lancer', reset: 'Effacer', cleared: 'Niveau réussi !', crashed: 'Aïe ! Ziggy a heurté quelque chose.', emptyQueue: 'Ajoute au moins une flèche.', tries: 'essais' },
    oddone: { name: 'L’intrus', description: 'Trois images vont ensemble, une seule n’a rien à faire là. Trouve-la !', howTo: 'Appuie sur l’image qui n’appartient pas au groupe.', reasons: REASONS.fr },
    puzzle: { name: 'Taquin', description: 'Fais glisser les cases pour remettre les nombres dans l’ordre.', howTo: 'Appuie sur une case à côté du trou pour la faire glisser.', moves: 'Coups', goal: 'Remets 1 à 8 dans l’ordre', solved: 'Résolu !' },
  },
  en: {
    simon: { name: 'Ziggy Says', description: 'Watch the colour sequence, then repeat it. It gets longer every round!', howTo: 'Memorise the order of the colours and tap them back in the same order.', round: 'Round', watch: 'Watch closely…', yourTurn: 'Your turn!' },
    coding: { name: 'Robot Path', description: 'Program Ziggy with arrows so he reaches the star.', howTo: 'Queue up arrows, then press Run. Mind the obstacles!', level: 'Level', run: 'Run', reset: 'Clear', cleared: 'Level cleared!', crashed: 'Oops! Ziggy bumped into something.', emptyQueue: 'Add at least one arrow.', tries: 'tries' },
    oddone: { name: 'Odd One Out', description: 'Three pictures belong together and one does not. Find it!', howTo: 'Tap the picture that does not belong with the others.', reasons: REASONS.en },
    puzzle: { name: 'Sliding Puzzle', description: 'Slide the tiles to put the numbers back in order.', howTo: 'Tap a tile next to the gap to slide it across.', moves: 'Moves', goal: 'Put 1 to 8 in order', solved: 'Solved!' },
  },
  es: {
    simon: { name: 'Ziggy dice', description: '¡Mira la secuencia de colores y repítela! Crece en cada ronda.', howTo: 'Memoriza el orden de los colores y tócalos en el mismo orden.', round: 'Ronda', watch: 'Mira bien…', yourTurn: '¡Te toca!' },
    coding: { name: 'El camino del robot', description: 'Programa a Ziggy con flechas para que llegue a la estrella.', howTo: 'Añade flechas y pulsa Ejecutar. ¡Cuidado con los obstáculos!', level: 'Nivel', run: 'Ejecutar', reset: 'Borrar', cleared: '¡Nivel superado!', crashed: '¡Ups! Ziggy ha chocado.', emptyQueue: 'Añade al menos una flecha.', tries: 'intentos' },
    oddone: { name: 'El intruso', description: 'Tres imágenes van juntas y una no. ¡Encuéntrala!', howTo: 'Toca la imagen que no encaja con las demás.', reasons: REASONS.es },
    puzzle: { name: 'Puzle deslizante', description: 'Desliza las fichas para ordenar los números.', howTo: 'Toca una ficha junto al hueco para deslizarla.', moves: 'Movimientos', goal: 'Ordena del 1 al 8', solved: '¡Resuelto!' },
  },
  de: {
    simon: { name: 'Ziggy sagt', description: 'Merk dir die Farbfolge und wiederhole sie. Sie wird jede Runde länger!', howTo: 'Präge dir die Reihenfolge ein und tippe die Farben genauso nach.', round: 'Runde', watch: 'Gut aufpassen…', yourTurn: 'Du bist dran!' },
    coding: { name: 'Roboterpfad', description: 'Programmiere Ziggy mit Pfeilen, damit er den Stern erreicht.', howTo: 'Pfeile aneinanderreihen, dann Start drücken. Achtung, Hindernisse!', level: 'Level', run: 'Start', reset: 'Löschen', cleared: 'Level geschafft!', crashed: 'Hoppla! Ziggy ist angestoßen.', emptyQueue: 'Füge mindestens einen Pfeil hinzu.', tries: 'Versuche' },
    oddone: { name: 'Was passt nicht?', description: 'Drei Bilder gehören zusammen, eines nicht. Finde es!', howTo: 'Tippe auf das Bild, das nicht zu den anderen passt.', reasons: REASONS.de },
    puzzle: { name: 'Schiebepuzzle', description: 'Schiebe die Steine, bis die Zahlen in der Reihenfolge liegen.', howTo: 'Tippe auf einen Stein neben der Lücke, um ihn zu schieben.', moves: 'Züge', goal: 'Bringe 1 bis 8 in die Reihe', solved: 'Gelöst!' },
  },
  pt: {
    simon: { name: 'O Ziggy diz', description: 'Vê a sequência de cores e repete-a. Cresce a cada ronda!', howTo: 'Memoriza a ordem das cores e toca nelas pela mesma ordem.', round: 'Ronda', watch: 'Presta atenção…', yourTurn: 'É a tua vez!' },
    coding: { name: 'Caminho do robô', description: 'Programa o Ziggy com setas para ele chegar à estrela.', howTo: 'Junta setas e carrega em Executar. Cuidado com os obstáculos!', level: 'Nível', run: 'Executar', reset: 'Limpar', cleared: 'Nível concluído!', crashed: 'Ups! O Ziggy bateu em algo.', emptyQueue: 'Adiciona pelo menos uma seta.', tries: 'tentativas' },
    oddone: { name: 'O intruso', description: 'Três imagens combinam e uma não. Encontra-a!', howTo: 'Toca na imagem que não pertence ao grupo.', reasons: REASONS.pt },
    puzzle: { name: 'Puzzle deslizante', description: 'Desliza as peças para pôr os números por ordem.', howTo: 'Toca numa peça ao lado do espaço vazio para a deslizar.', moves: 'Jogadas', goal: 'Ordena de 1 a 8', solved: 'Resolvido!' },
  },
  it: {
    simon: { name: 'Ziggy dice', description: 'Guarda la sequenza di colori e ripetila. Cresce ogni turno!', howTo: 'Memorizza l’ordine dei colori e toccali nello stesso ordine.', round: 'Turno', watch: 'Guarda bene…', yourTurn: 'Tocca a te!' },
    coding: { name: 'Il percorso del robot', description: 'Programma Ziggy con le frecce per farlo arrivare alla stella.', howTo: 'Metti in fila le frecce e premi Avvia. Attento agli ostacoli!', level: 'Livello', run: 'Avvia', reset: 'Cancella', cleared: 'Livello superato!', crashed: 'Ops! Ziggy ha sbattuto.', emptyQueue: 'Aggiungi almeno una freccia.', tries: 'tentativi' },
    oddone: { name: 'L’intruso', description: 'Tre immagini stanno insieme, una no. Trovala!', howTo: 'Tocca l’immagine che non c’entra con le altre.', reasons: REASONS.it },
    puzzle: { name: 'Gioco del quindici', description: 'Fai scorrere le tessere per rimettere i numeri in ordine.', howTo: 'Tocca una tessera vicina allo spazio vuoto per farla scorrere.', moves: 'Mosse', goal: 'Metti da 1 a 8 in ordine', solved: 'Risolto!' },
  },
  nl: {
    simon: { name: 'Ziggy zegt', description: 'Kijk naar de kleurenreeks en herhaal hem. Elke ronde wordt hij langer!', howTo: 'Onthoud de volgorde van de kleuren en tik ze in dezelfde volgorde aan.', round: 'Ronde', watch: 'Goed kijken…', yourTurn: 'Jouw beurt!' },
    coding: { name: 'Robotpad', description: 'Programmeer Ziggy met pijlen zodat hij de ster bereikt.', howTo: 'Zet pijlen op een rij en druk op Start. Pas op voor obstakels!', level: 'Niveau', run: 'Start', reset: 'Wissen', cleared: 'Niveau gehaald!', crashed: 'Oeps! Ziggy botste ergens tegenaan.', emptyQueue: 'Voeg minstens één pijl toe.', tries: 'pogingen' },
    oddone: { name: 'Wie hoort er niet bij?', description: 'Drie plaatjes horen bij elkaar, één niet. Vind hem!', howTo: 'Tik op het plaatje dat niet bij de andere hoort.', reasons: REASONS.nl },
    puzzle: { name: 'Schuifpuzzel', description: 'Schuif de tegels om de cijfers op volgorde te zetten.', howTo: 'Tik op een tegel naast het gaatje om hem te schuiven.', moves: 'Zetten', goal: 'Zet 1 tot 8 op volgorde', solved: 'Opgelost!' },
  },
  tr: {
    simon: { name: 'Ziggy diyor ki', description: 'Renk sırasını izle ve tekrarla. Her turda uzuyor!', howTo: 'Renklerin sırasını ezberle ve aynı sırayla dokun.', round: 'Tur', watch: 'Dikkatle izle…', yourTurn: 'Sıra sende!' },
    coding: { name: 'Robotun yolu', description: "Ziggy'yi oklarla programla ki yıldıza ulaşsın.", howTo: 'Okları sıraya diz ve Çalıştır’a bas. Engellere dikkat!', level: 'Seviye', run: 'Çalıştır', reset: 'Temizle', cleared: 'Seviye tamam!', crashed: 'Eyvah! Ziggy bir yere çarptı.', emptyQueue: 'En az bir ok ekle.', tries: 'deneme' },
    oddone: { name: 'Farklı olan', description: 'Üç resim birbirine ait, biri değil. Onu bul!', howTo: 'Diğerlerine ait olmayan resme dokun.', reasons: REASONS.tr },
    puzzle: { name: 'Kaydırmalı bulmaca', description: 'Kareleri kaydırarak sayıları sıraya diz.', howTo: 'Boşluğun yanındaki kareye dokunarak kaydır.', moves: 'Hamle', goal: '1’den 8’e sırala', solved: 'Çözüldü!' },
  },
  ja: {
    simon: { name: 'ジギーのまね', description: '色のじゅんばんを見て、そのとおりにおしてね。だんだん長くなるよ！', howTo: '色のじゅんばんをおぼえて、おなじじゅんばんでタップしよう。', round: 'ラウンド', watch: 'よく見てね…', yourTurn: 'きみのばん！' },
    coding: { name: 'ロボットのみち', description: 'やじるしでジギーをプログラムして、星までとどけよう。', howTo: 'やじるしをならべて「スタート」をおそう。しょうがいぶつに気をつけて！', level: 'レベル', run: 'スタート', reset: 'けす', cleared: 'クリア！', crashed: 'あっ！ジギーがぶつかっちゃった。', emptyQueue: 'やじるしを1つ以上ふやしてね。', tries: 'かい' },
    oddone: { name: 'なかまはずれ', description: '3つはなかま、1つだけちがうよ。見つけてね！', howTo: 'ほかとちがう絵をタップしよう。', reasons: REASONS.ja },
    puzzle: { name: 'スライドパズル', description: 'タイルをすべらせて、数字をじゅんばんにならべよう。', howTo: 'あいているところのとなりのタイルをタップするとすべるよ。', moves: 'てすう', goal: '1から8をじゅんばんに', solved: 'できた！' },
  },
  ko: {
    simon: { name: '지기가 말하길', description: '색깔 순서를 보고 따라 눌러요. 라운드마다 길어져요!', howTo: '색깔 순서를 외운 다음 같은 순서로 눌러요.', round: '라운드', watch: '잘 보세요…', yourTurn: '네 차례!' },
    coding: { name: '로봇의 길', description: '화살표로 지기를 프로그래밍해서 별까지 보내요.', howTo: '화살표를 차례로 놓고 실행을 눌러요. 장애물을 조심해요!', level: '레벨', run: '실행', reset: '지우기', cleared: '레벨 통과!', crashed: '앗! 지기가 부딪혔어요.', emptyQueue: '화살표를 하나 이상 넣어요.', tries: '번' },
    oddone: { name: '다른 하나', description: '셋은 같은 무리, 하나는 아니에요. 찾아보세요!', howTo: '나머지와 어울리지 않는 그림을 눌러요.', reasons: REASONS.ko },
    puzzle: { name: '슬라이드 퍼즐', description: '조각을 밀어서 숫자를 순서대로 맞춰요.', howTo: '빈칸 옆의 조각을 누르면 밀려요.', moves: '이동', goal: '1부터 8까지 순서대로', solved: '완성!' },
  },
  zh: {
    simon: { name: 'Ziggy 说', description: '看清颜色顺序，然后照着按。每一轮都会变长！', howTo: '记住颜色的顺序，再按同样的顺序点一遍。', round: '回合', watch: '看仔细…', yourTurn: '该你了！' },
    coding: { name: '机器人路线', description: '用箭头给 Ziggy 编程，让它走到星星那里。', howTo: '排好箭头，然后点“运行”。小心障碍物！', level: '关卡', run: '运行', reset: '清空', cleared: '过关！', crashed: '哎呀！Ziggy 撞到东西了。', emptyQueue: '至少加一个箭头。', tries: '次' },
    oddone: { name: '找不同', description: '三张图是一类，有一张不是。把它找出来！', howTo: '点那张和其他不一样的图。', reasons: REASONS.zh },
    puzzle: { name: '滑块拼图', description: '滑动方块，把数字按顺序排好。', howTo: '点空格旁边的方块就能把它滑过去。', moves: '步数', goal: '把 1 到 8 排好', solved: '完成！' },
  },
  ar: {
    simon: { name: 'زيجي يقول', description: 'شاهد تسلسل الألوان ثم كرّره. يطول في كل جولة!', howTo: 'احفظ ترتيب الألوان واضغط عليها بالترتيب نفسه.', round: 'جولة', watch: 'انتبه جيدًا…', yourTurn: 'دورك!' },
    coding: { name: 'مسار الروبوت', description: 'برمج زيجي بالأسهم ليصل إلى النجمة.', howTo: 'رتّب الأسهم ثم اضغط تشغيل. انتبه للعوائق!', level: 'المستوى', run: 'تشغيل', reset: 'مسح', cleared: 'اجتزت المستوى!', crashed: 'أوه! اصطدم زيجي بشيء.', emptyQueue: 'أضف سهمًا واحدًا على الأقل.', tries: 'محاولات' },
    oddone: { name: 'الدخيل', description: 'ثلاث صور تنتمي لبعضها وواحدة لا. اعثر عليها!', howTo: 'اضغط على الصورة التي لا تنتمي إلى المجموعة.', reasons: REASONS.ar },
    puzzle: { name: 'أحجية الانزلاق', description: 'حرّك المربعات لترتيب الأرقام.', howTo: 'اضغط على مربع بجوار الفراغ لتحريكه.', moves: 'الحركات', goal: 'رتّب من 1 إلى 8', solved: 'تم الحل!' },
  },
};

let n = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const locale = file.replace('.json', '');
  const path = join(dir, file);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const t = T[locale] ?? T.en;
  data.games = { ...data.games, ...t };
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  n++;
}
console.log(`4 new games added to ${n} locales`);

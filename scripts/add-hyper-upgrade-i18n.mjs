// Strings for the Hyper™ upgrade: shared chat, Ziggy's voice, rewards, footer, /hyper page — all 12 locales.
import { readFileSync, writeFileSync } from 'node:fs';

const T = {
  fr: {
    chat: { nap: '{name} fait une petite sieste… Réessaie dans un instant ! ⭐', thinking: '{name} réfléchit', safety: 'Message protégé', send: 'Envoyer', ask: 'Écris à {name}…' },
    voice: { listen: 'Écouter', stop: 'Arrêter', auto_on: 'Voix : oui', auto_off: 'Voix : non', mic_start: 'Parler à Ziggy', mic_stop: 'J’ai fini' },
    rewards: {
      level_up: 'Niveau {level} atteint', level_short: 'Niveau {level}', new_badge: 'Nouveau badge', level_desc: 'Tu progresses à toute vitesse. Ziggy est super fier de toi !',
      next: 'Suivant', ok: 'Super !', max_level: 'Niveau maximum : tu es une légende !', to_next: 'Encore {xp} XP pour le niveau suivant', badges_title: 'Mes badges',
      levels: { curious: 'Petit curieux', explorer: 'Explorateur', inventor: 'Inventeur', coder: 'Codeur', genius: 'Petit génie', legend: 'Légende Hyper' },
      badges: {
        first_game: { name: 'Décollage', desc: 'Jouer une première partie' },
        three_stars: { name: 'Trois étoiles', desc: 'Réussir un jeu avec 3 étoiles' },
        explorer: { name: 'Explorateur', desc: 'Essayer 4 jeux différents' },
        star_collector: { name: 'Collectionneur', desc: 'Réunir 15 étoiles' },
        brave: { name: 'Persévérant', desc: 'Rejouer 5 fois au même jeu' },
        marathon: { name: 'Marathon', desc: 'Jouer 25 parties' },
        all_games: { name: 'Grand voyageur', desc: 'Jouer à tous les jeux' },
        perfectionist: { name: 'Perfection', desc: '3 étoiles partout (au moins 4 jeux)' },
      },
    },
    footer: { made_with: 'Fait avec', for_kids: 'pour les enfants' },
    hyper: {
      eyebrow: 'Propulsé par', title: 'Hyper™ AI Engine', subtitle: 'Le moteur qui donne à Ziggy sa voix, son cerveau et ses garde-fous. Voici, concrètement, ce qu’il apporte à votre enfant.',
      pillars: {
        voice: { title: 'Ziggy parle et écoute', desc: 'Ses réponses sont lues à voix haute avec une voix chaleureuse, et l’enfant peut lui parler au micro : idéal pour les plus jeunes qui lisent encore peu.' },
        safety: { title: 'Un filtre pensé pour les enfants', desc: 'Adresses, téléphones, e-mails et mots de passe sont bloqués avant d’atteindre l’IA, les liens retirés des réponses, et les sujets sensibles renvoient vers un adulte de confiance.' },
        brain: { title: 'Un cerveau qui ne s’endort pas', desc: 'Plusieurs moteurs d’IA prennent le relais l’un de l’autre : si l’un est indisponible, Ziggy répond quand même.' },
        motion: { title: 'Des animations soignées', desc: 'Des mouvements courts et précis, qui suivent le réglage « réduire les animations » de l’appareil et se mettent en pause hors de l’écran.' },
        privacy: { title: 'Données en Europe, zéro pub', desc: 'Les comptes sont hébergés en Europe, rien n’est revendu, aucune publicité et aucun traçage.' },
      },
      ziggy_title: 'Tout ça, au service d’un seul copain', ziggy_text: 'Le moteur reste en coulisses. Sur scène, il n’y a que Ziggy et votre enfant.', cta: 'Parler à Ziggy',
    },
  },
  en: {
    chat: { nap: '{name} is having a little nap… Try again in a moment! ⭐', thinking: '{name} is thinking', safety: 'Protected message', send: 'Send', ask: 'Write to {name}…' },
    voice: { listen: 'Listen', stop: 'Stop', auto_on: 'Voice: on', auto_off: 'Voice: off', mic_start: 'Talk to Ziggy', mic_stop: 'I’m done' },
    rewards: {
      level_up: 'Level {level} reached', level_short: 'Level {level}', new_badge: 'New badge', level_desc: 'You’re learning so fast. Ziggy is super proud of you!',
      next: 'Next', ok: 'Awesome!', max_level: 'Top level: you’re a legend!', to_next: '{xp} more XP to the next level', badges_title: 'My badges',
      levels: { curious: 'Little curious', explorer: 'Explorer', inventor: 'Inventor', coder: 'Coder', genius: 'Little genius', legend: 'Hyper legend' },
      badges: {
        first_game: { name: 'Lift-off', desc: 'Play your first game' },
        three_stars: { name: 'Three stars', desc: 'Win a game with 3 stars' },
        explorer: { name: 'Explorer', desc: 'Try 4 different games' },
        star_collector: { name: 'Collector', desc: 'Gather 15 stars' },
        brave: { name: 'Never give up', desc: 'Play the same game 5 times' },
        marathon: { name: 'Marathon', desc: 'Play 25 games' },
        all_games: { name: 'Globetrotter', desc: 'Play every game' },
        perfectionist: { name: 'Perfection', desc: '3 stars everywhere (at least 4 games)' },
      },
    },
    footer: { made_with: 'Made with', for_kids: 'for kids' },
    hyper: {
      eyebrow: 'Powered by', title: 'Hyper™ AI Engine', subtitle: 'The engine that gives Ziggy his voice, his brain and his safeguards. Here is, concretely, what it brings to your child.',
      pillars: {
        voice: { title: 'Ziggy talks and listens', desc: 'His answers are read aloud in a warm voice, and children can talk to him through the microphone — ideal for the youngest, who don’t read much yet.' },
        safety: { title: 'A filter built for children', desc: 'Addresses, phone numbers, emails and passwords are blocked before they reach the AI, links are removed from replies, and sensitive topics point to a trusted adult.' },
        brain: { title: 'A brain that never naps', desc: 'Several AI engines back each other up: if one is unavailable, Ziggy still answers.' },
        motion: { title: 'Crafted motion', desc: 'Short, precise animations that follow the device’s “reduce motion” setting and pause when off screen.' },
        privacy: { title: 'Data in Europe, zero ads', desc: 'Accounts are hosted in Europe, nothing is sold, no advertising and no tracking.' },
      },
      ziggy_title: 'All of it, for one single friend', ziggy_text: 'The engine stays backstage. On stage, there is only Ziggy and your child.', cta: 'Talk to Ziggy',
    },
  },
  es: {
    chat: { nap: '{name} está echando una siestecita… ¡Inténtalo enseguida! ⭐', thinking: '{name} está pensando', safety: 'Mensaje protegido', send: 'Enviar', ask: 'Escribe a {name}…' },
    voice: { listen: 'Escuchar', stop: 'Parar', auto_on: 'Voz: sí', auto_off: 'Voz: no', mic_start: 'Hablar con Ziggy', mic_stop: 'Ya terminé' },
    rewards: {
      level_up: 'Nivel {level} alcanzado', level_short: 'Nivel {level}', new_badge: 'Nueva insignia', level_desc: 'Aprendes a toda velocidad. ¡Ziggy está muy orgulloso de ti!',
      next: 'Siguiente', ok: '¡Genial!', max_level: 'Nivel máximo: ¡eres una leyenda!', to_next: 'Faltan {xp} XP para el siguiente nivel', badges_title: 'Mis insignias',
      levels: { curious: 'Pequeño curioso', explorer: 'Explorador', inventor: 'Inventor', coder: 'Programador', genius: 'Pequeño genio', legend: 'Leyenda Hyper' },
      badges: {
        first_game: { name: 'Despegue', desc: 'Jugar tu primera partida' },
        three_stars: { name: 'Tres estrellas', desc: 'Ganar un juego con 3 estrellas' },
        explorer: { name: 'Explorador', desc: 'Probar 4 juegos distintos' },
        star_collector: { name: 'Coleccionista', desc: 'Reunir 15 estrellas' },
        brave: { name: 'Constante', desc: 'Jugar 5 veces al mismo juego' },
        marathon: { name: 'Maratón', desc: 'Jugar 25 partidas' },
        all_games: { name: 'Gran viajero', desc: 'Jugar a todos los juegos' },
        perfectionist: { name: 'Perfección', desc: '3 estrellas en todo (al menos 4 juegos)' },
      },
    },
    footer: { made_with: 'Hecho con', for_kids: 'para los niños' },
    hyper: {
      eyebrow: 'Impulsado por', title: 'Hyper™ AI Engine', subtitle: 'El motor que da a Ziggy su voz, su cerebro y sus protecciones. Esto es, en concreto, lo que aporta a tu hijo.',
      pillars: {
        voice: { title: 'Ziggy habla y escucha', desc: 'Sus respuestas se leen en voz alta con una voz cálida, y el niño puede hablarle por el micrófono: ideal para los más pequeños, que aún leen poco.' },
        safety: { title: 'Un filtro pensado para niños', desc: 'Direcciones, teléfonos, correos y contraseñas se bloquean antes de llegar a la IA, los enlaces se quitan de las respuestas y los temas delicados remiten a un adulto de confianza.' },
        brain: { title: 'Un cerebro que no se duerme', desc: 'Varios motores de IA se relevan: si uno no está disponible, Ziggy responde igualmente.' },
        motion: { title: 'Animaciones cuidadas', desc: 'Movimientos breves y precisos que respetan el ajuste «reducir movimiento» del dispositivo y se pausan fuera de pantalla.' },
        privacy: { title: 'Datos en Europa, cero anuncios', desc: 'Las cuentas se alojan en Europa, no se vende nada, sin publicidad ni rastreo.' },
      },
      ziggy_title: 'Todo esto, para un solo amigo', ziggy_text: 'El motor se queda entre bastidores. En el escenario solo están Ziggy y tu hijo.', cta: 'Hablar con Ziggy',
    },
  },
  de: {
    chat: { nap: '{name} macht ein kleines Nickerchen… Versuch es gleich noch mal! ⭐', thinking: '{name} denkt nach', safety: 'Geschützte Nachricht', send: 'Senden', ask: 'Schreib {name}…' },
    voice: { listen: 'Anhören', stop: 'Stopp', auto_on: 'Stimme: an', auto_off: 'Stimme: aus', mic_start: 'Mit Ziggy sprechen', mic_stop: 'Fertig' },
    rewards: {
      level_up: 'Level {level} erreicht', level_short: 'Level {level}', new_badge: 'Neues Abzeichen', level_desc: 'Du lernst superschnell. Ziggy ist mächtig stolz auf dich!',
      next: 'Weiter', ok: 'Super!', max_level: 'Höchstes Level: Du bist eine Legende!', to_next: 'Noch {xp} XP bis zum nächsten Level', badges_title: 'Meine Abzeichen',
      levels: { curious: 'Kleiner Neugieriger', explorer: 'Entdecker', inventor: 'Erfinder', coder: 'Programmierer', genius: 'Kleines Genie', legend: 'Hyper-Legende' },
      badges: {
        first_game: { name: 'Abheben', desc: 'Dein erstes Spiel spielen' },
        three_stars: { name: 'Drei Sterne', desc: 'Ein Spiel mit 3 Sternen schaffen' },
        explorer: { name: 'Entdecker', desc: '4 verschiedene Spiele ausprobieren' },
        star_collector: { name: 'Sammler', desc: '15 Sterne sammeln' },
        brave: { name: 'Dranbleiber', desc: 'Dasselbe Spiel 5-mal spielen' },
        marathon: { name: 'Marathon', desc: '25 Spiele spielen' },
        all_games: { name: 'Weltenbummler', desc: 'Alle Spiele spielen' },
        perfectionist: { name: 'Perfekt', desc: 'Überall 3 Sterne (mindestens 4 Spiele)' },
      },
    },
    footer: { made_with: 'Gemacht mit', for_kids: 'für Kinder' },
    hyper: {
      eyebrow: 'Angetrieben von', title: 'Hyper™ AI Engine', subtitle: 'Der Motor, der Ziggy Stimme, Verstand und Schutzschilde gibt. Das bringt er Ihrem Kind ganz konkret.',
      pillars: {
        voice: { title: 'Ziggy spricht und hört zu', desc: 'Seine Antworten werden mit warmer Stimme vorgelesen, und Kinder können per Mikrofon mit ihm reden – ideal für die Kleinsten, die noch wenig lesen.' },
        safety: { title: 'Ein Filter für Kinder', desc: 'Adressen, Telefonnummern, E-Mails und Passwörter werden blockiert, bevor sie die KI erreichen, Links werden aus Antworten entfernt, und heikle Themen verweisen an einen vertrauten Erwachsenen.' },
        brain: { title: 'Ein Gehirn, das nie schläft', desc: 'Mehrere KI-Motoren springen füreinander ein: Ist einer nicht erreichbar, antwortet Ziggy trotzdem.' },
        motion: { title: 'Durchdachte Animationen', desc: 'Kurze, präzise Bewegungen, die die Einstellung „Bewegung reduzieren“ beachten und außerhalb des Bildschirms pausieren.' },
        privacy: { title: 'Daten in Europa, null Werbung', desc: 'Konten liegen in Europa, nichts wird verkauft, keine Werbung, kein Tracking.' },
      },
      ziggy_title: 'All das für einen einzigen Freund', ziggy_text: 'Der Motor bleibt hinter den Kulissen. Auf der Bühne stehen nur Ziggy und Ihr Kind.', cta: 'Mit Ziggy sprechen',
    },
  },
  pt: {
    chat: { nap: '{name} está a fazer uma sesta… Tenta outra vez daqui a pouco! ⭐', thinking: '{name} está a pensar', safety: 'Mensagem protegida', send: 'Enviar', ask: 'Escreve ao {name}…' },
    voice: { listen: 'Ouvir', stop: 'Parar', auto_on: 'Voz: sim', auto_off: 'Voz: não', mic_start: 'Falar com o Ziggy', mic_stop: 'Já acabei' },
    rewards: {
      level_up: 'Nível {level} alcançado', level_short: 'Nível {level}', new_badge: 'Novo crachá', level_desc: 'Estás a aprender a toda a velocidade. O Ziggy está muito orgulhoso de ti!',
      next: 'Seguinte', ok: 'Fixe!', max_level: 'Nível máximo: és uma lenda!', to_next: 'Faltam {xp} XP para o próximo nível', badges_title: 'Os meus crachás',
      levels: { curious: 'Pequeno curioso', explorer: 'Explorador', inventor: 'Inventor', coder: 'Programador', genius: 'Pequeno génio', legend: 'Lenda Hyper' },
      badges: {
        first_game: { name: 'Descolagem', desc: 'Jogar o primeiro jogo' },
        three_stars: { name: 'Três estrelas', desc: 'Ganhar um jogo com 3 estrelas' },
        explorer: { name: 'Explorador', desc: 'Experimentar 4 jogos diferentes' },
        star_collector: { name: 'Colecionador', desc: 'Juntar 15 estrelas' },
        brave: { name: 'Persistente', desc: 'Jogar 5 vezes o mesmo jogo' },
        marathon: { name: 'Maratona', desc: 'Jogar 25 partidas' },
        all_games: { name: 'Grande viajante', desc: 'Jogar todos os jogos' },
        perfectionist: { name: 'Perfeição', desc: '3 estrelas em tudo (pelo menos 4 jogos)' },
      },
    },
    footer: { made_with: 'Feito com', for_kids: 'para as crianças' },
    hyper: {
      eyebrow: 'Movido por', title: 'Hyper™ AI Engine', subtitle: 'O motor que dá ao Ziggy a voz, o cérebro e as proteções. Eis, em concreto, o que traz ao seu filho.',
      pillars: {
        voice: { title: 'O Ziggy fala e ouve', desc: 'As respostas são lidas em voz alta com uma voz calorosa, e a criança pode falar-lhe pelo microfone: ideal para os mais novos, que ainda leem pouco.' },
        safety: { title: 'Um filtro pensado para crianças', desc: 'Moradas, telefones, e-mails e palavras-passe são bloqueados antes de chegarem à IA, os links são retirados das respostas e os temas sensíveis remetem para um adulto de confiança.' },
        brain: { title: 'Um cérebro que não adormece', desc: 'Vários motores de IA revezam-se: se um estiver indisponível, o Ziggy responde na mesma.' },
        motion: { title: 'Animações cuidadas', desc: 'Movimentos curtos e precisos, que respeitam a opção «reduzir movimento» do aparelho e pausam fora do ecrã.' },
        privacy: { title: 'Dados na Europa, zero anúncios', desc: 'As contas estão alojadas na Europa, nada é vendido, sem publicidade nem rastreamento.' },
      },
      ziggy_title: 'Tudo isto, para um só amigo', ziggy_text: 'O motor fica nos bastidores. No palco, só estão o Ziggy e o seu filho.', cta: 'Falar com o Ziggy',
    },
  },
  it: {
    chat: { nap: '{name} sta facendo un pisolino… Riprova tra un attimo! ⭐', thinking: '{name} sta pensando', safety: 'Messaggio protetto', send: 'Invia', ask: 'Scrivi a {name}…' },
    voice: { listen: 'Ascolta', stop: 'Ferma', auto_on: 'Voce: sì', auto_off: 'Voce: no', mic_start: 'Parla con Ziggy', mic_stop: 'Ho finito' },
    rewards: {
      level_up: 'Livello {level} raggiunto', level_short: 'Livello {level}', new_badge: 'Nuovo distintivo', level_desc: 'Impari a tutta velocità. Ziggy è fierissimo di te!',
      next: 'Avanti', ok: 'Forte!', max_level: 'Livello massimo: sei una leggenda!', to_next: 'Ancora {xp} XP per il prossimo livello', badges_title: 'I miei distintivi',
      levels: { curious: 'Piccolo curioso', explorer: 'Esploratore', inventor: 'Inventore', coder: 'Programmatore', genius: 'Piccolo genio', legend: 'Leggenda Hyper' },
      badges: {
        first_game: { name: 'Decollo', desc: 'Giocare la prima partita' },
        three_stars: { name: 'Tre stelle', desc: 'Vincere un gioco con 3 stelle' },
        explorer: { name: 'Esploratore', desc: 'Provare 4 giochi diversi' },
        star_collector: { name: 'Collezionista', desc: 'Raccogliere 15 stelle' },
        brave: { name: 'Tenace', desc: 'Giocare 5 volte allo stesso gioco' },
        marathon: { name: 'Maratona', desc: 'Giocare 25 partite' },
        all_games: { name: 'Gran viaggiatore', desc: 'Giocare a tutti i giochi' },
        perfectionist: { name: 'Perfezione', desc: '3 stelle ovunque (almeno 4 giochi)' },
      },
    },
    footer: { made_with: 'Fatto con', for_kids: 'per i bambini' },
    hyper: {
      eyebrow: 'Alimentato da', title: 'Hyper™ AI Engine', subtitle: 'Il motore che dà a Ziggy la voce, il cervello e le protezioni. Ecco, concretamente, cosa porta a tuo figlio.',
      pillars: {
        voice: { title: 'Ziggy parla e ascolta', desc: 'Le risposte vengono lette ad alta voce con una voce calda, e il bambino può parlargli al microfono: ideale per i più piccoli che leggono ancora poco.' },
        safety: { title: 'Un filtro pensato per i bambini', desc: 'Indirizzi, telefoni, e-mail e password vengono bloccati prima di arrivare all’IA, i link vengono tolti dalle risposte e i temi delicati rimandano a un adulto di fiducia.' },
        brain: { title: 'Un cervello che non dorme mai', desc: 'Più motori di IA si danno il cambio: se uno non è disponibile, Ziggy risponde lo stesso.' },
        motion: { title: 'Animazioni curate', desc: 'Movimenti brevi e precisi che rispettano l’opzione «riduci movimento» del dispositivo e si fermano fuori schermo.' },
        privacy: { title: 'Dati in Europa, zero pubblicità', desc: 'Gli account sono ospitati in Europa, niente viene venduto, nessuna pubblicità e nessun tracciamento.' },
      },
      ziggy_title: 'Tutto questo, per un solo amico', ziggy_text: 'Il motore resta dietro le quinte. Sul palco ci sono solo Ziggy e tuo figlio.', cta: 'Parla con Ziggy',
    },
  },
  nl: {
    chat: { nap: '{name} doet een dutje… Probeer het zo nog eens! ⭐', thinking: '{name} denkt na', safety: 'Beschermd bericht', send: 'Versturen', ask: 'Schrijf naar {name}…' },
    voice: { listen: 'Luisteren', stop: 'Stoppen', auto_on: 'Stem: aan', auto_off: 'Stem: uit', mic_start: 'Praat met Ziggy', mic_stop: 'Klaar' },
    rewards: {
      level_up: 'Level {level} bereikt', level_short: 'Level {level}', new_badge: 'Nieuwe badge', level_desc: 'Je leert razendsnel. Ziggy is supertrots op je!',
      next: 'Volgende', ok: 'Super!', max_level: 'Hoogste level: je bent een legende!', to_next: 'Nog {xp} XP tot het volgende level', badges_title: 'Mijn badges',
      levels: { curious: 'Kleine nieuwsgierige', explorer: 'Ontdekker', inventor: 'Uitvinder', coder: 'Programmeur', genius: 'Klein genie', legend: 'Hyper-legende' },
      badges: {
        first_game: { name: 'Lancering', desc: 'Je eerste spel spelen' },
        three_stars: { name: 'Drie sterren', desc: 'Een spel winnen met 3 sterren' },
        explorer: { name: 'Ontdekker', desc: '4 verschillende spellen proberen' },
        star_collector: { name: 'Verzamelaar', desc: '15 sterren verzamelen' },
        brave: { name: 'Doorzetter', desc: 'Hetzelfde spel 5 keer spelen' },
        marathon: { name: 'Marathon', desc: '25 spellen spelen' },
        all_games: { name: 'Wereldreiziger', desc: 'Alle spellen spelen' },
        perfectionist: { name: 'Perfectie', desc: 'Overal 3 sterren (minstens 4 spellen)' },
      },
    },
    footer: { made_with: 'Gemaakt met', for_kids: 'voor kinderen' },
    hyper: {
      eyebrow: 'Aangedreven door', title: 'Hyper™ AI Engine', subtitle: 'De motor die Ziggy zijn stem, zijn brein en zijn beschermingen geeft. Dit brengt hij concreet voor uw kind.',
      pillars: {
        voice: { title: 'Ziggy praat en luistert', desc: 'Zijn antwoorden worden met een warme stem voorgelezen, en kinderen kunnen via de microfoon met hem praten: ideaal voor de jongsten die nog weinig lezen.' },
        safety: { title: 'Een filter voor kinderen', desc: 'Adressen, telefoonnummers, e-mails en wachtwoorden worden geblokkeerd voordat ze de AI bereiken, links worden uit antwoorden gehaald en gevoelige onderwerpen verwijzen naar een vertrouwde volwassene.' },
        brain: { title: 'Een brein dat nooit slaapt', desc: 'Meerdere AI-motoren nemen het van elkaar over: valt er één uit, dan antwoordt Ziggy toch.' },
        motion: { title: 'Verzorgde animaties', desc: 'Korte, precieze bewegingen die de instelling „beweging verminderen” volgen en pauzeren buiten beeld.' },
        privacy: { title: 'Data in Europa, nul reclame', desc: 'Accounts staan in Europa, niets wordt verkocht, geen reclame en geen tracking.' },
      },
      ziggy_title: 'Dit alles, voor één vriendje', ziggy_text: 'De motor blijft achter de schermen. Op het podium staan alleen Ziggy en uw kind.', cta: 'Praat met Ziggy',
    },
  },
  tr: {
    chat: { nap: '{name} biraz kestiriyor… Birazdan tekrar dene! ⭐', thinking: '{name} düşünüyor', safety: 'Korunan mesaj', send: 'Gönder', ask: '{name} için yaz…' },
    voice: { listen: 'Dinle', stop: 'Durdur', auto_on: 'Ses: açık', auto_off: 'Ses: kapalı', mic_start: 'Ziggy ile konuş', mic_stop: 'Bitirdim' },
    rewards: {
      level_up: 'Seviye {level} oldu', level_short: 'Seviye {level}', new_badge: 'Yeni rozet', level_desc: 'Çok hızlı öğreniyorsun. Ziggy seninle gurur duyuyor!',
      next: 'Sonraki', ok: 'Harika!', max_level: 'En üst seviye: sen bir efsanesin!', to_next: 'Sonraki seviyeye {xp} XP kaldı', badges_title: 'Rozetlerim',
      levels: { curious: 'Minik meraklı', explorer: 'Kâşif', inventor: 'Mucit', coder: 'Kodlayıcı', genius: 'Minik dâhi', legend: 'Hyper efsanesi' },
      badges: {
        first_game: { name: 'Kalkış', desc: 'İlk oyununu oyna' },
        three_stars: { name: 'Üç yıldız', desc: 'Bir oyunu 3 yıldızla kazan' },
        explorer: { name: 'Kâşif', desc: '4 farklı oyun dene' },
        star_collector: { name: 'Koleksiyoncu', desc: '15 yıldız topla' },
        brave: { name: 'Pes etmeyen', desc: 'Aynı oyunu 5 kez oyna' },
        marathon: { name: 'Maraton', desc: '25 oyun oyna' },
        all_games: { name: 'Gezgin', desc: 'Bütün oyunları oyna' },
        perfectionist: { name: 'Mükemmel', desc: 'Her yerde 3 yıldız (en az 4 oyun)' },
      },
    },
    footer: { made_with: 'Çocuklar için', for_kids: 'ile yapıldı' },
    hyper: {
      eyebrow: 'Güç kaynağı', title: 'Hyper™ AI Engine', subtitle: 'Ziggy’ye sesini, beynini ve korumalarını veren motor. Çocuğunuza somut olarak getirdikleri şunlar.',
      pillars: {
        voice: { title: 'Ziggy konuşur ve dinler', desc: 'Cevapları sıcak bir sesle sesli okunur, çocuk da mikrofonla onunla konuşabilir: henüz az okuyan küçükler için ideal.' },
        safety: { title: 'Çocuklar için bir filtre', desc: 'Adres, telefon, e-posta ve şifreler yapay zekâya ulaşmadan engellenir, cevaplardan bağlantılar çıkarılır ve hassas konular güvenilir bir yetişkine yönlendirilir.' },
        brain: { title: 'Hiç uyumayan bir beyin', desc: 'Birkaç yapay zekâ motoru birbirinin yerine geçer: biri çalışmazsa Ziggy yine cevap verir.' },
        motion: { title: 'Özenli animasyonlar', desc: 'Cihazın “hareketi azalt” ayarına uyan, ekran dışındayken duran kısa ve net hareketler.' },
        privacy: { title: 'Veriler Avrupa’da, sıfır reklam', desc: 'Hesaplar Avrupa’da barındırılır, hiçbir şey satılmaz, reklam ve takip yoktur.' },
      },
      ziggy_title: 'Hepsi tek bir arkadaş için', ziggy_text: 'Motor perde arkasında kalır. Sahnede yalnızca Ziggy ve çocuğunuz var.', cta: 'Ziggy ile konuş',
    },
  },
  ja: {
    chat: { nap: '{name}はちょっとお昼寝中…すぐにもう一度ためしてね！⭐', thinking: '{name}がかんがえ中', safety: '保護されたメッセージ', send: '送る', ask: '{name}にメッセージ…' },
    voice: { listen: 'きく', stop: 'とめる', auto_on: '声：オン', auto_off: '声：オフ', mic_start: 'ジギーと話す', mic_stop: 'おわり' },
    rewards: {
      level_up: 'レベル{level}になったよ', level_short: 'レベル{level}', new_badge: 'あたらしいバッジ', level_desc: 'すごいスピードで成長してるね。ジギーはとってもほこらしいよ！',
      next: 'つぎへ', ok: 'やったー！', max_level: '最高レベル：きみはレジェンドだ！', to_next: 'つぎのレベルまであと{xp} XP', badges_title: 'わたしのバッジ',
      levels: { curious: 'ちいさな好奇心', explorer: '探検家', inventor: '発明家', coder: 'プログラマー', genius: 'ちいさな天才', legend: 'ハイパーレジェンド' },
      badges: {
        first_game: { name: '発進', desc: 'はじめてゲームをあそぶ' },
        three_stars: { name: '三つ星', desc: '星3つでゲームをクリア' },
        explorer: { name: '探検家', desc: '4つのちがうゲームをためす' },
        star_collector: { name: 'コレクター', desc: '星を15こあつめる' },
        brave: { name: 'がんばりや', desc: 'おなじゲームを5回あそぶ' },
        marathon: { name: 'マラソン', desc: '25回あそぶ' },
        all_games: { name: '旅人', desc: 'ぜんぶのゲームをあそぶ' },
        perfectionist: { name: 'パーフェクト', desc: 'ぜんぶ星3つ（4ゲーム以上）' },
      },
    },
    footer: { made_with: '子どもたちへ', for_kids: 'をこめて' },
    hyper: {
      eyebrow: 'Powered by', title: 'Hyper™ AI Engine', subtitle: 'ジギーに声と頭脳と安全を与えるエンジン。お子さまにもたらすものを具体的にご紹介します。',
      pillars: {
        voice: { title: 'ジギーは話して、きく', desc: '答えをあたたかい声で読み上げ、お子さまはマイクで話しかけられます。まだ文字をあまり読めない小さな子にぴったりです。' },
        safety: { title: '子どものためのフィルター', desc: '住所・電話番号・メール・パスワードはAIに届く前にブロック。答えからリンクを取り除き、デリケートな話題は信頼できる大人につなぎます。' },
        brain: { title: '眠らない頭脳', desc: '複数のAIエンジンが交代でこたえるので、ひとつが止まってもジギーは答えます。' },
        motion: { title: 'ていねいなアニメーション', desc: '短く正確な動き。端末の「視差効果を減らす」設定にしたがい、画面外では止まります。' },
        privacy: { title: 'データはヨーロッパ、広告ゼロ', desc: 'アカウントはヨーロッパで管理。データ販売・広告・トラッキングは一切ありません。' },
      },
      ziggy_title: 'すべては、ひとりの友だちのために', ziggy_text: 'エンジンは舞台裏に。ステージにいるのは、ジギーとお子さまだけです。', cta: 'ジギーと話す',
    },
  },
  ko: {
    chat: { nap: '{name}가 잠깐 낮잠 중이에요… 조금 있다가 다시 해 봐요! ⭐', thinking: '{name}가 생각 중', safety: '보호된 메시지', send: '보내기', ask: '{name}에게 쓰기…' },
    voice: { listen: '듣기', stop: '멈추기', auto_on: '목소리: 켜짐', auto_off: '목소리: 꺼짐', mic_start: '지기와 말하기', mic_stop: '다 했어요' },
    rewards: {
      level_up: '레벨 {level} 달성', level_short: '레벨 {level}', new_badge: '새 배지', level_desc: '정말 빨리 배우고 있어요. 지기가 아주 자랑스러워해요!',
      next: '다음', ok: '최고!', max_level: '최고 레벨: 너는 전설이야!', to_next: '다음 레벨까지 {xp} XP', badges_title: '내 배지',
      levels: { curious: '꼬마 호기심쟁이', explorer: '탐험가', inventor: '발명가', coder: '코더', genius: '꼬마 천재', legend: '하이퍼 전설' },
      badges: {
        first_game: { name: '이륙', desc: '첫 게임 하기' },
        three_stars: { name: '별 세 개', desc: '별 3개로 게임 깨기' },
        explorer: { name: '탐험가', desc: '다른 게임 4개 해 보기' },
        star_collector: { name: '수집가', desc: '별 15개 모으기' },
        brave: { name: '끈기왕', desc: '같은 게임 5번 하기' },
        marathon: { name: '마라톤', desc: '게임 25판 하기' },
        all_games: { name: '여행가', desc: '모든 게임 해 보기' },
        perfectionist: { name: '완벽', desc: '모두 별 3개 (게임 4개 이상)' },
      },
    },
    footer: { made_with: '아이들을 위해', for_kids: '정성껏 만들었어요' },
    hyper: {
      eyebrow: 'Powered by', title: 'Hyper™ AI Engine', subtitle: '지기에게 목소리와 두뇌, 안전장치를 주는 엔진. 아이에게 실제로 무엇을 주는지 소개합니다.',
      pillars: {
        voice: { title: '지기는 말하고 들어요', desc: '대답을 따뜻한 목소리로 읽어 주고, 아이는 마이크로 말을 걸 수 있어요. 아직 글을 잘 못 읽는 어린아이에게 딱이에요.' },
        safety: { title: '아이를 위한 필터', desc: '주소, 전화번호, 이메일, 비밀번호는 AI에 닿기 전에 차단되고, 답변의 링크는 지워지며, 민감한 주제는 믿을 수 있는 어른에게 안내해요.' },
        brain: { title: '잠들지 않는 두뇌', desc: '여러 AI 엔진이 서로를 대신해요. 하나가 멈춰도 지기는 대답해요.' },
        motion: { title: '정성 들인 애니메이션', desc: '기기의 ‘동작 줄이기’ 설정을 따르고 화면 밖에서는 멈추는, 짧고 정확한 움직임.' },
        privacy: { title: '데이터는 유럽에, 광고는 0', desc: '계정은 유럽에 보관되고, 판매·광고·추적은 전혀 없어요.' },
      },
      ziggy_title: '이 모든 것은 단 한 친구를 위해', ziggy_text: '엔진은 무대 뒤에 있어요. 무대 위에는 지기와 아이뿐이에요.', cta: '지기와 말하기',
    },
  },
  zh: {
    chat: { nap: '{name}在打个小盹……等一下再试试吧！⭐', thinking: '{name}正在思考', safety: '受保护的消息', send: '发送', ask: '写给{name}…' },
    voice: { listen: '听一听', stop: '停止', auto_on: '语音：开', auto_off: '语音：关', mic_start: '和 Ziggy 说话', mic_stop: '说完了' },
    rewards: {
      level_up: '达到第 {level} 级', level_short: '第 {level} 级', new_badge: '新徽章', level_desc: '你进步得好快！Ziggy 为你骄傲！',
      next: '下一个', ok: '太棒了！', max_level: '最高等级：你是传奇！', to_next: '距离下一级还差 {xp} XP', badges_title: '我的徽章',
      levels: { curious: '小小好奇宝宝', explorer: '探险家', inventor: '发明家', coder: '小程序员', genius: '小天才', legend: 'Hyper 传奇' },
      badges: {
        first_game: { name: '起飞', desc: '玩第一局游戏' },
        three_stars: { name: '三颗星', desc: '用三颗星通关一个游戏' },
        explorer: { name: '探险家', desc: '尝试 4 个不同的游戏' },
        star_collector: { name: '收藏家', desc: '集齐 15 颗星' },
        brave: { name: '坚持不懈', desc: '同一个游戏玩 5 次' },
        marathon: { name: '马拉松', desc: '玩 25 局游戏' },
        all_games: { name: '小旅行家', desc: '玩遍所有游戏' },
        perfectionist: { name: '完美', desc: '全部三颗星（至少 4 个游戏）' },
      },
    },
    footer: { made_with: '用', for_kids: '为孩子们打造' },
    hyper: {
      eyebrow: '技术支持', title: 'Hyper™ AI Engine', subtitle: '赋予 Ziggy 声音、大脑和安全防护的引擎。它为您的孩子带来的，具体如下。',
      pillars: {
        voice: { title: 'Ziggy 会说也会听', desc: '回答会用温暖的声音朗读出来，孩子也可以通过麦克风和他说话——特别适合还不太识字的小朋友。' },
        safety: { title: '专为孩子设计的过滤', desc: '地址、电话、邮箱和密码在到达 AI 之前就会被拦截，回答中的链接会被删除，敏感话题会引导孩子去找信任的大人。' },
        brain: { title: '永不打盹的大脑', desc: '多个 AI 引擎互为后备：即使其中一个不可用，Ziggy 也能回答。' },
        motion: { title: '精心打磨的动效', desc: '简短精准的动画，遵循设备的“减弱动态效果”设置，离开屏幕时自动暂停。' },
        privacy: { title: '数据在欧洲，零广告', desc: '账户托管在欧洲，不出售任何数据，没有广告，也没有追踪。' },
      },
      ziggy_title: '这一切，只为一个好朋友', ziggy_text: '引擎留在幕后。舞台上只有 Ziggy 和您的孩子。', cta: '和 Ziggy 说话',
    },
  },
  ar: {
    chat: { nap: '{name} يأخذ قيلولة صغيرة… حاول بعد قليل! ⭐', thinking: '{name} يفكّر', safety: 'رسالة محمية', send: 'إرسال', ask: 'اكتب إلى {name}…' },
    voice: { listen: 'استمع', stop: 'إيقاف', auto_on: 'الصوت: مفعّل', auto_off: 'الصوت: متوقف', mic_start: 'تحدّث مع زيغي', mic_stop: 'انتهيت' },
    rewards: {
      level_up: 'وصلت إلى المستوى {level}', level_short: 'المستوى {level}', new_badge: 'شارة جديدة', level_desc: 'أنت تتعلم بسرعة كبيرة. زيغي فخور بك جدًا!',
      next: 'التالي', ok: 'رائع!', max_level: 'أعلى مستوى: أنت أسطورة!', to_next: 'باقي {xp} XP للمستوى التالي', badges_title: 'شاراتي',
      levels: { curious: 'الفضولي الصغير', explorer: 'المستكشف', inventor: 'المخترع', coder: 'المبرمج', genius: 'العبقري الصغير', legend: 'أسطورة هايبر' },
      badges: {
        first_game: { name: 'الانطلاق', desc: 'العب أول لعبة' },
        three_stars: { name: 'ثلاث نجوم', desc: 'افز بلعبة بثلاث نجوم' },
        explorer: { name: 'المستكشف', desc: 'جرّب 4 ألعاب مختلفة' },
        star_collector: { name: 'جامع النجوم', desc: 'اجمع 15 نجمة' },
        brave: { name: 'المثابر', desc: 'العب اللعبة نفسها 5 مرات' },
        marathon: { name: 'ماراثون', desc: 'العب 25 جولة' },
        all_games: { name: 'الرحّالة', desc: 'العب كل الألعاب' },
        perfectionist: { name: 'الكمال', desc: 'ثلاث نجوم في كل شيء (4 ألعاب على الأقل)' },
      },
    },
    footer: { made_with: 'صُنع بـ', for_kids: 'للأطفال' },
    hyper: {
      eyebrow: 'مدعوم بـ', title: 'Hyper™ AI Engine', subtitle: 'المحرّك الذي يمنح زيغي صوته وعقله وحمايته. إليك ما يقدّمه لطفلك بشكل ملموس.',
      pillars: {
        voice: { title: 'زيغي يتكلم ويستمع', desc: 'تُقرأ إجاباته بصوت دافئ، ويمكن للطفل التحدث إليه عبر الميكروفون: مثالي للصغار الذين لا يقرؤون كثيرًا بعد.' },
        safety: { title: 'فلتر مصمَّم للأطفال', desc: 'تُحجب العناوين وأرقام الهواتف والبريد وكلمات السر قبل وصولها إلى الذكاء الاصطناعي، وتُحذف الروابط من الإجابات، وتُوجَّه المواضيع الحساسة إلى شخص بالغ موثوق.' },
        brain: { title: 'عقل لا ينام', desc: 'عدة محركات ذكاء اصطناعي تتناوب: إذا توقف أحدها يجيب زيغي رغم ذلك.' },
        motion: { title: 'حركات متقنة', desc: 'حركات قصيرة ودقيقة تحترم إعداد «تقليل الحركة» في الجهاز وتتوقف خارج الشاشة.' },
        privacy: { title: 'بيانات في أوروبا، بلا إعلانات', desc: 'الحسابات مستضافة في أوروبا، لا يُباع شيء، بلا إعلانات وبلا تتبّع.' },
      },
      ziggy_title: 'كل هذا من أجل صديق واحد', ziggy_text: 'يبقى المحرك خلف الكواليس. على المسرح، زيغي وطفلك فقط.', cta: 'تحدّث مع زيغي',
    },
  },
};

for (const [locale, v] of Object.entries(T)) {
  const file = new URL(`../messages/${locale}.json`, import.meta.url);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  json.chat = v.chat;
  json.voice = v.voice;
  json.rewards = v.rewards;
  json.footer = { ...json.footer, ...v.footer };
  json.hyper = v.hyper;
  writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
}
console.log('upgrade strings added to', Object.keys(T).length, 'locales');

/**
 * A child-safety screen around the chat, on top of the providers' own filters.
 *
 * Input: a child should never send personal details to a chatbot (email,
 * phone, address, passwords), and some messages call for a human adult rather
 * than an AI answer. Output: links, emails and phone numbers are stripped from
 * Ziggy's replies, whatever the model wrote.
 *
 * Deliberately small and readable: it is a seatbelt, not a moderation engine.
 */

export type ScreenResult = { verdict: 'ok' } | { verdict: 'personal' | 'unsafe' | 'help'; reply: string };

/**
 * Whole words in any script: JavaScript's \b only knows ASCII letters, so it
 * misses accented words and never fires between two CJK or Arabic letters.
 */
function words(source: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`, 'iu');
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/i;
const URL = /\b(?:https?:\/\/|www\.)\S+/i;
const PHONE = /(?:\+?\d[\s.\-()]*){8,}/;
const ADDRESS = words(
  String.raw`\d{1,4}\s*(?:bis|ter)?,?\s+(?:rue|avenue|av\.|boulevard|bd|chemin|allée|impasse|place|route|street|st\.|road|rd\.|avenida|calle|straße|strasse|via|piazza|laan|straat|weg|caddesi|sokak)`
);
const SECRET = words(
  String.raw`(?:mot de passe|password|passwort|contraseña|senha|wachtwoord|şifre|كلمة السر|code (?:pin|secret)|pin code)`
);

/** Words that mean a child may be at risk: an adult must step in. */
const HELP = words(
  String.raw`(?:suicide|me tuer|me suicider|kill myself|want to die|veux mourir|envie de mourir|quiero morir|me quiero matar|ich will sterben|quero morrer|voglio morire|ik wil dood|ölmek istiyorum|on me (?:frappe|bat)|il me (?:frappe|touche)|someone (?:hits|touches) me|harcèle|bullied|harcelé)`
);

/** Scripts without spaces between words: matched as plain substrings. */
const SECRET_NO_SPACES = /パスワード|暗証番号|비밀번호|密码/;
const HELP_NO_SPACES = /死にたい|消えたい|죽고 싶|자살|想死|自杀|أريد أن أموت|انتحار/;

/** Topics Ziggy declines outright. */
const UNSAFE = words(
  String.raw`(?:sexe?|sexy|porn\w*|nude?s?|naked|tout nu|toute nue|drogue|drugs?|cocaïne|cocaine|weed|cannabis|alcool|alcohol|beer|bière|fusil|gun|bombe|bomb|arme|weapon|kill|tuer|meurtre|murder|sang|blood|hack(?:er|ing)?)`
);

const REPLIES: Record<string, { personal: string; unsafe: string; help: string }> = {
  fr: {
    personal: 'Oups ! 🙈 On ne partage jamais son adresse, son téléphone, son e-mail ou ses mots de passe sur internet, même avec moi. Parlons plutôt de maths, de logique ou d’IA ! ⭐',
    unsafe: 'Ça, ce n’est pas un sujet pour moi 🤖 Si quelque chose te tracasse, parles-en à un adulte de confiance. On joue à un jeu de logique ?',
    help: 'Merci de me l’avoir dit 💚 C’est important : parle tout de suite à un adulte de confiance (parent, enseignant). En France, tu peux appeler le 119, c’est gratuit et quelqu’un t’écoutera.',
  },
  en: {
    personal: 'Oops! 🙈 We never share our address, phone, email or passwords online — not even with me. Let’s talk about maths, logic or AI instead! ⭐',
    unsafe: 'That’s not something I talk about 🤖 If something is bothering you, tell an adult you trust. Shall we play a logic game?',
    help: 'Thank you for telling me 💚 This matters: please talk to an adult you trust right now (a parent or a teacher). They can help you.',
  },
  es: {
    personal: '¡Uy! 🙈 Nunca compartimos la dirección, el teléfono, el correo ni las contraseñas en internet, ni siquiera conmigo. ¡Hablemos de mates, lógica o IA! ⭐',
    unsafe: 'De eso no hablo 🤖 Si algo te preocupa, cuéntaselo a un adulto de confianza. ¿Jugamos a un juego de lógica?',
    help: 'Gracias por contármelo 💚 Es importante: habla ahora mismo con un adulto de confianza (tu madre, tu padre, tu profe). Pueden ayudarte.',
  },
  de: {
    personal: 'Hoppla! 🙈 Adresse, Telefon, E-Mail oder Passwörter teilt man nie im Internet – auch nicht mit mir. Reden wir lieber über Mathe, Logik oder KI! ⭐',
    unsafe: 'Darüber spreche ich nicht 🤖 Wenn dich etwas bedrückt, erzähl es einem Erwachsenen, dem du vertraust. Spielen wir ein Logikspiel?',
    help: 'Danke, dass du es mir sagst 💚 Das ist wichtig: Sprich bitte sofort mit einem Erwachsenen, dem du vertraust (Eltern, Lehrkraft). Sie können dir helfen.',
  },
  pt: {
    personal: 'Ops! 🙈 Nunca partilhamos a morada, o telefone, o e-mail ou as palavras-passe na internet, nem comigo. Vamos falar de matemática, lógica ou IA! ⭐',
    unsafe: 'Disso eu não falo 🤖 Se algo te preocupa, conta a um adulto de confiança. Jogamos um jogo de lógica?',
    help: 'Obrigado por me contares 💚 É importante: fala já com um adulto de confiança (pai, mãe, professor). Eles podem ajudar-te.',
  },
  it: {
    personal: 'Ops! 🙈 Non si condividono mai indirizzo, telefono, e-mail o password su internet, nemmeno con me. Parliamo di matematica, logica o IA! ⭐',
    unsafe: 'Di questo non parlo 🤖 Se qualcosa ti preoccupa, dillo a un adulto di fiducia. Facciamo un gioco di logica?',
    help: 'Grazie di avermelo detto 💚 È importante: parla subito con un adulto di fiducia (genitore, insegnante). Può aiutarti.',
  },
  nl: {
    personal: 'Oei! 🙈 Je adres, telefoon, e-mail of wachtwoorden deel je nooit online, ook niet met mij. Laten we het over rekenen, logica of AI hebben! ⭐',
    unsafe: 'Daar praat ik niet over 🤖 Zit je iets dwars? Vertel het aan een volwassene die je vertrouwt. Zullen we een logicaspel doen?',
    help: 'Dank je dat je het me vertelt 💚 Dit is belangrijk: praat meteen met een volwassene die je vertrouwt (ouder, leraar). Die kan je helpen.',
  },
  tr: {
    personal: 'Hop! 🙈 Adresini, telefonunu, e-postanı veya şifreni internette asla paylaşma, benimle bile. Hadi matematik, mantık ya da yapay zekâ konuşalım! ⭐',
    unsafe: 'Bu benim konuşacağım bir konu değil 🤖 Seni üzen bir şey varsa güvendiğin bir yetişkine anlat. Bir mantık oyunu oynayalım mı?',
    help: 'Bana söylediğin için teşekkürler 💚 Bu önemli: hemen güvendiğin bir yetişkinle konuş (annen, baban, öğretmenin). Sana yardım edebilirler.',
  },
  ja: {
    personal: 'おっと！🙈 住所や電話番号、メール、パスワードはネットでは教えないよ。ぼくにもね。算数やパズル、AIのお話をしよう！⭐',
    unsafe: 'それはぼくが話すことじゃないんだ 🤖 気になることがあったら、信頼できる大人に話してね。パズルゲームをしようか？',
    help: '教えてくれてありがとう 💚 とても大切なことだよ。すぐに信頼できる大人（おうちの人や先生）に話してね。きっと助けてくれるよ。',
  },
  ko: {
    personal: '앗! 🙈 주소, 전화번호, 이메일, 비밀번호는 인터넷에서 절대 알려 주면 안 돼요. 나한테도요. 수학이나 논리, AI 이야기를 해요! ⭐',
    unsafe: '그건 내가 이야기하는 주제가 아니에요 🤖 걱정되는 일이 있으면 믿을 수 있는 어른에게 말해요. 논리 게임 할까요?',
    help: '말해 줘서 고마워요 💚 정말 중요해요. 지금 바로 믿을 수 있는 어른(부모님, 선생님)에게 이야기해요. 도와주실 거예요.',
  },
  zh: {
    personal: '哎呀！🙈 地址、电话、邮箱和密码都不能在网上告诉别人，连我也不行哦。我们来聊数学、逻辑或人工智能吧！⭐',
    unsafe: '这个话题我不聊哦 🤖 如果有什么让你不开心，告诉你信任的大人吧。我们来玩逻辑游戏好吗？',
    help: '谢谢你告诉我 💚 这很重要：请马上告诉一位你信任的大人（爸爸妈妈或老师），他们会帮助你。',
  },
  ar: {
    personal: 'أوه! 🙈 لا نشارك أبدًا العنوان أو الهاتف أو البريد أو كلمات السر على الإنترنت، حتى معي. لنتحدث عن الرياضيات أو المنطق أو الذكاء الاصطناعي! ⭐',
    unsafe: 'هذا ليس موضوعًا أتحدث عنه 🤖 إذا كان شيء يزعجك، أخبر شخصًا بالغًا تثق به. هل نلعب لعبة منطق؟',
    help: 'شكرًا لأنك أخبرتني 💚 هذا مهم: تحدّث الآن مع شخص بالغ تثق به (أحد والديك أو معلّمك). يمكنه مساعدتك.',
  },
};

function repliesFor(locale: string) {
  return REPLIES[locale] ?? REPLIES.en;
}

/** Screen what the child wrote, before any AI sees it. */
export function screenChildInput(text: string, locale: string): ScreenResult {
  const r = repliesFor(locale);
  if (HELP.test(text) || HELP_NO_SPACES.test(text)) return { verdict: 'help', reply: r.help };
  if (EMAIL.test(text) || PHONE.test(text) || ADDRESS.test(text) || SECRET.test(text) || SECRET_NO_SPACES.test(text) || URL.test(text)) {
    return { verdict: 'personal', reply: r.personal };
  }
  if (UNSAFE.test(text)) return { verdict: 'unsafe', reply: r.unsafe };
  return { verdict: 'ok' };
}

/** The friendly refusal used when a provider's own filter blocked the answer. */
export function blockedReply(locale: string): string {
  return repliesFor(locale).unsafe;
}

/** Clean what the AI wrote: no links, emails or phone numbers reach a child. */
export function screenAiOutput(text: string): string {
  return text
    .replace(new RegExp(URL.source, 'gi'), '')
    .replace(new RegExp(EMAIL.source, 'gi'), '')
    .replace(new RegExp(PHONE.source, 'g'), '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

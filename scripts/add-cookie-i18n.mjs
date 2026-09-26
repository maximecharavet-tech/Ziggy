// Honest cookie notice: Ziggy only stores what it needs to work. Adds cookies_banner to every locale.
import { readFileSync, writeFileSync } from 'node:fs';

const T = {
  fr: ['Ziggy et les cookies', 'Aucune publicité, aucun traçage. Ziggy garde seulement ce qui sert à fonctionner : ta connexion, tes réglages (son, thème) et ta progression.', 'D’accord', 'En savoir plus'],
  en: ['Ziggy and cookies', 'No ads, no tracking. Ziggy only keeps what it needs to work: your sign-in, your settings (sound, theme) and your progress.', 'Got it', 'Learn more'],
  es: ['Ziggy y las cookies', 'Sin publicidad ni rastreo. Ziggy solo guarda lo necesario para funcionar: tu sesión, tus ajustes (sonido, tema) y tu progreso.', 'De acuerdo', 'Saber más'],
  de: ['Ziggy und Cookies', 'Keine Werbung, kein Tracking. Ziggy speichert nur, was zum Funktionieren nötig ist: deine Anmeldung, deine Einstellungen (Ton, Design) und deinen Fortschritt.', 'Alles klar', 'Mehr erfahren'],
  pt: ['O Ziggy e os cookies', 'Sem publicidade nem rastreamento. O Ziggy só guarda o necessário para funcionar: a tua sessão, as tuas definições (som, tema) e o teu progresso.', 'Entendi', 'Saber mais'],
  it: ['Ziggy e i cookie', 'Niente pubblicità, niente tracciamento. Ziggy conserva solo ciò che serve per funzionare: il tuo accesso, le tue impostazioni (audio, tema) e i tuoi progressi.', 'Va bene', 'Scopri di più'],
  nl: ['Ziggy en cookies', 'Geen reclame, geen tracking. Ziggy bewaart alleen wat nodig is om te werken: je aanmelding, je instellingen (geluid, thema) en je voortgang.', 'Oké', 'Meer weten'],
  tr: ['Ziggy ve çerezler', 'Reklam yok, takip yok. Ziggy yalnızca çalışması için gerekenleri saklar: oturumun, ayarların (ses, tema) ve ilerlemen.', 'Tamam', 'Daha fazla bilgi'],
  ja: ['ジギーとクッキー', '広告も追跡もありません。ジギーが保存するのは動作に必要なものだけ：ログイン、設定（音・テーマ）、学習の進み具合です。', 'OK', 'くわしく見る'],
  ko: ['지기와 쿠키', '광고도, 추적도 없어요. 지기는 작동에 꼭 필요한 것만 저장해요: 로그인, 설정(소리, 테마), 학습 진행 상황.', '알겠어요', '자세히 보기'],
  zh: ['Ziggy 与 Cookie', '没有广告，也没有追踪。Ziggy 只保存运行所需的内容：你的登录、你的设置（声音、主题）和学习进度。', '知道了', '了解更多'],
  ar: ['زيغي وملفات تعريف الارتباط', 'لا إعلانات ولا تتبّع. يحتفظ زيغي فقط بما يحتاجه ليعمل: تسجيل دخولك، وإعداداتك (الصوت، المظهر)، وتقدّمك.', 'حسنًا', 'اعرف المزيد'],
};

for (const [locale, [title, text, ok, more]] of Object.entries(T)) {
  const file = new URL(`../messages/${locale}.json`, import.meta.url);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  json.cookies_banner = { title, text, ok, more };
  writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
}
console.log('cookies_banner added to', Object.keys(T).length, 'locales');

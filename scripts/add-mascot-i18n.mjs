// Adds the strings for the official-mascot redesign (moods gallery, tagline ribbon) to every locale.
import { readFileSync, writeFileSync } from 'node:fs';

const T = {
  fr: {
    hint: 'Les humeurs de Ziggy',
    moods: { cheer: 'Youpi !', wave: 'Coucou !', heart: 'Plein d’amour', closeup: 'Waouh !', stand: 'Prêt à jouer', film: 'Le film' },
    ribbon: { learn: 'Apprendre', understand: 'Comprendre', create: 'Créer', tagline: 'L’IA éducative qui fait grandir la curiosité et la confiance' },
  },
  en: {
    hint: 'Ziggy’s moods',
    moods: { cheer: 'Hooray!', wave: 'Hi there!', heart: 'Full of love', closeup: 'Wow!', stand: 'Ready to play', film: 'The film' },
    ribbon: { learn: 'Learn', understand: 'Understand', create: 'Create', tagline: 'The learning AI that grows curiosity and confidence' },
  },
  es: {
    hint: 'Los ánimos de Ziggy',
    moods: { cheer: '¡Yupi!', wave: '¡Hola!', heart: 'Lleno de amor', closeup: '¡Guau!', stand: 'Listo para jugar', film: 'La película' },
    ribbon: { learn: 'Aprender', understand: 'Comprender', create: 'Crear', tagline: 'La IA educativa que hace crecer la curiosidad y la confianza' },
  },
  de: {
    hint: 'Ziggys Launen',
    moods: { cheer: 'Juhu!', wave: 'Hallo!', heart: 'Voller Liebe', closeup: 'Wow!', stand: 'Bereit zum Spielen', film: 'Der Film' },
    ribbon: { learn: 'Lernen', understand: 'Verstehen', create: 'Erschaffen', tagline: 'Die Lern-KI, die Neugier und Selbstvertrauen wachsen lässt' },
  },
  pt: {
    hint: 'Os humores do Ziggy',
    moods: { cheer: 'Oba!', wave: 'Olá!', heart: 'Cheio de amor', closeup: 'Uau!', stand: 'Pronto para brincar', film: 'O filme' },
    ribbon: { learn: 'Aprender', understand: 'Compreender', create: 'Criar', tagline: 'A IA educativa que faz crescer a curiosidade e a confiança' },
  },
  it: {
    hint: 'Gli umori di Ziggy',
    moods: { cheer: 'Evviva!', wave: 'Ciao!', heart: 'Pieno d’amore', closeup: 'Wow!', stand: 'Pronto a giocare', film: 'Il film' },
    ribbon: { learn: 'Imparare', understand: 'Capire', create: 'Creare', tagline: 'L’IA educativa che fa crescere curiosità e fiducia' },
  },
  nl: {
    hint: 'Ziggy’s buien',
    moods: { cheer: 'Hoera!', wave: 'Hoi!', heart: 'Vol liefde', closeup: 'Wauw!', stand: 'Klaar om te spelen', film: 'De film' },
    ribbon: { learn: 'Leren', understand: 'Begrijpen', create: 'Creëren', tagline: 'De leer-AI die nieuwsgierigheid en zelfvertrouwen laat groeien' },
  },
  tr: {
    hint: 'Ziggy’nin halleri',
    moods: { cheer: 'Yaşasın!', wave: 'Merhaba!', heart: 'Sevgi dolu', closeup: 'Vay!', stand: 'Oynamaya hazır', film: 'Film' },
    ribbon: { learn: 'Öğren', understand: 'Anla', create: 'Yarat', tagline: 'Merakı ve özgüveni büyüten eğitici yapay zekâ' },
  },
  ja: {
    hint: 'ジギーのいろんな顔',
    moods: { cheer: 'やったー！', wave: 'やあ！', heart: 'だいすき', closeup: 'わあ！', stand: 'あそぼう', film: 'ムービー' },
    ribbon: { learn: 'まなぶ', understand: 'わかる', create: 'つくる', tagline: '好奇心と自信を育てる、学びのAI' },
  },
  ko: {
    hint: '지기의 여러 표정',
    moods: { cheer: '야호!', wave: '안녕!', heart: '사랑 가득', closeup: '우와!', stand: '놀 준비 완료', film: '영상' },
    ribbon: { learn: '배우고', understand: '이해하고', create: '만들고', tagline: '호기심과 자신감을 키우는 교육용 AI' },
  },
  zh: {
    hint: 'Ziggy 的心情',
    moods: { cheer: '耶！', wave: '你好！', heart: '满满的爱', closeup: '哇！', stand: '准备好玩了', film: '短片' },
    ribbon: { learn: '学习', understand: '理解', create: '创造', tagline: '让好奇心和自信一起成长的教育 AI' },
  },
  ar: {
    hint: 'مزاجات زيغي',
    moods: { cheer: 'هيييه!', wave: 'مرحبًا!', heart: 'مليء بالحب', closeup: 'واو!', stand: 'مستعد للعب', film: 'الفيلم' },
    ribbon: { learn: 'تعلَّم', understand: 'افهم', create: 'ابتكر', tagline: 'الذكاء الاصطناعي التعليمي الذي ينمّي الفضول والثقة' },
  },
};

for (const [locale, v] of Object.entries(T)) {
  const file = new URL(`../messages/${locale}.json`, import.meta.url);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  json.showcase = { ...json.showcase, moods_hint: v.hint, moods: v.moods };
  json.ribbon = v.ribbon;
  writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
  console.log('updated', locale);
}

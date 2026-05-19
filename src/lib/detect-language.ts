const CHAR_PATTERNS: Record<string, RegExp> = {
  ja: /[぀-ゟ゠-ヿ一-龯]/,
  ko: /[가-힯ᄀ-ᇿ]/,
  zh: /[一-鿿㐀-䶿]/,
  ar: /[؀-ۿݐ-ݿ]/,
};

const ACCENT_PATTERNS: Record<string, RegExp> = {
  fr: /[àâéèêëïîôùûüÿçœæ]/gi,
  es: /[áéíóúñ¿¡]/gi,
  de: /[äöüß]/gi,
  pt: /[ãõ]/gi,
  tr: /[çğışü]/gi,
};

const WORD_PATTERNS: Record<string, RegExp> = {
  fr: /\b(?:je|tu|nous|vous|ils|elles|est|sont|dans|pour|avec|mais|qui|que|cette|très|aussi)\b/gi,
  es: /\b(?:yo|el|ella|los|las|una|pero|como|más|muy|este|esta|tiene|puede|hace)\b/gi,
  de: /\b(?:der|die|das|ein|eine|ich|und|ist|sind|für|mit|auf|nicht|auch)\b/gi,
  pt: /\b(?:eu|ele|ela|uma|são|não|com|mais|muito|esta|este|tem|pode)\b/gi,
  it: /\b(?:il|gli|una|io|sono|con|per|non|che|questo|questa|molto|anche)\b/gi,
  nl: /\b(?:het|een|ik|jij|hij|zij|zijn|voor|met|van|niet|ook|maar|dit)\b/gi,
  tr: /\b(?:bir|bu|ve|ile|için|ben|sen|var|çok|olan|gibi|daha)\b/gi,
};

export function detectLanguage(text: string): string {
  for (const [lang, pattern] of Object.entries(CHAR_PATTERNS)) {
    if (pattern.test(text)) return lang;
  }

  const scores: Record<string, number> = {};

  for (const [lang, pattern] of Object.entries(ACCENT_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches) scores[lang] = (scores[lang] || 0) + matches.length * 3;
  }

  for (const [lang, pattern] of Object.entries(WORD_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches) scores[lang] = (scores[lang] || 0) + matches.length;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : 'en';
}

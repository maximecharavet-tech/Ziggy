const LANGUAGE_PATTERNS: Record<string, RegExp> = {
  fr: /[àâéèêëïîôùûüÿçœæ]|(?:^|\s)(?:le|la|les|un|une|des|je|tu|il|nous|vous|ils|est|sont|dans|pour|avec|sur)\b/i,
  es: /[áéíóúñ¿¡]|(?:^|\s)(?:el|la|los|las|un|una|yo|es|son|en|para|con|por)\b/i,
  de: /[äöüß]|(?:^|\s)(?:der|die|das|ein|eine|ich|du|er|ist|sind|und|für|mit)\b/i,
  pt: /[ãõáéíóúâêô]|(?:^|\s)(?:o|a|os|as|um|uma|eu|ele|é|são|em|para|com)\b/i,
  it: /[àèéìòù]|(?:^|\s)(?:il|lo|la|gli|le|un|una|io|è|sono|in|per|con)\b/i,
  nl: /(?:^|\s)(?:de|het|een|ik|jij|hij|zij|is|zijn|in|voor|met|van)\b/i,
  tr: /[çğıöşü]|(?:^|\s)(?:bir|bu|ve|ile|için|ben|sen|o)\b/i,
  ja: /[぀-ゟ゠-ヿ一-龯]/,
  ko: /[가-힯ᄀ-ᇿ]/,
  zh: /[一-鿿㐀-䶿]/,
  ar: /[؀-ۿݐ-ݿ]/,
};

export function detectLanguage(text: string): string {
  for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
    if (pattern.test(text)) return lang;
  }
  return 'en';
}

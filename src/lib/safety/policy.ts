/**
 * Ziggy's safety policy: what may never reach a child, in any language the
 * site speaks. Applied server-side to everything the AI produces and to every
 * value a client sends. The client is never trusted.
 */
export const SAFETY_CATEGORIES = [
  'sexual',
  'nudity',
  'graphic_violence',
  'weapons',
  'drugs',
  'adult_transformation',
  'dangerous',
  'personal_data',
  'self_harm',
] as const;
export type SafetyCategory = (typeof SAFETY_CATEGORIES)[number];

/** Whole words in any script (JavaScript's \b only knows ASCII). */
const words = (source: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`, 'iu');

export const RULES: Record<SafetyCategory, RegExp> = {
  sexual: words(
    String.raw`sex\w*|sexy|porn\w*|érotique|erotic\w*|seins?|breasts?|lingerie|bikini|string|kiss(?:ing)? on the mouth|bisou sur la bouche|séduisante?|seductive|sensual\w*|sensuel\w*|hot girl|hot boy`
  ),
  nudity: words(String.raw`nue?s?|nudes?|naked|tout nue?|toute nue|déshabill\w*|undress\w*|topless|sans vêtements|without clothes`),
  graphic_violence: words(String.raw`(?:du|le|de|en|plein de) sang|sangs|sanglante?s?|blood\w*|gore|tuer|kill\w*|meurtre|murder\w*|mort\w*|dead|death|cadavre|corpse|torture\w*|décapit\w*|behead\w*|massacre`),
  weapons: words(String.raw`armes?|weapons?|fusils?|guns?|pistolets?|pistols?|couteaux?|knife|knives|épée sanglante|bombes?|bombs?|grenades?|explosi\w*|rifle`),
  drugs: words(String.raw`drogues?|drugs?|cocaïne|cocaine|cannabis|weed|alcool|alcohol|bière|beer|vin|wine|cigarettes?|tabac|tobacco|vape`),
  adult_transformation: words(
    String.raw`(?:en|version|comme un|comme une) adulte|adult version|as an adult|grown[- ]up version|plus âgée?|aged up|age up|maquillage sexy|décolleté|cleavage|talons hauts|high heels|femme fatale|pin[- ]?up`
  ),
  dangerous: words(String.raw`suicide|poison\w*|incendie criminel|arson|hack\w*|défi dangereux|dangerous challenge|feu d'artifice maison`),
  personal_data: /[\w.+-]+@[\w-]+\.[\w.-]+|(?:\+?\d[\s.\-()]*){8,}|\b(?:https?:\/\/|www\.)\S+/i,
  self_harm: words(String.raw`me tuer|kill myself|me faire du mal|hurt myself|scarif\w*|self[- ]harm`),
};

export function classify(text: string): SafetyCategory | null {
  for (const c of SAFETY_CATEGORIES) if (RULES[c].test(text)) return c;
  return null;
}

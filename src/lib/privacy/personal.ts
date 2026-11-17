/**
 * Personal words never leave the device for a third-party service.
 *
 * Ziggy's read-aloud voice goes through /api/tts (Google Gemini). Some spoken
 * lines carry personal data: the child's first name (Santa app, Lutins letters,
 * account profile), names the child typed (creatures, pets…), or what the child
 * said. Those lines are spoken by the device's own speech synthesis instead.
 *
 * How a line is recognised as personal (`isPersonalText`):
 * 1. it contains a registered token (case- and accent-insensitive, whole words):
 *    every place that stores or shows child-entered text calls
 *    `registerPersonal`, and `collectStoredPersonal` reads the known local
 *    stores (Santa children, creature album, account profile…) on demand;
 * 2. or it was flagged with `markPersonal` (a line built around personal data);
 * 3. or it has obvious personal data a pattern can see (email, phone number,
 *    street address, "je m'appelle …" / "my name is …").
 *
 * `redactPersonal` replaces those words with a neutral placeholder before a text
 * is sent to an AI provider (chat, Santa's live call, Lutins prank ideas).
 *
 * The pure helpers (`fold`, `findTokens`, `obviousPersonalData`…) also run on
 * the server (defence in depth in /api/tts, /api/chat, /api/santa/chat). The
 * registry itself only lives in the browser tab's memory: on the server
 * `registerPersonal` and `markPersonal` do nothing.
 */

/** Lower case, no accents, straight apostrophes: "Léa" and "LEA" match. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’‘`´]/g, "'");
}

/** Folded text plus, for each folded code unit, the index of the original character it came from. */
function foldWithMap(s: string): { text: string; map: number[] } {
  let text = '';
  const map: number[] = [];
  let i = 0;
  for (const ch of s) {
    const f = fold(ch);
    for (let k = 0; k < f.length; k++) map.push(i);
    text += f;
    i += ch.length;
  }
  map.push(s.length);
  return { text, map };
}

const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

/**
 * Words too common to be a reliable personal token (a creature called "Le
 * dragon" must not send every sentence with "le" to the device voice).
 * "ziggy" is here because children name their creations after him.
 */
const STOP = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'moi', 'toi', 'lui', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
  'the', 'a', 'an', 'and', 'or', 'me', 'you', 'my', 'your', 'oui', 'non', 'yes', 'no', 'ziggy',
]);

/** A value worth remembering: 2–40 characters once folded, letters inside, not a stop word. */
export function tokenOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = fold(value).replace(/\s+/g, ' ').trim();
  if (t.length < 2 || t.length > 40 || !/\p{L}/u.test(t) || STOP.has(t)) return null;
  return t;
}

/** Every [start, end) span of the original text where one of the (folded) tokens appears as whole words. */
export function findTokens(text: string, tokens: Iterable<string>): [number, number][] {
  const { text: f, map } = foldWithMap(text);
  const spans: [number, number][] = [];
  for (const tok of tokens) {
    if (!tok) continue;
    let from = 0;
    for (let at = f.indexOf(tok, from); at >= 0; at = f.indexOf(tok, from)) {
      const end = at + tok.length;
      if (!isWordChar(f[at - 1]) && !isWordChar(f[end])) spans.push([map[at], map[end]]);
      from = at + 1;
    }
  }
  return spans.sort((a, b) => a[0] - b[0]);
}

/* ── Obvious personal data (patterns, no registry needed) ── */

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
// French numbers (06 12 34 56 78), international (+33 6 12 34 56 78), US ((555) 123-4567) and any run of 9+ digits.
const PHONE = /(?<!\d)(?:0[1-9](?:[\s.-]?\d{2}){4}|(?:\+|00)\d{1,3}(?:[\s.-]?\(?\d{1,4}\)?){2,5}|\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}|\d{9,})(?!\d)/g;
// French order ("12 rue des Lilas"), then English order ("221 Baker Street").
const STREET =
  /\b\d{1,4}\s*(?:bis|ter)?,?\s+(?:rue|avenue|av\.|boulevard|bd|chemin|all[ée]e|impasse|place|route|quai|cours)\s+[\p{L}'’ -]{2,40}|\b\d{1,5}\s+(?:[\p{L}'’-]+\s+){1,3}(?:street|st\.|road|rd\.|avenue|ave\.|lane|drive|way|boulevard|court)\b/giu;
/** "je m'appelle Léa", "mon prénom c'est Léa", "my name is Leo", "I'm called Leo" → the name. */
const SELF_NAME =
  /\b(?:je\s+m['’]\s?appelle|moi\s+c['’]est|mon\s+(?:pr[ée])?nom\s+(?:c['’]est|est)|my\s+name\s+is|my\s+name['’]s|i['’]m\s+called|i\s+am\s+called|call\s+me)\s+([\p{Lu}\p{Ll}][\p{L}'’-]{1,23})/giu;
/** Names a child may say about themselves that are not personal (characters of the site). */
const CHARACTERS = new Set(['ziggy', 'pepin', 'grelotte', 'noisette', 'pere', 'santa', 'lumi']);

export type ObviousKind = 'email' | 'phone' | 'address' | 'self-name';

/** Spans of personal data a pattern can see, with their kind. */
export function obviousPersonalData(text: string): { kind: ObviousKind; span: [number, number]; value: string }[] {
  const out: { kind: ObviousKind; span: [number, number]; value: string }[] = [];
  const scan = (re: RegExp, kind: ObviousKind, group = 0) => {
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const value = m[group];
      if (!value) continue;
      if (kind === 'self-name' && CHARACTERS.has(fold(value))) continue;
      const start = m.index + m[0].lastIndexOf(value);
      out.push({ kind, span: [start, start + value.length], value });
    }
  };
  scan(EMAIL, 'email');
  scan(PHONE, 'phone');
  scan(STREET, 'address');
  scan(SELF_NAME, 'self-name', 1);
  return out.sort((a, b) => a.span[0] - b.span[0]);
}

/** True when the text holds an email, a phone number or a street address (what the server can refuse cheaply). */
export function hasContactData(text: string): boolean {
  return obviousPersonalData(text).some((d) => d.kind !== 'self-name');
}

/* ── The registry (browser tab memory only) ── */

const registered = new Set<string>();
const flagged: string[] = []; // exact lines flagged personal, most recent last
const FLAGGED_MAX = 300;
const onServer = () => typeof window === 'undefined';

/** Remember personal words (a first name, a name the child typed…) for this visit. */
export function registerPersonal(...values: unknown[]): void {
  if (onServer()) return;
  for (const v of values) {
    const t = tokenOf(v);
    if (t) registered.add(t);
  }
}

/** Flag a line as personal (it will be spoken by the device only) and return it unchanged. */
export function markPersonal<T extends string | null | undefined>(line: T): T {
  if (onServer() || !line || !line.trim()) return line;
  const f = fold(line).trim();
  if (!flagged.includes(f)) {
    flagged.push(f);
    if (flagged.length > FLAGGED_MAX) flagged.shift();
  }
  return line;
}

type Reader = { getItem(key: string): string | null };

/**
 * The local stores that hold child-entered text, and how to pick the words out.
 * Keys are listed here (not imported) so this module stays tiny and loads no game code.
 */
const STORES: { key: string; pick: (data: unknown) => unknown[] }[] = [
  // L'appli du Père Noël (also the Lutins' child): first names.
  { key: 'ziggy:santa:v1', pick: (d) => arr((d as { children?: unknown })?.children).map((c) => (c as { name?: unknown })?.name) },
  // Creature lab album: names the child typed or kept.
  { key: 'ziggy:creatures:v1', pick: (d) => (Array.isArray(d) ? d : arr((d as { album?: unknown })?.album)).map((c) => (c as { name?: unknown })?.name) },
];
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const lastRaw = new Map<string, string | null>();
const fromStores = new Map<string, string[]>();

/** Reads the known local stores and returns their personal tokens (cached until a store changes). */
export function collectStoredPersonal(storage?: Reader | null): string[] {
  const s = storage ?? (onServer() ? null : safeLocalStorage());
  if (!s) return [];
  const out: string[] = [];
  for (const { key, pick } of STORES) {
    let raw: string | null = null;
    try {
      raw = s.getItem(key);
    } catch {
      raw = null;
    }
    if (lastRaw.get(key) !== raw || !fromStores.has(key)) {
      lastRaw.set(key, raw);
      let tokens: string[] = [];
      try {
        tokens = raw ? pick(JSON.parse(raw)).map(tokenOf).filter((t): t is string => Boolean(t)) : [];
      } catch {
        tokens = [];
      }
      fromStores.set(key, tokens);
    }
    out.push(...(fromStores.get(key) ?? []));
  }
  return out;
}

function safeLocalStorage(): Reader | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Every personal token known right now: registered this visit, or found in the local stores. */
export function personalTokens(storage?: Reader | null): string[] {
  return [...new Set([...registered, ...collectStoredPersonal(storage)])];
}

/**
 * Must this line stay on the device? True when it contains a registered or
 * stored personal word, was flagged with `markPersonal`, or holds obvious
 * personal data (email, phone, address, "my name is …").
 */
export function isPersonalText(text: string, storage?: Reader | null): boolean {
  if (!text.trim()) return false;
  const f = fold(text);
  if (flagged.some((line) => f.includes(line))) return true;
  if (obviousPersonalData(text).length) return true;
  return findTokens(text, personalTokens(storage)).length > 0;
}

/**
 * What replaces a personal word in a text sent to a chat model. In parentheses:
 * the model reads it as a gap, and Santa's reply cleaner drops anything in
 * parentheses, so it is never spoken back. (Image prompts pass their own words.)
 */
export const PLACEHOLDER: Record<'fr' | 'en', string> = { fr: '(prénom)', en: '(name)' };

/**
 * The text with every personal word (registered, stored, or seen by a pattern)
 * replaced by `placeholder`. Extra tokens (e.g. the name a request carries) can
 * be passed on the server, where there is no registry.
 */
export function redactPersonal(text: string, placeholder: string, opts: { extra?: unknown[]; storage?: Reader | null } = {}): string {
  if (!text) return text;
  const tokens = new Set(personalTokens(opts.storage));
  for (const e of opts.extra ?? []) {
    const t = tokenOf(e);
    if (t) tokens.add(t);
  }
  const spans = [...findTokens(text, tokens), ...obviousPersonalData(text).map((d) => d.span)].sort((a, b) => a[0] - b[0]);
  if (!spans.length) return text;
  let out = '';
  let at = 0;
  for (const [s, e] of spans) {
    if (e <= at) continue;
    out += text.slice(at, Math.max(at, s)) + placeholder;
    at = e;
  }
  return out + text.slice(at);
}

/** For tests only. */
export function _resetPersonal() {
  registered.clear();
  flagged.length = 0;
  lastRaw.clear();
  fromStores.clear();
}

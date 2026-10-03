/**
 * Text as Ziggy says it out loud — the pure part of the voice call, shared
 * with hyper-engine's voice chat (src/lib/voice/chat.ts there).
 */

/** What to add to the system prompt when the answer will be heard, not read. */
export const SPOKEN_STYLE =
  'VOICE CALL MODE: your answer is read aloud to a young child. Speak as you would out loud: short sentences, warm tone, no markdown, no lists, no emoji, no links. Two or three sentences, then often end with a small question to keep the conversation going.';

/** Text as it should be heard: no markdown marks, links, code or emoji. */
export function clean(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/(\*\*|__|\*|_|~~)(.+?)\1/g, '$2')
    .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cut a full answer into sentences to speak one after the other: the first
 * one starts while the next is still being synthesised. Very short pieces are
 * merged with the next so the voice does not stutter; very long ones are cut
 * at a comma.
 */
export function splitSentences(text: string, minChars = 10, maxChars = 200): string[] {
  const body = clean(text);
  if (!body) return [];
  // Sentence ends: . ! ? … and the CJK / Arabic full stops.
  const raw = body.match(/[^.!?…。！？؟]+(?:[.!?…。！？؟]+["»)\]]?|$)/g) ?? [body];
  const out: string[] = [];
  let carry = '';
  for (const part of raw.map((s) => s.trim()).filter(Boolean)) {
    const piece = carry ? `${carry} ${part}` : part;
    if (piece.length < minChars) {
      carry = piece;
      continue;
    }
    carry = '';
    if (piece.length <= maxChars) {
      out.push(piece);
      continue;
    }
    // Too long for one breath: cut at the last comma (or space) before the limit.
    let rest = piece;
    while (rest.length > maxChars) {
      const comma = rest.lastIndexOf(', ', maxChars);
      const space = rest.lastIndexOf(' ', maxChars);
      const cut = comma > minChars ? comma + 1 : space > minChars ? space : maxChars;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
  }
  if (carry) {
    if (out.length) out[out.length - 1] = `${out[out.length - 1]} ${carry}`;
    else out.push(carry);
  }
  return out;
}

/** Recognisers sometimes "hear" noise as filler; nothing worth answering. */
export function isNoise(text: string): boolean {
  const t = text.trim();
  return t.length < 2 || /^[\s.,!?…-]*$/.test(t);
}

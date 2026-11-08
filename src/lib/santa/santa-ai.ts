import 'server-only';
import { localShield, shield } from '@/lib/safety/child-shield';
import { giftById } from '@/data/santa/gifts';
import { cleanName } from './name';

/**
 * The live AI call with Santa (Pack magique, switched on by a parent).
 *
 * Safeguards (owner-approved exception to "no free LLM chat", docs/PERE_NOEL.md):
 * - the child's voice is transcribed on the device; only the sentence's text comes here;
 * - ChildShield on the child's sentence and on every reply; anything flagged gets a fixed,
 *   human-written line instead;
 * - one or two short sentences, a strict persona, never asks for personal data, never
 *   claims to be a human, no promises of specific gifts, no other topics;
 * - nothing is stored or logged (no transcript, no name).
 */

export type SantaTurn = { role: 'child' | 'santa'; text: string };
export type SantaAiInput = { locale: 'fr' | 'en'; name: string; age: number; wishes: string[]; history: SantaTurn[]; text: string };
export type SantaAiResult = { ok: true; text: string } | { ok: false; line: 'ai.again' | 'ai.busy' };

const MAX_INPUT = 300;
const MAX_REPLY = 260;

export function santaSystemPrompt(input: Pick<SantaAiInput, 'locale' | 'name' | 'age' | 'wishes'>): string {
  const name = cleanName(input.name) || (input.locale === 'fr' ? 'mon enfant' : 'my friend');
  const age = Math.min(12, Math.max(2, Math.round(input.age) || 6));
  const wishes = input.wishes
    .map((id) => giftById(id)?.say[input.locale])
    .filter(Boolean)
    .slice(0, 6)
    .join(', ');
  const lang = input.locale === 'fr' ? 'French (tutoie the child, simple words)' : 'English (simple words)';
  return [
    `You are the voice of Santa Claus in a children's app called Ziggy, talking on a video call with ${name}, a ${age}-year-old child. A parent is nearby.`,
    `Speak ${lang}. Answer in ONE or TWO short sentences (under 35 words), warm, jolly and playful, like a kind grandfather. A "Ho ho ho" now and then.`,
    wishes ? `The child's letter asks for: ${wishes}. You may mention them, but never promise a specific gift ("I'll see what my elves can do").` : `You don't have the child's letter yet.`,
    'Talk only about Christmas magic: the North Pole, elves, reindeer, the workshop, Mrs Claus, snow, cookies, kindness, the child\'s wishes, their day, games, animals, stories. Ask the child simple questions back.',
    'Never ask for or repeat personal information (surname, address, school, phone, email, photos, passwords) — if the child gives some, kindly say Santa does not need it and change the subject.',
    'Never talk about money, prices, buying, apps, ads, brands, other websites, religion, politics, news, violence, scary things, illness or death, romance, or adult topics. If asked, say gently that it is a question for a grown-up and come back to Christmas.',
    'If the child is sad, worried or says something about being hurt or unsafe, answer with gentle comfort and say: "Go and tell a grown-up you love right now, they will help you."',
    'Never say you are a human or a real person. If asked whether you are real, a robot or an AI, say warmly that you are the magic voice of Santa made by Ziggy for this call, and that the real magic of Christmas is in their heart.',
    'Never be sad, never scold, never mention a naughty list, never threaten that gifts depend on behaviour. Never use emojis, lists or stage directions: only words to be spoken.',
  ].join('\n');
}

/** What the child said, cleaned for the model: short, no markup. */
export function cleanChildText(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[<>{}[\]`*_#|\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_INPUT);
}

/** Santa's reply, ready to speak: one paragraph, no markup, short. */
export function cleanReply(raw: string): string {
  const text = raw
    .replace(/\*[^*]*\*/g, ' ') // stage directions
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[#*_`~>[\]{}]/g, '')
    .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= MAX_REPLY) return text;
  const cut = text.slice(0, MAX_REPLY);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (end > 60 ? cut.slice(0, end + 1) : cut).trim();
}

type Msg = { role: 'user' | 'assistant'; content: string };

function toMessages(history: SantaTurn[], text: string): Msg[] {
  const msgs: Msg[] = [];
  for (const t of history.slice(-8)) {
    const content = t.role === 'child' ? cleanChildText(t.text) : cleanReply(t.text);
    if (!content) continue;
    const role = t.role === 'child' ? 'user' : 'assistant';
    if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += ' ' + content;
    else msgs.push({ role, content });
  }
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (msgs.length && msgs[msgs.length - 1].role === 'user') msgs[msgs.length - 1].content += ' ' + text;
  else msgs.push({ role: 'user', content: text });
  return msgs;
}

async function anthropic(system: string, messages: Msg[]): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    // A fast model: the child is waiting on the line.
    body: JSON.stringify({ model: process.env.SANTA_AI_MODEL || 'claude-haiku-5-5', max_tokens: 200, system, messages }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return data.content?.find((b) => b.type === 'text')?.text ?? '';
}

async function nvidia(system: string, messages: Msg[]): Promise<string> {
  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.NVIDIA_API_KEY}` },
    body: JSON.stringify({ model: process.env.NVIDIA_TEXT_MODEL || 'meta/llama-3.3-70b-instruct', max_tokens: 200, temperature: 0.7, messages: [{ role: 'system', content: system }, ...messages] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`nvidia ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

/** Providers for children's words: no provider outside these (no free tiers that train on data). */
export function santaAiReady(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.NVIDIA_API_KEY);
}

export async function santaReply(input: SantaAiInput): Promise<SantaAiResult> {
  const text = cleanChildText(input.text);
  if (text.length < 2) return { ok: false, line: 'ai.again' };
  // A flagged sentence from the child is not sent to any model.
  if (!localShield(text).ok) return { ok: false, line: 'ai.busy' };

  const system = santaSystemPrompt(input);
  const messages = toMessages(input.history, text);
  const providers = [process.env.ANTHROPIC_API_KEY ? anthropic : null, process.env.NVIDIA_API_KEY ? nvidia : null].filter(Boolean) as ((s: string, m: Msg[]) => Promise<string>)[];
  for (const call of providers) {
    try {
      const reply = cleanReply(await call(system, messages));
      if (!reply) continue;
      const verdict = await shield(reply, 'santa_call');
      if (!verdict.ok) return { ok: false, line: 'ai.busy' };
      return { ok: true, text: reply };
    } catch {
      /* next provider */
    }
  }
  return { ok: false, line: 'ai.busy' };
}

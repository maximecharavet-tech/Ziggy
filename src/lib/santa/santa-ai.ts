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

/** One OpenAI-compatible chat provider (DeepSeek, NVIDIA NIM and Mistral all speak this dialect). */
type Provider = { id: 'deepseek' | 'nvidia' | 'mistral'; url: string; key: string; model: string };

/**
 * Providers for the live call, in the owner's order: DeepSeek, then NVIDIA, then
 * Mistral. Anthropic is not used. Only keys already set on the server count;
 * nothing new is configured here.
 */
export function santaProviders(env: NodeJS.ProcessEnv = process.env): Provider[] {
  const list: Provider[] = [];
  if (env.DEEPSEEK_API_KEY)
    list.push({ id: 'deepseek', url: 'https://api.deepseek.com/chat/completions', key: env.DEEPSEEK_API_KEY, model: env.SANTA_DEEPSEEK_MODEL || env.DEEPSEEK_MODEL || 'deepseek-v4-flash' });
  if (env.NVIDIA_API_KEY)
    list.push({ id: 'nvidia', url: 'https://integrate.api.nvidia.com/v1/chat/completions', key: env.NVIDIA_API_KEY, model: env.NVIDIA_TEXT_MODEL || 'meta/llama-3.3-70b-instruct' });
  if (env.MISTRAL_API_KEY)
    list.push({ id: 'mistral', url: 'https://api.mistral.ai/v1/chat/completions', key: env.MISTRAL_API_KEY, model: env.MISTRAL_MODEL || 'mistral-small-latest' });
  return list;
}

const bodyFor = (p: Provider, system: string, messages: Msg[], stream: boolean) =>
  JSON.stringify({ model: p.model, max_tokens: 200, temperature: 0.7, stream, messages: [{ role: 'system', content: system }, ...messages] });

async function complete(p: Provider, system: string, messages: Msg[]): Promise<string> {
  const res = await fetch(p.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${p.key}` },
    body: bodyFor(p, system, messages, false),
    // A fast answer: the child is waiting on the line.
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${p.id} ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

/** Streams the model's words (OpenAI-style server-sent events). */
async function* streamTokens(p: Provider, system: string, messages: Msg[], signal?: AbortSignal): AsyncGenerator<string> {
  const res = await fetch(p.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${p.key}`, accept: 'text/event-stream' },
    body: bodyFor(p, system, messages, true),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
  });
  if (!res.ok || !res.body) throw new Error(`${p.id} ${res.status}`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += value;
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const delta = (JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        /* keep-alive or partial line */
      }
    }
  }
}

/**
 * Cuts finished sentences off the front of `text` (for speaking them one by one
 * while the rest is still being written). A sentence ends with . ! ? or … and a
 * space; very short pieces ("Oh !") stay attached to the next one.
 */
export function takeSentences(text: string, minLength = 14): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  let rest = text;
  const re = /[.!?…]+["»”]?\s+/g;
  let from = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest))) {
    const end = m.index + m[0].length;
    const piece = rest.slice(from, end).trim();
    if (piece.length >= minLength) {
      sentences.push(piece);
      rest = rest.slice(end);
      re.lastIndex = 0;
      from = 0;
    }
  }
  return { sentences, rest };
}

/** Providers for children's words: no provider outside these (no free tiers that train on data). */
export function santaAiReady(): boolean {
  return santaProviders().length > 0;
}

export async function santaReply(input: SantaAiInput): Promise<SantaAiResult> {
  const text = cleanChildText(input.text);
  if (text.length < 2) return { ok: false, line: 'ai.again' };
  // A flagged sentence from the child is not sent to any model.
  if (!localShield(text).ok) return { ok: false, line: 'ai.busy' };

  const system = santaSystemPrompt(input);
  const messages = toMessages(input.history, text);
  for (const p of santaProviders()) {
    try {
      const reply = cleanReply(await complete(p, system, messages));
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

export type SantaStreamEvent = { type: 'sentence'; text: string } | { type: 'line'; line: 'ai.again' | 'ai.busy' };

/**
 * The live reply, sentence by sentence: each sentence is cleaned and checked by
 * ChildShield before it is handed out, so Santa starts talking after the first
 * sentence instead of waiting for the whole answer. A provider that fails before
 * its first sentence is replaced by the next one; a flagged sentence ends the
 * reply with a fixed line.
 */
export async function* santaReplyStream(input: SantaAiInput, signal?: AbortSignal): AsyncGenerator<SantaStreamEvent> {
  const text = cleanChildText(input.text);
  if (text.length < 2) return yield { type: 'line', line: 'ai.again' };
  if (!localShield(text).ok) return yield { type: 'line', line: 'ai.busy' };

  const system = santaSystemPrompt(input);
  const messages = toMessages(input.history, text);
  for (const p of santaProviders()) {
    let said = 0;
    let total = 0;
    const emit = async function* (raw: string): AsyncGenerator<SantaStreamEvent, boolean> {
      const sentence = cleanReply(raw);
      if (!sentence || total >= MAX_REPLY) return true;
      const verdict = await shield(sentence, 'santa_call');
      if (!verdict.ok) {
        yield { type: 'line', line: 'ai.busy' };
        return false;
      }
      said++;
      total += sentence.length;
      yield { type: 'sentence', text: sentence };
      return true;
    };
    try {
      let buf = '';
      for await (const tok of streamTokens(p, system, messages, signal)) {
        buf += tok;
        const { sentences, rest } = takeSentences(buf);
        buf = rest;
        for (const s of sentences) if (!(yield* emit(s))) return;
      }
      if (buf.trim() && !(yield* emit(buf))) return;
      if (said) return;
    } catch {
      if (said || signal?.aborted) return;
      /* next provider */
    }
  }
  yield { type: 'line', line: 'ai.busy' };
}

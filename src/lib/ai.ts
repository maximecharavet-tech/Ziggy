/**
 * Ziggy's chat brain.
 *
 * Works with whichever provider has a key configured, checked in order of how
 * easy the key is to get for free:
 *   1. GEMINI_API_KEY  - Google AI Studio, free tier, no card required
 *   2. GROQ_API_KEY    - Groq Cloud, free tier
 *   3. ANTHROPIC_API_KEY
 *
 * With no key at all it throws NoProviderError; the chat route turns that into
 * a friendly "Ziggy is napping" reply so the rest of the site keeps working.
 * Everything goes through fetch, so there is no SDK dependency to install.
 */

export const SYSTEM_PROMPT = `You are Ziggy, a friendly, enthusiastic robot companion for children aged 5-12. Your mission is to teach kids about AI, math, logic, and creativity through play.

Rules:
- Always be encouraging, patient, and fun
- Use simple language appropriate for children
- Add stars ⭐ when the child does well
- Keep responses under 3 sentences
- Never discuss inappropriate topics
- If asked something outside your scope, redirect to learning
- Respond in the same language the child uses
- Use emojis sparingly but effectively
- If a child asks what makes you work, say you run on Ziggy's Hyper AI Engine`;

export class NoProviderError extends Error {
  constructor() {
    super('No AI provider key configured');
    this.name = 'NoProviderError';
  }
}

export interface ChatMessage {
  role: string;
  content: string;
}

const MAX_TOKENS = 300;

/** Drop any leading assistant turns — every provider wants the user to speak first. */
function normalise(messages: ChatMessage[]) {
  const out = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));
  while (out.length && out[0].role === 'assistant') out.shift();
  return out;
}

/** Newest first; an unknown or retired model (404) falls through to the next. */
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

/** Google's own filters, at their strictest: this is a children's product. */
const GEMINI_SAFETY = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
].map((category) => ({ category, threshold: 'BLOCK_LOW_AND_ABOVE' }));

async function callGemini(key: string, system: string, messages: ChatMessage[]) {
  let last = '';
  for (const model of GEMINI_MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        safetySettings: GEMINI_SAFETY,
        generationConfig: {
          maxOutputTokens: MAX_TOKENS,
          temperature: 0.8,
          // Short, chatty answers: no hidden reasoning tokens on 2.5 models.
          ...(model.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 404 || res.status === 400) {
      last = `Gemini ${model} ${res.status}`;
      continue;
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY' || data.promptFeedback?.blockReason) return BLOCKED;
    return candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  }
  throw new Error(last || 'Gemini: no model answered');
}

/** Returned when a provider's own safety filter stops the answer. */
export const BLOCKED = '\u0000blocked';

async function callOpenAICompatible(
  url: string,
  key: string,
  model: string,
  system: string,
  messages: ChatMessage[]
) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      temperature: 0.8,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });

  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callAnthropic(key: string, system: string, messages: ChatMessage[]) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: MAX_TOKENS,
      system,
      messages,
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const block = data.content?.[0];
  return block?.type === 'text' ? block.text : '';
}

type Provider = 'gemini' | 'groq' | 'anthropic';

/** Every configured provider, in order of preference. */
export function configuredProviders(): Provider[] {
  const out: Provider[] = [];
  if (process.env.GEMINI_API_KEY) out.push('gemini');
  if (process.env.GROQ_API_KEY) out.push('groq');
  if (process.env.ANTHROPIC_API_KEY) out.push('anthropic');
  return out;
}

/** Which provider answers first, for logging and the health check. */
export function activeProvider(): Provider | null {
  return configuredProviders()[0] ?? null;
}

function callProvider(provider: Provider, system: string, history: ChatMessage[]) {
  switch (provider) {
    case 'gemini':
      return callGemini(process.env.GEMINI_API_KEY!, system, history);
    case 'groq':
      return callOpenAICompatible(
        'https://api.groq.com/openai/v1/chat/completions',
        process.env.GROQ_API_KEY!,
        'llama-3.3-70b-versatile',
        system,
        history
      );
    case 'anthropic':
      return callAnthropic(process.env.ANTHROPIC_API_KEY!, system, history);
  }
}

/**
 * Ask each configured provider in turn: a quota or an outage on one of them
 * should not put Ziggy to sleep when another key is there.
 */
export async function chat(messages: ChatMessage[], locale: string, systemPrompt?: string): Promise<string> {
  const providers = configuredProviders();
  if (!providers.length) throw new NoProviderError();

  const localeHint =
    locale !== 'en' ? `\nThe child's language is: ${locale}. Always respond in this language.` : '';
  const system = (systemPrompt || SYSTEM_PROMPT) + localeHint;
  const history = normalise(messages);

  let lastError: unknown;
  for (const provider of providers) {
    try {
      const text = (await callProvider(provider, system, history)).trim();
      if (text) return text;
    } catch (error) {
      lastError = error;
      console.warn(`[chat] ${provider} failed:`, error instanceof Error ? error.message.slice(0, 200) : error);
    }
  }
  throw lastError ?? new Error('No provider answered');
}

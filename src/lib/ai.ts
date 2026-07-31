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
- Use emojis sparingly but effectively`;

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

async function callGemini(key: string, system: string, messages: ChatMessage[]) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.8 },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

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
      model: 'claude-sonnet-4-20250514',
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

/** Which provider is configured, for logging and the health check. */
export function activeProvider(): 'gemini' | 'groq' | 'anthropic' | null {
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

export async function chat(
  messages: ChatMessage[],
  locale: string,
  systemPrompt?: string
): Promise<string> {
  const provider = activeProvider();
  if (!provider) throw new NoProviderError();

  const localeHint =
    locale !== 'en' ? `\nThe child's language is: ${locale}. Always respond in this language.` : '';
  const system = (systemPrompt || SYSTEM_PROMPT) + localeHint;
  const history = normalise(messages);

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

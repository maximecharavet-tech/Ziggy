import 'server-only';
import { postJson, chatText, chatUsage, ProviderError } from './http';

/**
 * DeepSeek — Ziggy's text brain: quests, stories and game content, always as
 * a JSON object (JSON mode), never as code.
 */
export const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
export const deepseekModel = () => process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-v4-flash';
export const deepseekReady = () => Boolean(process.env.DEEPSEEK_API_KEY);

export async function deepseekJson(system: string, user: string, opts: { maxTokens?: number; temperature?: number } = {}) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new ProviderError('DeepSeek not configured', 0, 'not_configured');
  const model = deepseekModel();
  const body = await postJson({
    provider: 'deepseek',
    url: DEEPSEEK_URL,
    key,
    timeoutMs: 45_000,
    body: {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.maxTokens ?? 1600,
    },
  });
  return { text: chatText(body), usage: chatUsage(body), model };
}

/** Plain chat answer (Ziggy's conversation), for the chat route's provider chain. */
export async function deepseekChat(system: string, messages: { role: string; content: string }[], maxTokens = 300) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new ProviderError('DeepSeek not configured', 0, 'not_configured');
  const body = await postJson({
    provider: 'deepseek',
    url: DEEPSEEK_URL,
    key,
    body: { model: deepseekModel(), messages: [{ role: 'system', content: system }, ...messages], temperature: 0.8, max_tokens: maxTokens },
  });
  return chatText(body);
}

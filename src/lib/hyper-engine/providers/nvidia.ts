import 'server-only';
import { postJson, chatText, chatUsage, ProviderError } from './http';

/**
 * NVIDIA API catalog (OpenAI-compatible, integrate.api.nvidia.com):
 * vision for the photo blueprint, a content-safety model for ChildShield,
 * and a text model as fallback when DeepSeek is unavailable.
 * Model ids are configurable because NVIDIA's catalog evolves.
 */
export const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
export const nvidiaReady = () => Boolean(process.env.NVIDIA_API_KEY);
export const nvidiaModels = () => ({
  text: process.env.NVIDIA_TEXT_MODEL?.trim() || 'meta/llama-3.3-70b-instruct',
  vision: process.env.NVIDIA_VISION_MODEL?.trim() || 'meta/llama-3.2-90b-vision-instruct',
  safety: process.env.NVIDIA_SAFETY_MODEL?.trim() || 'nvidia/llama-3.1-nemoguard-8b-content-safety',
});

function key() {
  const k = process.env.NVIDIA_API_KEY;
  if (!k) throw new ProviderError('NVIDIA not configured', 0, 'not_configured');
  return k;
}

export async function nvidiaJson(system: string, user: string, maxTokens = 1600) {
  const model = nvidiaModels().text;
  const body = await postJson({
    provider: 'nvidia',
    url: NVIDIA_URL,
    key: key(),
    timeoutMs: 45_000,
    body: {
      model,
      messages: [
        { role: 'system', content: `${system}\nAnswer with ONE JSON object and nothing else.` },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    },
  });
  return { text: chatText(body), usage: chatUsage(body), model };
}

/** Look at one image (data: URI) and answer as JSON. The image is not stored anywhere. */
export async function nvidiaVision(instructions: string, imageDataUri: string) {
  const model = nvidiaModels().vision;
  const body = await postJson({
    provider: 'nvidia',
    url: NVIDIA_URL,
    key: key(),
    timeoutMs: 60_000,
    retries: 1,
    body: {
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `${instructions}\nAnswer with ONE JSON object and nothing else.` },
            { type: 'image_url', image_url: { url: imageDataUri } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 700,
    },
  });
  return { text: chatText(body), usage: chatUsage(body), model };
}

/**
 * Content-safety verdict on a text (NemoGuard-style models answer with a JSON
 * like {"User Safety": "safe" | "unsafe", "Safety Categories": "..."}).
 * Returns null when the model gives no usable verdict (the local shield still applies).
 */
export async function nvidiaSafety(text: string): Promise<{ safe: boolean; categories: string } | null> {
  const model = nvidiaModels().safety;
  const body = await postJson({
    provider: 'nvidia',
    url: NVIDIA_URL,
    key: key(),
    timeoutMs: 15_000,
    retries: 1,
    body: { model, messages: [{ role: 'user', content: text.slice(0, 4000) }], temperature: 0, max_tokens: 120 },
  });
  return readSafetyVerdict(chatText(body));
}

export function readSafetyVerdict(raw: string): { safe: boolean; categories: string } | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const j = JSON.parse(m[0]) as Record<string, unknown>;
      const verdict = String(j['User Safety'] ?? j['Response Safety'] ?? j.safety ?? j.verdict ?? '').toLowerCase();
      if (verdict) return { safe: verdict === 'safe', categories: String(j['Safety Categories'] ?? j.categories ?? '') };
    } catch {}
  }
  const low = raw.toLowerCase();
  if (/\bunsafe\b/.test(low)) return { safe: false, categories: '' };
  if (/\bsafe\b/.test(low)) return { safe: true, categories: '' };
  return null;
}

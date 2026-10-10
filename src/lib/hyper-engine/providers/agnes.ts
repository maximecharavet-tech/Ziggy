import 'server-only';
import { postJson, ProviderError } from './http';

/**
 * Agnes image generation (the same API Hyper Engine's image studio uses):
 *   POST {base}/v1/images/generations
 *   { model, prompt, size, n: 1, extra_body: { response_format: "url", image: [dataURI] } }
 *   → { data: [{ url | b64_json, revised_prompt }] }
 * With a reference image the model works in "edit" mode: it keeps the
 * subject and redraws it in the requested style — photo → avatar.
 */
export const agnesBase = () => (process.env.AGNES_BASE_URL?.trim() || 'https://apihub.agnes-ai.com').replace(/\/+$/, '');
export const agnesModel = () => process.env.AGNES_IMAGE_MODEL?.trim() || 'agnes-image-2.5-flash';
export const agnesReady = () => Boolean(process.env.AGNES_API_KEY);

export async function agnesImage(prompt: string, opts: { size?: string; reference?: string } = {}) {
  const key = process.env.AGNES_API_KEY;
  if (!key) throw new ProviderError('Agnes not configured', 0, 'not_configured');
  const extra: Record<string, unknown> = { response_format: 'url' };
  if (opts.reference) extra.image = [opts.reference];
  const body = await postJson({
    provider: 'agnes',
    url: `${agnesBase()}/v1/images/generations`,
    key,
    timeoutMs: 150_000,
    retries: 2,
    body: { model: agnesModel(), prompt, size: opts.size ?? '1024x1024', n: 1, extra_body: extra },
  });
  const url = imageFromResponse(body);
  if (!url) throw new ProviderError('Agnes returned no image', 502, 'bad_response');
  return { url, model: agnesModel() };
}

export function imageFromResponse(body: unknown): string | null {
  const first = (body as { data?: Record<string, unknown>[] })?.data?.[0];
  if (!first) return null;
  if (typeof first.url === 'string' && /^https?:\/\//.test(first.url)) return first.url;
  if (typeof first.b64_json === 'string' && first.b64_json.length > 100) return `data:image/png;base64,${first.b64_json}`;
  return null;
}

import 'server-only';
import { postJson, ProviderError } from './http';

/**
 * NVIDIA NIM image generation (build.nvidia.com), used to pre-generate the
 * Mode dodo illustrations once:
 *   POST https://ai.api.nvidia.com/v1/genai/{model}
 *   text → image : black-forest-labs/flux.1-schnell { prompt, width, height, seed, steps }
 *   with a reference (keep a character identical) : black-forest-labs/flux.1-kontext-dev { prompt, image, seed, steps }
 *   → { artifacts: [{ base64, finishReason, seed }] }
 * Model ids are environment-configurable: NIM catalogues change.
 */
const BASE = 'https://ai.api.nvidia.com/v1/genai';
export const nvidiaImageModel = () => process.env.NVIDIA_IMAGE_MODEL?.trim() || 'black-forest-labs/flux.1-schnell';
export const nvidiaEditModel = () => process.env.NVIDIA_IMAGE_EDIT_MODEL?.trim() || 'black-forest-labs/flux.1-kontext-dev';
export const nvidiaImageReady = () => Boolean(process.env.NVIDIA_API_KEY);

export async function nvidiaImage(prompt: string, opts: { width?: number; height?: number; seed?: number; reference?: string } = {}) {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new ProviderError('NVIDIA not configured', 0, 'not_configured');
  const model = opts.reference ? nvidiaEditModel() : nvidiaImageModel();
  const body: Record<string, unknown> = opts.reference
    ? { prompt, image: opts.reference, aspect_ratio: 'match_input_image', seed: opts.seed ?? 0, steps: 30, cfg_scale: 3.5 }
    : { prompt, width: opts.width ?? 1344, height: opts.height ?? 768, seed: opts.seed ?? 0, steps: 4 };
  const res = await postJson<{ artifacts?: { base64?: string; finishReason?: string }[] }>({
    provider: 'nvidia',
    url: `${BASE}/${model}`,
    key,
    timeoutMs: 120_000,
    retries: 2,
    body,
  });
  const art = res?.artifacts?.[0];
  if (art?.finishReason && art.finishReason !== 'SUCCESS') throw new ProviderError(`NVIDIA image ${art.finishReason}`, 422, 'refused');
  if (!art?.base64 || art.base64.length < 200) throw new ProviderError('NVIDIA returned no image', 502, 'bad_response');
  return { url: `data:image/jpeg;base64,${art.base64}`, model };
}

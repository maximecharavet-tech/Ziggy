# Ziggy World — AI providers

Ziggy has **no local GPU** and runs no local model, no ComfyUI. All generation goes through hosted APIs,
called only from the server.

| Role | Provider | Env | Default model |
| --- | --- | --- | --- |
| Text JSON (quests, stories, Game Factory) | DeepSeek | `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` | `deepseek-v4-flash` (JSON mode) |
| Vision (photo → blueprint) | NVIDIA NIM | `NVIDIA_API_KEY`, `NVIDIA_VISION_MODEL` | `meta/llama-3.2-90b-vision-instruct` |
| Content safety (ChildShield 2nd opinion) | NVIDIA NIM | `NVIDIA_SAFETY_MODEL` | `nvidia/llama-3.1-nemoguard-8b-content-safety` |
| Text fallback | NVIDIA NIM | `NVIDIA_TEXT_MODEL` | `meta/llama-3.3-70b-instruct` |
| Images (avatars, world scenes) | Agnes AI | `AGNES_API_KEY`, `AGNES_BASE_URL`, `AGNES_IMAGE_MODEL` | `agnes-image-2.5-flash` |
| Chat (existing Ziggy chat) | Gemini → DeepSeek → NVIDIA → Groq → Anthropic | existing keys | — |

Model ids are environment-configurable because provider catalogues change; check each provider's
console for the current names.

## Behaviour without keys
- No text key: quests, stories and game questions use local hand-written content.
- No NVIDIA key: the photo path answers 503 `not_configured`; ChildShield uses the local policy only.
- No Agnes key: avatar generation answers 503; the live local preview still works.

## Mistral
The original brief targeted Mistral (Agents API image tool). The family chose DeepSeek + NVIDIA + Agnes.
Mistral can be added later as another provider in `src/lib/hyper-engine/providers/` behind the same
orchestrator contract (see MISTRAL.md).

## Real limits to know
- Provider rate limits and quotas apply (HTTP 429 → retried with backoff, then local fallback).
- Vision quality depends on the photo; "no face" returns 422 and the parent picks colours manually.
- Image generation takes several seconds (route `maxDuration` = 60 s on Vercel).
- Costs in the parent console are **estimates** (`ESTIMATED_COST` in `cost-guard.ts`), not invoices.

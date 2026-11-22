# Ziggy World — AI providers

Ziggy has **no local GPU** and runs no local model, no ComfyUI. All generation goes through hosted APIs,
called only from the server.

| Role | Provider | Env | Default model |
| --- | --- | --- | --- |
| Text JSON (quests, stories, Game Factory) | DeepSeek | `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` | `deepseek-v4-flash` (JSON mode) |
| Photo → blueprint | none: on the device (MediaPipe, `src/lib/avatar/photo-analyze.ts`) | — | — |
| Content safety (ChildShield 2nd opinion) | NVIDIA NIM | `NVIDIA_SAFETY_MODEL` | `nvidia/llama-3.1-nemoguard-8b-content-safety` |
| Text fallback | NVIDIA NIM | `NVIDIA_TEXT_MODEL` | `meta/llama-3.3-70b-instruct` |
| Images (avatars, world scenes) | Agnes AI | `AGNES_API_KEY`, `AGNES_BASE_URL`, `AGNES_IMAGE_MODEL` | `agnes-image-2.5-flash` |
| Chat (/demo, /agents: guided questions; free typing behind the grown-up gate) | Mistral (if `MISTRAL_API_KEY` is set) → Gemini → DeepSeek → NVIDIA → Groq → Anthropic (whichever keys are set) | existing keys | `mistral-small-latest` (`MISTRAL_MODEL`) |
| Santa live call | Mistral (if `MISTRAL_API_KEY` is set) → DeepSeek → NVIDIA | existing keys | — |
| Voices (Ziggy, Santa) | Fixed site sentences: Ziggy's offline voice bank (`public/voice`, no provider, `scripts/voice-bake.mjs`); other lines: Google Gemini TTS | `GEMINI_API_KEY` | — |

Model ids are environment-configurable because provider catalogues change; check each provider's
console for the current names.

## Behaviour without keys
- No text key: quests, stories and game questions use local hand-written content.
- No NVIDIA key: ChildShield uses the local policy only (the photo path needs no key: it runs on the device).
- No Agnes key: avatar generation answers 503; the live local preview still works.

## Mistral (EU first)
Children's chat text and Santa's live call prefer the EU provider: Mistral (France) answers first
whenever `MISTRAL_API_KEY` is set (`configuredProviders()` in `src/lib/ai.ts`, `santaProviders()` in
`src/lib/santa/santa-ai.ts`); without the key the order is unchanged. Ziggy World (Hyper Engine) still
uses DeepSeek → NVIDIA; Mistral can be added there behind the same orchestrator contract (see MISTRAL.md).

## Real limits to know
- Provider rate limits and quotas apply (HTTP 429 → retried with backoff, then local fallback).
- On-device photo reading is an estimate; "no face" or an unclear trait leaves that choice to the parent.
- Image generation takes several seconds (route `maxDuration` = 60 s on Vercel).
- Costs in the parent console are **estimates** (`ESTIMATED_COST` in `cost-guard.ts`), not invoices.

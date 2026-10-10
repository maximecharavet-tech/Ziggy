# Mistral (optional, not active)

Ziggy World currently uses DeepSeek, NVIDIA and Agnes (see AI_PROVIDERS.md). No Mistral key is
configured and no Mistral code path is active.

To add Mistral later:
1. Create `src/lib/hyper-engine/providers/mistral.ts` using `postJson` from `providers/http.ts`
   (text: `https://api.mistral.ai/v1/chat/completions` with `response_format: {type: 'json_object'}`;
   images: the Agents API `image_generation` tool, then download the produced file).
2. Add it to the provider list in `aiJson()` (orchestrator) and/or as an image provider next to Agnes.
3. Add `MISTRAL_API_KEY` to Vercel. Every output still passes Zod + ChildShield, so nothing else changes.

# Mistral (optional, EU first)

When `MISTRAL_API_KEY` is set on the server, Mistral (France) answers first for the chat
(`src/lib/ai.ts`) and Santa's live call (`src/lib/santa/santa-ai.ts`); the other providers stay as
fallbacks in their usual order. Without the key nothing changes. The privacy policy states this order.

Ziggy World currently uses DeepSeek, NVIDIA and Agnes (see AI_PROVIDERS.md). To add Mistral there:
1. Create `src/lib/hyper-engine/providers/mistral.ts` using `postJson` from `providers/http.ts`
   (text: `https://api.mistral.ai/v1/chat/completions` with `response_format: {type: 'json_object'}`;
   images: the Agents API `image_generation` tool, then download the produced file).
2. Add it to the provider list in `aiJson()` (orchestrator) and/or as an image provider next to Agnes.
3. Add `MISTRAL_API_KEY` to Vercel. Every output still passes Zod + ChildShield, so nothing else changes.

# Ziggy World — Security

## Keys and network
- Provider keys (`DEEPSEEK_API_KEY`, `NVIDIA_API_KEY`, `AGNES_API_KEY`, `HYPER_ENGINE_API_KEY`) are read
  only in server modules marked `import 'server-only'`. They never reach the browser.
- Every AI request goes browser → `/api/ziggy/*` → Hyper Engine → provider.
- A remote Hyper Engine must be `https://`; its answers are re-validated (Zod) and re-shielded locally.
- Avatar images returned by a provider are downloaded with `fetchImage`: https only, no IP literals,
  no localhost/internal hosts, no redirects, image types only, 5 MB cap.

## Authentication and authorisation
- Routes verify the Supabase access token server-side (`auth.getUser`), then use a client that carries
  the user's token, so **row-level security applies to every query**. No service-role key is used.
- Storage bucket `ziggy-avatars` is private; policies restrict each account to its own folder.
- AI generation requires a signed-in parent; guests get local content only.

## Input validation
- Every request body is parsed with Zod (size-capped). Children never send free text: only ids/enums.
- AI output is parsed as JSON only (`parseModelJson`), validated against strict schemas
  (`schemas.ts`) that reject markup, code, links and `javascript:`. One controlled correction is allowed,
  then local fallback. Nothing returned by a model is executed, rendered as HTML, used as SQL,
  used as a URL to call, or written to the filesystem.
- World Memory sent by a client is validated by `WorldMemorySchema`; game results are recomputed by
  the server engine (a quest only counts if it is really open and matches its game).

## ChildShield
1. Local policy (`policy.ts`): Unicode whole-word rules in FR/EN for sexual content, nudity, graphic
   violence, weapons, drugs, adult transformation, dangerous acts, personal data and self-harm.
2. Second opinion from NVIDIA NemoGuard content safety when configured.
Blocked content is replaced by local content; a SafetyEvent stores the category only.

## Abuse and cost
- In-memory rate limits per account (or IP for guests) on every route.
- CostGuard: per-account daily/monthly limits, daily image limit, platform monthly limit (env-configurable),
  counted from generation capsules.

## Logs
`[ziggy]` JSON lines: request id, operation, status, latency, provider, estimated cost, short safe code.
Never a photo, face, prompt, story text, name or email.

## Known limits
- Rate limits are per serverless instance (in memory); use a shared store (e.g. Upstash) for strict global limits.
- The local word lists are a first line of defence, not a guarantee; the NVIDIA safety model and the
  fallback-to-local design cover the rest.

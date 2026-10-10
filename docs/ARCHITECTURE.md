# Ziggy World — Architecture

```
ZIGGY CLIENT (Next.js pages under /[locale]/monde)
   │  fetch /api/ziggy/*  (Bearer = parent's Supabase session, optional for guests)
   ▼
HYPER ENGINE API (src/app/api/ziggy/*)          ← auth, rate limit, Zod body validation
   ▼
HyperEngineClient (src/lib/hyper-engine/client.ts)
   │  remote Hyper Engine (HYPER_ENGINE_API_URL) if set, else embedded
   ▼
ZIGGY ORCHESTRATOR (src/lib/hyper-engine/orchestrator.ts)
   │  CostGuard → GenerationCapsule → provider → JSON parse → Zod (1 correction) → ChildShield
   ▼
AI PROVIDERS  DeepSeek (text JSON) · NVIDIA (vision, safety, text fallback) · Agnes (images)
   ▼
VALIDATION   schemas.ts (strict JSON) + safety/child-shield.ts (+ NVIDIA NemoGuard)
   ▼
ZIGGY WORLD  deterministic engines (quests, learning, story, companions, magic moments)
```

Any failure at any step falls back to **local, hand-written, deterministic content**.
The site works fully with no AI key at all.

## Principle: the engine decides, the AI proposes

The **Adaptive Quest Engine** (`src/lib/world/engine.ts`) is pure and deterministic.
It chooses the world, quest, game, difficulty, companion, reward and story progression
from the World Memory. The AI may only *narrate* (quest text, stories) or *propose
questions* that pass the Game Factory schema. Rewards always come from the engine.

## Modules

| Area | Files |
| --- | --- |
| Content contracts | `src/data/types.ts`, `src/data/worlds.ts` (20 worlds × 6 quests), `src/data/companions.ts` (8) |
| Arcade (20 games, 10 mechanics) | `src/lib/arcade/*`, `src/components/arcade/*` (Phaser runner) |
| Adaptive learning | `src/lib/learning/adaptive.ts` — skillScore (EMA), masteryEstimate (BKT-lite), difficulty 1–5, streak |
| World Memory | `src/lib/world/memory.ts` (schema, merge), `store.ts` (device + sync), `server-state.ts` |
| Quest engine + Magic Moments | `src/lib/world/engine.ts` |
| Gamification | `src/lib/world/gamification.ts` — XP/levels, badges, unlocks, daily bonus |
| Companion state machine | `src/lib/world/companion.ts` — IDLE/HAPPY/THINKING/EXCITED/SAD/CELEBRATE |
| Story engine | `src/lib/story/engine.ts` (world chapters), `local-story.ts`, `choices.ts` (Story Builder) |
| Hyper Engine | `src/lib/hyper-engine/*` — providers, orchestrator, client, CostGuard, capsule, schemas, auth |
| Safety | `src/lib/safety/policy.ts`, `child-shield.ts`, `events.ts` |
| Avatar | `src/lib/avatar/prompt.ts` (enum-only prompt), `fetch-image.ts` (SSRF-safe download) |
| Logs | `src/lib/analytics/log.ts` — request id, operation, status, latency, cost; no personal data |

## API routes

| Route | Auth | Purpose |
| --- | --- | --- |
| `POST /api/ziggy/avatar/analyze` | parent + photo consent | photo → VisualBlueprint (zero retention) |
| `POST /api/ziggy/avatar/generate` | parent | blueprint → image → private storage |
| `GET/DELETE /api/ziggy/avatar` | parent | list (signed URLs) / delete |
| `POST /api/ziggy/quest/generate` | optional | quest narration |
| `POST /api/ziggy/story/generate`, `GET/DELETE /api/ziggy/story` | optional / parent | Story Builder + library |
| `POST /api/ziggy/game/content` | optional | Game Factory content |
| `POST /api/ziggy/game/result` | optional | adaptive update, rewards, story, Magic Moments |
| `GET /api/ziggy/worlds` | public | 20 worlds, localised |
| `GET/POST /api/ziggy/progress` | parent | World Memory sync (merge, never loses progress) |
| `POST /api/ziggy/companion/reaction` | public | state machine step + pre-written line |
| `DELETE /api/ziggy/privacy/photo` | parent | delete photo-derived avatars, revoke consent |
| `GET/POST /api/ziggy/parent/consent`, `GET /api/ziggy/parent/overview`, `DELETE /api/ziggy/parent/data` | parent | parent console |

## Data (Supabase, RLS on every table)

Migration `supabase/migrations/20261010000000_ziggy_world.sql`: `ziggy_world_state`,
`ziggy_consents`, `ziggy_avatars`, `ziggy_stories`, `ziggy_generations` (capsules, TTL 30 days),
`ziggy_safety_events`, private bucket `ziggy-avatars` (own folder only). All rows cascade on account deletion.

## Generation capsule

Each AI call creates a `ziggy_generations` row: `QUEUED → PROCESSING → VALIDATING → COMPLETED | FAILED`,
`EXPIRED` after `expires_at` (marked by `ziggy_expire_generations()`). It stores operation, provider,
world, scene, safety status, estimated cost and latency — never prompts, photos or outputs.
Provider HTTP calls retry 408/425/429/5xx and network errors with exponential backoff + jitter.

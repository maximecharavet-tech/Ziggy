# Ziggy World — Privacy by design

## Photos: zero retention
- The photo path is optional, parent-initiated and requires an explicit `photo_avatar` consent
  (`ziggy_consents`), checked server-side before any processing.
- The browser downscales the photo (≤1024 px JPEG). The server holds it **only in request memory**
  while NVIDIA's vision model returns a `VisualBlueprint` of enums (hair, skin tone, eyes, glasses,
  freckles). No identity, age, ethnicity, emotion or health inference is requested or accepted.
- The photo is never written to disk, database, storage or logs, and **never sent to the image
  generator**. Agnes receives only a text prompt built from enums (`avatarPrompt`), always describing a
  young child, modestly dressed, in a cartoon style.
- `DELETE /api/ziggy/privacy/photo` deletes photo-derived avatars (rows + files) and revokes consent.

## What is stored
| Data | Where | Retention |
| --- | --- | --- |
| World Memory (progress, skills, choices) | device localStorage; `ziggy_world_state` when signed in | until deleted |
| Avatars (image + enum blueprint) | private bucket + `ziggy_avatars` | until deleted |
| Stories | `ziggy_stories` | until deleted |
| Generation capsules (no content) | `ziggy_generations` | marked EXPIRED after 30 days; deletable |
| Safety events (category only) | `ziggy_safety_events` | deletable |

Everything cascades when the parent account is deleted.

## Parent controls (`/monde/parents`)
Progress, skills (learning only — no psychological profile or diagnosis), consents, AI usage and
estimated cost, what the shield blocked, recent generations, and deletion of avatars, stories,
progress, AI history or everything.

## No manipulation
No public leaderboard, no comparison between children, no loot boxes, no countdowns, no loss when a
day is skipped. The daily adventure is a small bonus. Wrong answers are never shown as failure.

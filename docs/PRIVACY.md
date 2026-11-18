# Ziggy World — Privacy by design

## Photos: never leave the device (since 2026-11-18)
- The photo path is optional and parent-initiated: behind the grown-up gate (`SantaGate`), with an explicit
  consent tick (stored as `photo_avatar` in `ziggy_consents` when signed in; for the visit only otherwise).
  Reading needs no account (nothing is uploaded); creating the image does.
- The photo is read **in the browser** by MediaPipe Tasks Vision (Apache-2.0, self-hosted models:
  `public/avatar/mediapipe/face_landmarker.task` and the booth's `selfie_multiclass_256x256.tflite`):
  `src/lib/avatar/photo-analyze.ts` → `traitsFromFrame` (`src/lib/avatar/photo-traits.ts`, pure, tested).
  It returns only enums (hair colour and length, headscarf, skin tone, eye colour, glasses); hairstyle
  texture and freckles are never guessed and stay for the parent/child to pick. The decoded pixels are
  wiped afterwards. MediaPipe's usage logger is answered locally (`blockMediapipeLogging`).
- No photo is sent to Ziggy's server or to any AI provider. `POST /api/ziggy/avatar/analyze` is retired
  (always 410, body never read). The NVIDIA vision path was removed.
- Agnes receives only a text prompt built from enums (`avatarPrompt`), always describing a young child,
  modestly dressed, in a cartoon style. The enum blueprint (including skin tone) is stored with the avatar.
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

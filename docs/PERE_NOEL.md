# L'appli du Père Noël (`/pere-noel`)

Seasonal product for Christmas 2026: children write their letter to Santa, get a
call from Santa, and take a photo (and a short video) with him. Paid by parents.

## Owner decisions (2026-11-07)
- **Call**: a guided call by default (scripted, Santa's cached voice, reacts to the
  child's answers detected on the device), **plus** a live AI call (Pack magique only)
  that a parent switches on explicitly after reading what it does. This is an
  owner-approved exception to the CLAUDE.md line "no free LLM chat for children", with
  these safeguards: parent consent on the device, the child's voice is transcribed **on
  the device** (only the text reaches the server), every reply passes ChildShield,
  short replies, Santa never asks for personal data, never claims to be a human, a
  minute cap per pass, nothing stored.
- **Photo**: montage **on the device** (MediaPipe selfie segmentation, Apache-2.0). The
  child's picture never leaves the device. Backdrops are code-built 3D scenes.
- **Payment**: Stripe Checkout (test mode until the owner creates the account and adds
  `STRIPE_SECRET_KEY` + `SANTA_PASS_SECRET` to Vercel). One-time payment, no subscription.

## Offer
| | Free | Pack Noël 4,99 € | Pack magique 9,99 € |
|---|---|---|---|
| Letter to Santa + printable letter | ✓ | ✓ | ✓ |
| Short voice message from Santa (with the first name) | ✓ | ✓ | ✓ |
| Photo with Santa | 1, watermarked | unlimited, HD, video | unlimited, HD, video |
| Guided calls (3 stories) | first minute | unlimited | unlimited |
| Live AI call with Santa | | | 20 min in total |
| Children | 1 | 3 | 3 |
Valid until 31 January 2027. Bought by a parent behind the grown-up gate.

## Architecture
- Pages: `src/app/[locale]/pere-noel/` — `page.tsx` (village hub), `lettre/`, `appel/`,
  `photo/`, `parents/`, `merci/` (Stripe return).
- Shared: `src/lib/santa/` (types, device store, pass client), `src/data/santa/`
  (gift catalogue, proud moments, call scripts, voice lines).
- 3D: `src/games3d/santa/` — code-built Santa, village / call / booth scenes.
- Photo booth: `src/components/santa/booth/`.
- Server: `src/app/api/santa/` — `checkout`, `pass`, `status`, `voice` (cached Santa
  voice lines by id, and first-name clips), `chat` (live AI call, pass + consent).
- Pass: after Stripe Checkout, the server verifies the session with Stripe and sets a
  signed HttpOnly cookie (HMAC, `SANTA_PASS_SECRET`). A restore link
  (`/pere-noel/merci?session_id=…`) re-verifies it on another device. No account needed.

## Data and privacy
- On the device only: first names, ages, wish lists, proud moments, drawings, photos, videos.
- Server: the first name alone, to fetch Santa saying it (cached clip, not logged).
  Live AI call: the transcribed text of the child's sentence, for the reply only;
  nothing stored. Stripe: the parent's payment and email (receipt).
- No tracking pixel (TikTok ads are measured with the campaign link and Stripe sales).

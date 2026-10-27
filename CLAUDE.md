# Ziggy — notes for Claude Code

Shared, checked-in memory for everyone (human or Claude) working on this repo.
When Claude gets something wrong here, add one line to "Lessons learned" so it
never happens twice (Boris Cherny's rule: CLAUDE.md grows from mistakes).

## What this is
Kids' learning site (4–12 y/o), ziggy-ai.fr. Next.js 15 App Router, React 19,
TypeScript strict, Tailwind v4, framer-motion, next-intl (12 locales, `fr`
default without prefix, `ar` RTL), Supabase (project `idoynasiaufymzuwnfpe`),
Vercel (deploys `main`), three.js for 3D, Vitest.

## Verify your work (most important)
Never call something done without a feedback loop:
- `npm run check` = `tsc --noEmit` + `eslint .` + `vitest run` — must be green.
- UI change → look at it: production build + Playwright screenshots at
  1280×800 and 390×844 (see `/smoke`). No page errors, no horizontal overflow,
  no hydration error (also with `reducedMotion: 'reduce'`).
- 3D change → render it (Playwright + SwiftShader, see `.claude/agents/verify-app.md`).
- AI content (Hyper Engine) → schema + `src/lib/hyper-engine/verify.ts` + ChildShield.

## Child-safety red lines (never cross)
No ads, no tracking, no purchase by a child, no manipulative mechanics, no
guilt streaks, no failure screens, Ziggy and companions are never sad, the AI
never claims to be human, no free LLM chat for children, every AI text goes
through ChildShield, no child image/voice/data to third parties, no invented
data (reviews, user counts, partners). GDPR for minors.

## Code rules
- Every visible text exists in FR + EN (`tr()` / `L` from `@/lib/i18n-text`); little ones can't read: keep read-aloud (`SayButton`, `useAutoSay`).
- Reduced motion: import `useReducedMotion` from `@/lib/use-reduced-motion`, never from framer-motion (hydration mismatch).
- Big tap targets (≥ 56–64 px for game answers). Animate transform/opacity only.
- Licences: MIT / Apache-2.0 / BSD only (ISC needs the owner's OK). Never GPL/AGPL/LGPL/MPL/NC in the shipped code. List new ones in `THIRD_PARTY_LICENSES.md`.
- Zero new running cost: prefer code-built assets and offline pre-generation.
- The real Ziggy = the felt plush of `public/mascot/*`: 2D uses `MascotCutout`/`ZiggyAvatar`, 3D uses `<Ziggy3D>` (max one per page) or `makeZiggy()` in game scenes.

## Workflow
- Plan first for anything non-trivial; then implement; then verify.
- Commits end with the `Co-Authored-By` / `Claude-Session` trailers given by the session. No model names in commits or PRs.
- Deploy = fast-forward `main` after `/verify` + `/smoke` (see `/deploy`). Only when the owner asks.

## Lessons learned
- `next dev` rewrites `tsconfig.json` and `next-env.d.ts`: run `git checkout tsconfig.json` before committing; keep `next-env.d.ts` on `./.next/types/routes.d.ts`.
- Several dev servers at once: give each its own `NEXT_DIST_DIR=.next-<name>` and port; never `rm -rf .next` while another one runs.
- `src/lib/motion.ts` holds shared motion tokens (no `'use client'`): don't overwrite it, add new hooks in their own files.
- Never touch Supabase project `awvgmkoozerfggdvvubi` (another product's data).
- Projected decals on a curved mesh must be tessellated first (big flat triangles sink into the surface).
- The sandbox speed test can fail when the machine is overloaded; rerun it alone before blaming the code.

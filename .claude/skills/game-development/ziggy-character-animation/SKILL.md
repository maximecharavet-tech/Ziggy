---
name: ziggy-character-animation
description: Animating Ziggy, the three felt elves (Pépin, Grelotte, Noisette) and Santa in three.js: rigs, poses, clips, faces and lip sync. Use when adding or changing a character's motion, expression or mouth.
---

# ziggy-character-animation

Project rules: `CLAUDE.md`. Designs: `docs/GAME_DESIGN_LUTINS.md`. Architecture: `docs/GAME_ARCHITECTURE.md`. Assets: `docs/ASSET_PIPELINE.md`. Technology decisions: `docs/TECHNOLOGY_REGISTRY.md`, `docs/LICENCE_AUDIT.md`.

## The characters
- Ziggy = the felt plush of `public/mascot/*`: 3D `makeZiggy()` / `<Ziggy3D>` (max one per page), 2D `MascotCutout` / `ZiggyAvatar`.
- Elves: `makeElf(id)` in `src/games3d/lutins` (rig: `setPose`, blink, breathe), bible `src/data/lutins/bible.json` — never change their look without updating the bible and re-rendering `public/lutins/refs` (`node scripts/lutins-refs/render.mjs`).
- Santa: `src/games3d/santa` (`setTalk`, `setExpression`).

## Rules
1. Procedural rigs for secondary motion (breathing, bounce, squash & stretch); state changes (idle → walk → cheer) as three.js `AnimationClip`s built in code and blended with `AnimationMixer` (MIT, adopt). No Spine, no Rive editor, no Cocos (licence/cost).
2. **Never sad.** Allowed expressions: idle, happy, laugh, surprise, listen, wink, wave, cheeky. A mistake → a hint pose or the elf takes the blame laughing; no failure animation.
3. Faces: drive mouths through the `FaceAnimator` interface (`src/lib/face`): `WebFallbackAnimator` live from audio (free, everywhere) or `PrecomputedTrackAnimator` for baked tracks (`ziggy-face-track` v1, validated by `track.ts`). Mapping helpers per character in `src/lib/face/mapping.ts`. Emotion labels outside the allowed set become a smile.
4. Audio2Face-3D (NVIDIA) only as an **offline bake** on a GPU box for fixed lines (plan: `research/nvidia/offline-bake.md`); never a runtime dependency.
5. Animate transform/opacity only; respect `useReducedMotion` from `@/lib/use-reduced-motion` (never framer-motion's): calmer idles, no camera shake.
6. No text-to-motion models trained on SMPL/AMASS (non-commercial data).
7. Render-test every change (Playwright + SwiftShader, 1280×800 and 390×844, also with `hardwareConcurrency` forced to 8).

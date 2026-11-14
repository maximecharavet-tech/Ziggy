---
name: ziggy-phaser-expert
description: Phaser 4 for a Ziggy 2D game prototype (only if a 2D physics/tilemap genre is chosen). Use when writing or reviewing Phaser code in this repo.
---

# ziggy-phaser-expert

Project rules: `CLAUDE.md`. Designs: `docs/GAME_DESIGN_LUTINS.md`. Architecture: `docs/GAME_ARCHITECTURE.md`. Assets: `docs/ASSET_PIPELINE.md`. Technology decisions: `docs/TECHNOLOGY_REGISTRY.md`, `docs/LICENCE_AUDIT.md`.

Phaser 4.2 (MIT). Official skills are vendored, read the one for the subsystem before coding:
`vendor/phaser-<name>/SKILL.md` (scenes, scale-and-responsive, input-keyboard-mouse-touch, loading-assets, sprites-and-images, animations, tweens, graphics-and-shapes, render-textures, text-and-bitmaptext, particles, filters-and-postfx, cameras, groups-and-containers, time-and-timers, events-system, audio-and-sound, physics-arcade, tilemaps, curves-and-paths, actions-and-utilities, v4-new-features, game-object-components, game-setup-and-config). Upstream links `../<skill>/` mean `../phaser-<skill>/`.

## Rules
1. Phaser **4** APIs only (render nodes, Filters instead of FX/masks, new tint modes); never paste Phaser 3 snippets.
2. Mount in a `'use client'` component with a lazy `import('phaser')`; `game.destroy(true)` on unmount.
3. Scale `FIT` (or `EXPAND`) + `autoCenter: CENTER_BOTH`, parent with a defined size; test 1280×800 and 390×844.
4. Create colliders, keys and handlers in `create()`, never in `update()`; clean listeners on scene `shutdown`.
5. Code-built art: `Graphics` → `generateTexture`, `RenderTexture`. No downloaded sprite packs without a licence entry.
6. Text from `tr()` (FR+EN), `resolution: devicePixelRatio`, `setRTL()` for Arabic; read-aloud lives in the React overlay.
7. Audio only after a user gesture, honour the site mute; Arcade physics (not Matter) unless proven necessary.
8. Expose `window.__phaserGame` only in test builds, for state injection.

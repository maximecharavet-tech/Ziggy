# Asset pipeline and Asset Manager

Status: first version, 2026-11-09 (game R&D lab). Code: `src/lib/assets/` (types, registry,
validator, tests). Data: `src/data/assets/manifest.json`. Read with `docs/GAME_ARCHITECTURE.md`.

Principles (CLAUDE.md): **code-built first**, **zero running cost** (offline generation only,
everything self-hosted, no CDN or API at play time), **allowed licences only** (MIT /
Apache-2.0 / BSD, our own work; ISC / Zlib / Unicode-3.0 / CC-BY-4.0 only with the owner's
written OK), **no child image, voice or data** in any asset or tool, and the real Ziggy is
the felt plush (`public/mascot/*`, `makeZiggy()`).

---

## 1. The registry: one entry per asset

Every asset a game or page ships (a served file **or** a code-built model/material/sound) has
one entry in `src/data/assets/manifest.json`:

```jsonc
{
  "schemaVersion": 1,
  "assets": [
    {
      "id": "lutins.ref.pepin",                  // unique, stable, dot-separated lowercase
      "type": "image",                           // see the type list below
      "format": "png",                           // = file extension
      "resolution": { "width": 1024, "height": 1024 },   // required for image/texture/spritesheet/video
      "version": "1.0.0",                        // semver of THIS asset; bump on any change
      "licence": "LicenseRef-Ziggy",             // SPDX id (allowed list below)
      "licenceApproval": "…",                    // only for ISC / Zlib / Unicode-3.0 / CC-BY-4.0
      "copyright": "© Ziggy",
      "description": "Turnaround of Pépin: front, 3/4 and back (image-AI reference).",
      "location": { "kind": "public", "path": "/lutins/refs/pepin.png" },   // or { kind: "source", path: "src/…" }
      "dependencies": ["lutins.model.pepin"],    // what it needs / was made from
      "source": {                                // how it was made
        "kind": "render-script",                 // code | render-script | ai-bake | download | npm-copy | build | owner-artwork
        "script": "scripts/lutins-refs/render.mjs",
        "tool": "three.js 0.186 + Playwright Chromium (SwiftShader)",
        "origin": "https://…",                   // required for download / npm-copy
        "notes": "layout=turnaround&elf=pepin, 1024×1024, ss=2"
      },
      "tags": ["lutins", "reference"]
    }
  ]
}
```

| Field | Rule (enforced by `validate.ts`) |
|---|---|
| `id` | `^[a-z0-9-]+(\.[a-z0-9-]+)+$`, unique. Convention `<universe>.<kind>.<name>`: `lutins.model.pepin`, `chaos.room.kitchen`, `factory.voice.fr.l2-letter`. Never reuse an id for something else. |
| `type` | `image, texture, code-model, model, code-material, animation-clip, spritesheet, audio, code-audio, voice, face-track, ml-model, wasm, script, data, font, video` |
| `format` | `png, webp, jpg, svg, avif, ktx2, glb, json, ts, js, wasm, tflite, onnx, mp3, ogg, wav, woff2, mp4, webm`; must match the file extension. |
| `resolution` | positive integers ≤ 8192; required for picture types. |
| `version` | SemVer 2.0.0 (`1.2.0`, `2.0.0-beta.1`). Major = looks different / breaking (new ids in a sheet), minor = improved, patch = re-encode. |
| `licence` | `LicenseRef-Ziggy` (our own: code-built, rendered from our code, owner artwork, our offline bakes from an allowed model), `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `CC0-1.0`, `LicenseRef-PublicDomain`. Owner-approval list: `ISC`, `Zlib`, `Unicode-3.0`, `CC-BY-4.0` (needs `licenceApproval`). **Everything else fails** (GPL, AGPL, LGPL, MPL, any NC/ND, "free for personal use", unknown). |
| `location` | `public`: path starting with `/` under `public/` (no `..`, no scheme). `source`: repo path of the code or data file. **No remote location exists**: everything is self-hosted. `provisionedBy`: a file copied/downloaded at install time (gitignored); the validator checks the script and only warns if the file is absent. Code types (`code-model`, `code-material`, `code-audio`) must be `source`. |
| `dependencies` | ids that exist; no self-dependency; no cycle. Used for load order (`assets.loadOrder(id)`) and "what to re-render when X changes" (`assets.dependents(id)`). |
| `source` | `download` / `npm-copy` need `origin`; `script` must exist in the repo. |

### Using the registry in code

```ts
import { assets } from '@/lib/assets/registry';

assets.url('lutins.avatar.pepin');           // "/lutins/refs/avatars/pepin.png?v=1.0.0" (version busts caches)
assets.loadOrder('lutins.ref.sheet');        // deps first: bible, materials, models, then the sheet
assets.byTag('ml');                          // all on-device ML models
assets.get('lutins.model.pepin').location;   // { kind: 'source', path: 'src/games3d/lutins/elf.ts', exportName: 'makeElf' }
```

Games and level files reference assets **by id**, never by hard-coded path; the level
validator checks that every referenced id exists.

### Tests (`src/lib/assets/registry.test.ts`, part of `npm run check`)

Unique ids; allowed licences only (approval licences carry an approval); semver versions;
every local file exists (`public/…` or the source path) and every producing script exists;
format = extension; dependencies exist and are acyclic; plus unit tests that the validator
rejects GPL/MPL/NC licences, bad versions, duplicate ids, remote or `..` paths, missing files,
missing origins and cycles.

---

## 2. What is in the manifest today (43 entries)

| Group | Ids | Licence | Source |
|---|---|---|---|
| Ziggy 3D | `ziggy.model`, `ziggy.rig`, `ziggy.material.felt`, `ziggy.face.embroidery` | LicenseRef-Ziggy | code (`src/games3d/ziggy/*`) |
| Ziggy plush artwork | `mascot.*` (12 images: cut-outs, scene photos, posters, OG) | LicenseRef-Ziggy | owner artwork (`public/mascot/*`) |
| Elves 3D | `lutins.model.{pepin,grelotte,noisette}`, `lutins.material.craft`, `lutins.bible` | LicenseRef-Ziggy | code + bible JSON |
| Elves references | `lutins.ref.{sheet,sheet-34,pepin,grelotte,noisette}`, `lutins.avatar.{pepin,grelotte,noisette}` | LicenseRef-Ziggy | rendered by `scripts/lutins-refs/render.mjs` from the code models |
| Lutins wasm | `lutins.wasm.core(-glue)`, `lutins.wasm.core-full(-glue)` | MIT (our crate `rust/lutins-core`) | built by `scripts/lutins-wasm.mjs` |
| MediaPipe | `mediapipe.vision.wasm`, `mediapipe.vision.glue` (npm-copy at install, gitignored), `santa.mediapipe.selfie-segmenter`, `santa.mediapipe.selfie-multiclass`, `lutins.mediapipe.efficientdet-lite0` | Apache-2.0, © Google LLC | downloaded / copied |
| Santa 3D | `santa.model`, `santa.props`, `santa.material.textures`, `santa.material.fluff` | LicenseRef-Ziggy | code |
| Kit audio | `kit.music.jingle` | LicenseRef-Ziggy (synth) over a public-domain melody (Pierpont, 1857) | code |

Found while building it (to fix outside this cell's scope):
- `public/lutins/mediapipe/efficientdet_lite0.tflite` (Apache-2.0, MediaPipe model zoo) is
  **not listed in `THIRD_PARTY_LICENSES.md`**; it should be added next to the selfie models.
- The MediaPipe wasm runtime is not committed (copied by `postinstall`); the manifest marks it
  `provisionedBy: scripts/santa-mediapipe.mjs`.

---

## 3. Production pipeline

```
 design brief ──► 1. code-built (default) ──► 2. offline render/bake (optional) ──► 3. optimise ──► 4. register ──► 5. validate ──► 6. ship
```

### 3.1 Code-built 3D first (default for everything)

- Characters, props, rooms, machines are three.js `Group` factories (origin on the ground,
  facing +Z, like `kit/models.ts`), with felt/knit materials from `ziggy/felt.ts` and
  `lutins/craft.ts`, canvas textures generated at runtime (256–512 px, cached), and a
  `lowPower` option.
- Registered as `code-model` / `code-material` with `location.kind = 'source'` and
  `exportName`. Version bumps when the look changes (and then every render that depends on it
  is re-rendered: `assets.dependents(id)`).
- Why: zero download, zero licence risk, perfect consistency (the elves in games = the elves
  in the reference sheets = the elves in the AI photos), easy variation by code.

### 3.2 Offline renders from our code (render scripts)

- Pattern: `scripts/lutins-refs/render.mjs`: esbuild bundles the scene, Playwright Chromium
  with SwiftShader renders it, supersampled, deterministic ("same code, same pictures").
- Uses: reference sheets, avatars, HUD portraits, **spritesheets** of elves' gags for 2D UI,
  album photo frames, store/OG images, baked ambient-occlusion/lightmaps for static rooms
  (vertex colours preferred).
- Output licence: `LicenseRef-Ziggy`, `source.kind = 'render-script'`, `dependencies` = the
  code models used.

### 3.3 Optional offline AI bakes (never at play time)

Allowed only when **(a)** the model's code **and weights** licences are allowed (MIT /
Apache-2.0 / BSD; registry rows in `research/*/registry.md` say "adopt" or "test"), **(b)** it
runs on our machine or a rented box once (zero running cost), **(c)** no child data goes in,
**(d)** the output is reviewed by a human and, for text, passes ChildShield.

| Bake | Tool (current choice) | Output | Registry type |
|---|---|---|---|
| Voice lines (Ziggy, elves, Santa) FR + EN | `voice-engine/` (Kokoro-82M, Apache-2.0) | MP3 + word timings + visemes | `voice` (+ `face-track`) |
| Face tracks for lines | face cell's offline bake (`src/lib/face`, `PrecomputedTrackAnimator`), only with a model whose licence passes (see research/nvidia) | small JSON track | `face-track` |
| Textures (felt fibres, wallpaper, wood) | procedural code first; an AI texture model only if its weights are Apache/MIT | PNG/WebP 512–1024 | `texture` |
| Level drafts | Hyper Engine offline → schema + `verify.ts` + ChildShield → human review | level JSON | `data` |

Each bake records `source.kind = 'ai-bake'`, `source.tool` (model + version), `source.notes`
(settings, seed, date), and its licence is `LicenseRef-Ziggy` (our output) **only if** the
model licence allows owning outputs commercially; otherwise the bake is not allowed.

### 3.4 Spritesheets and animation clips

- **Spritesheets:** rendered frames packed in one WebP (power-of-two, ≤ 2048²) + a JSON atlas
  (`{ frames: { name: { x, y, w, h } }, fps }`), both registered (atlas `data` depends on the
  image).
- **Animation clips:** `ActionClip` JSON (pose targets per bone group + timing) for the code
  rigs, compiled at load into three.js `AnimationClip`s (see architecture §3.8). Registered as
  `animation-clip` (`format: json`), depending on the character's `code-model`.
- glTF (`model`, `glb`) only if an artist pipeline appears; then optimised with
  **glTF-Transform** (MIT, registry "test") at build time, never at runtime.

### 3.5 Optimisation targets

| Type | Format | Budget |
|---|---|---|
| UI images, posters | WebP (quality 80–85), PNG only when alpha + sharp edges needed | ≤ 150 KB each, ≤ 1024 px long side unless a reference sheet |
| Textures | WebP / canvas-generated | ≤ 512² on the low tier, ≤ 1024² high |
| Spritesheets | WebP | ≤ 2048², ≤ 400 KB |
| Voice | MP3 mono 64–96 kbps, EBU R128 −16 LUFS (voice-engine checks) | ≤ 40 KB per short line |
| Music | code-synthesised | 0 KB |
| ML models | as published (no re-quantisation without re-checking the licence/model card) | load only on the page that needs it |
| Per game total download (excl. three, voices streamed per line) | | ≤ 2 MB |

KTX2/Basis and meshoptimizer are not used now (registry "reject": not worth it at our sizes).

### 3.6 Register, validate, ship

1. Add or update the manifest entry (bump `version` on any change of the file or look).
2. `npx vitest run src/lib/assets` (also in `npm run check`): ids, licences, versions, files,
   dependencies.
3. Third-party asset → also add a row to `THIRD_PARTY_LICENSES.md` (name, URL, licence,
   copyright, version).
4. Files under `public/` cached by the service worker → bump `public/sw.js` `VERSION`.
5. UI check per CLAUDE.md (Playwright screenshots) when the asset is visible.

---

## 4. Asset manager roadmap (next steps, not built yet)

- `preload(ids, onProgress)` in the engine (`level.ts`) using `loadOrder`, with an in-memory
  cache of decoded textures/audio buffers, released on scene dispose.
- A generator script `scripts/assets/scan.mjs` that lists files under `public/` not in the
  manifest (orphans) and manifest entries whose dimensions differ from the file (reads PNG/WebP
  headers), run in CI as a warning.
- Optional `bytes` / `sha256` fields filled by that script to detect silent changes without a
  version bump.
- Extend the manifest to the rest of the site's assets (dodo voices, games' public files) in
  batches, once the format has been used by the two Lutins games.

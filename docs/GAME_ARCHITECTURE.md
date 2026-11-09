# Game architecture: Lutin Chaos & Lutin Factory (and the games after them)

Status: **architecture proposal, no game code yet** (2026-11-09, game R&D lab). Design:
`docs/GAME_DESIGN_LUTINS.md`. Assets: `docs/ASSET_PIPELINE.md` and `src/lib/assets/`.

Goal: one shared, tested engine layer (`src/games3d/engine/`) on top of our existing kit
(`src/games3d/kit/`) so both games, and years of content after them, are mostly **data**
(rooms, pranks, machines, toys, levels) plus small plug-ins, not 1 700-line one-off classes
like `PizzaGame.ts`.

---

## 1. Engine decision: stay on three.js + our kit

**Decision: three.js (MIT, already `^0.186.1`) + our kit, extended with `src/games3d/engine/`.
No Phaser, no Babylon for these two games.**

Inputs: the GitHub research cell's registry (`research/github/registry.md`, read on 2026-11-09:
three.js 95/100 *adopt*, AnimationMixer 91 *adopt*, Phaser 4 87 *test*, Babylon.js 82
*reject*, Rapier 87 *test*, bitECS *reject* (MPL-2.0), miniplex/koota *reject*,
three-mesh-bvh 89 *test*, ZzFX 83 *test*, inkjs 88 *test*). `research/github/REPORT.md` was
not yet written when this doc was finished; **assumption:** it will not contradict the
registry's decisions. If it does, revisit sections 1, 5 and 7 only.

| Criterion | three.js + kit | Babylon.js | Phaser 3/4 |
|---|---|---|---|
| Our characters | Ziggy (`makeZiggy` + `ZiggyRig`), the elves (`makeElf` + `ElfRig`), Santa (`makeSanta` + `SantaRig`) are **code-built three.js rigs**, the same that render the `/lutins` reference sheets: identical elves everywhere | would mean porting ≈ 4 000 lines of rigs and felt materials, and two versions of each elf | 2D only: the felt 3D elves become sprites; we lose the consistency with the photos |
| Existing games | 10 three.js games + kit, the team knows the patterns | none | one runner (Phaser 3) |
| Size on a mid phone | three tree-shaken ≈ 150–180 KB gz, already cached by the other games | heavier core | 352 KB gz (Phaser 4 min) on top of three |
| Licence | MIT | Apache-2.0 | MIT |
| What we lack | loop, scenes, input map, level loader, ECS-lite, cutscenes: all small, we write them (sections 3–9) | has more built in (GUI, inspector) | has scenes/tweens/input but not 3D |

Lutin Factory is grid-based and could be 2D, but rendering it in three.js with an
orthographic/isometric camera keeps the felt elves, shares the engine and the TV focus
code, and costs nothing extra. Phaser stays the tool for future *pure 2D* games (the
registry's "test").

**Kit chores to do first** (from the registry): `THREE.Clock` → `THREE.Timer` (r183
deprecation) in the new engine loop; don't use `PCFSoftShadowMap` (removed, falls back with a
warning): use `PCFShadowMap` / `VSMShadowMap` explicitly in `createRenderer`.

---

## 2. Layering

```
React player (src/components/games3d/LutinChaosPlayer.tsx, LutinFactoryPlayer.tsx)
  HUD, read-aloud (SayButton / speakSequence), TV focus (data-tv-*), result, MagicMoments
        ▲ events (typed)                 │ commands (typed)
        │                                ▼
Game runtime (src/games3d/lutin-chaos/*, lutin-factory/*): three.js scenes, actors, views
        ▲                                │
        │ pure state + rules             ▼
Pure logic (…/logic/*.ts): NO three.js, NO DOM. Level rules, simulation, checks, texts.
        ▲
        │ validated data
Content (src/data/games/<game>/*.json) + asset manifest (src/data/assets/manifest.json)
```

Rule kept from every existing game (`pizza/logic.ts`, `nid/logic.ts`): **everything the game
decides lives in pure modules**, tested by Vitest without WebGL. The three.js layer only
shows the state and turns taps into commands.

---

## 3. Shared engine additions: `src/games3d/engine/`

```
src/games3d/engine/
  loop.ts           FixedStepLoop: fixed-timestep simulation + interpolated rendering
  host.ts           GameHost: renderer, Post, resize, adaptive resolution, visibility, dispose
  scene.ts          GameScene interface + SceneStack (load → enter → update → exit → dispose)
  events.ts         typed Emitter: game → React events, React → game commands
  ecs.ts            ECS-lite: entities + typed component stores + systems (≈ 200 lines, ours)
  input/
    actions.ts      semantic actions (select, back, move, pan, rotate, go, hint, replay, undo)
    pointer.ts      tap / drag / pan (from kit Controls, generalised)
    keyboard.ts     key → action map (configurable, FR AZERTY + QWERTY)
    gamepad.ts      Gamepad API → actions (TV boxes, consoles)
    hotspots.ts     3D hotspots ⇄ DOM proxy buttons (TV remote, screen readers, switch scan)
  camera.ts         CameraRig: named views, smooth damp, pan limits, focus-follow, cuts when reduced motion
  tween.ts          tweens, timers and easing (lifted from PizzaGame's tasks/tweens)
  cutscene.ts       data-driven beats: say / move / cue / pose / camera / wait / sfx / parallel
  animator.ts       Animator interface over ZiggyRig / ElfRig / SantaRig + code-built clips
  face.ts           FaceAnimator (src/lib/face) → rig adapters (setMouth, cues)
  audio.ts          AudioBus: music / sfx / voice buses, ducking, synth SFX library (extends kit GameAudio)
  save.ts           versioned device-only saves (localStorage + IndexedDB) with migrations
  level.ts          level loading: JSON → schema validation → typed level → asset preload list
  replay.ts         input recording / deterministic replay + state hash
  perf.ts           frame-time probe, renderer.info budgets, quality tiers
  i18n.ts           L-typed text helpers for level data (re-exports tr / L)
  index.ts
```

### 3.1 Game loop and fixed timestep (`loop.ts`)

- **Simulation at a fixed 60 Hz** (`STEP = 1/60`) with an accumulator, max 5 substeps per
  frame (spiral-of-death guard), `dt` capped at 0.1 s like the current games.
- **Rendering every animation frame**, with `alpha = acc / STEP` for interpolation of moving
  items (Factory belts).
- Lutin Factory's simulation runs on **discrete ticks** above that (1 tile per tick, tick =
  0.5 s at ×1, 0.25 s at ×2): perfectly deterministic and steppable (the "step" button).
- Paused on `visibilitychange` and when a dialog is open; `timeScale` test hook kept (the
  existing Playwright playthroughs use it on slow software GL).
- Uses `THREE.Timer` (not the deprecated `Clock`).

### 3.2 Host and scenes (`host.ts`, `scene.ts`)

`GameHost` owns what every game re-implements today: `createRenderer` + `studioEnvironment`
(kit/look.ts), `Post` (bloom only when `!prefersLowPower()`), ResizeObserver + `fit()`, the
**adaptive resolution** of PizzaGame (drop pixel ratio by 0.15 down to 0.55 when < 24 fps),
WebGL-lost handling, and full `dispose()` (`disposeTree`, textures, audio).

```ts
interface GameScene<Cmd, Evt> {
  load(ctx: SceneContext): Promise<void>;   // build meshes, preload assets by id (registry)
  enter(ctx: SceneContext): void;
  fixedUpdate(step: number): void;          // simulation (pure state)
  update(dt: number, alpha: number): void;  // visuals, rigs, tweens
  command(c: Cmd): void;                    // from React
  exit(): void;
  dispose(): void;
}
```

A `SceneStack` swaps scenes (house map → room → album) with a soft fade. One renderer, one
canvas per game page.

### 3.3 Events and commands (`events.ts`)

Same contract as today's `PizzaCallbacks` (`onState`, `onSay`, `onRoundDone`, `onFinish`) but
typed generically: `Emitter<Events>` for game → React (`state`, `say`, `react`, `roundDone`,
`hotspots`, `finish`) and a `command()` entry for React → game. React never touches three.js
objects; the game never touches the DOM except its canvas and the hotspot layer (3.6).

### 3.4 ECS-lite (`ecs.ts`): our own, no dependency

- **Why not a library:** bitECS is **MPL-2.0 (forbidden)**, koota is ISC (needs the owner's
  OK), miniplex is fine (MIT) but the registry rejected it as not worth a dependency. Our needs
  are small.
- **Design:** `World` with numeric entity ids, **typed component stores** (`Map<Entity, T>` for
  rich components, struct-of-arrays `Float32Array` stores for hot ones like belt items),
  `query(A, B)` with cached archetype lists, and ordered **systems** (`fixedUpdate` systems for
  rules, `update` systems for visuals).
- **Where:** Lutin Factory uses it fully (hundreds of items on belts, machines, gates);
  rendering via **`InstancedMesh` per item kind** (one draw call per kind). Lutin Chaos has few
  actors (3 elves + Ziggy + ~40 interactive props per room) and uses the same `World` for props
  and hotspots, with actors as plain classes wrapping rigs.
- **Pure core:** components hold plain data; three.js objects are linked by a `View`
  component only in the runtime layer, so the simulation can run in Node tests.

### 3.5 Input abstraction (`input/*`)

Every device produces the same **semantic actions**, so game code never reads raw events:

| Action | Touch / mouse | Keyboard | TV remote | Gamepad | Switch |
|---|---|---|---|---|---|
| `select(target)` | tap | Enter / Space | OK | A | switch press on the scanned item |
| `focus(dir)` | — | arrows / Tab | D-pad | D-pad / stick | auto-scan |
| `pan(dx)` | drag / ◀ ▶ buttons | Q/D, A/D | (camera follows focus) | right stick | — |
| `rotate` | ↻ button | R | menu item | Y | menu item |
| `go` / `step` | buttons | Space / S | buttons | Start / X | menu item |
| `undo` / `back` | buttons | Z / Esc | Back | B | menu item |
| `hint`, `replay` | buttons | H / ? | buttons | LB / RB | menu item |

- **Hotspots ⇄ DOM proxies (`hotspots.ts`)**, the key accessibility decision: every tappable
  3D thing (a hiding place, a prank object, a grid tile) registers a hotspot. Each frame (when
  the camera moves) the layer projects hotspots to screen rects and positions **real
  `<button>`s** (transparent, `aria-label` in FR/EN, `data-tv-*` attributes) over the canvas.
  So: the TV remote uses our existing spatial navigation (`src/lib/tv/spatial-nav.ts` / wasm,
  `tv-step-focus.ts`), screen readers and keyboard Tab work natively, switch scanning is just
  "cycle the buttons", and tap targets get a guaranteed **≥ 64 px** hit area even when the 3D
  object is small. Raycasting stays for pointer taps on the canvas (kit `Controls`), with the
  same hotspot ids.
- Pointer: tap = up within 14 px / 450 ms of down (as kit `Controls`); drag only for pan or
  optional drag-and-drop; no multi-touch gestures.

### 3.6 Camera (`camera.ts`)

`CameraRig` with **named views** (as PizzaGame's `views`), spherical coordinates (centre,
radius, pitch, yaw), critically-damped smoothing, pan limits per room, and `focus(hotspot)`
that gently follows the TV/keyboard focus. Framing helpers reuse `lutins/framing.ts`
(`fitSphereDistance`, `orbit`). **Reduced motion:** `cut()` instead of flights, no idle drift.
Lutin Chaos: a perspective "diorama" view per room (45° FOV, 3–4 views + pan). Lutin Factory:
a low-angle orthographic/isometric view of the grid, 2 zoom levels, no free rotation.

### 3.7 Physics: none general-purpose; custom and scripted

- **Lutin Factory:** a grid simulation (discrete, deterministic). No physics at all.
- **Lutin Chaos:** slapstick is **authored** (tweens, cutscene beats, springs). Secondary
  motion (hats, braids, bells) is the rigs' existing spring system. Chain reactions are
  scripted step sequences (they must be undoable step by step, which a physics engine makes
  hard). Picking = three.js raycaster (add **three-mesh-bvh** (MIT) only if a room's picking
  costs > 1 ms).
- **Rapier** (Apache-2.0, registry "test") stays the candidate if a later game needs real
  rigid bodies (a marble-run sandbox); the cost is a ≈ 1–2 MB wasm, loaded only by that game.
  Not for these two.

### 3.8 Animation (`animator.ts`)

- **Code rigs remain the characters' animation system** (`ZiggyRig` cues `wave, cheer, jump,
  nod, oops, think, love, giggle`; `ElfRig` poses `stand, sit, wave, laugh, peek, tiptoe,
  point`; `SantaRig`). They are what makes the elves identical to the reference sheets.
- A thin **`Animator` interface** unifies them for the engine:
  `setPose(p)`, `cue(c)`, `lookAt(v)`, `walkTo` speed hint, `update(dt)`, `energy` (reduced
  motion ≈ 0.4), `face?: FaceAnimator`.
- **New poses / gags as data:** `ActionClip` JSON (pose targets per bone group + timing +
  easing), compiled to three.js `AnimationClip`s with `KeyframeTrack`s on the rig's named parts
  and played through **`AnimationMixer`** (registry "adopt": crossfades and blending for free,
  no asset files). New elf gags (tumble, hide-in-boot, ride-the-belt, bow) are added this way
  without touching `elf.ts`.
- **glTF + AnimationMixer** only for imported props if an artist pipeline ever appears (never
  for the three elves or Ziggy, to keep one source of truth).

### 3.9 Face animation hook (`face.ts`)

Uses the **`FaceAnimator` interface of `src/lib/face`** (written by the face cell):
`update(FaceInput) → FaceFrame` (jaw, visemes, happy-only emotions, expression params),
`setEmotion`, `cue`, `reset`. Two implementations: `PrecomputedTrackAnimator` (offline-baked
tracks shipped as small JSON, registered in the asset manifest as `face-track`) and
`WebFallbackAnimator` (live from the audio). Adapters already exist in `src/lib/face/mapping.ts`
(`toElfMouth`, `toZiggyMouth`, `toSantaTalk`); the engine's `face.ts` connects them to
`ElfModel.setMouth(open)`, the Ziggy mouth states and the rigs' cue system each frame while
a voice line plays. Unknown or negative emotions map to happy ones by construction.

### 3.10 Audio (`audio.ts`)

- `AudioBus` (Web Audio): **music / sfx / voice** buses, voice **ducks** music by −10 dB,
  respects the site mute (`isMuted()`), starts only after a user gesture (`unlockAudio`).
- **SFX synthesised in code** (boing, jingle, pop, whoosh, kazoo, belt hum, machine clunks):
  a small library in the style of kit `GameAudio` / the pizza audio; **ZzFX** (MIT, ~1 KB,
  registry "test") is an option for authoring SFX as parameter arrays.
- **Music:** code-synthesised loops (music box, festive workshop tune), public-domain melodies
  only (as Jingle Bells today).
- **Voice lines:** pre-generated offline by `voice-engine/` (Kokoro, Apache-2.0) per line id,
  FR + EN, with word timings + visemes; played through `@/lib/voice` (`speakSequence`), browser
  TTS fallback for missing lines and the other locales. Elves' babble is gibberish synth
  (language-free).

### 3.11 Save system (`save.ts`): device only

- **Game progress** (rooms/levels done, band variant, album photos meta, costumes, catalogue,
  sandbox layouts): `localStorage` key `ziggy:game:<gameId>:v<N>` for the small JSON
  (< 50 KB), **IndexedDB** for album thumbnails and sandbox creations. Never sent anywhere.
- **Versioned with migrations:** `{ v: 2, … }`, `migrate(v1 → v2)` functions tested in Vitest;
  unreadable data → fresh save + a note in the console (never a crash, never a scary message).
- **Learning results** go through the existing `finishExtraGame(gameId, skill, stats, ms)`
  (World Memory, `src/lib/world/play.ts`), so XP/badges/adaptive difficulty follow the
  site's existing rules (localStorage for guests; existing parent-account sync of the World
  Memory unchanged). The game itself adds no network call.
- Saved after every prank / letter / sandbox change (debounced 500 ms): stopping anytime
  loses nothing (design rule).
- `try/catch` around every storage access (private mode, quota).

### 3.12 Level data format (`level.ts`)

Content lives in `src/data/games/<game>/…json`, validated by a schema at test time and at load
time (dev). The schema is written as TypeScript types + a hand-written validator (same style
as `src/lib/assets/validate.ts`, no new dependency); a JSON Schema file is generated from it
for editors. Shared envelope:

```jsonc
{
  "schema": "ziggy.level/1",
  "game": "lutin-chaos",                // or "lutin-factory"
  "id": "chaos.kitchen",                 // unique, stable
  "version": "1.0.0",                    // semver of the content
  "title": { "fr": "La cuisine", "en": "The kitchen" },
  "season": "winter",                    // content pack
  "assets": ["lutins.model.pepin", "chaos.room.kitchen"],   // asset registry ids
  "skills": ["counting", "logic", "vocabulary"],             // LearningSkill ids
  "bands": { "little": { … }, "middle": { … }, "big": { … } }
}
```

**Lutin Chaos room** (band block):

```jsonc
{
  "layout": "kitchen-a",                 // code-built room preset id
  "views": [{ "id": "wide", "c": [0, 1, 0], "r": 7, "pitch": 0.35, "yaw": 0 }],
  "hidingSpots": [{ "id": "curtain", "at": [2.1, 0, -1.4], "hotspot": { "fr": "le rideau", "en": "the curtain" } }],
  "pranks": [
    {
      "id": "socks-in-fridge",
      "type": "move-into",                // prank type plug-in
      "culprit": "noisette",              // or "random" (seeded)
      "clues": ["footprint-tiny", "thread-hazelnut"],
      "fix": { "mechanic": "count-back", "params": { "item": "sock", "count": 4, "target": "drawer" } },
      "lines": { "spot": "chaos.kitchen.socks.spot", "fixed": "chaos.kitchen.socks.fixed" }   // voice line ids
    }
  ],
  "pickCount": 3,                         // pranks drawn from the pool (seeded remix)
  "finale": { "steps": ["rolling-pin", "flour-puff", "kettle"], "undo": "reverse-order" }
}
```

**Lutin Factory level** (band block):

```jsonc
{
  "grid": { "w": 6, "h": 4, "blocked": [[0, 3]] },
  "tray": ["belt", "shaper", "painter"],          // machines offered (plug-in ids)
  "prebuilt": [{ "machine": "chute", "at": [0, 1], "dir": "E", "locked": true }],
  "letter": { "from": "village.bear-cub", "text": { "fr": "Je voudrais une balle rouge !", "en": "I'd like a red ball!" }, "voice": "factory.l2.letter" },
  "orders": [{ "toy": "ball", "count": 1, "props": { "color": "red" } }],
  "reference": [ { "machine": "shaper", "at": [2, 1], "dir": "E", "dial": "sphere" }, … ],  // a known solution (tests)
  "ideas": [{ "kind": "max-machines", "value": 3 }]   // optional big-kid challenge, never required
}
```

Validator rules (Vitest runs them on every file): unique ids; every `L` has `fr` and `en`;
asset ids exist in the manifest; skills are `LearningSkill`s; prank types / fix mechanics /
machines / toys exist in their registries; **no `timeLimit`, `lives`, `score` or `fail` field
exists in the schema at all** (child-safety by construction); Factory `reference` solutions
**actually produce the order** when run through the pure simulator; Chaos clues **uniquely
identify** the culprit at the band's clue count; counts and numbers stay within the band caps
(≤ 5 / ≤ 20 / free).

### 3.13 Localisation (`i18n.ts`)

- All texts in data are `L = { fr, en }` (`@/lib/i18n-text`), read with `tr(l, locale)`; the 10
  other locales fall back to EN like the rest of the site; `ar` RTL only affects the React HUD
  (the canvas has no text, labels are sprites made with `labelSprite` from `L`).
- Voice line ids → baked audio per locale (`/games/<game>/voice/<locale>/<id>.mp3` + timing
  JSON, registered in the asset manifest), else TTS.
- Generated names (surprise toys) use per-language grammar tables (adjective order, gender
  agreement in French) in the pure logic, tested.

### 3.14 Accessibility (checklist enforced in review and tests)

Read-aloud everything (auto for `little`/`middle`, `readAloudOn`), 🔊 replay on every line;
hotspot DOM proxies (TV, keyboard, screen readers, switch scan); targets ≥ 64 px; one-handed
bottom-band HUD; no time pressure anywhere; colour always paired with icon/pattern;
`useReducedMotion` from `@/lib/use-reduced-motion` (never framer-motion's) passed to the game
as `reducedMotion` (camera cuts, `energy` 0.4); captions for every sound clue; contrast ≥ 4.5:1
in the HUD; the game pauses when the tab is hidden; volume per bus in the pause menu.

---

## 4. Performance budgets (mid phone = 4 cores, `prefersLowPower()` true)

| Budget | Low tier (≤ 4 cores, the sandbox default) | High tier (> 4 cores) |
|---|---|---|
| Frame rate | target 60, floor 30 fps (adaptive resolution kicks in < 24) | 60 fps |
| Frame time (CPU) | sim ≤ 2 ms, scene update ≤ 4 ms, render submit ≤ 6 ms | same, more headroom |
| Draw calls | ≤ 120 | ≤ 250 |
| Triangles on screen | ≤ 150 k | ≤ 400 k |
| GPU texture memory | ≤ 48 MB (canvas textures 256–512 px, shared) | ≤ 96 MB |
| Shadows | 1 directional, 1024² map, static props baked into vertex colour where possible | 2048² |
| Post (bloom) | off | on (`Post`) |
| Pixel ratio | cap 1.5, adaptive down to 0.55 | cap 2 |
| Game JS chunk (gz, excl. three) | ≤ 250 KB | same |
| Time to first frame (4G) | ≤ 3 s after "Play" | — |
| JS heap | ≤ 200 MB | — |

How: merge static room geometry per material (`BufferGeometryUtils.mergeGeometries`), share
materials (one felt material per colour, kit `mat()`), `InstancedMesh` for repeated things
(belt items, socks, books, baubles), elves at `lowPower` detail on the low tier, freeze
`matrixAutoUpdate` on static meshes, no per-frame allocations in systems, textures generated
once and cached per game. `perf.ts` reads `renderer.info` and a frame-time histogram in dev
and in tests. Always also test with `navigator.hardwareConcurrency = 8` forced (CLAUDE.md
lesson: the bloom path hid bugs).

---

## 5. Testing strategy

1. **Pure logic (Vitest, `npm run check`):** rules, Factory simulator, Chaos prank/clue/fix
   logic, generated texts (FR/EN, no empty string), save migrations, adaptive band selection.
2. **Content validation (Vitest):** every level/room JSON passes the validator; every
   Factory reference solution produces its order; every Chaos room is solvable in every band;
   every asset id exists (`src/lib/assets`); every voice line id has FR+EN text.
3. **Child-safety tests:** schemas contain no fail/timer/lives fields; reaction tables contain
   only happy emotions/cues; no text contains words from a "sad/scold" deny list
   (méchant, puni, perdu, raté / naughty, punished, lost, failed…).
4. **Deterministic replays (`replay.ts`):** a session = seed + band + the list of
   `(tick, action)`; the fixed-step loop + seeded `rng` (kit/rng.ts, mulberry32) make the
   final state hash reproducible. Golden replays per level run in Vitest on the pure layer
   (no WebGL) and catch rule regressions; bug reports can attach a replay string.
5. **Rendered checks (Playwright + SwiftShader, `.claude/agents/verify-app.md`):** each
   room/level at 1280×800 and 390×844, also with `reducedMotion: 'reduce'` and with
   `hardwareConcurrency` forced to 8; assert no page error, no hydration error, no horizontal
   overflow, non-blank canvas (pixel variance), `renderer.info` under the budget table, and
   hotspot buttons present and focusable (TV path: press arrows/Enter through one prank).
6. **Perf smoke:** a scripted playthrough with `timeScale` on the low tier logs frame times.
7. **Play-tests** with children per band before content scale-up (design doc §D).

---

## 6. Folder layout

```
src/games3d/engine/                 shared engine (section 3), pure parts tested
src/games3d/lutin-chaos/
  logic/                            pure: rooms, pranks, clues, fixes, finale, texts, save model
    pranks/                         prank type plug-ins (move-into, swap, recolour, flip, multiply, hide)
    fixes/                          fix mechanic plug-ins (count-back, sort, pair, order, pattern, place, path, rotate, name-it, clock)
    *.test.ts
  rooms/                            code-built room presets (kitchen-a, …) and props
  actors.ts                         elf / Ziggy actors over the Animator interface
  ChaosGame.ts                      runtime: SceneStack (house map, room, album, photo mode)
src/games3d/lutin-factory/
  logic/                            pure: grid, simulator (ticks), machines, toys, recipes, check, names
    machines/                       machine plug-ins (chute, shaper, painter, mixer, assembler, counter, sorter, loop, arm, wrapper, gate)
    toys/                           toy recipes
    *.test.ts
  workshop/                         code-built halls, machines' meshes, belt instancing
  FactoryGame.ts                    runtime: SceneStack (letter board, hall, sandbox, catalogue)
src/components/games3d/LutinChaosPlayer.tsx, LutinFactoryPlayer.tsx   React HUD (as PizzaPlayer)
src/app/[locale]/monde/3d/lutin-chaos/, lutin-factory/                routes (or /lutins/jeux/, owner's choice)
src/data/games/lutin-chaos/rooms/*.json, lines.json
src/data/games/lutin-factory/levels/*.json, toys.json, lines.json
src/data/assets/manifest.json       every asset (see ASSET_PIPELINE.md)
public/games/lutin-chaos/voice/<locale>/*.mp3 (+ .json timings), same for lutin-factory
```

three.js and the game modules are loaded with a dynamic `import()` when the child presses
Play (as every 3D player does), never during SSR.

---

## 7. Extension points (years of content)

| Extension | How | Who can add it |
|---|---|---|
| New room / level | a JSON file + (optionally) a code-built room preset + manifest entries | level designer, no engine change |
| New prank type | `definePrank({ id, apply(state), revert(state), clueHints, hotspots })` in `pranks/` | developer, ~100 lines + tests |
| New fix mechanic | `defineFix({ id, params schema, makePuzzle(band, rng), check(answer), ui })` | developer |
| New machine | `defineMachine({ id, ports, dial, tick(item, state), mesh(), elf })` | developer |
| New toy | a recipe in `toys.json` (+ optional custom mesh builder) | designer |
| Season / content pack | `packs/<season>/` with rooms/levels/props/lines + `season` field; enabled by date or by the parent | team |
| New character | bible entry → code model + rig → asset manifest → `Animator` adapter → face mapping | team (owner approval) |
| New locale voice | bake lines with the voice engine, add manifest entries | team |
| AI-assisted content (offline only) | Hyper Engine drafts level JSON offline → schema + `src/lib/hyper-engine/verify.ts` + ChildShield on all text → human review → commit. **Never generated at play time** (zero running cost, no free AI for children). | team |
| Family-made content | sandbox layouts as a local share code (copy/paste), validated by the same schema | children & parents, device only |
| New input device | add a mapper in `input/` producing the same actions | developer |
| New game | reuse `engine/` (loop, host, input, hotspots, camera, save, replay, level) | team |

Plug-in registries are plain TypeScript maps checked by tests (every id referenced in data
exists, every plug-in has FR/EN labels and an icon).

---

## 8. Integration with the site

- **Learning:** `finishExtraGame('lutin-chaos' | 'lutin-factory', skill, stats, ms)` after each
  room/letter (skills: `counting`, `addition`, `multiplication`, `logic`, `sequencing`, `shapes`,
  `colors`, `vocabulary`, `memory`, `music`); band and level caps from `maxDifficulty`,
  read-aloud from `readAloudOn`; Magic Moments via `MagicMoments`.
- **TV:** add both games to `src/lib/tv/catalog.ts`; the HUD uses `data-tv-stage`,
  `data-tv-row`, `data-tv-autofocus` and `useTvStepFocus` like PizzaPlayer.
- **Showcase:** `Games3DShowcase.tsx` entry; Ziggy 2D on the intro screen via `MascotCutout`
  (max one `<Ziggy3D>` per page; in-game Ziggy is `makeZiggy()`).
- **Service worker:** baked voice files under `public/games/**` are cached: bump `public/sw.js`
  `VERSION` when they change (CLAUDE.md lesson).

---

## 9. Build order (proposed)

1. `engine/` core: loop, host, events, input + hotspots, camera, tween, save, replay (+ tests).
2. Lutin Factory pure simulator + levels 1–3 + validator (fast to test, no art risk).
3. Lutin Chaos pure logic + kitchen room in 3 bands.
4. Runtime scenes for both vertical slices, Playwright renders, perf check on the low tier.
5. Play-tests, then content at scale (rooms 1–15, levels 4–15), voice bakes, seasons.

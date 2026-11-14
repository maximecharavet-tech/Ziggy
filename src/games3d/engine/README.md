# `src/games3d/engine`: shared game engine core

Build-order step 1 of `docs/GAME_ARCHITECTURE.md` (§3, §5, §6). Used by Lutin Chaos and Lutin
Factory, and by later games. Sits on top of the kit (`src/games3d/kit`): renderer, felt look,
`Post`, `FrameClock`, `rng`, `GameAudio`. No new dependency. three.js is used only in `host.ts`
and `demo/`.

**Import rules**
- Pure logic (`src/games3d/<game>/logic/**`, Node tests): import from `@/games3d/engine` (the
  barrel, which has no three.js) or from the single module you need (`@/games3d/engine/level`).
- Runtime (client only, behind a lazy `import()`): `@/games3d/engine/host` and
  `@/games3d/engine/audio`.
- React: `@/components/games3d/engine/GameHost` (generic wrapper).

| Module | Pure? | What it gives you |
|---|---|---|
| `loop.ts` | ✓ | `FixedStepLoop`, `DiscreteTicker`, `RafDriver`, `STEP`, `MAX_SUBSTEPS`, `MAX_FRAME` |
| `events.ts` | ✓ | `Emitter<Map>`, `GameBus<Evt, Cmd>`, `BaseGameEvents<Hud>`, `BaseGameCommands`, `SayRequest`, `RoundResult`, `Reaction` |
| `ecs.ts` | ✓ | `World`, `defineComponent`, `defineTag`, `SoAStore`, `System` |
| `input/` | ✓ maths / DOM classes | `Action` union, `keyToAction` + `createKeyMap`, `gamepadActions`, `isTap`/`toNdc`, `projectBox`/`layoutHotspots`/`checkLayout`, `HotspotLayer`, `InputRouter` |
| `camera.ts` | ✓ | `CameraRig`, `smoothDamp`, `frameForAspect`, `fitDistance`, `fitOrthoHalfHeight`, `viewPosition` |
| `tween.ts` | ✓ | `Tweener` (tweens + game-time timers), `ease` |
| `save.ts` | ✓ | `SaveStore<T>` (versioned, migrations, debounced), `MemoryStorage`, `deviceStorage` |
| `replay.ts` | ✓ | `ActionQueue`, `ReplayRecorder`, `runReplay`, `hashState`, `stableStringify`, `encodeReplay`/`decodeReplay` |
| `level.ts` | ✓ | `LevelEnvelope<B>`, `validateLevel`, `assertLevel`, `findForbiddenFields`, `isForbiddenName`, `duplicateIds`, `BANDS` |
| `i18n.ts` | ✓ | `tr`, `L`, `gameLocale`, `isL`, `checkL`, `fmt`, `joinL`, `same`, `trAll` |
| `face.ts` | ✓ | `attachFace(target)` → `FaceLink` (elf / Ziggy / Santa mouth from a `FaceAnimator`) |
| `perf.ts` | ✓ | `AdaptiveResolution`, `BUDGETS`, `checkBudget` |
| `scene.ts` | ✓ | `GameScene<Ctx, Cmd>`, `SceneStack` |
| `audio.ts` | client | `EngineAudio`, `kitBackend` |
| `host.ts` | client, three | `GameHost`, `GameDefinition`, `HostScene`, `CommandOf` |
| `demo/` | client, three | test-only demo game (cube + ball, two hotspots). No public route. |

---

## Writing a game

```ts
// src/games3d/lutin-factory/FactoryGame.ts (runtime, client only)
import type { GameDefinition, HostScene, GameHost, CommandOf } from '@/games3d/engine/host';
import type { BaseGameEvents, BaseGameCommands } from '@/games3d/engine/events';
import type { InputEvent } from '@/games3d/engine/input/actions';

type Hud = { letter: string; running: boolean };
export type FactoryEvents = BaseGameEvents<Hud> & { placed: { at: [number, number] } };
export type FactoryCommands = BaseGameCommands & { go: void; step: void };
type Host = GameHost<FactoryEvents, FactoryCommands>;

class HallScene implements HostScene<FactoryEvents, FactoryCommands> {
  readonly id = 'factory.hall';
  view = { scene: new THREE.Scene(), camera: new THREE.OrthographicCamera() };
  async load(host: Host) { /* build meshes */ }
  enter(host: Host) { host.input.hotspots.set([/* one per tile / machine */]); }
  fixedUpdate(step: number, tick: number) { /* pure simulation, e.g. DiscreteTicker.advance(step) */ }
  update(dt: number, alpha: number) { /* visuals; rig.update(dt); rig.applyTo(camera) */ }
  input(e: InputEvent) { /* e.action.type: select / focus / pan / rotate / go / step / undo … */ }
  command(c: CommandOf<FactoryCommands>) { /* c.type === 'go' … */ }
  resume() { /* covered scene is back: register its hotspots again */ }
  dispose() { /* extra cleanup; the host disposes the view.scene tree itself */ }
}

export const factoryGame: GameDefinition<FactoryEvents, FactoryCommands> = {
  id: 'lutin-factory',
  start: (host) => host.push(new HallScene()),
};
```

```tsx
// React player ('use client')
<GameHost<FactoryEvents, FactoryCommands>
  load={() => import('@/games3d/lutin-factory/FactoryGame').then((m) => m.factoryGame)}
  locale={locale}
  options={{ keymap: createKeyMap({ ' ': { type: 'go' } }), hotspotLabel: { fr: 'L’atelier', en: 'The workshop' } }}
  onReady={(h) => (hostRef.current = h)}          // hostRef.current.command({ type: 'go' })
  onEvent={(name, payload) => { /* 'hud' → setState, 'say' → speakSequence, 'result' → finishExtraGame */ }}
  style={{ position: 'absolute', inset: 0 }}
/>
```

The HUD (bottom-band buttons, speech bubble, 🔊 `SayButton`, `data-tv-*`) stays in the game's
player, as in `PizzaPlayer`. Results go to World Memory from React:
`onEvent('result', r) → finishExtraGame(r.gameId, r.skill, r.stats, r.durationMs)`.

---

## API reference

### Loop (`loop.ts`)
- `new FixedStepLoop({ fixedUpdate(step, tick), update(dt, alpha) }, { step?, maxSubSteps?, maxFrame? })`
  - `advance(rawDt)` → `{ steps, alpha, dt }`. 60 Hz steps with an accumulator, frame clamp 0.1 s,
    at most 5 steps per frame (the backlog is dropped), `alpha` for interpolation.
  - `tick` (steps since start = replay clock), `timeScale` (test hook), `paused`, `stepOnce()`,
    `resetAccumulator()`.
- `new DiscreteTicker(onTick, tickSeconds = 0.5)`: whole ticks on top of the fixed steps
  (Factory belts). `running`, `speed` (×1/×2), `advance(step)` from `fixedUpdate`, `stepOnce()`
  (the step button), `progress` (0..1 inside the tick, for smooth item motion), `reset()`.
- `new RafDriver(loop, clock = new FrameClock(), beforeFrame?)`: rAF, pauses on a hidden tab and
  drops the hidden time. Uses the kit `FrameClock` (never `THREE.Clock`).

### Events (`events.ts`)
- `Emitter<Map>`: `on`, `once`, `off`, `onAny`, `emit`, `listenerCount`, `clear`. Synchronous,
  in subscription order; emits made during a delivery are queued FIFO; a throwing listener is
  logged and the others still run.
- `BaseGameEvents<Hud>`: `hud`, `say` (`{ id, lines: L[], who, force?, kind? }`), `react` (happy
  reactions only), `result` (`RoundResult` = `finishExtraGame` arguments), `finish`, `status`, `focus`.
- `BaseGameCommands`: `pause`, `resume`, `replay`, `hint`, `music { on }`.

### ECS-lite (`ecs.ts`)
`const Pos = defineComponent<{x:number;y:number}>('Pos')`; `world.spawn([Pos, {x,y}], …)`,
`add/set/get/req/has/remove/destroy`, `query(A, B)` (creation order, cached until a structural
change; do not mutate the array), `first(…)`, `addSystem({ name, phase: 'fixed'|'update', order?, run })`,
`runFixed(step)`, `runUpdate(dt, alpha)`. Ids are never reused. `SoAStore(['x','y'])` gives
`Float32Array` columns indexed by entity for hot data.

### Input (`input/`)
- Semantic `Action`s: `select {target, ndc?}`, `focus {dir?, target?}`, `pan {dx, dy}`, `rotate`,
  `go`, `step`, `undo`, `redo`, `back`, `hint`, `replay`, `remove`, `pick {index}`. Wrapped in
  `InputEvent { action, source }` (`pointer | keyboard | gamepad | hotspot | scan | replay | ui`).
- Keyboard: `DEFAULT_KEYMAP` (arrows focus, Enter/Space select, Esc/Backspace back, H/? hint,
  L replay, R rotate, Z undo, Y redo, G go, S step, Delete remove, Q/A ◀ D ▶ pan, 1–9 pick,
  Ctrl/Cmd+Z undo). `createKeyMap(overrides)`; `null` removes a key. Text fields are ignored;
  Enter/Space on a focused button is left to the native click; arrows in TV mode are left to the
  site's spatial navigation.
- Gamepad: A select, B back, X step, Y rotate, LB hint, RB replay, Start go, D-pad / left stick
  focus, right stick pan.
- Pointer: tap = ≤ 14 px and ≤ 450 ms; drag = `pan` (px). Taps emit `select` with the hotspot id
  from your raycast: `host.input.setPick((ndc) => id | null)`.
- **Hotspots**: `host.input.hotspots.set([{ id, label: {fr,en}, at, size?, order?, disabled?, attrs? }])`.
  `at` can be a live `THREE.Vector3` (read every frame). Each hotspot gets a real transparent
  `<button>` over the canvas: `aria-label` in the current locale, ≥ 64 px, never overlapping,
  hidden when off screen or behind the camera, DOM order = `order` = Tab / screen reader / switch
  scan order. Also `upsert`, `remove`, `focus(id)`, `focusedId()`, `moveFocus(dir)`,
  `startScan(ms = 1500)` / `stopScan()`, `rects()`. The host clears the hotspots before each scene
  `enter` / `resume`: register them there.
- Pure maths for tests: `projectPoint`, `projectBox(m, centre, half, viewport)`,
  `layoutHotspots(items, viewport, { minSize, maxSize, gap })`, `checkLayout(laid)`.

### Camera (`camera.ts`)
`new CameraRig(view)`: `addView(name, {c, r, pitch, yaw})`, `goTo(name | view, { cut? })`,
`pan(dx, dz)`, `limits = { min, max }`, `follow(point | null, strength)` (lean toward the focused
hotspot), `aspect` / `fov` (set on resize: portrait screens back off via `frameForAspect`),
`update(dt)` (critically damped), `applyTo(camera)` (also sets ortho `zoom` when
`orthoBase` is set), `settled`, `reducedMotion` (every move becomes a cut).

### Tweens (`tween.ts`)
`host.tween` (game time, paused with the loop): `to(obj, {x: 1}, { duration, ease, delay, kind, onDone })`,
`vec(position, {y})`, `fade(material, 0.5, {…})`, `run(fn(k), opts)`, `after(seconds, fn)`,
`killTweensOf(obj)`, handles with `cancel()` / `finish()`. Reduced motion: `kind: 'move'` jumps to
the end, `'fade'` is shortened to 0.2 s. Animate transform / opacity only.

### Saves (`save.ts`)
```ts
const save = new SaveStore<V2>({ gameId: 'lutin-chaos', version: 2, defaults, migrations: { 1: (v1) => v2 }, validate });
const data = save.load();      // never throws; migrates older versions; corrupt → defaults
save.saveSoon(data);           // debounced 500 ms; save.flush() on pagehide / dispose
```
Key `ziggy:game:<gameId>:v<N>`, value `{ v, savedAt, data }`. Storage failures fall back to memory.

### Replays (`replay.ts`)
Inputs reach the simulation only at tick boundaries: the host pushes every `InputEvent` into
`host.actions` (an `ActionQueue`) and drains it at the start of each fixed step. `host.record(game, seed, band)`
starts a `ReplayRecorder`; `host.stopRecording()` returns the `Replay`. In Vitest:
`runReplay({ create(seed, band), apply(state, action), tick(state, t) }, replay)` then
`hashState(state)`. `encodeReplay` / `decodeReplay` give a URL-safe string for bug reports.

### Levels (`level.ts`)
`validateLevel(json, { game?, knownAssets?, validateBand?(block, band, path) })` →
`{ ok, level | errors }`. Checks the `ziggy.level/1` envelope (ids, semver, FR+EN title, known
learning skills, bands `little | middle | big`, no unknown top-level field) and **rejects any
timer / lives / fail / game-over / score / penalty field at any depth, in any spelling, and any
rule `kind` / `type` / `mode` naming one** (child-safety red line). Games add their own checks in
`validateBand` (Factory reference solution, Chaos clue uniqueness, band caps) and use
`duplicateIds` for unique ids.

### Face (`face.ts`)
```ts
const face = attachFace({ kind: 'elf', elf: 'pepin', setMouth: (o) => model.setMouth(o) });
face.speak(track?);   // a voice line starts (baked track, else the live web fallback)
face.update(dt, { time, level });   // each frame while it plays
face.silence();       // mouth back to rest
```
Ziggy: `{ kind: 'ziggy', rig }` drives `rig.lipSync`; Santa: `{ kind: 'santa', setTalk }`.
Emotions are happy-only by construction (`src/lib/face`).

### Audio (`audio.ts`)
`host.audio` (an `EngineAudio` over the kit `GameAudio` by default, or pass `options.audio` = any
`{ play(name), startMusic?, stopMusic?, dispose? }`): `sfx(name)`, `music(on)`, `unlock()`.
Silent until the first gesture; honours the site mute (`isMuted()` + `ziggy:muted`); suspended
while paused or hidden.

### Host (`host.ts`)
`new GameHost<Evt, Cmd>({ canvas, container, locale, reducedMotion?, lowPower?, bloom?, keymap?, hotspotLabel?, pan?, audio?, adaptive?, fadeColor?, renderer?, exposeAs? })`
- Owns: `renderer`, `bus` (`events`, `commands`), `signals` (`scene`, `webgl`, `error`), `input`
  (`InputRouter`, with `.hotspots`), `tween`, `audio`, `loop`, `stack`, `actions`, `size`, `lowPower`.
- `push / replace / pop(scene)` (soft fade, a cut with reduced motion), `start()`, `pause()` /
  `resume()` (taps made while paused are dropped), `timeScale`, `setReducedMotion`, `setLocale`,
  `emit(name, payload)` (game → React), `command({ type, … })` (React → game: `bus.commands`
  listeners, then the top scene; `pause` / `resume` / `music` are also handled by the host),
  `studio(target)` (kit felt reflections), `onDispose(fn)`, `record` / `stopRecording`, `dispose()`.
- Each frame: gamepad poll → fixed steps (actions drained, then `scene.fixedUpdate`) → tweens →
  `scene.update` → hotspots repositioned from `view.camera` → render (`Post` bloom only when
  `!lowPower`, else direct). Perspective cameras get their aspect set on resize. Adaptive
  resolution drops the pixel ratio by 0.15 (down to 0.55) under 24 fps.
- `exposeAs: '__engine'` (test harnesses only) puts the host on `window` for state injection.

### Scenes (`scene.ts`)
`GameScene<Ctx, Cmd>`: `id`, `view?: { scene, camera }`, `load?(ctx)`, `enter(ctx)`,
`fixedUpdate?`, `update?`, `command?`, `input?`, `resize?`, `render?(renderer)`, `pause?`,
`resume?`, `exit?`, `dispose?`. `SceneStack` serialises operations, loads the next scene before
the old one leaves, disposes a scene whose `load` throws, and only drives the top scene.

---

## Tests and checks
- `npx vitest run src/games3d/engine`: loop determinism, scene lifecycle (mock renderer), event
  bus typing and ordering, ECS queries, input mapping, hotspot projection and layout (no
  overlap, min size, both test viewports), save migrations and corrupt storage, replay
  determinism, level validator (red-line fields), tweens and camera.
- Rendered check: the demo (`demo/DemoGame.ts`) through `<GameHost>` in a scratch harness
  (esbuild bundle + Playwright, SwiftShader) at 1280×800 and 390×844, default / reduced motion /
  `hardwareConcurrency = 8`: hotspots ≥ 64 px, on top, no overlap, tappable, Tab + Enter, arrows,
  switch scan, focus events, pause / resume, dispose cleans the DOM, no page error.

## Not done yet (next steps)
`cutscene.ts` and `animator.ts` (§3.8: Animator over the rigs + `ActionClip` → `AnimationMixer`)
are not written; IndexedDB saves (album thumbnails) are not written; JSON Schema generation for
level editors is not written.

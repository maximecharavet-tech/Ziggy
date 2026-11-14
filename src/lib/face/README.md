# `src/lib/face`: talking faces for Ziggy, Santa and the elves

This module is pure TypeScript: no DOM, no three.js, no NVIDIA at runtime, no new dependency.
A `FaceAnimator` turns the clip that is playing into a `FaceFrame` every animation frame:

| Field | Range | Meaning |
|---|---|---|
| `jaw` | 0..1 | how open the mouth is |
| `visemes` | sums to 1 | `rest`, `AA` (a), `EE` (i/é), `OO` (o/ou), `MM` (m/b/p), `FF` (f/v/s) |
| `viseme` | | the dominant one |
| `emotion` | sums to 1 | `neutral`, `smile`, `laugh`, `surprise`, `listen`, `wink`. There is **no sad emotion**. |
| `expression` | 0..1 (tilt -1..1) | smile, cheek, browUp, eyeWide, blinkL/R, headTilt, jawBias |

There are two implementations, and a scene never needs to know which one it got:

```ts
import { createFaceAnimator } from '@/lib/face';
const anim = createFaceAnimator(trackJson /* or undefined */);
// each frame:
const frame = anim.update({ dt, time: audio.currentTime, spectrum /* or samples, or level */ });
```

- `PrecomputedTrackAnimator` is used when a valid `*.face.json` track exists for the clip. Tracks are baked
  offline, for example with Audio2Face-3D (see `research/nvidia/offline-bake.md`). It only reads `time`.
- `WebFallbackAnimator` is used for everything else (no track, a broken track, or live audio such as a
  name inserted in a line). It reads the audio:
  - `spectrum`: the cheapest input. From an `AnalyserNode`, use
    `{ magnitudes: dbToMagnitudes(floatFreqData, fftSize), sampleRate, fftSize }`.
  - `samples`: a time-domain window, from `getFloatTimeDomainData`. A 1024-sample window costs one FFT per frame.
  - `level`: what `src/lib/santa/audio.ts` already computes. It gives a jaw-only "a" mouth.

The fallback is deliberately simple: an energy share in 5 bands (80–400, 400–1000, 1000–1600, 1600–3200,
3200–8000 Hz), hand-tuned scores, softmax, then attack/release smoothing (30 ms / 80 ms) and automatic gain.
It is tested on synthetic vowels at 110, 150 and 220 Hz (Santa, an adult voice, and Ziggy/the elves).

Emotions are driven by `anim.setEmotion('laugh')` (held) or `anim.cue('wink', 0.6)` (one-shot). Any label works, and
`sad`, `anger`, `grief` and unknown labels all become `smile`. The Audio2Face emotion vector goes through
`weightsFromA2fEmotions`, which keeps only joy, amazement and cheekiness.

## Mapping onto our characters (hooks that already exist)

The character files are owned by other people and are **not modified** by this module. A scene (a component
or a game) calls the mapping helper and passes the result to the hook the character already exposes:

| Character | Existing hook | Helper | Notes |
|---|---|---|---|
| Santa (`src/games3d/santa`) | `SantaSceneHandle.setTalk(level)` | `toSantaTalk(frame)` | The beard hides the lips, so only the jaw/moustache move. The profile uses a jaw gain of 1.15 and a minimum opening while voiced so that speech stays readable. |
| | `setExpression(e)` | `toSantaExpression(frame)` | Returns `laugh`, `wink`, `listen` or `idle` (threshold 0.5). Gestures (`wave`, `write`) stay with the scene. |
| Ziggy (`src/games3d/ziggy`) | `ZiggyStage.setLipSync(() => MouthShape)` | `toZiggyMouth(frame)` | AA→`open`, OO→`o`, EE→`grin`, MM/FF→`small`, rest→`smile` (or `grin` when laughing/winking). Same mouth set as the Rust voice engine's visemes in `src/lib/dodo/voice.ts`. |
| Pépin / Grelotte / Noisette (`src/games3d/lutins/elf.ts`) | `setMouth(open)` | `toElfMouth(frame, elf)` | The felt decal only scales open, so EE/OO/MM narrow the opening. Noisette (half size) gets a little more gain. |
| Future morph-target faces (glTF with ARKit names) | `mesh.morphTargetInfluences` | `toArkitWeights(frame)` | Never outputs a frown, brow-down or sneer. |

Example for Santa's call (`src/components/santa/call/SantaCall.tsx` today calls `setTalk(level)` from loudness):

```ts
const anim = createFaceAnimator(track);
// in the rAF loop, with the analyser SantaAudio already owns:
analyser.getFloatFrequencyData(db);
const f = anim.update({ dt, time: clipTime, spectrum: { magnitudes: dbToMagnitudes(db, analyser.fftSize), sampleRate: ctx.sampleRate, fftSize: analyser.fftSize } });
scene.setTalk(toSantaTalk(f));
```

### Hooks the character owners could add later (optional, not required)

1. **Santa**: `setMouthShape?(v: 'AA'|'EE'|'OO'|'MM'|'FF'|'rest')` to round the moustache for OO and widen
   it for EE. `setBlink?(l, r)` would let a baked track's blinks through (today Santa blinks on his own).
2. **Elves**: `setMouthShape?(width, open)` (two scalars instead of one) so OO can read as a small round mouth.
   They also need `setExpression?(e)` reusing their poses (`laugh`, `wink`, `listen`).
3. **Ziggy**: nothing is needed for the mouth (`setLipSync` already takes shapes). Adding `setBrows?(up)` would let
   `surprise` and `listen` show on the face as well as in the cues.

All of this needs `useReducedMotion` from `@/lib/use-reduced-motion`. With reduced motion, keep lip sync but drop the
head tilt and the laugh bounce: pass `expression.headTilt = 0` and skip `jawBias`.

## Track files

The format is documented and validated in `track.ts` (`validateTrack`, `encodeTrack`): 8-bit quantised, base64,
frame-major, about 2 KB for 5 s at 30 fps with 10 channels. Suggested path:
`public/face/{character}/{locale}/{clip}.face.json`. Once these files exist, add them to `public/sw.js` and bump
its `VERSION` when they are regenerated (see the CLAUDE.md lesson about `public/dodo/**`).

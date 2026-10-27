# Ziggy's bedtime voice — offline generator

Pre-records every bedtime story of the mode dodo in Ziggy's voice (a cute little
robot child) with word timings, so the player can light each word like a
teleprompter. It runs **once, on a computer**; the site only serves static files —
no AI and no API call when a child listens.

```
public/dodo/voice/{fr|en}/{storyId}/title.mp3, s1.mp3 … s6.mp3, outro.mp3
public/dodo/voice/{fr|en}/{storyId}/timing.json      (DodoVoiceTiming, src/lib/dodo/voice.ts)
```

`timing.json` holds, per segment, the exact text shown on screen and `words[i]`, the
start time (s) of token `i` of `text.trim().split(/\s+/)`. Tokens without a letter
(`«`, `»`, `—`, a lone `?`) take the time of the next word. `src/lib/dodo/voice.test.ts`
checks that every story/locale has its files and that they match the current texts.

## Setup (once)

Needs Node 22 (the repo's `node_modules`, for esbuild), Python 3.11, `ffmpeg` built with
`librubberband` and `libmp3lame`, and network access to registry.npmjs.org + pypi.org
(Hugging Face is not needed).

```bash
cd scripts/dodo-voice
python3 -m venv .cache/venv
.cache/venv/bin/pip install -r requirements.txt
.cache/venv/bin/python prepare_model.py      # ~330 MB from npm → .cache/
```

`prepare_model.py` downloads Kokoro-82M from npm (`kokoro-js@1.2.1` for the voices,
`kokoro-fp32{a,b,c}-shards@1.0.0` for the fp32 ONNX graph in 19 parts), joins the parts
in order, checks the size and sha256
(`8fbea51ea711f2af382e88c833d9e288c6dc82ce5e98421ea61c058ce21a34cb`, 325 532 232 bytes),
then saves a copy whose graph also outputs the phoneme durations the model predicts
(`/encoder/Gather_output_0` → `duration`; no weight changes). Set `DODO_VOICE_CACHE` to
keep the cache elsewhere (it is git-ignored).

## Generate

```bash
cd scripts/dodo-voice
.cache/venv/bin/python ziggy_voice.py                         # all stories, fr then en
.cache/venv/bin/python ziggy_voice.py --locale fr --story d07  # one story
.cache/venv/bin/python ziggy_voice.py --skip-existing          # only stories whose text changed
.cache/venv/bin/python ziggy_voice.py --check                  # phoneme report, no audio
.cache/venv/bin/python ziggy_voice.py --sample lili:s2 --out /tmp/try   # one segment (raw + Ziggy wav, mp3, json)
```

After editing a story (`src/data/dodo`), regenerate that story (the vitest test fails
until you do). Synthesis runs at about 0.3× real time on 4 free CPU cores (much slower on a
busy machine), ~3 h of audio for everything. To use several processes, start a few workers
with the same claims folder — each takes the next story nobody has (all French first):

```bash
for i in 1 2 3; do .cache/venv/bin/python ziggy_voice.py --threads 2 --claims .cache/claims & done
rm -r .cache/claims   # afterwards (a crashed worker leaves its story claimed)
```

Kokoro's raw takes are
cached in `.cache/raw` (keyed by voice, speed, phonemes and pauses), so changing the voice
effect, the loudness or the MP3 settings re-renders everything in a few minutes.

## How it works

1. `dump-stories.mjs` bundles `src/data/dodo` with esbuild and prints every segment's exact
   text (title, scenes 1–6, `outroText()`).
2. Each segment is cut into sentences (a `.`/`!`/`?`/`…` followed by a capital; closing
   quotes stay with their sentence; `« Oh ! » chuchota Lili` stays one sentence).
3. Phonemes, as Kokoro was trained:
   - **fr**: espeak-ng `fr-fr` through misaki's `EspeakG2P` (with liaisons, on the whole
     sentence). French typography (« », ’, …, non-breaking spaces) is normalized for it.
   - **en**: misaki's lexicon G2P (gold/silver US dictionaries) with espeak as fallback. No
     spaCy model can be downloaded, so a tiny rule tagger (`EnglishG2P`) gives misaki the tags
     it needs (punctuation, determiners, `close`/`live` as verbs).
   - `lexicon.json` fixes names and sounds (Léopold, Ziggy, Pousse, Inès…, `Grrrrr`, `chhh`,
     and French words espeak reads as English: `dos`, `bruns`, `pull`, `rythme`…). The
     `--check` report and the run's "espeak fallback" list tell you what to add.
4. Each sentence is synthesized separately (no drift) with Kokoro-82M fp32 on CPU, style
   vector chosen by phoneme count (`pack[len(ids) - 1]`) like Kokoro does. Word positions in
   the phoneme string come from misaki's tokens (en) or a monotonic edit-distance alignment
   of each word's phonemes with the sentence's (fr: liaisons, `qu’est-ce que` merged…).
   **Word times are read from the model's own phoneme durations** (600 samples per step),
   moved 0.10 s earlier (Kokoro's audio for a phoneme starts ~3 steps before its slot — the
   same −3 its own `join_timestamps` uses — and a word should light as it begins).
5. Leading/trailing silence is trimmed per sentence, then sentences are joined with calm
   pauses: 0.38 s after `.`, 0.45 s after `?`/`!`, 0.60 s after `…`; 0.08 s before the
   segment, 0.30 s after. The voice effect keeps the tempo (checked with tone bursts: ±20 ms),
   so the times stay true.
6. Loudness: two-pass EBU R128, a static gain to −18 LUFS (true peak ≤ −1.5 dBTP, never
   compressed), 20 ms fades, MP3 mono 24 kHz 40 kbps (`libmp3lame`).

## Ziggy's voice recipe

| | French | English |
|---|---|---|
| Kokoro voice | `ff_siwis` | `af_heart` |
| Model speed (natural slow-down) | 0.80 | 0.84 |

Then, on the whole segment (ffmpeg):

1. **Child**: formants ×1.12 (shorter vocal tract: `asetrate` ×1.12 + `aresample`), then
   `rubberband` pitch ×1.30/1.12 with `formant=preserved` and tempo ×1/1.12 → pitch ×1.30
   (≈ +4.5 semitones; median F0 ~210 Hz → ~270 Hz), formants ×1.12, same duration.
2. **Warm, for bedtime**: high-pass 90 Hz, +2 dB around 220 Hz, −3 dB high shelf from 6 kHz,
   low-pass 10 kHz.
3. **Little robot** (kept very light): a 4 ms comb (`aecho`, gain 0.20 — a soft metallic
   shimmer) and a 42 Hz ring modulator mixed at 0.12 (≈ −20 dB: a faint toy-robot buzz).

All of it is in the constants at the top of `ziggy_voice.py` (`VOICES`, `PITCH`, `FORMANT`,
`COMB_*`, `RING_*`, pauses, `LUFS`, `MP3_KBPS`).

## Licenses

- **Kokoro-82M** by hexgrad — Apache-2.0 (model and voices): https://huggingface.co/hexgrad/Kokoro-82M.
  ONNX export by onnx-community (`Kokoro-82M-v1.0-ONNX`, Apache-2.0), redistributed on npm as
  `kokoro-fp32a/b/c-shards` (Apache-2.0); voices from `kokoro-js` 1.2.1 (Apache-2.0, hexgrad & Xenova).
  The MP3s shipped in `public/dodo/voice` are generated with it.
- Build tools only (nothing of them is shipped with the site): misaki (Apache-2.0),
  kokoro-onnx (MIT, its `config.json` vocabulary), onnxruntime (MIT), onnx (Apache-2.0),
  spaCy (MIT), num2words (LGPL-2.1), numpy/soundfile (BSD), **espeak-ng (GPL-3.0)** via
  phonemizer (GPL-3.0) and espeakng-loader (MIT), ffmpeg with librubberband (GPL). These run
  locally to *produce* the audio; their code is not distributed, so the site's license is
  unaffected.

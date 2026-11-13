# Recherche Rust open source — « Le Père Noël va t'appeler ! »

Date : 10 novembre 2026, Europe/Paris. Licences et activité vérifiées via l’API GitHub, crates.io et les fichiers LICENSE (cette session). Aucun code de l’app modifié (branche `feat/pere-noel-deep-upgrade` laissée à l’autre worker).

Contexte : module Next.js de `maximecharavet-tech/Ziggy`, plan `/workspace/pere-noel/PLAN.md`. Contraintes : MIT / Apache / BSD uniquement · 0 € · pas de fusion / déploiement / env / DNS · pas de fonction Rust Vercel pour l’inférence lourde (poids, cold start).

Déjà dans Ziggy (à réutiliser, pas à réécrire) :
- `voice-engine/ziggy-voice` (MIT) : Kokoro-82M via `ort`, G2P, DSP, mastering, **visèmes** (`visemes.rs`), prêt pour une voix Père Noël sur le PC.
- `rust/lutins-core` (MIT, `cdylib` wasm-bindgen) : modèle d’intégration WASM navigateur.

---

## Recommandation d’intégration (3 tâches concrètes)

### 1. STT + VAD on-device pour Safari / iOS (WASM navigateur, 0 €)
Brancher le **WASM officiel sherpa-onnx** (Apache-2.0, testé Safari) : Silero VAD (MIT) + ASR streaming. Modèle sûr pour le français : **Whisper tiny/base** (poids MIT). Le zipformer FR `sherpa-onnx-streaming-zipformer-fr-2023-04-14` est annoncé Apache-2.0 sur un miroir HF, mais la licence amont icefall est discutée — à reconfirmer avant de l’embarquer. Les bindings Rust `sherpa-onnx` 2.0.1 (crate officiel) sont pour un **service PC**, pas pour le navigateur (ONNX Runtime natif). Variante 100 % Rust WASM : exemple Whisper de Candle (plus jeune, SIMD WASM encore limité).

### 2. Voix unique du Père Noël + lip-sync (service PC, 0 €)
Étendre `ziggy-voice` : voix masculine Kokoro (poids Apache-2.0, dont `ff_siwis` en français) + FunDSP / rubato / signalsmith-stretch pour grave, chaleur, « Ho ho ho ». Pré-générer clips + prénoms → `public/santa/voice/*.opus`. Piloter la bouche du Père Noël three.js déjà en place avec les visèmes de `visemes.rs` (pas de moteur Bevy). Option CLI : [Kokoros](https://github.com/lucasjinreal/Kokoros).

### 3. Appel IA live « qualité max » (service PC / Hyper Engine, pas Vercel)
Runtime [Flowcat](https://github.com/AreevAI/flowcat) (Apache-2.0, Rust, pipeline STT→LLM→TTS, WebRTC via str0m, Kokoro local). Client web inchangé. LLM local optionnel : mistral.rs (MIT) ou llama-cpp-rs (Apache-2.0). Les API DeepSeek / NVIDIA / Mistral du plan restent le chemin 0 € en prod. LiveKit Cloud est payant → uniquement self-host, et seulement avec OK. Aucune inférence lourde en fonction Rust Vercel.

---

## Top 8 (à retenir)

| # | Projet | Licence | ★ (10/11/2026) | Dernier push (Europe/Paris) | Branche d’usage |
|---|---|---|---:|---|---|
| 1 | [k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (+ [miroir Gitee](https://gitee.com/k2-fsa/sherpa-onnx)) | Apache-2.0 | 15 848 | 10 nov 2026, 02:49 | WASM navigateur (officiel) + crate Rust service PC |
| 2 | [huggingface/candle](https://github.com/huggingface/candle) | MIT OR Apache-2.0 | 21 297 | 2 nov 2026, 13:05 | Whisper WASM + LLM ; exemple `candle-wasm-examples/whisper` |
| 3 | [lucasjinreal/Kokoros](https://github.com/lucasjinreal/Kokoros) + `ziggy-voice` | Apache-2.0 / MIT (Ziggy) | 836 | 5 oct 2026, 10:15 | TTS Père Noël sur le PC ; poids Kokoro Apache-2.0 |
| 4 | [pykeio/ort](https://github.com/pykeio/ort) | Apache-2.0 | 2 610 | 2 nov 2026, 00:23 | Déjà dans `ziggy-voice` ; ONNX Kokoro / VAD / sherpa côté PC |
| 5 | [AreevAI/flowcat](https://github.com/AreevAI/flowcat) | Apache-2.0 | 127 | 2 nov 2026, 22:27 | Runtime voix temps réel Rust, self-host, 0 € |
| 6 | [EricLBuehler/mistral.rs](https://github.com/EricLBuehler/mistral.rs) | MIT | 7 821 | 9 nov 2026, 03:43 | LLM local sur le PC (repli hors API) |
| 7 | [SamiPerttu/fundsp](https://github.com/SamiPerttu/fundsp) + [HEnquist/rubato](https://github.com/HEnquist/rubato) | MIT OR Apache-2.0 | 1 231 / 367 | 3 mars 2026 / 7 nov 2026 | Effets voix Père Noël + resample 16/24 kHz (WASM possible) |
| 8 | [image-rs/image](https://github.com/image-rs/image) + [linebender/tiny-skia](https://github.com/linebender/tiny-skia) | MIT OR Apache-2.0 / BSD-3-Clause | 5 907 / 1 688 | 8 nov 2026 / 20 août 2026 | Compostion images / cadres de la vidéo « Grand Livre » en WASM (même schéma que `lutins-core`) |

---

## Détail par domaine

### STT / VAD / TTS — Rust et WASM

| Projet | Licence code | ★ | Activité | Pourquoi | Branchement |
|---|---|---:|---|---|---|
| **[k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)** | Apache-2.0 | 15 848 | Très actif (push le 10/11/2026) | Référence mondiale (origine chinoise, aussi sur Gitee). STT streaming, TTS, **Silero VAD**, WASM officiel Safari, Rust officiel (`sherpa-onnx` 2.0.1, ~800 k dl). | **WASM navigateur** (build Emscripten officiel, pas les bindings Rust) pour débloquer iPhone. **Service PC** : crate Rust. |
| [thewh1teagle/sherpa-rs](https://github.com/thewh1teagle/sherpa-rs) | MIT | 313 | **Archivé** (dernier push 8 mars 2026) | Ancien binding, officiellement remplacé par le crate amont. | Ne pas utiliser. |
| [huggingface/candle](https://github.com/huggingface/candle) + Whisper | MIT OR Apache-2.0 ; **poids Whisper = MIT** | 21 297 | Actif (2 nov 2026) | Seule grande stack 100 % Rust avec exemple Whisper **dans le navigateur**. | Module WASM `santa-ear` (wasm-bindgen, comme `lutins-core`). Limite : SIMD WASM encore faible côté Candle. |
| [paiml/whisper.apr](https://github.com/paiml/whisper.apr) | MIT | 33 | Actif (9 nov 2026) | Whisper pur Rust, conçu WASM (quantif int4, streaming). Jeune. | Expérimental, repli si Candle/sherpa bloquent. |
| [ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) | MIT | 55 051 | Très actif | Standard de fait, WASM Emscripten. | Repli navigateur ou PC. Binding Rust [whisper-rs](https://codeberg.org/tazz4843/whisper-rs) : **Unlicense** (domaine public, plus permissif que MIT). Le miroir GitHub est archivé ; crates.io 0.16.0 (12 mars 2026). Acceptable si on admet l’Unlicense ; sinon rester sur Candle / sherpa. |
| [snakers4/silero-vad](https://github.com/snakers4/silero-vad) | MIT (code **et** poids) | 10 625 | Actif (22 oct 2026) | VAD d’entreprise, déjà dans sherpa-onnx WASM. | Poids MIT utilisables tels quels. |
| [sheldonix/silero-vad-rust](https://github.com/sheldonix/silero-vad-rust) | MIT | 15 | 27 août 2026 | Port Rust + ONNX bundlés. | Service PC via `ort` (déjà là). Peu d’étoiles. |
| [findit-studio/silero](https://github.com/findit-studio/silero) (crates.io `silero`) | MIT OR Apache-2.0 | 6 | 15 sept 2026 | Wrapper VAD « prod » (session réutilisable). | Service PC. Repo déplacé depuis Findit-AI. |
| [nkeenan38/voice_activity_detector](https://github.com/nkeenan38/voice_activity_detector) | MIT (fichier LICENSE ; crates.io dit « non-standard » à cause de `license-file`) | 64 | 4 août 2025 | Silero + API streaming. Un peu figé. | PC seulement (`ort`). |
| [thewh1teagle/vad-rs](https://github.com/thewh1teagle/vad-rs) | MIT (Cargo.toml ; pas de fichier LICENSE) | 34 | **Figé** (16 déc 2024) | Ancien, dépend d’un vieux `ort`. | Éviter. |
| **[lucasjinreal/Kokoros](https://github.com/lucasjinreal/Kokoros)** | Apache-2.0 ; **poids Kokoro-82M Apache-2.0** | 836 | 5 oct 2026 | Meilleur port Rust de Kokoro (auteur chinois). FR possible. Pas sur crates.io (binaire `koko`). | **Service PC** pour pré-générer la voix. Ziggy a déjà l’équivalent plus avancé (`ziggy-voice`). |
| [pguso/kokoro](https://github.com/pguso/kokoro) (`kokoro-en` 0.1.5) | Apache-2.0 | 11 | 4 août 2026 | Crate léger, streaming, voices FR listées, peu éprouvé hors anglais. | Alternative crates.io si on veut une lib. |
| [hexgrad/kokoro](https://github.com/hexgrad/kokoro) | Apache-2.0 | 10 017 | 6 août 2025 (peu actif) | Référence Python/JS, pas Rust. | Poids + `kokoro-js` déjà prévus au plan (repli navigateur). |
| [thewh1teagle/piper-rs](https://github.com/thewh1teagle/piper-rs) | MIT (code) | 67 | 21 mai 2026 | GitHub licence « None », Cargo.toml = MIT. Feature par défaut compile **espeak-ng (GPL-3)** → **risque copyleft**. | Ne pas activer `compile-espeak-intonations`. Préférer Kokoro. `piper1-gpl` est **GPL, interdit**. [rhasspy/piper](https://github.com/rhasspy/piper) MIT mais **archivé**. |
| [altunenes/parakeet-rs](https://github.com/altunenes/parakeet-rs) | MIT OR Apache-2.0 (code) | 421 | 31 oct 2026 | ASR NVIDIA très rapide, FR dans le modèle TDT 25 langues, backend `ort` ou Burn. | **Poids CC-BY-4.0** → hors liste, OK de Maxime requis (comme Kyutai au plan). |
| [miuda-ai/lele](https://github.com/miuda-ai/lele) | MIT déclaré au Cargo.toml, **pas de fichier LICENSE** dans le dépôt | 183 | 5 nov 2026 | ONNX→Rust AOT, démo WASM SenseVoice (équipe chinoise). Prometteur pour un STT WASM sans ONNX Runtime. | Jeune ; SenseVoice : licence modèle FunASR custom, **pas MIT/Apache/BSD** → exclus tant que pas d’OK. Whisper int8 OK si poids MIT. |

### Voix temps réel (agents)

| Projet | Licence | ★ | Activité | Pourquoi | Branchement |
|---|---|---:|---|---|---|
| **[AreevAI/flowcat](https://github.com/AreevAI/flowcat)** | Apache-2.0 | 127 | 2 nov 2026 | Seul runtime d’agents vocaux **natif Rust**, self-host, compatible idée Pipecat, Kokoro/Piper locaux, transports str0m / LiveKit / WS. | **Service PC / Hyper Engine**. Pas de contrôle cloud payant. |
| [livekit/rust-sdks](https://github.com/livekit/rust-sdks) | Apache-2.0 | 505 | 10 nov 2026, 01:20 | SDK client/serveur officiel, crate `livekit` 0.10.1 très vivant. | Self-host uniquement. [livekit/agents](https://github.com/livekit/agents) est **Python** (Apache-2.0, 15 158 ★) ; skill `npx skills add livekit/agent-skills` = Python/Node, pas Rust. LiveKit Cloud = payant, interdit sans OK. |
| [webrtc-rs/webrtc](https://github.com/webrtc-rs/webrtc) | MIT OR Apache-2.0 | 5 182 | 7 nov 2026 | Stack WebRTC complète en Rust. | Briques basses si on écrit un pont custom. Trop bas niveau pour l’app seule. |
| [algesten/str0m](https://github.com/algesten/str0m) | MIT OR Apache-2.0 | 652 | 9 nov 2026 | Sans-I/O WebRTC, déjà utilisé par Flowcat. Crate 0.25.0. | Dépendance interne du service PC, pas le navigateur (le client reste JS). |

Pipecat (BSD-2, Python) reste la référence d’archi du PLAN.md ; Flowcat en est l’équivalent Rust, plus aligné avec la demande « en rust code ».

### LLM inference Rust

| Projet | Licence | ★ | Activité | Pourquoi | Branchement |
|---|---|---:|---|---|---|
| **[EricLBuehler/mistral.rs](https://github.com/EricLBuehler/mistral.rs)** | MIT | 7 821 | 9 nov 2026 | Meilleur moteur d’inférence LLM en Rust (au-dessus de Candle). Crate `mistralrs` 0.8.1. | **Service PC** : petit modèle FR / garde-fou, repli si les API saturent le 24/12. Pas Vercel. |
| [huggingface/candle](https://github.com/huggingface/candle) | MIT OR Apache-2.0 | 21 297 | 2 nov 2026 | Socle tenseurs, exemples WASM, Whisper + petits LLM. | WASM / PC. [tokenizers](https://github.com/huggingface/tokenizers) Apache-2.0, 11 230 ★, 9 nov 2026. |
| [tracel-ai/burn](https://github.com/tracel-ai/burn) | MIT OR Apache-2.0 | 16 263 | 10 nov 2026 | Framework complet (train + inférence), backend de parakeet-rs. | Utile à long terme, trop lourd pour un premier livrable Noël. |
| [utilityai/llama-cpp-rs](https://github.com/utilityai/llama-cpp-rs) | Apache-2.0 (bindings) ; [llama.cpp](https://github.com/ggml-org/llama.cpp) MIT, 133 858 ★ | 664 | 9 nov 2026 | Bindings Rust actives (préférer à mdrokz/rust-llama.cpp, figé 2024). | Service PC, GGUF. |
| [rustformers/llm](https://github.com/rustformers/llm) | Apache-2.0 | 6 145 | **Non maintenu** (juin 2024) | — | Éviter. |

Les poids des LLM ont leur propre licence (Llama, Mistral, etc.) : les vérifier avant tout embedding. En prod 0 €, garder DeepSeek / NVIDIA / Mistral API du plan.

### Lip-sync / avatar / animation Rust-WASM

| Projet | Licence | ★ | Activité | Pourquoi | Branchement |
|---|---|---:|---|---|---|
| **`ziggy-voice` visemes.rs + three.js existant** | MIT (Ziggy) | — | Déjà là | Meilleur rapport effort/qualité : visèmes FR déjà calculés. [TalkingHead](https://github.com/met4citizen/TalkingHead) (MIT, JS) pour le mapping bouche, comme au plan. | **Pas un nouveau moteur 3D.** |
| [bevyengine/bevy](https://github.com/bevyengine/bevy) | MIT OR Apache-2.0 | 49 653 | Très actif | Meilleur moteur de jeu Rust, WASM possible. | **Trop lourd** : réécrirait le Père Noël three.js (885+ l.). Ne pas migrer pour Noël 2026. |
| [gfx-rs/wgpu](https://github.com/gfx-rs/wgpu) | MIT OR Apache-2.0 (communauté / crates ; GitHub affiche souvent Apache-2.0) | 18 503 | Très actif | API GPU Rust, base de Bevy / Vello. | Seulement si un effet WebGPU custom s’impose. |
| [rive-app/rive-rs](https://github.com/rive-app/rive-rs) | MIT | 135 | **Peu actif** (4 juil 2025) | Runtime Rive 2D (visèmes via state machine). [rive-bevy](https://github.com/rive-app/rive-bevy) MIT, 131 ★, 14 août 2025. | UI 2D lutins possible, mais figé. **Attention** : le crate crates.io `rive` 1.2.0 est un **autre** projet (**LGPL-2.1, interdit**). |
| Démos « Santa » Bevy ([bevy-santa-demo](https://github.com/Arrekin/bevy-santa-demo) MIT, 1 ★, janv 2025, etc.) | MIT (quand déclaré) | 1–qqs | Inactives / jouets | Aucun code réutilisable au niveau prod. | Inspiration visuelle seulement. |

### Audio DSP (voix du Père Noël)

| Projet | Licence | ★ | Activité | Pourquoi | Branchement |
|---|---|---:|---|---|---|
| **[SamiPerttu/fundsp](https://github.com/SamiPerttu/fundsp)** | MIT OR Apache-2.0 | 1 231 | 3 mars 2026 (un peu calme) | Synthèse / filtres / chorus / pitch en Rust pur, compilable WASM. | Chaîne PC dans `ziggy-voice` (grave, chaleur, rire). |
| **[HEnquist/rubato](https://github.com/HEnquist/rubato)** | MIT OR Apache-2.0 (LICENSE-MIT + LICENSE-APACHE ; GitHub « NOASSERTION ») | 367 | 7 nov 2026 | Resampler de référence (15 M dl). Indispensable 16 kHz STT ↔ 24 kHz Kokoro. | PC et WASM. |
| [colinmarc/signalsmith-stretch-rs](https://github.com/colinmarc/signalsmith-stretch-rs) | MIT (wrapper) ; amont [Signalsmith Stretch](https://github.com/Signalsmith-Audio/signalsmith-stretch) MIT, 580 ★, 22 oct 2026 | 14 | 12 juin 2026 | Vrai time-stretch / pitch-shift (FunDSP ne suffit pas seul pour ça). | Formant / « Ho ho ho » plus grave, sur le PC. |

`ziggy-voice` a déjà rustfft / realfft / ebur128 / WORLD : compléter, ne pas dupliquer.

### Compostion vidéo / image WASM

| Projet | Licence | ★ | Activité | Pourquoi | Branchement |
|---|---|---:|---|---|---|
| **[image-rs/image](https://github.com/image-rs/image)** | MIT OR Apache-2.0 | 5 907 | 8 nov 2026 | Décodage/encodage d’images, déjà le standard. | Étendre le schéma `lutins-core` : photo enfant + cadre « Grand Livre » **dans le navigateur**. |
| **[linebender/tiny-skia](https://github.com/linebender/tiny-skia)** | BSD-3-Clause | 1 688 | 20 août 2026 | Raster 2D pur Rust, excellent en WASM. | Compositing (livre, certificat, carte cadeau) sans libvips/LGPL. |
| [image-rs/imageproc](https://github.com/image-rs/imageproc) | MIT | 986 | 31 oct 2026 | Filtres, overlay. | Optionnel sur le même crate WASM. |
| [xiph/rav1e](https://github.com/xiph/rav1e) | BSD-2-Clause | 4 165 | 6 nov 2026 | Encodeur AV1 sûr, en Rust. | **PC** pour un export marketing ; trop lourd pour le navigateur. La vidéo enfant reste canvas + MediaRecorder (plan). |
| [linebender/vello](https://github.com/linebender/vello) | Apache-2.0 (souvent dual MIT/Apache en pratique) | 4 480 | 10 nov 2026 | Rendu 2D GPU. | Overkill pour Noël 2026. |
| lumen-oss / rust-motion / vibe-machine / kantera | Apache ou licence absente | 1–3 | Jeunes, voire archivés / figés (kantera 2023, licence non claire) | Pas assez matures. | Écarter. |

ffmpeg et `ffmpeg-next` : souvent liés à LGPL/GPL selon le build → ne pas embarquer dans le module WASM. Garder ffmpeg CLI sur la box / le PC, déjà en place.

### Projets Père Noël / Noël en Rust

Aucun dépôt Rust permissif de niveau mondial (appel IA, TTS Santa, lip-sync) n’a été trouvé, ni sur GitHub ni sur Gitee. Les démos Bevy « Santa » sont des jeux d’atelier, 1 étoile, inactives. L’état de l’art « appel du Père Noël » reste côté Python/JS (Pipecat, LiveKit Agents, TalkingHead) — d’où l’intérêt de **Flowcat + sherpa-onnx + Kokoro Rust**, unique combinaison permissive et sérieuse.

### Chine / Gitee

- Miroir officiel : [gitee.com/k2-fsa/sherpa-onnx](https://gitee.com/k2-fsa/sherpa-onnx) (même projet Apache-2.0). Fetch Gitee 403 depuis la box ; existence confirmée par le web.
- Meilleurs projets chinois utiles sont sur **GitHub** : sherpa-onnx (k2-fsa), Kokoros (lucasjinreal), lele (miuda-ai). RapidAI (Gitee) est surtout C++ / Python, pas un socle Rust supérieur.
- Rien d’exploitable spécifiquement « Père Noël » sur Gitee.

---

## Hors liste (ne pas embarquer sans OK, ou interdit)

| Élément | Motif |
|---|---|
| piper1-gpl, espeak-ng lié par défaut dans piper-rs | GPL |
| crate crates.io `rive` (codeberg) | LGPL-2.1 |
| Poids NVIDIA Parakeet, Moshi / Unmute Kyutai | CC-BY-4.0 (code parfois Apache/MIT) — même règle que le plan |
| Poids SenseVoice / FunASR | Licence modèle custom |
| LiveKit Cloud, APIs payantes | Coût, OK requis |
| TEN-framework | Conditions en plus d’Apache |
| rustformers/llm, sherpa-rs, rhasspy/piper | Non maintenu / archivé |
| Remotion, F5-TTS NC, ChatTTS AGPL, etc. | Déjà exclus au plan |

---

## Skills utiles (pas un repo)

- Pattern interne Ziggy : crates WASM `lutins-core` / `ziggy-tv-nav` + moteur `ziggy-voice` (à cloner pour un `santa-voice`).
- Exemple recette : `candle-wasm-examples/whisper` dans le dépôt Candle.
- Skills HF déjà au catalogue (huggingface-local-models, transformers.js) : repli **JS** on-device si le WASM Rust n’est pas prêt, uniquement côté client.
- Skill LiveKit `agent-skills` : Python/Node, utile seulement si on choisit LiveKit self-host — pas le chemin Rust prioritaire.

---

## Ce qui ne va pas sur Vercel

Pas de fonction Rust Vercel pour STT / TTS / LLM : binaires et modèles trop gros, timeout, 0 €, « pas de changement de région ». Le Rust utile est **WASM dans le navigateur** (vie privée, Safari) et **service sur le PC de Maxime** (voix pré-générée, live optionnel, clips marketing).

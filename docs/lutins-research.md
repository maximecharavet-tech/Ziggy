# Les Lutins Farceurs: open-source research (Nov 2026)

What world open-source work (Chinese and Western) can improve the `/lutins` pipeline
(Agnes `agnes-image-2.x` with reference images in `extra_body.image`, plus Agnes video).
Read with `docs/LUTINS.md` and `src/data/lutins/bible.json`.

**How the licences were checked:** each code licence was read from the repo's own `LICENSE*`
file (fetched from `raw.githubusercontent.com/<repo>/HEAD/…` on 2026-11-08). For Rust
crates, the `license` field of `Cargo.toml` was read (plus the LICENSE file where that field
was missing). Model-weight licences come from the repo READMEs, because huggingface.co and
docs.bfl.ai were blocked from this session. **We run none of these models.** We take ideas,
prompt patterns and algorithms from them. The only code we would ship is Rust crates
(section C).

Legend: ✅ = we may copy the code (MIT / Apache-2.0 / BSD). 💡 = idea only, do not ship.

---

## 1. Repos

### A. Keeping a subject consistent from reference images (image)

| Repo | Org (country) | Code licence | Weights / caveat | Technique | What we take |
|---|---|---|---|---|---|
| [HVision-NKU/StoryDiffusion](https://github.com/HVision-NKU/StoryDiffusion) | Nankai Univ. + ByteDance (CN) | Apache-2.0 ✅ | SD1.5/SDXL | Consistent Self-Attention shares attention across a batch of images. The README asks for ≥3 prompts and recommends 5–6 | 💡 Identity comes from a *shared, fixed context* |
| [TencentARC/PhotoMaker](https://github.com/TencentARC/PhotoMaker) | Tencent ARC (CN) | Apache-2.0 ✅ | Faces only | Stacked ID embedding from several reference photos | 💡 Several clean refs beat one |
| [instantX-research/InstantID](https://github.com/instantX-research/InstantID) | InstantX / Xiaohongshu (CN) | Apache-2.0 ✅ | Face model weights are non-commercial | Face embedding + landmark ControlNet | 💡 Not relevant to plush characters |
| [tencent-ailab/IP-Adapter](https://github.com/tencent-ailab/IP-Adapter) | Tencent AI Lab (CN) | Apache-2.0 ✅ | – | Decoupled image cross-attention | 💡 The reference image acts as a "prompt": a clean background and a tight crop matter |
| [ali-vilab/In-Context-LoRA](https://github.com/ali-vilab/In-Context-LoRA) | Alibaba Tongyi (CN) | **No LICENSE file**. FLUX.1-dev based 💡 | Non-commercial (FLUX dev) | Joins condition and target into one panel image. Prompts use `[LEFT]/[RIGHT]`, `[SCENE-1]` markers | 💡 Panel layout + positional words in the prompt |
| [VectorSpaceLab/OmniGen2](https://github.com/VectorSpaceLab/OmniGen2) (and [OmniGen](https://github.com/VectorSpaceLab/OmniGen), MIT) | BAAI VectorSpaceLab (CN) | Apache-2.0 ✅ | Apache | A unified model that takes several images in context | 💡 **Its prompt template and consistency tips** (see recs #3 and #9) |
| [bytedance/UNO](https://github.com/bytedance/UNO) | ByteDance (CN) | Apache-2.0 ✅ | Runs on FLUX.1-dev (non-commercial) | Multi-subject in-context generation | 💡 References shrink to 512 px (one subject) and 320 px (several): each extra subject costs pixels |
| [bytedance/DreamO](https://github.com/bytedance/DreamO) | ByteDance (CN) | Apache-2.0 ✅ | FLUX.1-dev based | Routing constraint per subject (ID / IP / try-on) | 💡 High guidance gives a "glossy, over-saturated" look |
| [bytedance/InfiniteYou](https://github.com/bytedance/InfiniteYou) | ByteDance (CN) | Apache-2.0 ✅ | FLUX.1-dev based | Identity residuals injected into a DiT | 💡 – |
| [bytedance/USO](https://github.com/bytedance/USO) | ByteDance (CN) | Apache-2.0 ✅ | FLUX.1-dev based | Separates *content* references from *style* references (first image = content) | 💡 Our CG-rendered sheet drags its style along (rec #2) |
| [bytedance/XVerse](https://github.com/bytedance/XVerse) | ByteDance (CN) | Apache-2.0 per README (no LICENSE file found) | FLUX based | Per-subject token modulation for multi-subject control | 💡 – |
| [Yuanshi9815/OminiControl](https://github.com/Yuanshi9815/OminiControl) | NUS (SG) | Apache-2.0 ✅ | FLUX | The condition image's tokens join the DiT sequence | 💡 – |
| [ali-vilab/ACE_plus](https://github.com/ali-vilab/ACE_plus) | Alibaba Tongyi (CN) | **No LICENSE file**. FLUX.1-dev based 💡 | Non-commercial | Context-aware fill: reference panel + masked target | 💡 Layout "reference ‖ target" |
| [QwenLM/Qwen-Image](https://github.com/QwenLM/Qwen-Image) (Edit-2509/2511) | Alibaba Qwen (CN) | Apache-2.0 ✅ | Apache | Edit model trained on joined images. **Works best with 1–3 input images**. Pairs supported: person + person, person + product, person + scene | 💡 Budget of 1–3 images. The 2509 release is said to improve identity |
| [black-forest-labs/flux](https://github.com/black-forest-labs/flux) (Kontext) | Black Forest Labs (DE) | Apache-2.0 ✅ (code) | Kontext [dev] weights are **non-commercial** | In-context edit by concatenating sequences | 💡 **The Kontext prompting rules** (rec #3) |
| [stepfun-ai/Step1X-Edit](https://github.com/stepfun-ai/Step1X-Edit) | StepFun (CN) | Apache-2.0 ✅ | Apache | A vision-language model encodes the instruction for a DiT | 💡 One concrete instruction works better than several |
| [ByteDance-Seed/Bagel](https://github.com/ByteDance-Seed/Bagel) | ByteDance Seed (CN) | Apache-2.0 ✅ | Apache | Unified model with a "think before editing" mode | 💡 An expanded, explicit prompt helps (rec #9) |
| [song-wensong/insert-anything](https://github.com/song-wensong/insert-anything) | Zhejiang Univ. (CN) | MIT ✅ | FLUX Fill based | Inserts a reference into a scene with a diptych (ref ‖ masked target). "The mask must fully cover the area to be edited" | 💡 A segmented ref on a plain background. An insertion region bigger than the object |
| [ali-vilab/AnyDoor](https://github.com/ali-vilab/AnyDoor) | Alibaba DAMO + HKU (CN) | MIT ✅ | SD based | Inserts an object at a box. ID extractor on a ref with the **background removed**, plus a high-frequency detail map | 💡 Remove the background of every ref |
| [byliutao/1Prompt1Story](https://github.com/byliutao/1Prompt1Story) | Nankai Univ. (CN) | MIT ✅ | SDXL | All frame prompts in ONE prompt ("context consistency") | 💡 Byte-identical identity text inside one prompt |
| [MS-Diffusion/MS-Diffusion](https://github.com/MS-Diffusion/MS-Diffusion) | Academic (CN) | MIT ✅ | SDXL | Layout-guided multi-subject generation (one box per subject) | 💡 Give each subject a place in words |
| [NVlabs/consistory](https://github.com/NVlabs/consistory) | NVIDIA + Tel Aviv Univ. (US/IL) | **NVIDIA License (non-commercial)** 💡 | – | Training-free shared subject attention. Its tips: "the first two settings determine identity" (anchors); the same seed alone does not keep a subject | 💡 Fixed anchors. A seed does not carry identity |
| [NVlabs/addit](https://github.com/NVlabs/addit) | NVIDIA (US/IL) | **NVIDIA License (non-commercial)** 💡 | FLUX | Training-free object insertion. Introduces an "affordance" benchmark: models often place objects in implausible spots | 💡 Name the surface explicitly (rec #4) |
| [River-Zhang/ICEdit](https://github.com/River-Zhang/ICEdit) | Zhejiang Univ. (CN) | **FLUX.1-dev Non-Commercial** 💡 | – | In-context diptych edit | 💡 – |
| [RedAIGC/StoryMaker](https://github.com/RedAIGC/StoryMaker), [showlab/OmniConsistency](https://github.com/showlab/OmniConsistency) | Xiaohongshu (CN) / NUS (SG) | **No LICENSE file** 💡 | – | Multi-character consistency / style consistency | 💡 – |
| [Tencent-Hunyuan/HunyuanCustom](https://github.com/Tencent-Hunyuan/HunyuanCustom) | Tencent Hunyuan (CN) | **Tencent Hunyuan Community License: "does not apply in the EU, UK and South Korea"** 💡 | Same | Subject-to-video with an LLaVA fusion module + temporal ID concatenation | 💡 Idea only. Excluded for France |

### B. Image-to-video / subject-to-video

| Repo | Org (country) | Code licence | Weights / caveat | What we take |
|---|---|---|---|---|
| [Wan-Video/Wan2.2](https://github.com/Wan-Video/Wan2.2) (and [Wan2.1](https://github.com/Wan-Video/Wan2.1)) | Alibaba Tongyi Wan (CN) | Apache-2.0 ✅ | Apache | I2V keeps **the input's aspect ratio** ("size" sets the area). 81 frames by default (≈5 s at 16 fps); TI2V-5B renders 1280×704 at 24 fps. Its **default negative prompt contains "static / still / motionless frame"** (静态, 静止, 静止不动的画面), see rec #11. Prompt extension is recommended |
| [Tencent-Hunyuan/HunyuanVideo-I2V](https://github.com/Tencent-Hunyuan/HunyuanVideo-I2V) | Tencent Hunyuan (CN) | **Community License, EU/UK/KR excluded** 💡 | Same | Tips: *"use concise prompts… overly detailed prompts can lead to unnecessary transitions"*. Prompt = subject + action (+ background, camera). `--i2v-stability` + flow-shift 7 = stable, 17 = dynamic. 129 frames ≈ 5 s |
| [zai-org/CogVideo](https://github.com/zai-org/CogVideo) | Zhipu / Tsinghua (CN) | Apache-2.0 ✅ (code) | CogVideoX-5B(-I2V) weights: **CogVideoX License** (2B is Apache) | 5B-I2V: 720×480, 49 frames, 8 fps = 6 s, English, ≤226 tokens. Long prompts produced by an LLM help. 1.5: 5 s or 10 s at 16 fps |
| [Lightricks/LTX-Video](https://github.com/Lightricks/LTX-Video) | Lightricks (IL) | Apache-2.0 ✅ (code) | OpenRAIL-M (0.9.x) / LTX-2.x Community License | "Detailed, chronological… single flowing paragraph… start directly with the action… within 200 words". Resolution a multiple of 32, frames = 8n+1, best under 720×1280 |
| [stepfun-ai/Step-Video-TI2V](https://github.com/stepfun-ai/Step-Video-TI2V) | StepFun (CN) | MIT ✅ | – | `motion_score`: 2 = more stable but may lack dynamism, 5 = default, 10–20 = intense |
| [lllyasviel/FramePack](https://github.com/lllyasviel/FramePack) | Lvmin Zhang / Stanford (US) | Apache-2.0 ✅ | HunyuanVideo-based weights (EU caveat) | Prompt template: "describe subject, then motion, then other things". Notes that models prefer large motions, so we must *ask* for small ones |
| [Phantom-video/Phantom](https://github.com/Phantom-video/Phantom) | ByteDance (CN) | Apache-2.0 ✅ | Wan-based | Subject-to-video with **≤4 refs**. *"Describe the visual content of the reference image as accurately as possible"*. To fix a bad result, change the seed first |
| [ali-vilab/VACE](https://github.com/ali-vilab/VACE) | Alibaba Tongyi (CN) | Apache-2.0 ✅ | Wan (Apache) / LTX (OpenRAIL) | All-in-one reference-to-video, masked video edit, "move/animate anything" |
| [SkyworkAI/SkyReels-V2](https://github.com/SkyworkAI/SkyReels-V2), [-A2](https://github.com/SkyworkAI/SkyReels-A2) | Skywork / Kunlun (CN) | **Skywork Community License (not OSI)** 💡 | Same | Long video / elements-to-video. Idea only |
| [PKU-YuanGroup/ConsisID](https://github.com/PKU-YuanGroup/ConsisID) | Peking Univ. (CN) | Apache-2.0 ✅ | CogVideoX-based | Identity-preserving video (faces). Not relevant beyond the idea |
| Kling "Elements", Vidu "reference-to-video" | Kuaishou / Shengshu (CN) | Closed | – | Kling: a **front-facing main image + 1–3 supplementary angle images**, 1–4 images per element (Kling user guide) |

### C. Rust crates (the only code we would ship). Add each one to `THIRD_PARTY_LICENSES.md`

| Crate | Repo | Licence (Cargo.toml) | Use in `lutins-core` |
|---|---|---|---|
| `image` | [image-rs/image](https://github.com/image-rs/image) | MIT OR Apache-2.0 ✅ | Decode, resize, buffers |
| `imageproc` | [image-rs/imageproc](https://github.com/image-rs/imageproc) | MIT ✅ | Sobel/gradients, Canny, Gaussian filter, integral images, Hough, region labelling, distance transform, morphology |
| `palette` | [Ogeon/palette](https://github.com/Ogeon/palette) | MIT OR Apache-2.0 ✅ | sRGB↔Lab/Oklab, **`Ciede2000` / `ImprovedCiede2000`**, `chromatic_adaptation` (Bradford / von Kries) |
| `rustfft` | [ejmahler/RustFFT](https://github.com/ejmahler/RustFFT) | MIT OR Apache-2.0 ✅ | Spectral-residual saliency, phase correlation (alignment). Pure Rust, builds for wasm |
| `kmeans_colors` | [okaneco/kmeans-colors](https://github.com/okaneco/kmeans-colors) | MIT OR Apache-2.0 ✅ | Scene palette (k-means in Lab) |
| `fast_image_resize` | [Cykooz/fast_image_resize](https://github.com/Cykooz/fast_image_resize) | MIT OR Apache-2.0 ✅ | Fast, good-quality downscale before metrics |
| `lsdetect` | [p5k369/lsdetect](https://github.com/p5k369/lsdetect) | MIT OR Apache-2.0 ✅ | Line Segment Detector, written independently from the IPOL paper (the README says no AGPL code was used) → vanishing points / horizon |
| `image-compare` | [ChrisRega/image-compare](https://github.com/ChrisRega/image-compare) | MIT ✅ | SSIM (8×8 windows), RMS, histogram distances. Good enough for a v1, or a reference to test our own SSIM against |
| `ssimulacra2` | [rust-av/ssimulacra2](https://github.com/rust-av/ssimulacra2) | BSD-2-Clause ✅ (LICENSE file) | A perceptual metric, heavier. Optional offline calibration tool |
| `deltae`, `empfindung`, `lab` | [ryanobeirne/deltae](https://github.com/ryanobeirne/deltae), [mina86/empfindung](https://github.com/mina86/empfindung), [TooManyBees/lab](https://github.com/TooManyBees/lab) | MIT ✅ | Alternatives to `palette` for ΔE00 / Lab (pick one, not all) |
| `color_quant`, `exoquant` | image-rs / exoticorn | MIT ✅ | Quantisation for the palette (alternative to k-means) |
| `kornia` | [kornia/kornia-rs](https://github.com/kornia/kornia-rs) | Apache-2.0 ✅ | Broad CV library. Probably too heavy for our wasm bundle |
| `photon-rs` | [silvia-odwyer/photon](https://github.com/silvia-odwyer/photon) | Apache-2.0 ✅ | Image effects for wasm (video-card frames), if useful |
| ❌ `dssim` | [kornelski/dssim](https://github.com/kornelski/dssim) | **AGPL-3.0** 💡 | Do not ship. Its idea (multi-scale SSIM in Lab) is free to re-implement from the papers |
| ❌ `imagequant` | [ImageOptim/libimagequant](https://github.com/ImageOptim/libimagequant) | **GPL-3.0-or-later** 💡 | Do not ship |

---

## 2. Lessons by area (short)

### 2.1 Consistency with an API we can't fine-tune
- **Every in-context model copies whatever is in the reference**: background, floor, shadows,
  rendering style. AnyDoor removes the reference background. Insert Anything and ACE++ use a
  clean ref panel next to the target. USO treats the first image as *content* and the others as
  *style*. → Send refs that are segmented, on flat white or transparent, with no ground shadow,
  and that **look like photographed felt** rather than a CG render.
- **Pixel budget:** UNO shrinks each ref to 320 px when there are several (512 px for one).
  OmniGen2: *"use… images in which people occupy a larger proportion of the frame"*. A 3×3
  sheet (3 elves × 3 views) in one 1024 px image gives each view about 300 px, and the face
  and hat details get lost.
- **Image count:** Qwen-Image-Edit-2509 works best with 1–3 input images, Phantom with ≤4, and
  Kling Elements with 1–4 per element (a front-facing main image first). → photo + 1–3 refs.
- **Image order and referencing:** OmniGen2's documented template is *"Edit the first image:
  add … from the second image. [detailed description of the target]"*. Put the photo first:
  it is the canvas. Name the refs by their order.
- **Text:** Kontext prompting rules (ComfyUI docs mirror the BFL guide). Use *specific
  descriptors instead of pronouns* ("the elf in the long red-and-white striped hat", not "he").
  Say *explicitly what must stay unchanged*. Prefer the verbs "add/change/replace" over
  "transform". Fix the position with *"keep … in the exact same position, scale"*.
  1Prompt1Story: identity holds better when every subject is described in one consistent prompt.
  Phantom: describe the ref's visual content accurately. OmniGen2: *"longer prompts generally
  yield better results"*, English works best, and the output size should match the image being
  edited.
- **Seeds:** ConsiStory exists because the same seed and prompt do *not* keep a subject. A seed
  helps only to reproduce a result. Phantom: when a result is bad, change the seed first.
  OmniGen2: generate several and pick one. → A retry = new seed + stricter prompt. Best-of-N
  with our own verifier as the judge.
- **Anchors:** ConsiStory and StoryDiffusion keep identity through *fixed* anchors. Never feed
  a nightly output back in as a reference (drift builds up from one night to the next).

### 2.2 Classical image analysis (Rust, no ML)
- **Saliency:** *spectral residual* (Hou & Zhang, CVPR 2007). Grey image at 64 px →
  log-amplitude spectrum minus its 3×3 mean → inverse FFT with the original phase → square →
  Gaussian blur. Cheap, gives coarse blobs. *Frequency-tuned* saliency (Achanta et al.,
  CVPR 2009) is simpler and has sharper boundaries: ‖mean Lab − Gaussian-blurred Lab‖ per pixel.
  Use FT for the "busy vs empty" map and spectral residual as a second opinion.
- **Free surfaces:** a stage = low saliency × low edge density (Sobel magnitude summed with an
  integral image) × good exposure × *support plausibility*. For support, take vanishing points
  from line segments (LSD: Grompone von Gioi et al., IPOL 2012; `lsdetect`) and derive the
  horizon. A horizontal top (floor, table, shelf) must lie **below the horizon** and usually sits
  just above a long, near-horizontal edge (the front edge of the table or shelf). The full room
  layout (Hedau, Hoiem & Forsyth, ICCV 2009; Lee, Hebert & Kanade, CVPR 2009 orientation maps)
  is the more ambitious version. **Shortcut:** the phone's `DeviceOrientation` gravity vector
  gives the camera pitch, hence the horizon line, with no vision at all.
- **Scale:** Hoiem, Efros & Hebert, *Putting Objects in Perspective* (CVPR 2006). Object height
  in px ≈ (v_contact − v_horizon) × H_object / (H_camera − H_support). With a 25 cm elf, the
  phone held at about 1.3–1.5 m and the support height (0 for the floor, about 0.75 m for a
  table), we can tell the model "about N % of the image height".
- **Light direction:** (a) find the brightest blobs (top 1–2 % luminance, saturated area)
  touching the border or the top: window or lamp → direction in the image plane. (b) Pentland
  (1982): the mean direction of the luminance gradient over smooth, low-texture regions
  estimates the light's tilt. Output 8 directions + soft/hard (from local contrast at shadow
  edges). That is enough for the prompt.
- **White balance / colour temperature:** grey-world (Buchsbaum 1980), white-patch / max-RGB,
  **shades-of-grey with Minkowski p = 6** (Finlayson & Trezzi 2004, the best p in their tests),
  and grey-edge (van de Weijer, Gevers & Gijsenij, IEEE TIP 2007), which is often better
  indoors. Estimate the illuminant → CCT (McCamy 1992) → words ("warm lamp light ≈ 2700–3200 K").
  The same estimate **adapts the elves' signature colours to the room light** (Bradford in
  `palette`) before comparing colours.
- **SSIM variants:** SSIM (Wang et al., IEEE TIP 2004: Gaussian 11×11, σ = 1.5, K1 = 0.01,
  K2 = 0.03). MS-SSIM (Wang, Simoncelli & Bovik 2003). **GMSD** (Xue et al., IEEE TIP 2014):
  gradient-magnitude similarity deviation, very cheap and little affected by a global tone
  shift. Edit models often re-expose the whole image, so use the *structure* terms (SSIM's c·s,
  or GMSD) rather than full SSIM.
- **CIEDE2000:** Sharma, Wu & Dalal (Color Res. Appl. 2005). The implementation is
  error-prone; use `palette::Ciede2000` and unit-test it against the paper's 34 published
  colour pairs. Rule of thumb: ΔE00 ≈ 1 is a just-noticeable difference, < 3 looks "the same"
  at a glance, > 10 is a different colour.

### 2.3 Image-to-video (short animation of the still)
- **I2V prompt = motion + camera.** The image already sets the subject, scene and style.
  "Fixed camera / static shot" locks the camera (Alibaba Model Studio guide). Third-party Wan
  guides note that without it the model invents a drift.
- **Concise beats long for I2V** (Hunyuan: long prompts cause "unnecessary transitions").
  LTX wants a detailed, chronological paragraph of ≤200 words. Compromise: 40–90 words, one
  action per elf, in time order.
- **Small motion is not the models' default** (FramePack's template prefers big motions; Wan's
  negative prompt pushes *away* from stillness). Stability controls exist: Step-Video
  `motion_score` 2–5, Hunyuan stable mode + flow-shift 7.
- **Length:** the native sweet spot is about 5 s everywhere (Wan 81 frames at 16 fps, Hunyuan
  129 frames, CogVideoX-I2V 6 s). Longer clips drift. **Aspect:** Wan I2V keeps the input's
  aspect ratio. Sizes are multiples of 16 (Wan, Agnes) or 32 (LTX).

---

## 3. Top 12 actionable recommendations (ranked by impact)

**1. Redesign the reference: one clean "line-up" image, not a 3×3 sheet.** Ref A = the three
elves side by side, front-facing, full body, same scale (Noisette at half height), on pure
white, no ground shadow, ≥1024 px wide, positions fixed left→right Pépin, Grelotte, Noisette.
Optional ref B = the same line-up at 3⁄4 view. Total ≤ 3 images including the photo.
*Why:* Qwen-Image-Edit-2509 works best with 1–3 images. UNO shrinks refs to 320 px when there
are several. OmniGen2 says consistency improves when the subject fills the frame. Kling
Elements = a front-facing main image + supplementary angles. AnyDoor and Insert Anything
segment the ref from its background. A/B it against "photo + one ref per elf" (4 images), but
start with the line-up.

**2. Make the reference look like *photographed felt*, and freeze it.** Render the three.js
sheet with a fibre/felt shader, soft studio light and slight depth of field. Or generate a
photographic version once, offline, have the owner approve it, and store it as the canonical
ref (`public/lutins/refs/`). Never use a nightly output as a ref. *Why:* in-context models copy
the ref's style along with its identity (USO separates content from style for exactly this
reason). A CG-looking ref pulls toward CG-looking elves in a real photo. ConsiStory and
StoryDiffusion hold identity through fixed anchors; chaining outputs builds up drift.
No running cost (one-time).

**3. Adopt the OmniGen2 + Kontext prompt skeleton** (the full template is in section 4).
Start with *"Edit the first image: add the three felt elf dolls from the second image."* Name
each elf by its visual descriptor (no pronouns, ever). End with an explicit preservation clause:
*"Keep everything else exactly the same: framing, furniture, objects, walls, colours, light
and perspective."* Use "add", never "transform". *Why:* the OmniGen2 README's in-context edit
format. The Kontext rules: specific descriptors over "she/he", "explicit preservation",
"verb selection", "keep … exact same position, scale".

**4. Tell the model WHERE and HOW BIG, from geometry.** From the stage finder, write the
surface by name and position ("on the wooden table top, lower left third"). Give the size as a
percentage of image height, computed from the horizon (device gravity or vanishing points via
`lsdetect`) with the Hoiem 2006 formula. Tell the model to stand the feet on that surface with
contact shadows. *Why:* Add-it (NVIDIA) shows that generative insertion often fails on
plausible *placement* (their affordance benchmark). MS-Diffusion and In-Context LoRA give each
subject an explicit place. Wrong scale is the most visible "fake" cue.

**5. Align before verifying, and ask for the same framing.** Request output width × height =
input size (multiples of 16). Before SSIM, estimate the global shift with **phase correlation**
(`rustfft`, 256 px luma). If the shift is > 3 % of the width or the peak is weak, the model
re-framed or zoomed: retry with "keep the exact same framing and zoom". *Why:* the OmniGen2
README says the output size must match the edited image. Edit models commonly re-crop
slightly. Without alignment, SSIM rejects good results.

**6. Use these verification metrics and starting thresholds** (calibrate on 30–50 real Agnes
outputs that a human has labelled; set each cut at the 5th percentile of the accepted ones).
Work at 256 px luma, with σ = 1 pre-blur, after alignment. Mask = the stage boxes dilated by
20 %.
- Structure outside the mask: SSIM *structure term* (c·s) or GMSD. Start with pass if
  c·s ≥ 0.80 / GMSD ≤ 0.10. Reject if c·s < 0.65 / GMSD > 0.15. In between, decide on the
  colour checks.
- Global colour drift outside the mask (64 px, mean ΔE00 photo↔output): ≤ 5 OK, > 10 reject
  (room repainted or re-lit).
- Changed area outside the mask (pixels with ΔE00 > 20): ≤ 3 % of the image.
*Why:* SSIM (Wang 2004) and GMSD (Xue 2014). Edit models shift exposure globally, so drop
SSIM's luminance term.

**7. Check each elf's colour signature after adapting to the room light.** Estimate the
illuminant with shades-of-grey (p = 6) or grey-edge. Bradford-adapt each elf's
primary + accent colour (`palette::chromatic_adaptation`). Count connected pixels within
ΔE00 ≤ 12 (`palette::Ciede2000`) inside the dilated stage. Require for each elf a primary blob
and an accent blob, each ≥ 0.15 % of the image area (scale with the expected elf size), less
than one elf-height apart. **More blobs than expected = "extra elves" → retry.** For Noisette,
use hazelnut brown + size, because cream is ambiguous. *Why:* Finlayson & Trezzi 2004
(p = 6), van de Weijer 2007, Sharma 2005. Without the illuminant correction, a warm lamp
turns lavender grey and green olive, and the check fails.

**8. Retry policy: new seed + targeted fix, plus optional best-of-2.** The retry prompt names
the failed check ("exactly three elves", "keep the exact framing", "the elf in the
lavender dress with the mustard scarf must be visible") and uses a new seed. If the daily cap
allows, ask for n = 2 and let the verifier pick. *Why:* ConsiStory (a seed does not carry
identity). Phantom ("change the seed" first). OmniGen2 ("increase the number of images per
prompt… pick").

**9. Keep the text bible fixed and write the prompt in English; extend it in Rust, not with an
LLM.** The identity paragraph is byte-identical every night, always in the same order with
the same names, and all three elves sit in one prompt. The parent picks from a **curated prank
catalogue** with pre-written English action slots (FR/EN in the UI). Free text is the
ChildShield-checked fallback. Our Rust builder plays the part of the "prompt extension" (scene
words from the analysis: surface, light, colour temperature, palette). *Why:* 1Prompt1Story
(one consistent prompt). OmniGen2 and CogVideoX: English works best. Wan, Qwen-Image and
CogVideoX all recommend prompt extension. Doing it deterministically adds no cost and needs no
free LLM.

**10. Video prompt = camera lock + one small action per elf + stillness clause** (template in
section 4). Open with "Fixed camera, static shot." Give each elf one short visual tag
(Phantom: describe the ref's visual content). Use 40–90 words in chronological order. *Why:*
Alibaba Model Studio I2V formula (motion + camera, "fixed camera"). Hunyuan (concise, or the
model adds transitions). LTX (chronological, literal, ≤200 words).

**11. Video negatives and motion strength.** Do **not** reuse Wan-style default negatives
that ban "static / still frame". Use instead: *camera movement, zoom, pan, shaking, cut, scene
change, morphing, furniture moving, flicker, extra characters, people, hands, text*. If Agnes
video exposes a motion or stability control, pick low to medium (Step-Video `motion_score`
2–5; Hunyuan stable mode with flow-shift 7). *Why:* Wan's `shared_config.py` negative list;
the Step-Video and HunyuanVideo-I2V READMEs.

**12. Video format and check: 5 s, same aspect as the still, verified on 3 frames, looped on
the device.** Ask for about 5 s (the native length of Wan, Hunyuan and CogVideoX; longer
clips drift). Keep the still's aspect ratio and size (multiples of 16), and keep the elves at
≥ 1/6 of the frame height (small subjects lose detail). In the browser, grab the first, middle
and last frames (`<video>` → canvas) and run the same Rust verifier. Background structure vs
frame 0 catches camera drift; the colour signatures catch an elf melting or vanishing. Play it
**ping-pong (forward + reverse) on the device** for a seamless 10 s loop at no cost. *Why:* the
READMEs of Wan (81 frames, aspect follows the input), HunyuanVideo-I2V (129 frames) and
CogVideo (6 s); the OmniGen2 note on subject size.

---

## 4. Starting templates (for the Rust prompt builder)

**Image (references: [1] photo, [2] line-up ref, [3] optional 3⁄4 line-up):**
```
Edit the first image: add the three small felt elf dolls shown in the second image
(left to right: Pépin, Grelotte, Noisette). Keep everything else in the first image exactly
the same: same framing and zoom, same furniture, objects, walls, colours, light and
perspective.
{bible.style}
Pépin — {bible.elves[0].look}
Grelotte — {bible.elves[1].look}
Noisette — {bible.elves[2].look}
Placement: the three elves stand on {stage.surface} in the {stage.position} of the photo,
feet on the surface, each about {scale_pct}% of the image height (Noisette half that),
with soft contact shadows that match the room's shadows.
Light: {light.direction}, {light.softness}, {light.cct_words}; the felt is lit by this same light.
Action: {prank.action_en}
Exactly three elves. {bible.negative}
```
**Retry suffix:** `Important: {failed_check_sentence}. Do not move, crop or zoom the photo.`
(+ new seed).

**Video (input = the verified still):**
```
Fixed camera, static shot, no camera movement. The three small felt elf dolls come to life
with small, gentle movements: the elf in the long red-and-white striped hat {act1}; the elf
with the mustard scarf and round glasses {act2}; the tiny elf in the acorn-cap hood {act3}.
The room, the furniture and the light stay completely still.
Negative: camera movement, zoom, pan, shaking, cut, scene change, morphing, melting,
furniture moving, flicker, extra characters, people, hands, text, subtitles, blurry, deformed.
```
(Our hypothesis, not sourced: adding "stop-motion-like movement" may suit felt dolls. A/B it.)

---

## 5. Do-not-ship / idea-only list
AGPL `dssim`; GPL `imagequant`; NVIDIA License (ConsiStory, Add-it); FLUX.1-dev Non-Commercial
(ICEdit, Kontext [dev] weights, and the weights of every FLUX-dev-based model: UNO, DreamO,
InfiniteYou, USO, ACE++, In-Context-LoRA); Tencent Hunyuan Community License (HunyuanVideo-I2V,
HunyuanCustom; it **excludes the EU**); Skywork Community License; CogVideoX-5B weights; LTX
weights (OpenRAIL-M / community); repos without a LICENSE file (In-Context-LoRA, ACE++,
StoryMaker, OmniConsistency). We copy no model code at all. Only the Rust crates in section C
(✅) may enter the binary.

## Sources (beyond the repo links above)
- OmniGen2 usage tips and in-context edit format: OmniGen2 README, "Usage Tips".
- Kontext prompting rules: ComfyUI docs mirror of BFL's guide,
  `Comfy-Org/docs/snippets/tutorials/flux/prompt-techniques.mdx` (docs.bfl.ai blocked here).
- Qwen-Image-Edit-2509 (1–3 images, joined-image training): Qwen-Image README and
  [HF model card](https://huggingface.co/Qwen/Qwen-Image-Edit-2509/blob/main/README.md), via search.
- Wan default negative and frame count: `Wan2.2/wan/configs/shared_config.py`, `wan_i2v_A14B.py`.
- I2V prompt formula: [Alibaba Model Studio prompt guide](https://help.aliyun.com/en/model-studio/text-to-video-prompt).
- Kling Elements: [Kling Element Library guide](https://kling.ai/quickstart/klingai-element-library-3-user-guide).
- Agnes request shape (`extra_body.image`, sizes ×16): third-party plugin README
  ([dsh-agnes-image](https://raw.githubusercontent.com/Lijianan-123/dsh-agnes-image/4bd1663caea2c2dbab2bb063f5c25076cc0d7ae0/README.md)), not official docs.
- Classical papers: Hou & Zhang CVPR 2007; Achanta et al. CVPR 2009; Hoiem, Efros & Hebert CVPR
  2006; Hedau, Hoiem & Forsyth ICCV 2009; Lee, Hebert & Kanade CVPR 2009; Grompone von Gioi et al.
  IPOL 2012; Pentland 1982; Buchsbaum 1980; Finlayson & Trezzi 2004; van de Weijer et al. TIP 2007;
  McCamy 1992; Wang et al. TIP 2004; Wang, Simoncelli & Bovik 2003; Xue et al. TIP 2014;
  Sharma, Wu & Dalal 2005.

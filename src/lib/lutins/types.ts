/**
 * JSON shapes of the Lutins Farceurs engine (Rust → WebAssembly,
 * rust/lutins-core). The Rust structs are the source of truth; these types
 * mirror them field for field (engine.test.ts checks real outputs against them).
 */

/** A bible elf id (src/data/lutins/bible.json). */
export type ElfId = 'pepin' | 'grelotte' | 'noisette';

/** RGBA8 pixels, row-major, no padding: what `ImageData` holds. */
export type RgbaLike = { data: Uint8Array | Uint8ClampedArray; width: number; height: number };

/** An RGBA8 image returned by the engine (can be passed to `new ImageData(data, width, height)`). */
export type RgbaImage = { data: Uint8ClampedArray; width: number; height: number };

export type ColorTemp = 'warm' | 'neutral' | 'cool';

/** Where the main light comes from ("front" = the camera side). Light from below is reported as "diffuse". */
export type LightDir = 'left' | 'right' | 'top' | 'front' | 'diffuse';

/** Coarse position of a stage: 3 × 3 grid cell of its centre. */
export type StagePos =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'centre'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';

export type PaletteEntry = {
  /** `#rrggbb` */
  hex: string;
  /** Share of the pixels, 0–1 (the entries sum to 1). */
  share: number;
};

/** A free area for the elves, normalised 0–1 (origin top-left). */
export type Stage = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0–1, stages are sorted best first. */
  score: number;
  label: StagePos;
  /** A long horizontal edge (table / shelf edge, wall-surface line) runs right above it. */
  below_edge: boolean;
};

/** Output of `analyzeScene`. */
export type SceneAnalysis = {
  /** Size of the analysed photo. */
  width: number;
  height: number;
  /** Mean gamma-encoded luma Y′, 0–1. */
  brightness: number;
  /** RMS contrast (standard deviation of Y′), 0–0.5. */
  contrast: number;
  color_temp: ColorTemp;
  /** Correlated colour temperature estimate (1 500–15 000 K). */
  kelvin: number;
  light_dir: LightDir;
  /** 0 (no direction) – 1 (strong directional light). */
  light_strength: number;
  /** Up to 5 dominant colours, by decreasing share. */
  palette: PaletteEntry[];
  /** brightness < 0.25: the prompt asks for a cosy lamp glow, no flash look. */
  is_dark: boolean;
  /** Variance of the Laplacian of Y′ (0–255 units) on the ≤ 256 px working copy. */
  sharpness: number;
  /** 0 sharp – 1 very blurry. */
  blur: number;
  is_blurry: boolean;
  /** Up to 4, best first; empty when there is no usable free area. */
  stages: Stage[];
};

/**
 * Scene sent to `buildPrompt`. May come from the client: the engine validates
 * and clamps every field and drops invalid ones (reported in `warnings`).
 * `horizon` is optional and not produced by `analyzeScene`: the share of the
 * image height (from the top) where the horizon line is, e.g. from the
 * phone's DeviceOrientation pitch; it sharpens the elves' size estimate.
 */
export type SceneInput = Partial<SceneAnalysis> & { horizon?: number | null };

export type PrankInput = {
  /** Catalogue id (src/data/lutins/pranks.ts). */
  id: string;
  /** English action without subject ("are racing toy cars …"). TAKE IT FROM THE CATALOGUE BY ID, never from the client. */
  action: string;
  /** Catalogue title, for the child's caption. */
  title?: { fr?: string; en?: string };
};

/** Verification reasons (see `Verification.reasons`). */
export type VerifyReason =
  | 'framing_changed'
  | 'room_changed'
  | 'room_recolored'
  | `elf_missing:${ElfId}`
  | 'extra_elves'
  | 'too_dark'
  | 'blank';

/** Input of `buildPrompt`. */
export type PromptInput = {
  /** Caption locale: "fr" → French, anything else → English. The prompt is always English. */
  locale: string;
  /** 1–3 distinct ids; order kept in the prompt and caption. */
  elves: ElfId[];
  prank?: PrankInput | null;
  /** Parent's own words, already cleaned and ChildShield-checked (≤ 240 chars kept). Never echoed in the caption. */
  parent_text?: string | null;
  scene?: SceneInput | null;
  /** Retry: stronger keep-the-room / keep-the-design wording; implies attempt ≥ 1. */
  strict?: boolean;
  /** 0 for the first attempt (default: 1 when strict). The seed is the base seed + attempt. */
  attempt?: number;
  /** Reasons of the failed verification, each turned into a sentence of the retry prompt. */
  failed?: VerifyReason[] | string[];
};

/** Output of `buildPrompt`. */
export type PromptOut = {
  /** English prompt for the image model (image 1 = the photo, image 2 = the elves' reference line-up). */
  prompt: string;
  /** Keyword negative prompt, for models that take one. */
  negative: string;
  /** Stable 31-bit seed: hash of locale, elves, prank and parent text (not the scene) + attempt. */
  seed: number;
  /** Short cheerful sentence for the child's journal, in the requested locale. */
  caption: string;
  /** The elves' height used in the prompt, % of the image height. */
  elf_height_pct: number;
  /** Dropped scene fields, unknown failed reasons… (for logs). */
  warnings: string[];
};

/** A normalised rectangle, 0–1. */
export type Rect = { x: number; y: number; w: number; h: number };

/** What `verify` checks: the requested elves and optional areas where they were placed (e.g. the stages). */
export type VerifyRequest = { elves: ElfId[]; mask?: Rect[] };

export type RoomCheck = {
  ok: boolean;
  /** SSIM contrast·structure term outside the edited areas (1 = identical). Pass ≥ 0.80, reject < 0.65. */
  structure: number;
  /** Full SSIM outside the edited areas. */
  ssim: number;
  /** Gradient magnitude similarity deviation (0 = identical). Pass ≤ 0.10, reject > 0.15. */
  gmsd: number;
  /** Mean CIEDE2000 colour drift (≤ 5 fine, > 10 = room_recolored). */
  drift: number;
  /** Share of the frame outside the edited areas whose colour moved by ΔE00 > 20. */
  changed: number;
  /** Pearson correlation of the edge maps (informative). */
  edge_corr: number;
  /** Share of the frame left out of these metrics. */
  masked: number;
};

export type AlignCheck = {
  /** Shift of the generated picture as a share of the width / height. */
  dx: number;
  dy: number;
  /** Zoom found (1 = none). */
  scale: number;
  /** Phase-correlation peak, 0–1. */
  peak: number;
};

export type ElfCheck = {
  id: ElfId;
  present: boolean;
  /** New primary-colour area, share of the frame (present needs ≥ 0.0015). */
  primary: number;
  /** New accent-colour area near a primary patch (needs ≥ 0.0005, except Noisette). */
  accent: number;
  /** Separate large primary clusters (≥ 3 → extra_elves). */
  clusters: number;
};

/** Output of `verify` / `verifyEncoded`. */
export type Verification = {
  ok: boolean;
  /** 0–1, to pick the best of several attempts. */
  score: number;
  /** Machine-readable, fixed order; pass them as `failed` to the retry prompt. */
  reasons: VerifyReason[];
  room: RoomCheck;
  align: AlignCheck;
  /** In the requested order. */
  elves: ElfCheck[];
  extra_elves: boolean;
  /** Mean luma 0–1. */
  brightness_generated: number;
  brightness_original: number;
};

/** Magic-card style; every field optional (defaults in brackets). */
export type CardStyle = {
  /** Output size [the photo's], 16–2048. */
  out_w?: number;
  out_h?: number;
  /** Loop length in seconds [12]. */
  duration?: number;
  /** Extra zoom at mid-loop [0.08], 0–0.3. */
  zoom?: number;
  /** Pan amount [0.6], 0–1. */
  pan?: number;
  /** Snowflakes [90], 0–400. */
  snow?: number;
  /** Golden sparkles [24], 0–200. */
  sparkles?: number;
  /** Vignette strength [0.35], 0–1. */
  vignette?: number;
  /** Glow pulse strength [0.5], 0–1. */
  glow?: number;
  /** Glow colour ['#ffd27a']. */
  glow_color?: string;
};

/** Security-camera ("caught on camera") style; every field optional (defaults in brackets). */
export type CctvStyle = {
  /** Output size [the picture's], 16–2048. */
  out_w?: number;
  out_h?: number;
  /** Green night vision or grey CCTV ['night']. */
  look?: 'night' | 'grey';
  /** Seconds for the slow digital zoom to reach its maximum [7], 0.5–120. */
  duration?: number;
  /** Extra zoom at the end [0.18], 0–0.6. */
  zoom?: number;
  /** Where to zoom (normalised rectangle of the picture) [found by the engine from the elves' colours, else the centre]. */
  focus?: Rect | null;
  /** Look for the elves when `focus` is not given [true]. */
  auto_focus?: boolean;
  /** Barrel (fish-eye) distortion [0.12], 0–0.4. */
  barrel?: number;
  /** Scanline darkness [0.22], 0–1. */
  scanlines?: number;
  /** Sensor grain [0.35], 0–1. */
  noise?: number;
  /** Vignette [0.55], 0–1. */
  vignette?: number;
  /** How often an interference line tears the picture [0.5], 0–1. */
  interference?: number;
  /** Extra gain after the auto-gain [1], 0.3–3. */
  gain?: number;
  /** Grain frames per second [15], 1–60 (grain is deterministic per grain frame). */
  grain_fps?: number;
};

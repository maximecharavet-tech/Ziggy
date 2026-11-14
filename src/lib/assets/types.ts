/**
 * Asset registry — shared types (pure: no three.js, no DOM, no Node).
 *
 * Every file or code-built asset a game or page ships (images, 3D models built in
 * code, ML models, wasm, audio, face tracks…) gets one entry in
 * `src/data/assets/manifest.json`. The registry answers "where is it, which
 * version, under which licence, what does it need", and the validator keeps the
 * manifest honest (unique ids, allowed licences only, files really there).
 *
 * See docs/ASSET_PIPELINE.md for the production pipeline and the rules.
 */

/** Version of the manifest *format* (not of the assets). */
export const MANIFEST_SCHEMA_VERSION = 1;

export const ASSET_TYPES = [
  /** A finished picture shown as is (photo, poster, reference sheet, avatar). */
  'image',
  /** A texture fed to a material (baked offline or painted). */
  'texture',
  /** A 3D model built in code (three.js Group factory): `location.kind = 'source'`. */
  'code-model',
  /** A 3D model file (glTF binary). */
  'model',
  /** A material / texture generator built in code (felt, knit, stitches). */
  'code-material',
  /** A skeletal or property animation clip (glTF clip or JSON keyframes). */
  'animation-clip',
  /** Frames packed in one image + a JSON atlas. */
  'spritesheet',
  /** A sound effect or a music file. */
  'audio',
  /** Sound or music synthesised in code at runtime (Web Audio). */
  'code-audio',
  /** A pre-generated voice line (audio + word timings + visemes). */
  'voice',
  /** Face animation track (visemes / expressions over time) for a FaceAnimator. */
  'face-track',
  /** An on-device ML model (MediaPipe .tflite, ONNX…). */
  'ml-model',
  /** A WebAssembly module (and its JS glue as a dependency). */
  'wasm',
  /** A JavaScript file served as is (wasm glue, worker). */
  'script',
  /** Structured data (level files, bibles, recipes). */
  'data',
  'font',
  'video',
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

/** File formats, named after their extension. */
export const ASSET_FORMATS = ['png', 'webp', 'jpg', 'svg', 'avif', 'ktx2', 'glb', 'json', 'ts', 'js', 'wasm', 'tflite', 'onnx', 'mp3', 'ogg', 'wav', 'woff2', 'mp4', 'webm'] as const;
export type AssetFormat = (typeof ASSET_FORMATS)[number];

/**
 * Licences an asset may carry (SPDX ids).
 * - `LicenseRef-Ziggy`: our own work — built in code, rendered from our code,
 *   the owner's official artwork, or baked offline by us from an allowed model.
 * - MIT / Apache-2.0 / BSD: the project's licence rule (CLAUDE.md).
 * - CC0-1.0 / LicenseRef-PublicDomain: no rights reserved (e.g. a public-domain melody).
 */
export const ALLOWED_LICENCES = ['LicenseRef-Ziggy', 'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'CC0-1.0', 'LicenseRef-PublicDomain'] as const;
/** Permissive, but each use needs the owner's written OK (`licenceApproval`). */
export const APPROVAL_LICENCES = ['ISC', 'Zlib', 'Unicode-3.0', 'CC-BY-4.0'] as const;
export type AllowedLicence = (typeof ALLOWED_LICENCES)[number];
export type ApprovalLicence = (typeof APPROVAL_LICENCES)[number];
export type AssetLicence = AllowedLicence | ApprovalLicence;

/** Where the asset lives. Remote URLs are not allowed: everything is self-hosted. */
export type AssetLocation =
  /** A file served from `public/` (path starts with `/`, e.g. `/lutins/refs/pepin.png`). */
  | {
      kind: 'public';
      path: string;
      /**
       * Set when the file is not committed but copied/downloaded by a script at
       * install time (e.g. `scripts/santa-mediapipe.mjs`): the validator then
       * checks that the script exists, and the file only when it is present.
       */
      provisionedBy?: string;
    }
  /** Code in the repo (a code-built model, a generator, a data file), path from the repo root. */
  | { kind: 'source'; path: string; exportName?: string };

/** How the asset was made. */
export type AssetSourceKind =
  /** Written by hand in code (three.js geometry, Web Audio synth, canvas textures). */
  | 'code'
  /** Rendered offline from our code by a script (reference sheets, baked textures). */
  | 'render-script'
  /** Baked offline by an AI model we run ourselves (textures, voices, face tracks). */
  | 'ai-bake'
  /** Downloaded from a third party, unmodified (ML models, runtimes). */
  | 'download'
  /** Copied from an npm package at install time. */
  | 'npm-copy'
  /** Compiled from our own source (Rust → wasm). */
  | 'build'
  /** Supplied by the owner (official artwork, photos of the plush). */
  | 'owner-artwork';

export interface AssetSource {
  kind: AssetSourceKind;
  /** Script or source file that produces it, from the repo root (render/bake/build). */
  script?: string;
  /** Upstream page or download URL (third-party assets: required). */
  origin?: string;
  /** Tool or model and its version (e.g. "Kokoro-82M via voice-engine 2.0", "SwiftShader render"). */
  tool?: string;
  /** Free text: settings, seed, date. */
  notes?: string;
}

export interface AssetResolution {
  width: number;
  height: number;
}

export interface AssetEntry {
  /**
   * Unique, stable id: dot-separated lowercase segments, e.g.
   * `lutins.ref.pepin`, `santa.mediapipe.selfie-segmenter`. Never reuse an id
   * for a different thing; bump `version` instead.
   */
  id: string;
  type: AssetType;
  format: AssetFormat;
  /** Pixel size for images, textures, spritesheets and videos. */
  resolution?: AssetResolution;
  /** Semantic version of the asset itself (bump when the file or its look changes). */
  version: string;
  licence: AssetLicence;
  /** Owner's OK for an APPROVAL_LICENCES licence: who/when/where, e.g. "owner, 2026-11-08, CLAUDE.md". */
  licenceApproval?: string;
  /** Copyright holder, e.g. "© Ziggy" or "© Google LLC". */
  copyright: string;
  /** What it is and what it is for (English, one or two sentences). */
  description: string;
  location: AssetLocation;
  /** Ids of the assets this one needs or was made from (refs ← code models). */
  dependencies?: string[];
  source: AssetSource;
  /** Free tags for lookups: `lutins`, `santa`, `mascot`, `reference`, `ml`… */
  tags?: string[];
}

export interface AssetManifest {
  schemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  assets: AssetEntry[];
}

/** One problem found by the validator. `error` fails the tests; `warning` is reported. */
export interface AssetIssue {
  level: 'error' | 'warning';
  /** The asset id (or `manifest` for top-level problems). */
  id: string;
  code:
    | 'schema'
    | 'bad-id'
    | 'duplicate-id'
    | 'bad-version'
    | 'licence-forbidden'
    | 'licence-needs-approval'
    | 'bad-location'
    | 'missing-file'
    | 'format-mismatch'
    | 'bad-resolution'
    | 'missing-dependency'
    | 'dependency-cycle'
    | 'missing-origin';
  message: string;
}

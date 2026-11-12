/**
 * The Lutins Farceurs engine (Rust → WebAssembly, rust/lutins-core), for the
 * browser and the Node API routes alike.
 *
 *   const engine = await loadEngine();
 *   const scene = engine.analyzeScene(imageData);
 *
 * - Browser: loads `wasm/lutins_core_bg.wasm` (no image decoders, ~130 kB
 *   gzipped) through `new URL(…, import.meta.url)`, which Next bundles as a
 *   static asset (the same pattern as src/lib/tv/wasm-nav.ts).
 * - Node (API routes, Vitest): reads `wasm/lutins_core_full_bg.wasm` (with
 *   PNG/JPEG/WebP decoding) from disk at `process.cwd()/src/lib/lutins/wasm/`.
 *   A route that uses it must list the file for Vercel's output tracing in
 *   next.config.ts:
 *     outputFileTracingIncludes: { '/api/lutins/**': ['./src/lib/lutins/wasm/lutins_core_full_bg.wasm'] }
 *
 * Built by `npm run lutins:wasm` (the files in ./wasm are committed).
 * JSON shapes: ./types.ts.
 */
import type {
  CardStyle,
  ElfId,
  IdeaCheck,
  Plan,
  PlanRequest,
  PromptInput,
  PromptOut,
  RgbaImage,
  RgbaLike,
  SceneAnalysis,
  Verification,
  VerifyRequest,
} from './types';

export type * from './types';

type Glue = typeof import('./wasm/lutins_core_full.js');
type ImageOut = Glue['ImageOut']['prototype'];
type RawRenderer = Glue['CardRenderer']['prototype'];

/** A magic-card renderer holding the photo in WebAssembly memory. Call `free()` when done. */
export type CardRendererHandle = {
  readonly width: number;
  readonly height: number;
  /** The frame at `t` seconds (a copy you own). */
  render(t: number): Uint8ClampedArray;
  /**
   * The frame at `t` seconds as a view into WebAssembly memory (no copy): use
   * it at once (e.g. `ctx.putImageData(new ImageData(view, w, h), 0, 0)`); it
   * is invalidated by the next call into the engine.
   */
  renderView(t: number): Uint8ClampedArray;
  free(): void;
};

export type LutinsEngine = {
  /** Crate version. */
  version: string;
  /** FNV-1a 32 of the bible.json embedded in this build. */
  bibleHash: number;
  /** FNV-1a 32 of the pranks.json embedded in this build. */
  pranksHash: number;
  /** True for the Node build (has `decodeImage` / `verifyEncoded`). */
  canDecode: boolean;
  analyzeScene(img: RgbaLike): SceneAnalysis;
  buildPrompt(input: PromptInput): PromptOut;
  /** Cleans and checks a parent's own prank idea (same cleaning as `cleanParentText`, plus the gentle-words gate). */
  checkIdea(text: string): IdeaCheck;
  /** Whether `id` is a prank of the catalogue. */
  isPrankId(id: string): boolean;
  /** The prank(s) of the night, deterministic in the seed (place filter, no repeat over the last N nights). */
  planPranks(req: PlanRequest): Plan;
  verify(generated: RgbaLike, original: RgbaLike, elves: ElfId[] | VerifyRequest): Verification;
  /** Node build only: verify from encoded PNG / JPEG / WebP files. */
  verifyEncoded(generated: Uint8Array, original: Uint8Array, elves: ElfId[] | VerifyRequest): Verification;
  /** One magic-card frame (one-shot; for an animation prefer `createCardRenderer`). */
  renderCardFrame(base: RgbaLike, t: number, seed: number, style?: CardStyle): RgbaImage;
  createCardRenderer(base: RgbaLike, seed: number, style?: CardStyle): CardRendererHandle;
  /** High-quality downscale to fit `maxSide` (never enlarges) + optional mild auto white balance / levels. */
  preparePhoto(img: RgbaLike, maxSide: number, autoFix?: boolean): RgbaImage;
  /** Node build only: decode a PNG / JPEG / WebP file. */
  decodeImage(bytes: Uint8Array): RgbaImage;
};

/** Where the Node build reads the WebAssembly from (relative to `process.cwd()`). */
export const NODE_WASM_PATH = 'src/lib/lutins/wasm/lutins_core_full_bg.wasm';

const u8 = (d: Uint8Array | Uint8ClampedArray): Uint8Array =>
  d instanceof Uint8Array ? d : new Uint8Array(d.buffer, d.byteOffset, d.byteLength);

const clamped = (d: Uint8Array): Uint8ClampedArray => new Uint8ClampedArray(d.buffer, d.byteOffset, d.byteLength);

function take(out: ImageOut): RgbaImage {
  try {
    return { data: clamped(out.rgba()), width: out.width, height: out.height };
  } finally {
    out.free();
  }
}

const elvesJson = (elves: ElfId[] | VerifyRequest) => JSON.stringify(elves);

function wrap(glue: Glue, memory: WebAssembly.Memory, canDecode: boolean): LutinsEngine {
  const needDecode = () => {
    if (!canDecode) throw new Error('lutins-core: image decoding is only in the Node build (decode with canvas in the browser)');
  };
  return {
    version: glue.engine_version(),
    bibleHash: glue.bible_hash(),
    pranksHash: glue.pranks_hash(),
    canDecode,
    analyzeScene: (img) => JSON.parse(glue.analyze_scene(u8(img.data), img.width, img.height)) as SceneAnalysis,
    buildPrompt: (input) => JSON.parse(glue.build_prompt(JSON.stringify(input))) as PromptOut,
    checkIdea: (text) => JSON.parse(glue.check_idea(text.normalize('NFC'))) as IdeaCheck,
    isPrankId: (id) => glue.is_prank_id(id),
    planPranks: (req) => JSON.parse(glue.plan_pranks(JSON.stringify(req))) as Plan,
    verify: (g, o, elves) =>
      JSON.parse(glue.verify(u8(g.data), g.width, g.height, u8(o.data), o.width, o.height, elvesJson(elves))) as Verification,
    verifyEncoded: (g, o, elves) => {
      needDecode();
      return JSON.parse(glue.verify_encoded(g, o, elvesJson(elves))) as Verification;
    },
    renderCardFrame: (base, t, seed, style = {}) => {
      const data = glue.render_card_frame(u8(base.data), base.width, base.height, t, seed >>> 0, JSON.stringify(style));
      const width = Math.min(2048, Math.max(16, style.out_w ?? base.width));
      return { data: clamped(data), width, height: data.length / 4 / width };
    },
    createCardRenderer: (base, seed, style = {}) => {
      const r: RawRenderer = new glue.CardRenderer(u8(base.data), base.width, base.height, seed >>> 0, JSON.stringify(style));
      return {
        width: r.width,
        height: r.height,
        render: (t) => clamped(r.render(t)),
        renderView: (t) => {
          r.render_in_place(t);
          return new Uint8ClampedArray(memory.buffer, r.frame_ptr(), r.frame_len());
        },
        free: () => r.free(),
      };
    },
    preparePhoto: (img, maxSide, autoFix = false) =>
      take(glue.prepare_photo(u8(img.data), img.width, img.height, maxSide, autoFix)),
    decodeImage: (bytes) => {
      needDecode();
      return take(glue.decode_image(bytes));
    },
  };
}

let loading: Promise<LutinsEngine> | null = null;
let loaded: LutinsEngine | null = null;

/**
 * Loads the engine once (later calls return the same promise). `wasmPath`
 * overrides the Node file location (absolute, or relative to `process.cwd()`).
 */
export function loadEngine(opts: { wasmPath?: string } = {}): Promise<LutinsEngine> {
  loading ??= (async () => {
    let engine: LutinsEngine;
    // `typeof window` is inlined on purpose: Next replaces it at compile time,
    // so each bundle keeps only its branch (the browser never sees the Node build).
    if (typeof window === 'undefined' && typeof process !== 'undefined' && typeof process.versions?.node === 'string') {
      const glue = (await import('./wasm/lutins_core_full.js')) as Glue;
      const fs = process.getBuiltinModule('node:fs');
      const p = opts.wasmPath ?? NODE_WASM_PATH;
      const file = p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p) ? p : `${process.cwd()}/${p}`;
      const exports = glue.initSync({ module: fs.readFileSync(file) });
      engine = wrap(glue, exports.memory, true);
    } else {
      const glue = (await import('./wasm/lutins_core.js')) as unknown as Glue;
      const exports = await glue.default({ module_or_path: new URL('./wasm/lutins_core_bg.wasm', import.meta.url) });
      engine = wrap(glue, exports.memory, false);
    }
    loaded = engine;
    return engine;
  })();
  loading.catch(() => {
    loading = null; // allow a retry after a failed load (offline, …)
  });
  return loading;
}

function engine(): LutinsEngine {
  if (!loaded) throw new Error('lutins-core: call `await loadEngine()` first');
  return loaded;
}

// Typed wrappers (synchronous once `loadEngine()` has resolved).
export const analyzeScene = (img: RgbaLike) => engine().analyzeScene(img);
export const buildPrompt = (input: PromptInput) => engine().buildPrompt(input);
export const checkIdea = (text: string) => engine().checkIdea(text);
export const isPrankId = (id: string) => engine().isPrankId(id);
export const planPranks = (req: PlanRequest) => engine().planPranks(req);
export const verify = (generated: RgbaLike, original: RgbaLike, elves: ElfId[] | VerifyRequest) =>
  engine().verify(generated, original, elves);
export const verifyEncoded = (generated: Uint8Array, original: Uint8Array, elves: ElfId[] | VerifyRequest) =>
  engine().verifyEncoded(generated, original, elves);
export const renderCardFrame = (base: RgbaLike, t: number, seed: number, style?: CardStyle) =>
  engine().renderCardFrame(base, t, seed, style);
export const createCardRenderer = (base: RgbaLike, seed: number, style?: CardStyle) =>
  engine().createCardRenderer(base, seed, style);
export const preparePhoto = (img: RgbaLike, maxSide: number, autoFix?: boolean) =>
  engine().preparePhoto(img, maxSide, autoFix);
export const decodeImage = (bytes: Uint8Array) => engine().decodeImage(bytes);

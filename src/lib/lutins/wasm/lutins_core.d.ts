/* tslint:disable */
/* eslint-disable */

/**
 * Stateful magic-card renderer: keeps the photo and the precomputed tables
 * in WebAssembly memory, so each frame costs only the rendering.
 */
export class CardRenderer {
    free(): void;
    [Symbol.dispose](): void;
    frame_len(): number;
    frame_ptr(): number;
    constructor(base: Uint8Array, w: number, h: number, seed: number, style_json: string);
    /**
     * Renders the frame at `t` seconds and returns a copy.
     */
    render(t: number): Uint8Array;
    /**
     * Renders the frame at `t` seconds in place; read it without a copy
     * through `new Uint8ClampedArray(memory.buffer, frame_ptr(), frame_len())`
     * (the view is valid until the next call into the engine).
     */
    render_in_place(t: number): void;
    readonly height: number;
    readonly width: number;
}

/**
 * An RGBA8 image returned to JavaScript. Call `free()` when done.
 */
export class ImageOut {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * The pixels (a copy).
     */
    rgba(): Uint8Array;
    readonly height: number;
    readonly width: number;
}

/**
 * Scene analysis of a room photo → `SceneAnalysis` JSON.
 */
export function analyze_scene(rgba: Uint8Array, w: number, h: number): string;

/**
 * FNV-1a 32 of the embedded `bible.json` (detects a stale build).
 */
export function bible_hash(): number;

/**
 * `PromptInput` JSON → `PromptOut` JSON.
 */
export function build_prompt(input_json: string): string;

/**
 * The crate version (`0.1.0`).
 */
export function engine_version(): string;

/**
 * Downscale to fit `max_side` (never enlarges) + optional mild auto white
 * balance and levels.
 */
export function prepare_photo(rgba: Uint8Array, w: number, h: number, max_side: number, auto_fix: boolean): ImageOut;

/**
 * One frame of the magic card (RGBA8 of the style's output size, default the
 * photo's size).
 */
export function render_card_frame(base: Uint8Array, w: number, h: number, t: number, seed: number, style_json: string): Uint8Array;

/**
 * Verifies a generated picture against the photo → `Verification` JSON.
 * `elves_json`: `["pepin", …]` or `{"elves": [...], "mask": [{x,y,w,h}]}`.
 */
export function verify(generated: Uint8Array, gw: number, gh: number, original: Uint8Array, ow: number, oh: number, elves_json: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_cardrenderer_free: (a: number, b: number) => void;
    readonly __wbg_imageout_free: (a: number, b: number) => void;
    readonly analyze_scene: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly bible_hash: () => number;
    readonly build_prompt: (a: number, b: number, c: number) => void;
    readonly cardrenderer_frame_len: (a: number) => number;
    readonly cardrenderer_frame_ptr: (a: number) => number;
    readonly cardrenderer_height: (a: number) => number;
    readonly cardrenderer_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly cardrenderer_render: (a: number, b: number, c: number) => void;
    readonly cardrenderer_render_in_place: (a: number, b: number) => void;
    readonly cardrenderer_width: (a: number) => number;
    readonly engine_version: (a: number) => void;
    readonly imageout_height: (a: number) => number;
    readonly imageout_rgba: (a: number, b: number) => void;
    readonly imageout_width: (a: number) => number;
    readonly prepare_photo: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly render_card_frame: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly verify: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export3: (a: number, b: number, c: number, d: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

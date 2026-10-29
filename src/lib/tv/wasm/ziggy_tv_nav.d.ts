/* tslint:disable */
/* eslint-disable */

/**
 * WebAssembly entry: `rects` is [x, y, w, h, x, y, w, h, …]; returns the
 * index to focus, or -1 to stay.
 */
export function nextFocus(rects: Float64Array, groups: Uint32Array, current: number, dir: number, flags: Uint8Array, memory: Int32Array): number;

/**
 * WebAssembly entry: the priority of one move (lower is better), -1 when
 * `to` is not in that direction. For tests and the debugger.
 */
export function priority(from: Float64Array, to: Float64Array, dir: number): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly nextFocus: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => number;
    readonly priority: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly __wbindgen_export: (a: number, b: number) => number;
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

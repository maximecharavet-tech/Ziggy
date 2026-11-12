/* tslint:disable */
/* eslint-disable */

/**
 * `[true, false, …]`, one per requirement.
 */
export function check_requirements(reqs_json: string, creature_json: string): string;

export function combo_count(): number;

export function cross(a_json: string, b_json: string, seed: number): string;

export function decode_code(code: string): string;

export function encode_code(creature_json: string): string;

export function generate_challenge(band: string, seed: number): string;

export function make_name(seed: number): string;

export function moves_of(creature_json: string): string;

export function parse_album(raw: string): string;

/**
 * `[lift, squash, roll, yaw, pitch]`
 */
export function pose(kind: string, p: number): Float64Array;

export function powers_of(creature_json: string): string;

export function random_creature(seed: number): string;

/**
 * First numbers of a seeded stream (used by the parity tests).
 */
export function rng_probe(seed: number, n: number): Float64Array;

export function sanitize(creature_json: string): string;

export function silly_event(seed: number): string;

export function solve_requirements(reqs_json: string): string;

export function voice_of(creature_json: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly check_requirements: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly combo_count: () => number;
    readonly cross: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly decode_code: (a: number, b: number, c: number) => void;
    readonly encode_code: (a: number, b: number, c: number) => void;
    readonly generate_challenge: (a: number, b: number, c: number, d: number) => void;
    readonly make_name: (a: number, b: number) => void;
    readonly moves_of: (a: number, b: number, c: number) => void;
    readonly parse_album: (a: number, b: number, c: number) => void;
    readonly pose: (a: number, b: number, c: number, d: number) => void;
    readonly powers_of: (a: number, b: number, c: number) => void;
    readonly random_creature: (a: number, b: number) => void;
    readonly rng_probe: (a: number, b: number, c: number) => void;
    readonly sanitize: (a: number, b: number, c: number) => void;
    readonly silly_event: (a: number, b: number) => void;
    readonly solve_requirements: (a: number, b: number, c: number) => void;
    readonly voice_of: (a: number, b: number, c: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
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

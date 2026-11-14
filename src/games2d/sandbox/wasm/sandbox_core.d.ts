/* tslint:disable */
/* eslint-disable */

export class Sandbox {
    free(): void;
    [Symbol.dispose](): void;
    awake_chunks(): number;
    beam(x0: number, y0: number, x1: number, y1: number, r: number): void;
    /**
     * The beam is let go (it stops being drawn).
     */
    beam_off(): void;
    /**
     * A burst of sparkles at a cell.
     */
    burst(x: number, y: number, rgb: number, n: number): void;
    clear(): void;
    count(element: number): number;
    counts_len(): number;
    /**
     * Exact number of times each reaction happened in this world (one `u32` per reaction).
     */
    counts_ptr(): number;
    critter_count(): number;
    critter_x(k: number): number;
    critter_y(k: number): number;
    drop_parcel(x: number, y: number): boolean;
    events_len(): number;
    /**
     * Reactions since the last `take_events`: one `u32` each, kind | x << 7 | y << 16.
     */
    events_ptr(): number;
    frame_height(): number;
    frame_ptr(): number;
    frame_width(): number;
    get(x: number, y: number): number;
    hash(): number;
    hatch_baby(x: number, y: number): void;
    height(): number;
    io_ptr(): number;
    /**
     * Makes room for `len` bytes at `io_ptr` (write a save there, then call `load`).
     */
    io_reserve(len: number): number;
    /**
     * Restores the world from the bytes at `io_ptr`. False (and nothing changed) if they are not a save of this world.
     */
    load(): boolean;
    load_scene(): void;
    /**
     * A world of `w` × `h` cells (at most 320 each way). `world_id`: 0 garden, 1 mountain, 2 islands, 3 volcano, 4 undersea, 5 space, 6 moon, 7 mars.
     */
    constructor(w: number, h: number, seed: number, world_id: number);
    paint_line(x0: number, y0: number, x1: number, y1: number, r: number, element: number, variant: number): void;
    /**
     * 0 no parcel, 1 falling, 2 landed, 3 opening.
     */
    parcel_state(): number;
    parcel_x(): number;
    parcel_y(): number;
    place_gift(kind: number, x: number, y: number): void;
    /**
     * Draws the world. `flags` bit 0: reduced motion.
     */
    render(t_ms: number, flags: number): void;
    /**
     * Serialises the world; read `io_len` bytes at `io_ptr`.
     */
    save(): number;
    set(x: number, y: number, element: number): void;
    set_gravity(percent: number): void;
    set_night(night: boolean): void;
    /**
     * Where the finger is, in cells (negative: away). Faces look at it, babies follow it, the backdrop leans.
     */
    set_pointer(x: number, y: number): void;
    /**
     * Frame pixels per cell (1 rescue, 2 low tier, 3 high tier) and the extra effects of the high tier.
     */
    set_quality(scale: number, high: boolean): void;
    set_temperature(offset: number): void;
    stamp_critter(x: number, y: number): number;
    /**
     * Advances the world by `n` ticks (at most 8 per call).
     */
    step(n: number): void;
    take_events(): void;
    tick(): number;
    width(): number;
    wind(x: number, y: number, r: number, dir: number): void;
    world_id(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_sandbox_free: (a: number, b: number) => void;
    readonly sandbox_awake_chunks: (a: number) => number;
    readonly sandbox_beam: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly sandbox_beam_off: (a: number) => void;
    readonly sandbox_burst: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly sandbox_clear: (a: number) => void;
    readonly sandbox_count: (a: number, b: number) => number;
    readonly sandbox_counts_len: (a: number) => number;
    readonly sandbox_counts_ptr: (a: number) => number;
    readonly sandbox_critter_count: (a: number) => number;
    readonly sandbox_critter_x: (a: number, b: number) => number;
    readonly sandbox_critter_y: (a: number, b: number) => number;
    readonly sandbox_drop_parcel: (a: number, b: number, c: number) => number;
    readonly sandbox_events_len: (a: number) => number;
    readonly sandbox_events_ptr: (a: number) => number;
    readonly sandbox_frame_height: (a: number) => number;
    readonly sandbox_frame_ptr: (a: number) => number;
    readonly sandbox_frame_width: (a: number) => number;
    readonly sandbox_get: (a: number, b: number, c: number) => number;
    readonly sandbox_hash: (a: number) => number;
    readonly sandbox_hatch_baby: (a: number, b: number, c: number) => void;
    readonly sandbox_height: (a: number) => number;
    readonly sandbox_io_ptr: (a: number) => number;
    readonly sandbox_io_reserve: (a: number, b: number) => number;
    readonly sandbox_load: (a: number) => number;
    readonly sandbox_load_scene: (a: number) => void;
    readonly sandbox_new: (a: number, b: number, c: number, d: number) => number;
    readonly sandbox_paint_line: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly sandbox_parcel_state: (a: number) => number;
    readonly sandbox_parcel_x: (a: number) => number;
    readonly sandbox_parcel_y: (a: number) => number;
    readonly sandbox_place_gift: (a: number, b: number, c: number, d: number) => void;
    readonly sandbox_render: (a: number, b: number, c: number) => void;
    readonly sandbox_save: (a: number) => number;
    readonly sandbox_set: (a: number, b: number, c: number, d: number) => void;
    readonly sandbox_set_gravity: (a: number, b: number) => void;
    readonly sandbox_set_night: (a: number, b: number) => void;
    readonly sandbox_set_pointer: (a: number, b: number, c: number) => void;
    readonly sandbox_set_quality: (a: number, b: number, c: number) => void;
    readonly sandbox_set_temperature: (a: number, b: number) => void;
    readonly sandbox_stamp_critter: (a: number, b: number, c: number) => number;
    readonly sandbox_step: (a: number, b: number) => void;
    readonly sandbox_take_events: (a: number) => void;
    readonly sandbox_tick: (a: number) => number;
    readonly sandbox_width: (a: number) => number;
    readonly sandbox_wind: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly sandbox_world_id: (a: number) => number;
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

/* @ts-self-types="./sandbox_core.d.ts" */

export class Sandbox {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SandboxFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_sandbox_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    awake_chunks() {
        const ret = wasm.sandbox_awake_chunks(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} x0
     * @param {number} y0
     * @param {number} x1
     * @param {number} y1
     * @param {number} r
     */
    beam(x0, y0, x1, y1, r) {
        wasm.sandbox_beam(this.__wbg_ptr, x0, y0, x1, y1, r);
    }
    /**
     * The beam is let go (it stops being drawn).
     */
    beam_off() {
        wasm.sandbox_beam_off(this.__wbg_ptr);
    }
    /**
     * A burst of sparkles at a cell.
     * @param {number} x
     * @param {number} y
     * @param {number} rgb
     * @param {number} n
     */
    burst(x, y, rgb, n) {
        wasm.sandbox_burst(this.__wbg_ptr, x, y, rgb, n);
    }
    clear() {
        wasm.sandbox_clear(this.__wbg_ptr);
    }
    /**
     * @param {number} element
     * @returns {number}
     */
    count(element) {
        const ret = wasm.sandbox_count(this.__wbg_ptr, element);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    counts_len() {
        const ret = wasm.sandbox_counts_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Exact number of times each reaction happened in this world (one `u32` per reaction).
     * @returns {number}
     */
    counts_ptr() {
        const ret = wasm.sandbox_counts_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    critter_count() {
        const ret = wasm.sandbox_critter_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} k
     * @returns {number}
     */
    critter_x(k) {
        const ret = wasm.sandbox_critter_x(this.__wbg_ptr, k);
        return ret;
    }
    /**
     * @param {number} k
     * @returns {number}
     */
    critter_y(k) {
        const ret = wasm.sandbox_critter_y(this.__wbg_ptr, k);
        return ret;
    }
    /**
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    drop_parcel(x, y) {
        const ret = wasm.sandbox_drop_parcel(this.__wbg_ptr, x, y);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    events_len() {
        const ret = wasm.sandbox_events_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Reactions since the last `take_events`: one `u32` each, kind | x << 7 | y << 16.
     * @returns {number}
     */
    events_ptr() {
        const ret = wasm.sandbox_events_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    frame_height() {
        const ret = wasm.sandbox_frame_height(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    frame_ptr() {
        const ret = wasm.sandbox_frame_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    frame_width() {
        const ret = wasm.sandbox_frame_width(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    get(x, y) {
        const ret = wasm.sandbox_get(this.__wbg_ptr, x, y);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    hash() {
        const ret = wasm.sandbox_hash(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} x
     * @param {number} y
     */
    hatch_baby(x, y) {
        wasm.sandbox_hatch_baby(this.__wbg_ptr, x, y);
    }
    /**
     * @returns {number}
     */
    height() {
        const ret = wasm.sandbox_height(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    io_ptr() {
        const ret = wasm.sandbox_io_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Makes room for `len` bytes at `io_ptr` (write a save there, then call `load`).
     * @param {number} len
     * @returns {number}
     */
    io_reserve(len) {
        const ret = wasm.sandbox_io_reserve(this.__wbg_ptr, len);
        return ret >>> 0;
    }
    /**
     * Restores the world from the bytes at `io_ptr`. False (and nothing changed) if they are not a save of this world.
     * @returns {boolean}
     */
    load() {
        const ret = wasm.sandbox_load(this.__wbg_ptr);
        return ret !== 0;
    }
    load_scene() {
        wasm.sandbox_load_scene(this.__wbg_ptr);
    }
    /**
     * A world of `w` × `h` cells (at most 320 each way). `world_id`: 0 garden, 1 mountain, 2 islands, 3 volcano, 4 undersea, 5 space, 6 moon, 7 mars.
     * @param {number} w
     * @param {number} h
     * @param {number} seed
     * @param {number} world_id
     */
    constructor(w, h, seed, world_id) {
        const ret = wasm.sandbox_new(w, h, seed, world_id);
        this.__wbg_ptr = ret;
        SandboxFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} x0
     * @param {number} y0
     * @param {number} x1
     * @param {number} y1
     * @param {number} r
     * @param {number} element
     * @param {number} variant
     */
    paint_line(x0, y0, x1, y1, r, element, variant) {
        wasm.sandbox_paint_line(this.__wbg_ptr, x0, y0, x1, y1, r, element, variant);
    }
    /**
     * 0 no parcel, 1 falling, 2 landed, 3 opening.
     * @returns {number}
     */
    parcel_state() {
        const ret = wasm.sandbox_parcel_state(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    parcel_x() {
        const ret = wasm.sandbox_parcel_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    parcel_y() {
        const ret = wasm.sandbox_parcel_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} kind
     * @param {number} x
     * @param {number} y
     */
    place_gift(kind, x, y) {
        wasm.sandbox_place_gift(this.__wbg_ptr, kind, x, y);
    }
    /**
     * Draws the world. `flags` bit 0: reduced motion.
     * @param {number} t_ms
     * @param {number} flags
     */
    render(t_ms, flags) {
        wasm.sandbox_render(this.__wbg_ptr, t_ms, flags);
    }
    /**
     * Serialises the world; read `io_len` bytes at `io_ptr`.
     * @returns {number}
     */
    save() {
        const ret = wasm.sandbox_save(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} element
     */
    set(x, y, element) {
        wasm.sandbox_set(this.__wbg_ptr, x, y, element);
    }
    /**
     * @param {number} percent
     */
    set_gravity(percent) {
        wasm.sandbox_set_gravity(this.__wbg_ptr, percent);
    }
    /**
     * @param {boolean} night
     */
    set_night(night) {
        wasm.sandbox_set_night(this.__wbg_ptr, night);
    }
    /**
     * Where the finger is, in cells (negative: away). Faces look at it, babies follow it, the backdrop leans.
     * @param {number} x
     * @param {number} y
     */
    set_pointer(x, y) {
        wasm.sandbox_set_pointer(this.__wbg_ptr, x, y);
    }
    /**
     * Frame pixels per cell (1 rescue, 2 low tier, 3 high tier) and the extra effects of the high tier.
     * @param {number} scale
     * @param {boolean} high
     */
    set_quality(scale, high) {
        wasm.sandbox_set_quality(this.__wbg_ptr, scale, high);
    }
    /**
     * @param {number} offset
     */
    set_temperature(offset) {
        wasm.sandbox_set_temperature(this.__wbg_ptr, offset);
    }
    /**
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    stamp_critter(x, y) {
        const ret = wasm.sandbox_stamp_critter(this.__wbg_ptr, x, y);
        return ret >>> 0;
    }
    /**
     * Advances the world by `n` ticks (at most 8 per call).
     * @param {number} n
     */
    step(n) {
        wasm.sandbox_step(this.__wbg_ptr, n);
    }
    take_events() {
        wasm.sandbox_take_events(this.__wbg_ptr);
    }
    /**
     * @returns {number}
     */
    tick() {
        const ret = wasm.sandbox_tick(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    width() {
        const ret = wasm.sandbox_width(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} r
     * @param {number} dir
     */
    wind(x, y, r, dir) {
        wasm.sandbox_wind(this.__wbg_ptr, x, y, r, dir);
    }
    /**
     * @returns {number}
     */
    world_id() {
        const ret = wasm.sandbox_world_id(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) Sandbox.prototype[Symbol.dispose] = Sandbox.prototype.free;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_41e9ee4f547fc59a: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
    };
    return {
        __proto__: null,
        "./sandbox_core_bg.js": import0,
    };
}

const SandboxFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_sandbox_free(ptr, 1));

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedUint8ArrayMemory0 = null;
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('sandbox_core_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };

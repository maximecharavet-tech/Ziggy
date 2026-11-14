/**
 * Loader for the Bac à sable magique engine (Rust → WebAssembly, built by
 * `npm run sandbox:wasm` from rust/sandbox-core into ./wasm/).
 *
 * Browser: the .wasm file is fetched lazily through `new URL(…, import.meta.url)`
 * (Next hashes it under /_next/static, cached offline by the service worker).
 * Node (Vitest, the benchmark): the same glue, initialised synchronously from disk.
 *
 * Everything that changes every frame is read straight from the wasm memory:
 * the picture, the events and the counters are typed-array views, never copies.
 * The views are rebuilt if the memory ever grows (the engine pre-allocates, so
 * in practice they stay valid).
 */
import { REACTIONS, type Reaction } from './wasm/ids';

type Glue = typeof import('./wasm/sandbox_core.js');
type RawSandbox = InstanceType<Glue['Sandbox']>;

export const NODE_WASM_PATH = 'src/games2d/sandbox/wasm/sandbox_core_bg.wasm';

/** A reaction reported by the engine, at a cell. */
export interface EngineEvent {
  kind: Reaction;
  x: number;
  y: number;
}

export interface SandEngine {
  readonly raw: RawSandbox;
  readonly w: number;
  readonly h: number;
  readonly world: number;
  /** Draws the world and returns the picture (RGBA bytes over the wasm memory: use it before the next call). */
  render(tMs: number, reducedMotion: boolean): ImageData | { data: Uint8ClampedArray; width: number; height: number };
  /** The reactions since the last call (at most one per kind per tick), then forgets them. */
  takeEvents(): EngineEvent[];
  /** Exact number of times each reaction happened in this world. */
  counts(): Uint32Array;
  /** The world as bytes (a copy, safe to keep). */
  save(): Uint8Array;
  /** Restores bytes from `save`; false if they are not a save of this world (nothing changes then). */
  load(bytes: Uint8Array): boolean;
  free(): void;
}

let glue: Glue | null = null;
let memory: WebAssembly.Memory | null = null;
let loading: Promise<void> | null = null;

/** Loads the engine once (later calls return the same promise). `wasmPath` overrides the Node file location. */
export function loadSandboxEngine(opts: { wasmPath?: string } = {}): Promise<void> {
  loading ??= (async () => {
    const g = (await import('./wasm/sandbox_core.js')) as Glue;
    // `typeof window` is inlined by Next at compile time: the browser bundle keeps only its branch.
    if (typeof window === 'undefined' && typeof process !== 'undefined' && typeof process.versions?.node === 'string') {
      const fs = process.getBuiltinModule('node:fs');
      const p = opts.wasmPath ?? NODE_WASM_PATH;
      const file = p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p) ? p : `${process.cwd()}/${p}`;
      memory = g.initSync({ module: fs.readFileSync(file) }).memory;
    } else {
      memory = (await g.default({ module_or_path: new URL('./wasm/sandbox_core_bg.wasm', import.meta.url) })).memory;
    }
    glue = g;
  })();
  loading.catch(() => {
    loading = null; // allow a retry after a failed load (offline, …)
  });
  return loading;
}

export const sandboxEngineReady = () => glue !== null;

/** A new world of `w` × `h` cells (call `await loadSandboxEngine()` first). */
export function createSandbox(w: number, h: number, seed: number, world: number): SandEngine {
  if (!glue || !memory) throw new Error('sandbox-core: call `await loadSandboxEngine()` first');
  const mem = memory;
  const raw = new glue.Sandbox(w, h, seed >>> 0, world);
  let buffer: ArrayBuffer | null = null;
  let frame: Uint8ClampedArray | null = null;
  let frameKey = '';
  let image: ImageData | null = null;
  const canImage = typeof ImageData !== 'undefined';
  const u32 = (ptr: number, len: number) => new Uint32Array(mem.buffer, ptr, len);
  return {
    raw,
    w: raw.width(),
    h: raw.height(),
    world: raw.world_id(),
    render(tMs, reducedMotion) {
      raw.render(tMs, reducedMotion ? 1 : 0);
      const width = raw.frame_width();
      const height = raw.frame_height();
      const key = `${width}x${height}`;
      if (buffer !== mem.buffer || key !== frameKey) {
        buffer = mem.buffer as ArrayBuffer;
        frameKey = key;
        frame = new Uint8ClampedArray(mem.buffer, raw.frame_ptr(), width * height * 4);
        image = canImage ? new ImageData(frame as Uint8ClampedArray<ArrayBuffer>, width, height) : null;
      }
      return image ?? { data: frame!, width, height };
    },
    takeEvents() {
      const n = raw.events_len();
      if (!n) return [];
      const view = u32(raw.events_ptr(), n);
      const out: EngineEvent[] = [];
      for (let k = 0; k < n; k++) {
        const e = view[k];
        const kind = REACTIONS[e & 127];
        if (kind) out.push({ kind, x: (e >>> 7) & 511, y: (e >>> 16) & 511 });
      }
      raw.take_events();
      return out;
    },
    counts: () => u32(raw.counts_ptr(), raw.counts_len()).slice(),
    save() {
      const n = raw.save();
      return new Uint8Array(mem.buffer, raw.io_ptr(), n).slice();
    },
    load(bytes) {
      const ptr = raw.io_reserve(bytes.length);
      new Uint8Array(mem.buffer, ptr, bytes.length).set(bytes);
      return raw.load();
    },
    free: () => raw.free(),
  };
}

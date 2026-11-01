/**
 * Loads the Rust/WebAssembly spatial-navigation engine (rust/ziggy-tv-nav,
 * built by scripts/build-tv-nav.sh into ./wasm). Only called on TVs; until it
 * resolves (or if it fails) the TypeScript engine in spatial-nav.ts answers.
 */
import { DIR_CODE, type Box, type NextFocusFn } from './spatial-nav';

let loading: Promise<NextFocusFn | null> | null = null;

export function loadWasmNav(): Promise<NextFocusFn | null> {
  loading ??= (async () => {
    try {
      const mod = await import('./wasm/ziggy_tv_nav.js');
      await mod.default({ module_or_path: new URL('./wasm/ziggy_tv_nav_bg.wasm', import.meta.url) });
      const fn: NextFocusFn = (rects: Box[], groups, current, dir, flags = [], memory = []) => {
        const flat = new Float64Array(rects.length * 4);
        rects.forEach((r, i) => flat.set([r.x, r.y, r.w, r.h], i * 4));
        return mod.nextFocus(flat, Uint32Array.from(groups as ArrayLike<number>), current, DIR_CODE[dir], Uint8Array.from(flags as ArrayLike<number>), Int32Array.from(memory as ArrayLike<number>));
      };
      return fn;
    } catch {
      return null;
    }
  })();
  return loading;
}

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import * as web from './wasm/lutins_core.js';
import { loadEngine, type LutinsEngine } from './engine';
import type { RgbaImage } from './types';
import bible from '@/data/lutins/bible.json';

/** Same reference value as `SEED_PEPIN_GRELOTTE_FR` in rust/lutins-core/src/prompt.rs. */
const SEED_PEPIN_GRELOTTE_FR = 1_899_733_704;

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

function fnv1a32(bytes: Uint8Array): number {
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function image(w: number, h: number, f: (x: number, y: number) => [number, number, number]): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = f(x, y);
      data.set([r, g, b, 255], (y * w + x) * 4);
    }
  return { data, width: w, height: h };
}

const inRect = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) => x >= x0 && x < x1 && y >= y0 && y < y1;

/** Dark wall on the top half, bright table below, a mug and a vase on the right (as tests/scenes.rs). */
const tableScene = () =>
  image(480, 320, (x, y) => {
    if (inRect(x, y, 380, 150, 420, 210)) return [230, 230, 240];
    if (inRect(x, y, 430, 120, 460, 200)) return [60, 110, 170];
    if (inRect(x, y, 100, 40, 200, 110)) return [120, 100, 90];
    return y < 160 ? [40, 36, 34] : [205, 180, 140];
  });

/** A wall lit from the left with two dark objects on it. */
const leftLit = () =>
  image(400, 260, (x, y) => {
    if (inRect(x, y, 60, 60, 110, 120)) return [40, 40, 40];
    if (inRect(x, y, 250, 150, 300, 220)) return [30, 60, 90];
    const v = (0.9 - (0.65 * x) / 400) * 255;
    return [v, v * 0.95, v * 0.9];
  });

let engine: LutinsEngine;
beforeAll(async () => {
  engine = await loadEngine();
});

describe('lutins-core WebAssembly (Node build)', () => {
  it('loads the build matching the current bible.json', () => {
    expect(engine.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(engine.canDecode).toBe(true);
    // A stale build (bible changed, `npm run lutins:wasm` not rerun) fails here.
    const bytes = readFileSync(here('../../data/lutins/bible.json'));
    expect(engine.bibleHash).toBe(fnv1a32(bytes));
  });

  it('builds the same prompt and seed as the Rust tests', () => {
    const out = engine.buildPrompt({ locale: 'fr', elves: ['pepin', 'grelotte'] });
    expect(out.seed).toBe(SEED_PEPIN_GRELOTTE_FR);
    const looks = Object.fromEntries(bible.elves.map((e) => [e.id, e.look]));
    expect(out.prompt).toContain(looks.pepin);
    expect(out.prompt).toContain(looks.grelotte);
    expect(out.prompt).not.toContain(looks.noisette);
    expect(out.prompt.startsWith('Edit the first image: add two small felt elf dolls')).toBe(true);
    expect(out.negative.length).toBeGreaterThan(20);
    const retry = engine.buildPrompt({ locale: 'fr', elves: ['pepin', 'grelotte'], strict: true, failed: ['elf_missing:pepin'] });
    expect(retry.seed).toBe(SEED_PEPIN_GRELOTTE_FR + 1);
    expect(retry.prompt).toContain('must be clearly visible');
  });

  it('captions in the requested locale without the parent text', () => {
    const out = engine.buildPrompt({
      locale: 'en',
      elves: ['noisette'],
      prank: { id: 'bulles', action: 'are blowing soap bubbles', title: { fr: 'Fête des bulles', en: 'Bubble party' } },
      parent_text: 'PRIVATE parent words',
    });
    expect(out.caption).toContain('Hazel');
    expect(out.caption).toContain('bubble party');
    expect(out.caption).not.toContain('PRIVATE');
    expect(out.prompt).toContain('Noisette is blowing soap bubbles');
  });

  it('validates hostile inputs', () => {
    expect(() => engine.buildPrompt({ locale: 'fr', elves: [] })).toThrow(/1–3 elves/);
    expect(() => engine.buildPrompt({ locale: 'fr', elves: ['grinch' as never] })).toThrow(/unknown elf/);
    const out = engine.buildPrompt({
      locale: 'fr',
      elves: ['pepin'],
      scene: { brightness: Number.NaN as never, light_dir: 'below' as never, stages: [{ x: -5, y: 0.6, w: 9, h: 0.2, score: 2, label: 'centre', below_edge: true }] },
    });
    expect(out.warnings.some((w) => w.includes('light_dir'))).toBe(true);
    expect(out.prompt).toContain('from 0% to 100% across');
    expect(() => engine.analyzeScene({ data: new Uint8Array(10), width: 4, height: 4 })).toThrow(/bad image/);
  });

  it('analyses scenes like the Rust tests', () => {
    const lit = engine.analyzeScene(leftLit());
    expect(lit.light_dir).toBe('left');
    expect(lit.palette).toHaveLength(5);

    const table = engine.analyzeScene(tableScene());
    expect(table.width).toBe(480);
    expect(table.stages.length).toBeGreaterThan(0);
    const s = table.stages[0];
    expect(s.y).toBeGreaterThanOrEqual(0.49);
    expect(s.x + s.w).toBeLessThanOrEqual(380 / 480 + 0.02);
    expect(s.below_edge).toBe(true);
    expect(table.stages.every((st) => st.y + st.h / 2 > 0.5)).toBe(true);
  });

  it('verifies: identical photo keeps the room but has no elves', () => {
    const photo = tableScene();
    const v = engine.verify(photo, photo, ['pepin', 'noisette']);
    expect(v.room.ok).toBe(true);
    expect(v.ok).toBe(false);
    expect(v.reasons).toEqual(['elf_missing:pepin', 'elf_missing:noisette']);
    const other = engine.verify(leftLit(), photo, { elves: ['grelotte'] });
    expect(other.reasons).toContain('room_changed');
  });

  it('decodes and verifies encoded files', () => {
    const jpg = new Uint8Array(readFileSync(here('../../../rust/lutins-core/tests/data/red16.jpg')));
    const img = engine.decodeImage(jpg);
    expect([img.width, img.height]).toEqual([16, 16]);
    expect(Math.abs(img.data[0] - 200)).toBeLessThanOrEqual(4);
    const v = engine.verifyEncoded(jpg, jpg, ['pepin']);
    expect(v.room.ok).toBe(true);
    expect(() => engine.decodeImage(new Uint8Array([1, 2, 3]))).toThrow(/cannot decode/);
  });

  it('renders deterministic magic-card frames', () => {
    const base = tableScene();
    const style = { out_w: 144, out_h: 180, snow: 60 };
    const a = engine.renderCardFrame(base, 1.25, 7, style);
    expect([a.width, a.height]).toEqual([144, 180]);
    expect(a.data.length).toBe(144 * 180 * 4);
    expect(engine.renderCardFrame(base, 1.25, 7, style).data).toEqual(a.data);
    expect(engine.renderCardFrame(base, 2.5, 7, style).data).not.toEqual(a.data);
    const r = engine.createCardRenderer(base, 7, style);
    try {
      expect([r.width, r.height]).toEqual([144, 180]);
      expect(r.render(1.25)).toEqual(a.data);
      expect(Array.from(r.renderView(1.25).subarray(0, 400))).toEqual(Array.from(a.data.subarray(0, 400)));
    } finally {
      r.free();
    }
  });

  it('prepares photos', () => {
    const out = engine.preparePhoto(tableScene(), 240, true);
    expect([out.width, out.height]).toEqual([240, 160]);
    expect(out.data.length).toBe(240 * 160 * 4);
  });
});

describe('lutins-core WebAssembly (browser build)', () => {
  beforeAll(() => {
    web.initSync({ module: readFileSync(here('./wasm/lutins_core_bg.wasm')) });
  });

  it('gives the same answers as the Node build, without decoders', () => {
    const img = tableScene();
    const fromWeb = JSON.parse(web.analyze_scene(new Uint8Array(img.data.buffer), img.width, img.height));
    expect(fromWeb).toEqual(engine.analyzeScene(img));
    expect(web.bible_hash()).toBe(engine.bibleHash);
    expect('decode_image' in web).toBe(false);
    expect(JSON.parse(web.build_prompt(JSON.stringify({ locale: 'fr', elves: ['pepin', 'grelotte'] }))).seed).toBe(
      SEED_PEPIN_GRELOTTE_FR,
    );
  });
});

describe('lutins-core: gentle pranks', () => {
  it('the Rust check and the TypeScript check agree', async () => {
    const { gentleCheck } = await import('./gentle');
    const eng = await loadEngine();
    for (const t of ['ils font du ski sur la rampe d’escalier', 'they climb the stairs with a knife', 'Ils ont CASSÉ le vase', 'four elves and a felt pen', 'Le feu de camp', 'des lutins dans les céréales', '']) expect(eng.gentleCheck(t), t).toEqual(gentleCheck(t));
  });
  it('tonight’s suggestion skips recent pranks and is the same for the same seed', async () => {
    const eng = await loadEngine();
    const ids = ['a', 'b', 'c', 'd', 'e'];
    for (let s = 0; s < 30; s++) expect(['d', 'e']).toContain(eng.pickPrank(ids, ['a', 'b', 'c'], s));
    expect(eng.pickPrank(ids, [], 9)).toBe(eng.pickPrank(ids, [], 9));
    expect(eng.pickPrank([], [], 1)).toBeNull();
  });
});

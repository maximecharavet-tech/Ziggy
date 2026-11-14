#!/usr/bin/env node
/**
 * Benchmark of the Bac à sable magique engine (the committed WebAssembly in
 * src/games2d/sandbox/wasm/), in Node: step and render times on canned scenes,
 * for each quality tier. Prints median and 95th percentile in ms, plus the
 * ratio to a calibration loop (to compare machines without trusting raw ms).
 *
 *   node scripts/sandbox-bench.mjs              # all scenes, 320×192
 *   node scripts/sandbox-bench.mjs --ticks 300  # shorter
 *   node scripts/sandbox-bench.mjs --json       # machine-readable
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src/games2d/sandbox/wasm');
const glue = await import(pathToFileURL(join(dir, 'sandbox_core.js')).href);
glue.initSync({ module: readFileSync(join(dir, 'sandbox_core_bg.wasm')) });
const ids = readFileSync(join(dir, 'ids.ts'), 'utf8');
const EL = Object.fromEntries([...ids.matchAll(/^ {2}(\w+): (\d+),$/gm)].map((m) => [m[1], Number(m[2])]));

const argv = process.argv.slice(2);
const TICKS = Number(argv[argv.indexOf('--ticks') + 1]) || 600;
const JSON_OUT = argv.includes('--json');
const W = 320;
const H = 192;
const WORLDS = { garden: 0, mountain: 1, islands: 2, volcano: 3, undersea: 4, space: 5, moon: 6, mars: 7 };

/** A fixed amount of integer work: ms per unit of it on this machine. */
function calibrate() {
  const t0 = performance.now();
  let x = 1;
  for (let k = 0; k < 2e7; k++) x = (Math.imul(x, 1664525) + 1013904223) | 0;
  if (x === 42) console.log('');
  return performance.now() - t0;
}

const SCENES = {
  idle: { world: 'garden', each: () => {} },
  pour: {
    world: 'garden',
    each: (s, t) => {
      s.paint_line(60 + (t % 80), 10, 70 + (t % 80), 14, 4, t % 2 ? EL.sand : EL.water, 0);
    },
  },
  ocean: {
    world: 'islands',
    each: (s, t) => {
      if (t % 2 === 0) s.wind(160, 110, 14, t % 200 < 100 ? 1 : -1);
    },
  },
  volcano: {
    world: 'volcano',
    each: (s, t) => {
      if (t % 3 === 0) s.paint_line(150, 20, 170, 24, 3, t % 6 ? EL.lava : EL.water, 0);
    },
  },
  undersea: { world: 'undersea', each: (s, t) => t % 4 === 0 && s.paint_line(40 + (t % 200), 60, 50 + (t % 200), 70, 3, EL.bubble, 0) },
  space: { world: 'space', each: (s, t) => t % 5 === 0 && s.paint_line(40, 40, 60, 50, 3, EL.stardust, 0) },
  worst: {
    world: 'garden',
    setup: (s) => {
      s.clear();
      for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x++) if ((x * 7 + y * 13) % 3 !== 0 && y < H * 0.8) s.set(x, y, [EL.sand, EL.water, EL.snow, EL.steam][(x + y) % 4]);
    },
    each: (s, t) => t % 30 === 0 && s.paint_line(0, 0, W, 0, 3, EL.water, 0),
  },
};

function stats(a) {
  const s = [...a].sort((x, y) => x - y);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { p50: +q(0.5).toFixed(3), p95: +q(0.95).toFixed(3) };
}

const cal = calibrate();
const results = [];
for (const [name, sc] of Object.entries(SCENES)) {
  for (const tier of [
    { tier: 'low', scale: 2, high: false },
    { tier: 'high', scale: 3, high: true },
  ]) {
    const s = new glue.Sandbox(W, H, 1234, WORLDS[sc.world]);
    s.load_scene();
    sc.setup?.(s);
    s.set_quality(tier.scale, tier.high);
    const step = [];
    const render = [];
    for (let t = 0; t < TICKS; t++) {
      sc.each(s, t);
      const a = performance.now();
      s.step(1);
      const b = performance.now();
      s.render(t * 16.67, 0);
      const c = performance.now();
      if (t > 20) {
        step.push(b - a);
        render.push(c - b);
      }
    }
    const r = { scene: name, tier: tier.tier, step: stats(step), render: stats(render), awake: s.awake_chunks() };
    r.total = +(r.step.p50 + r.render.p50).toFixed(3);
    results.push(r);
    s.free();
  }
}

if (JSON_OUT) console.log(JSON.stringify({ calibrationMs: cal, results }, null, 2));
else {
  console.log(`Bac à sable bench: ${W}×${H}, ${TICKS} ticks, calibration ${cal.toFixed(1)} ms`);
  console.log('scene      tier   step p50/p95     render p50/p95    total p50  (÷cal)');
  for (const r of results)
    console.log(
      `${r.scene.padEnd(10)} ${r.tier.padEnd(5)}  ${String(r.step.p50).padStart(6)} / ${String(r.step.p95).padEnd(7)}  ${String(r.render.p50).padStart(6)} / ${String(r.render.p95).padEnd(7)}  ${String(r.total).padStart(7)}   ${(r.total / cal).toFixed(3)}`,
    );
}

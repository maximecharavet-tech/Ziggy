#!/usr/bin/env node
/**
 * Renders the canonical reference images of the three felt elves
 * (public/lutins/refs/*.png) from the code-built 3D models in
 * src/games3d/lutins, so the image AI always sees the same Pépin, Grelotte
 * and Noisette. Reproducible: same code, same pictures.
 *
 *   node scripts/lutins-refs/render.mjs                 # all references
 *   node scripts/lutins-refs/render.mjs --only=sheet,pepin
 *   node scripts/lutins-refs/render.mjs --out=/tmp/refs # somewhere else
 *   node scripts/lutins-refs/render.mjs --live=/tmp/shots  # hero + stage screenshots (checks)
 *
 * Needs: esbuild (already in node_modules) and Playwright with the Chromium
 * at /opt/pw-browsers/chromium (or PW_CHROMIUM=/path/to/chrome). WebGL runs
 * in software (SwiftShader), so a full run takes a few minutes.
 */
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const require = createRequire(import.meta.url);

function load(name, fallbacks) {
  for (const p of [name, ...fallbacks]) {
    try {
      return require(p);
    } catch {
      /* try the next one */
    }
  }
  throw new Error(`Cannot find ${name} (tried ${[name, ...fallbacks].join(', ')})`);
}

const esbuild = load('esbuild', [join(repo, 'node_modules/esbuild')]);
const { chromium } = load('playwright', ['/opt/node-tools/node_modules/playwright', 'playwright-core']);

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? '1'];
  })
);
const outDir = resolve(args.out ?? join(repo, 'public/lutins/refs'));
const only = args.only ? new Set(args.only.split(',')) : null;

/** Every reference: name → harness query. */
const JOBS = [
  { name: 'sheet', file: 'sheet.png', q: 'layout=lineup&w=1536&h=1024&ss=2' },
  { name: 'sheet-34', file: 'sheet-34.png', q: 'layout=lineup34&w=1536&h=1024&ss=2' },
  ...['pepin', 'grelotte', 'noisette'].map((id) => ({ name: id, file: `${id}.png`, q: `layout=turnaround&elf=${id}&w=1024&h=1024&ss=2` })),
  ...['pepin', 'grelotte', 'noisette'].map((id) => ({ name: `avatar-${id}`, file: `avatars/${id}.png`, q: `layout=avatar&elf=${id}&w=512&h=512&ss=3&transparent=1` })),
];

async function bundle() {
  const dir = mkdtempSync(join(tmpdir(), 'lutins-refs-'));
  await esbuild.build({
    entryPoints: [join(here, 'harness.ts')],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    outfile: join(dir, 'harness.js'),
    alias: { '@': join(repo, 'src') },
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'warning',
  });
  writeFileSync(join(dir, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#fff}</style></head><body><script src="harness.js"></script></body></html>');
  return pathToFileURL(join(dir, 'index.html')).href;
}

async function launch() {
  const exe = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium';
  return chromium.launch({
    executablePath: existsSync(exe) ? exe : undefined,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
}

async function renderRefs(url) {
  const browser = await launch();
  mkdirSync(join(outDir, 'avatars'), { recursive: true });
  for (const job of JOBS) {
    if (only && !only.has(job.name)) continue;
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const t0 = Date.now();
    await page.goto(`${url}?job=sheet&${job.q}`);
    await page.waitForFunction(() => window.__result || window.__error, null, { timeout: 600_000, polling: 500 });
    const err = await page.evaluate(() => window.__error);
    if (err || errors.length) throw new Error(`${job.name}: ${err ?? errors.join('\n')}`);
    const data = await page.evaluate(() => window.__result);
    const file = join(outDir, job.file);
    writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    console.log(`${job.file}  ${(statSync(file).size / 1024).toFixed(0)} KB  ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    await page.close();
  }
  await browser.close();
}

/** Screenshots of the live scenes (hero, stage) for checks: sizes, cores, reduced motion. */
async function renderLive(url, dir) {
  mkdirSync(dir, { recursive: true });
  const browser = await launch();
  const views = [
    { name: 'desk', width: 1280, height: 800 },
    { name: 'phone', width: 390, height: 844 },
  ];
  let failures = 0;
  for (const scene of ['hero', 'stage']) {
    for (const v of views) {
      for (const cores of [4, 8]) {
        for (const reduce of [false, true]) {
          const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, reducedMotion: reduce ? 'reduce' : 'no-preference' });
          await ctx.addInitScript(`Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => ${cores} });`);
          const page = await ctx.newPage();
          const errors = [];
          page.on('pageerror', (e) => errors.push(String(e)));
          page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
          const q = scene === 'stage' ? 'mode=stage&transparent=1&az=20&el=14' : 'mode=hero';
          await page.goto(`${url}?job=live&${q}${reduce ? '&reduce=1' : ''}`);
          await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 300_000, polling: 500 });
          const err = await page.evaluate(() => window.__error);
          const file = join(dir, `${scene}-${v.name}-c${cores}${reduce ? '-reduce' : ''}.png`);
          await page.screenshot({ path: file });
          const msg = [err, ...errors].filter(Boolean).join(' | ');
          if (msg) failures++;
          console.log(`${file}${msg ? `  ERRORS: ${msg}` : '  ok'}`);
          await ctx.close();
        }
      }
    }
  }
  await browser.close();
  if (failures) process.exitCode = 1;
}

const url = await bundle();
if (args.live) await renderLive(url, resolve(args.live));
else await renderRefs(url);

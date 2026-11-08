#!/usr/bin/env node
/**
 * Self-hosts MediaPipe Tasks Vision for the Santa photo booth
 * (src/components/santa/booth). Run again after upgrading @mediapipe/tasks-vision:
 *
 *   node scripts/santa-mediapipe.mjs            # copy the wasm runtime (offline; also the npm postinstall)
 *   node scripts/santa-mediapipe.mjs --models   # also (re)download the two models
 *
 * - wasm: node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.{js,wasm}
 *   → public/santa/mediapipe/wasm/ (the non-module build, the one
 *   FilesetResolver.forVisionTasks(base) loads; Apache-2.0).
 * - models (Apache-2.0, see their MediaPipe model cards):
 *   selfie_segmenter.tflite (float16, 250 kB, person / background) and
 *   selfie_multiclass_256x256.tflite (float32, 16 MB, better hair edges).
 *
 * Nothing is fetched from Google at run time: the booth loads only these files.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const out = join(root, 'public/santa/mediapipe');
if (!existsSync(src)) {
  // Runs as "postinstall": never fail an install (e.g. a partial install without the package).
  console.warn('santa-mediapipe: @mediapipe/tasks-vision is not installed, nothing copied.');
  process.exit(0);
}
mkdirSync(join(out, 'wasm'), { recursive: true });

for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) {
  const to = join(out, 'wasm', f);
  if (f.endsWith('.js')) {
    // Generated vendor code: keep `eslint .` (npm run check) quiet about it.
    writeFileSync(to, `/* eslint-disable */\n${readFileSync(join(src, f), 'utf8')}`);
  } else {
    copyFileSync(join(src, f), to);
  }
  console.log(`wasm/${f}  ${(statSync(to).size / 1e6).toFixed(1)} MB`);
}

const MODELS = {
  'selfie_segmenter.tflite': 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
  'selfie_multiclass_256x256.tflite': 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
};

if (process.argv.includes('--models')) {
  for (const [name, url] of Object.entries(MODELS)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(join(out, name), buf);
    console.log(`${name}  ${(buf.length / 1e6).toFixed(2)} MB`);
  }
}

const version = JSON.parse(readFileSync(join(root, 'node_modules/@mediapipe/tasks-vision/package.json'), 'utf8')).version;
console.log(`@mediapipe/tasks-vision ${version} copied. Check THIRD_PARTY_LICENSES.md lists this version.`);

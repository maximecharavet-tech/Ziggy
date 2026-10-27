#!/usr/bin/env node
/**
 * Dump the bedtime stories (src/data/dodo) to JSON for the voice generator.
 *
 * The stories are TypeScript, so they are bundled on the fly with the esbuild
 * already installed by vite/vitest (no new dependency), then every segment the
 * player shows is written out with the EXACT displayed string:
 *
 *   { stories: [{ id, segments: { fr: { title, s1..s6, outro }, en: {...} } }] }
 *
 * Usage: node scripts/dodo-voice/dump-stories.mjs [out.json]   (default: stdout)
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const bundle = await build({
  stdin: {
    contents: "export { DODO_STORIES, outroText } from './src/data/dodo/index.ts';",
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  tsconfig: resolve(root, 'tsconfig.json'),
  logLevel: 'silent',
});

const code = bundle.outputFiles[0].text;
const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const { DODO_STORIES, outroText } = mod;

const LOCALES = ['fr', 'en'];
const stories = DODO_STORIES.map((story) => {
  const segments = {};
  for (const locale of LOCALES) {
    const seg = { title: story.title[locale] };
    story.scenes.forEach((scene, i) => {
      seg[`s${i + 1}`] = scene.text[locale];
    });
    seg.outro = outroText(story, locale);
    segments[locale] = seg;
  }
  return { id: story.id, segments };
});

const json = JSON.stringify({ v: 1, stories }, null, 1);
const out = process.argv[2];
if (out) writeFileSync(out, json);
else process.stdout.write(json);

#!/usr/bin/env node
/**
 * Dump every fixed clip Santa says (src/data/santa) to JSON for the voice
 * engine (`ziggy-voice santa`): guided and scheduled calls, the voice message,
 * gifts, proud moments, ages and the Advent doors.
 *
 *   [{ locale, key, file, text, hash }]   hash = first 10 hex of sha256(text)
 *
 * Usage: node voice-engine/dump-santa.mjs [out.json]   (default: stdout)
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = await build({
  stdin: {
    contents: "export { santaText } from './src/data/santa/lines.ts'; export { staticClipKeys, clipFile } from './src/data/santa/voice-clips.ts';",
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  tsconfig: resolve(root, 'tsconfig.json'),
  loader: { '.json': 'json' },
  logLevel: 'silent',
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const clips = [];
for (const locale of ['fr', 'en']) {
  for (const key of mod.staticClipKeys()) {
    const text = mod.santaText(key, locale);
    if (!text) throw new Error(`no text for ${key} (${locale})`);
    clips.push({ locale, key, file: mod.clipFile(key), text, hash: createHash('sha256').update(text).digest('hex').slice(0, 10) });
  }
}
const json = JSON.stringify(clips, null, 1);
if (process.argv[2]) writeFileSync(process.argv[2], json);
else process.stdout.write(json);

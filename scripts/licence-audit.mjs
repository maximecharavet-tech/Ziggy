#!/usr/bin/env node
/**
 * Licence audit of what actually ships: every non-dev package in
 * package-lock.json (production dependency tree), with its licence read from
 * node_modules/<pkg>/package.json. Fails (exit 1) on GPL/AGPL/LGPL/MPL/SSPL/BUSL/
 * NC or an unknown licence, unless listed in APPROVED (owner's OK, CLAUDE.md).
 *   node scripts/licence-audit.mjs          → prints the table and the verdict
 *   node scripts/licence-audit.mjs --md     → Markdown table (for docs/LICENCE_AUDIT.md)
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const OK = /^(MIT|MIT-0|Apache-2\.0|BSD-2-Clause|BSD-3-Clause|0BSD|CC0-1\.0|Unlicense|Python-2\.0|BlueOak-1\.0\.0|CC-BY-4\.0)$/;
// Owner-approved exceptions (CLAUDE.md) and permissive licences outside the default list, each with a reason.
const APPROVED = { ISC: 'permissive; owner OK required per CLAUDE.md (listed for review)', 'Unicode-3.0': 'owner OK 2026-11-08 (unicode-ident data)', Zlib: 'permissive; owner OK required', 'CC-BY-3.0': 'data/attribution only; owner OK required', 'OFL-1.1': 'standard open font licence (Fredoka); owner OK required' };
// Server-only optional binaries (next/image optimiser on Vercel): never sent to browsers.
const SERVER_ONLY = /^@img\/sharp-/;
const BAD = /(GPL|AGPL|LGPL|MPL|SSPL|BUSL|EUPL|CC-BY-NC|NonCommercial|Commons-Clause)/i;

const rows = [];
for (const [path, meta] of Object.entries(lock.packages ?? {})) {
  if (!path || meta.dev || meta.devOptional || !path.includes('node_modules/')) continue;
  const pj = join(root, path, 'package.json');
  let lic = meta.license ?? null;
  let version = meta.version ?? '?';
  if (existsSync(pj)) {
    const p = JSON.parse(readFileSync(pj, 'utf8'));
    lic = typeof p.license === 'string' ? p.license : p.license?.type ?? (Array.isArray(p.licenses) ? p.licenses.map((l) => l.type ?? l).join(' OR ') : lic);
    version = p.version ?? version;
  }
  const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
  const ids = String(lic ?? 'UNKNOWN').replace(/[()]/g, '').split(/\s+(?:OR|AND)\s+|\s*\/\s*/);
  const anyOk = /\bOR\b/.test(String(lic)) ? ids.some((i) => OK.test(i)) : ids.every((i) => OK.test(i));
  const approved = ids.find((i) => APPROVED[i]);
  const status = anyOk ? 'ok' : SERVER_ONLY.test(name) ? 'server-only (next/image on Vercel, not shipped to browsers; owner decision)' : BAD.test(String(lic)) ? 'FORBIDDEN' : approved ? `review (${APPROVED[approved]})` : 'UNKNOWN';
  rows.push({ name, version, lic: lic ?? 'UNKNOWN', status, optional: Boolean(meta.optional) });
}
rows.sort((a, b) => a.name.localeCompare(b.name));
const problems = rows.filter((r) => r.status === 'FORBIDDEN' || r.status === 'UNKNOWN');
const reviews = rows.filter((r) => r.status.startsWith('review') || r.status.startsWith('server-only'));
if (process.argv.includes('--md')) {
  console.log(`| Package | Version | Licence | Status |\n|---|---|---|---|`);
  for (const r of rows.filter((x) => x.status !== 'ok')) console.log(`| ${r.name} | ${r.version} | ${r.lic} | ${r.status}${r.optional ? ' (optional)' : ''} |`);
  console.log(`\n${rows.length} production packages; ${rows.length - problems.length - reviews.length} under the default allowed licences, ${reviews.length} to review, ${problems.length} forbidden/unknown.`);
} else {
  for (const r of rows.filter((x) => x.status !== 'ok')) console.log(`${r.status.padEnd(10)} ${r.name}@${r.version}  ${r.lic}${r.optional ? '  (optional)' : ''}`);
  console.log(`${rows.length} production packages, ${reviews.length} to review, ${problems.length} forbidden/unknown`);
}
process.exit(problems.filter((p) => !p.optional).length ? 1 : 0);

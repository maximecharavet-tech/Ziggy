#!/usr/bin/env node
/**
 * Builds the Lutins Farceurs engine (Rust, rust/lutins-core) to WebAssembly
 * into src/lib/lutins/wasm/. The built files are committed: Vercel has no Rust
 * toolchain. Run it after any change to rust/lutins-core/ or to
 * src/data/lutins/bible.json (embedded in the engine).
 *
 * Two builds of the same crate:
 * - lutins_core      — browser (no image decoders: the page decodes with canvas);
 * - lutins_core_full — Node API routes (+ PNG/JPEG/WebP decoding, `decode` feature).
 *
 *   npm run lutins:wasm                      # test, build, write src/lib/lutins/wasm/
 *   npm run lutins:wasm -- --skip-tests      # build only
 *   npm run lutins:wasm -- --check           # rebuild in a temp dir; fail if the committed files differ (CI)
 *
 * Needs: rustup target add wasm32-unknown-unknown
 *        cargo install wasm-bindgen-cli --version <the crate's pinned wasm-bindgen version>
 * wasm-opt (binaryen) is used when it is on the PATH, never installed. The
 * build is reproducible for a given rustc + wasm-bindgen (+ wasm-opt): paths
 * are remapped so the output does not depend on the machine.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const crate = join(root, 'rust/lutins-core');
const out = join(root, 'src/lib/lutins/wasm');
const args = new Set(process.argv.slice(2));
const check = args.has('--check');
const skipTests = args.has('--skip-tests') || check;
const VARIANTS = [
  { name: 'lutins_core', features: ['--no-default-features'] },
  { name: 'lutins_core_full', features: [] },
];
const FILES = VARIANTS.flatMap(({ name }) => [`${name}.js`, `${name}.d.ts`, `${name}_bg.wasm`, `${name}_bg.wasm.d.ts`]);

function fail(msg) {
  console.error(`\n✗ lutins:wasm: ${msg}\n`);
  process.exit(1);
}

function run(cmd, argv, opts = {}) {
  const r = spawnSync(cmd, argv, { stdio: 'inherit', ...opts });
  if (r.error) fail(`${cmd} not found (${r.error.message})`);
  if (r.status !== 0) fail(`${cmd} ${argv.join(' ')} exited with ${r.status}`);
}

function tool(cmd, argv) {
  try {
    return execFileSync(cmd, argv, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

// wasm-bindgen CLI must match the crate's pinned wasm-bindgen exactly.
const pinned = /wasm-bindgen\s*=\s*"=([0-9.]+)"/.exec(readFileSync(join(crate, 'Cargo.toml'), 'utf8'))?.[1];
const cli = tool('wasm-bindgen', ['--version'])?.split(/\s+/)[1];
if (!pinned) fail('rust/lutins-core/Cargo.toml must pin wasm-bindgen with "=x.y.z"');
if (!cli) fail(`wasm-bindgen CLI not found: cargo install wasm-bindgen-cli --version ${pinned}`);
if (cli !== pinned) fail(`wasm-bindgen CLI ${cli} ≠ crate ${pinned}: cargo install wasm-bindgen-cli --version ${pinned}`);

if (!skipTests) run('cargo', ['test', '--quiet', '--manifest-path', join(crate, 'Cargo.toml')]);

const cargoHome = process.env.CARGO_HOME || join(homedir(), '.cargo');
const rustflags = [
  `--remap-path-prefix=${cargoHome}=/cargo`,
  `--remap-path-prefix=${crate}=/lutins-core`,
  process.env.RUSTFLAGS || '',
]
  .join(' ')
  .trim();
const dest = check ? mkdtempSync(join(tmpdir(), 'lutins-wasm-')) : out;
mkdirSync(dest, { recursive: true });
const wasmOpt = tool('wasm-opt', ['--version']);
for (const { name, features } of VARIANTS) {
  run(
    'cargo',
    ['build', '--release', '--quiet', '--target', 'wasm32-unknown-unknown', ...features, '--manifest-path', join(crate, 'Cargo.toml')],
    { env: { ...process.env, RUSTFLAGS: rustflags } },
  );
  run('wasm-bindgen', [
    '--target', 'web',
    '--out-dir', dest,
    '--out-name', name,
    join(crate, 'target/wasm32-unknown-unknown/release/lutins_core.wasm'),
  ]);
  if (wasmOpt) {
    const wasm = join(dest, `${name}_bg.wasm`);
    run('wasm-opt', ['-Oz', '--enable-bulk-memory', '--enable-nontrapping-float-to-int', '--enable-sign-ext', '--enable-mutable-globals', wasm, '-o', wasm]);
  }
}
console.log(wasmOpt ? `wasm-opt: ${wasmOpt}` : 'wasm-opt: not found, skipped');

if (check) {
  const bad = [];
  for (const f of FILES) {
    const a = join(dest, f);
    const b = join(out, f);
    if (!existsSync(b)) bad.push(`${f}: missing in src/lib/lutins/wasm/`);
    else if (!readFileSync(a).equals(readFileSync(b))) bad.push(`${f}: differs`);
  }
  const extra = readdirSync(dest).filter((f) => !FILES.includes(f));
  rmSync(dest, { recursive: true, force: true });
  if (extra.length) bad.push(`unexpected outputs: ${extra.join(', ')}`);
  if (bad.length) {
    fail(
      `the committed WebAssembly is out of date:\n  ${bad.join('\n  ')}\n` +
        `Run \`npm run lutins:wasm\` and commit src/lib/lutins/wasm/ ` +
        `(same toolchain: ${tool('rustc', ['--version'])}, wasm-bindgen ${cli}${wasmOpt ? `, ${wasmOpt}` : ''}).`,
    );
  }
  console.log('✓ lutins:wasm --check: src/lib/lutins/wasm/ is up to date');
} else {
  for (const f of FILES) {
    const p = join(out, f);
    const size = statSync(p).size;
    const gz = gzipSync(readFileSync(p), { level: 9 }).length;
    console.log(`${f.padEnd(26)} ${(size / 1024).toFixed(1).padStart(7)} kB  (gzip ${(gz / 1024).toFixed(1)} kB)`);
  }
}

#!/usr/bin/env bash
# Builds the TV spatial-navigation engine (Rust → WebAssembly) into
# src/lib/tv/wasm/. The built files are committed: Vercel has no Rust
# toolchain. Run it after any change to rust/ziggy-tv-nav/.
#
# Needs: rustup target add wasm32-unknown-unknown
#        cargo install wasm-bindgen-cli --version 0.2.129 (same as the crate's wasm-bindgen)
set -euo pipefail
cd "$(dirname "$0")/../rust/ziggy-tv-nav"

cargo test --quiet
cargo build --release --target wasm32-unknown-unknown --quiet

OUT=../../src/lib/tv/wasm
mkdir -p "$OUT"
wasm-bindgen --target web --out-dir "$OUT" --out-name ziggy_tv_nav \
  target/wasm32-unknown-unknown/release/ziggy_tv_nav.wasm
ls -l "$OUT"

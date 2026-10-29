#!/usr/bin/env bash
# Type-checks and lints the iOS code (src-tauri/src/platform/ios.rs) on Linux, without
# Xcode: `cargo clippy --target aarch64-apple-ios` only needs the Rust sources, but one
# dependency compiles a tiny Objective-C file in its build script, so a stand-in compiler
# writes empty object files (nothing is linked by a check).
#   rustup target add aarch64-apple-ios && bash apps/ziggy-app/scripts/check-ios-on-linux.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
fake="$(mktemp -d)"
cat > "$fake/clang" <<'SH'
#!/usr/bin/env bash
out=""
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
  a="${args[$i]}"
  case "$a" in *detect_compiler_family.c) echo clang; exit 0 ;; "-?") exit 1 ;; -E) echo clang; exit 0 ;; esac
  [ "$a" = "-o" ] && out="${args[$((i + 1))]}"
  case "$a" in -o?*) out="${a#-o}" ;; esac
done
[ -n "$out" ] && { mkdir -p "$(dirname "$out")"; : > "$out"; }
exit 0
SH
chmod +x "$fake/clang"
mkdir -p "$fake/sdk"
cd "$here/../src-tauri"
SDKROOT="$fake/sdk" IPHONEOS_DEPLOYMENT_TARGET=15.0 CC_aarch64_apple_ios="$fake/clang" AR_aarch64_apple_ios=ar \
  cargo clippy --target aarch64-apple-ios -- -D warnings

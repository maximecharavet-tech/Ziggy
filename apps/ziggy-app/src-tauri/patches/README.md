# Licence drop-ins

The project ships only MIT / Apache-2.0 / BSD code (see `CLAUDE.md`). Two small crates of
the Tauri dependency tree are MPL-2.0, so `Cargo.toml` (`[patch.crates-io]`) replaces them
with these MIT re-implementations of the exact API their users call:

| crate | pulled by | what is used |
|---|---|---|
| `option-ext` 0.2 (MPL-2.0) | `dirs-sys` (Tauri's path resolver) | `OptionExt::{contains, map_or2, map_or_else2}` |
| `dom_query` 0.28 (MIT, but built on MPL-2.0 `cssparser` / `selectors`) | `wry` on Android only | prepend `<script>` tags to `<head>` of a bundled HTML page, on WebViews too old for document-start scripts |

Both are written from the public API only. Remove a patch when its upstream user drops the
dependency (check with `cargo tree -e normal,no-proc-macro --target aarch64-linux-android`).

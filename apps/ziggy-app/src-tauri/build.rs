fn main() {
    // The app's own commands get ACL permissions (`allow-<command>`), granted in
    // `capabilities/`: the local launch page and the site each get only what they use.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
        "launch",
        "app_info",
        "set_bar_style",
        "haptic",
        "open_external",
        "exit_app",
    ])))
    .expect("failed to run tauri-build");
}

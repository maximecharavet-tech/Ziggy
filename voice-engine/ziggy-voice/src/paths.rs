//! Where things live: the repository, the build cache (git-ignored) and the
//! published voice files.

use std::path::{Path, PathBuf};

/// `voice-engine/` (the workspace root), found from the crate's manifest dir.
pub fn engine_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).parent().expect("workspace").to_path_buf()
}

/// The Ziggy repository root.
pub fn repo_root() -> PathBuf {
    engine_dir().parent().expect("repo").to_path_buf()
}

/// Build cache: models, downloaded libraries, raw takes. `ZIGGY_VOICE_CACHE`
/// overrides the default `voice-engine/.cache`.
pub fn cache_dir() -> PathBuf {
    std::env::var_os("ZIGGY_VOICE_CACHE").map(PathBuf::from).unwrap_or_else(|| engine_dir().join(".cache"))
}

pub struct Cache {
    pub root: PathBuf,
}

impl Cache {
    pub fn new() -> Self {
        Self { root: cache_dir() }
    }
    pub fn at(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }
    pub fn npm(&self) -> PathBuf {
        self.root.join("npm")
    }
    pub fn wheels(&self) -> PathBuf {
        self.root.join("wheels")
    }
    /// The joined, verified fp32 graph (as published).
    pub fn base_model(&self) -> PathBuf {
        self.root.join("kokoro-fp32.onnx")
    }
    /// Ziggy's patched graph (durations + in-network pitch controls).
    pub fn model(&self) -> PathBuf {
        self.root.join("kokoro-ziggy-v2.onnx")
    }
    pub fn voices(&self) -> PathBuf {
        self.root.join("voices")
    }
    pub fn lib(&self) -> PathBuf {
        self.root.join("lib")
    }
    pub fn onnxruntime(&self) -> PathBuf {
        self.lib().join("libonnxruntime.so")
    }
    pub fn espeak_lib(&self) -> PathBuf {
        self.lib().join("libespeak-ng.so")
    }
    pub fn espeak_data(&self) -> PathBuf {
        self.root.join("espeak-ng-data")
    }
    pub fn misaki(&self) -> PathBuf {
        self.root.join("misaki")
    }
    pub fn raw(&self) -> PathBuf {
        self.root.join("raw")
    }
}

impl Default for Cache {
    fn default() -> Self {
        Self::new()
    }
}

/// `public/dodo/voice`.
pub fn voice_out() -> PathBuf {
    repo_root().join("public").join("dodo").join("voice")
}

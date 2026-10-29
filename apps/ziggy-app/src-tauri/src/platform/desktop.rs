//! Computer build (checks and tests only): every native touch is a no-op.

use crate::shell::{BarStyle, Haptic};
use tauri::{Runtime, WebviewWindow};

pub fn television() -> bool {
    false
}

pub fn prefers_dark() -> bool {
    false
}

pub fn init_audio() {}

pub fn prepare_webview<R: Runtime>(_window: &WebviewWindow<R>) {}

pub fn set_user_agent<R: Runtime>(_window: &WebviewWindow<R>, _user_agent: String) {}

pub fn set_bar_style<R: Runtime>(_window: &WebviewWindow<R>, _style: BarStyle) {}

pub fn haptic<R: Runtime>(_window: &WebviewWindow<R>, _kind: Haptic) {}

pub fn clear_history<R: Runtime>(_window: &WebviewWindow<R>) {}

#[allow(dead_code)] // only the Android back button leaves the app
pub fn leave_app<R: Runtime>(window: &WebviewWindow<R>) {
    let _ = window.close();
}

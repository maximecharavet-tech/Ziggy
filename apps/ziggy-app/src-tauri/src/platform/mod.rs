//! What each system needs natively, behind one small API:
//!
//! | function          | Android (JNI)                         | iOS / iPadOS (objc2)                  |
//! |-------------------|---------------------------------------|---------------------------------------|
//! | `television`      | UiModeManager, leanback, Fire TV      | always `false`                        |
//! | `prefers_dark`    | `Configuration.uiMode`                | `UITraitCollection`                   |
//! | `init_audio`      | nothing (WebView keeps playing)       | `AVAudioSession` `.playback`          |
//! | `prepare_webview` | no overscroll glow, no zoom, text 100%| no bounce, no link preview            |
//! | `set_user_agent`  | `WebSettings.setUserAgentString`      | `WKWebView.customUserAgent`           |
//! | `set_bar_style`   | light/dark system bar icons           | status bar style                      |
//! | `haptic`          | `View.performHapticFeedback`          | `UI*FeedbackGenerator`                |
//! | `clear_history`   | `WebView.clearHistory`                | nothing (no back button)              |
//! | `leave_app`       | `Activity.moveTaskToBack`             | nothing (iOS apps never quit)         |
//!
//! The desktop build only exists to compile and test the shell on a computer.

#[cfg(target_os = "android")]
mod android;
#[cfg(target_os = "android")]
pub use android::*;

#[cfg(target_os = "ios")]
mod ios;
#[cfg(target_os = "ios")]
pub use ios::*;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
mod desktop;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub use desktop::*;

/// Origin of the bundled pages (launch / offline page) on this platform.
#[cfg(any(target_os = "android", target_os = "windows"))]
pub const LOCAL_ORIGIN: &str = "http://tauri.localhost";
#[cfg(not(any(target_os = "android", target_os = "windows")))]
pub const LOCAL_ORIGIN: &str = "tauri://localhost";

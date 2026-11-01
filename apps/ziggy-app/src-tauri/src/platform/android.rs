//! Android, Android TV, Google TV and Fire TV, through JNI. Only framework classes
//! (`android.*`) are used: they resolve from any thread, unlike the app's own classes.

use crate::shell::{self, BarStyle, Haptic};
use jni::objects::{JObject, JValue};
use jni::{JNIEnv, JavaVM};
use tauri::{Runtime, WebviewWindow};

/// Runs `f` with the application `Context` (published by tao in `ndk-context`).
/// Any Java exception is cleared and turns into `None`.
fn with_context<T>(f: impl FnOnce(&mut JNIEnv, &JObject) -> jni::errors::Result<T>) -> Option<T> {
    let ctx = ndk_context::android_context();
    if ctx.vm().is_null() || ctx.context().is_null() {
        return None;
    }
    // SAFETY: tao stores the process JavaVM and a global reference to the application
    // context in ndk-context before any Tauri code runs; both live as long as the process.
    let vm = unsafe { JavaVM::from_raw(ctx.vm().cast()) }.ok()?;
    let mut env = vm.attach_current_thread().ok()?;
    // SAFETY: a global reference owned by tao; `JObject` never deletes it.
    let context = unsafe { JObject::from_raw(ctx.context().cast()) };
    let result = f(&mut env, &context);
    clear_exception(&mut env);
    result.ok()
}

fn clear_exception(env: &mut JNIEnv) {
    if env.exception_check().unwrap_or(false) {
        let _ = env.exception_clear();
    }
}

/// Runs `f` on the UI thread with the activity and the `WebView` (Tauri's JNI handle).
fn on_webview<R: Runtime>(
    window: &WebviewWindow<R>,
    f: impl FnOnce(&mut JNIEnv, &JObject, &JObject) -> jni::errors::Result<()> + Send + 'static,
) {
    let _ = window.with_webview(move |webview| {
        webview.jni_handle().exec(move |env, activity, webview| {
            let _ = f(env, activity, webview);
            clear_exception(env);
        });
    });
}

fn sdk_int(env: &mut JNIEnv) -> jni::errors::Result<i32> {
    env.get_static_field("android/os/Build$VERSION", "SDK_INT", "I")?.i()
}

fn has_feature(env: &mut JNIEnv, context: &JObject, feature: &str) -> jni::errors::Result<bool> {
    let pm = env.call_method(context, "getPackageManager", "()Landroid/content/pm/PackageManager;", &[])?.l()?;
    let name = env.new_string(feature)?;
    env.call_method(&pm, "hasSystemFeature", "(Ljava/lang/String;)Z", &[JValue::Object(&name)])?.z()
}

/// Android TV / Google TV / Fire TV: the UI mode says "television", or the device has the
/// leanback feature, or Amazon's Fire TV feature (see `shell::is_television`).
pub fn television() -> bool {
    const UI_MODE_TYPE_TELEVISION: i32 = 4;
    let ui_mode_tv = with_context(|env, context| {
        let name = env.new_string("uimode")?;
        let manager = env
            .call_method(
                context,
                "getSystemService",
                "(Ljava/lang/String;)Ljava/lang/Object;",
                &[JValue::Object(&name)],
            )?
            .l()?;
        if manager.is_null() {
            return Ok(false);
        }
        Ok(env.call_method(&manager, "getCurrentModeType", "()I", &[])?.i()? == UI_MODE_TYPE_TELEVISION)
    });
    let leanback = with_context(|env, context| has_feature(env, context, "android.software.leanback"));
    let fire_tv = with_context(|env, context| has_feature(env, context, "amazon.hardware.fire_tv"));
    shell::is_television(ui_mode_tv, leanback, fire_tv)
}

/// The system is in dark mode (`Configuration.uiMode & UI_MODE_NIGHT_MASK == UI_MODE_NIGHT_YES`).
pub fn prefers_dark() -> bool {
    with_context(|env, context| {
        let resources = env.call_method(context, "getResources", "()Landroid/content/res/Resources;", &[])?.l()?;
        let configuration =
            env.call_method(&resources, "getConfiguration", "()Landroid/content/res/Configuration;", &[])?.l()?;
        Ok(env.get_field(&configuration, "uiMode", "I")?.i()? & 0x30 == 0x20)
    })
    .unwrap_or(false)
}

/// The Android WebView keeps playing a bedtime story with the screen off: nothing to set.
pub fn init_audio() {}

/// No overscroll glow/stretch, no pinch zoom, page text at 100 % (the site sizes its own
/// text for children), and the WebView takes the focus so a TV remote drives it at once.
pub fn prepare_webview<R: Runtime>(window: &WebviewWindow<R>) {
    on_webview(window, |env, _activity, webview| {
        const OVER_SCROLL_NEVER: i32 = 2;
        env.call_method(webview, "setOverScrollMode", "(I)V", &[JValue::Int(OVER_SCROLL_NEVER)])?;
        env.call_method(webview, "setHapticFeedbackEnabled", "(Z)V", &[JValue::Bool(1)])?;
        let settings = env.call_method(webview, "getSettings", "()Landroid/webkit/WebSettings;", &[])?.l()?;
        env.call_method(&settings, "setSupportZoom", "(Z)V", &[JValue::Bool(0)])?;
        env.call_method(&settings, "setBuiltInZoomControls", "(Z)V", &[JValue::Bool(0)])?;
        env.call_method(&settings, "setDisplayZoomControls", "(Z)V", &[JValue::Bool(0)])?;
        env.call_method(&settings, "setTextZoom", "(I)V", &[JValue::Int(100)])?;
        env.call_method(webview, "setFocusable", "(Z)V", &[JValue::Bool(1)])?;
        env.call_method(webview, "requestFocus", "()Z", &[])?;
        Ok(())
    });
}

pub fn set_user_agent<R: Runtime>(window: &WebviewWindow<R>, user_agent: String) {
    on_webview(window, move |env, _activity, webview| {
        let settings = env.call_method(webview, "getSettings", "()Landroid/webkit/WebSettings;", &[])?.l()?;
        let ua = env.new_string(user_agent)?;
        env.call_method(&settings, "setUserAgentString", "(Ljava/lang/String;)V", &[JValue::Object(&ua)])?;
        Ok(())
    });
}

/// Status and navigation bar icons that stay readable on the page under them.
pub fn set_bar_style<R: Runtime>(window: &WebviewWindow<R>, style: BarStyle) {
    let light_page = style == BarStyle::Light;
    on_webview(window, move |env, activity, _webview| {
        let win = env.call_method(activity, "getWindow", "()Landroid/view/Window;", &[])?.l()?;
        if sdk_int(env)? >= 30 {
            const APPEARANCE_LIGHT_STATUS_BARS: i32 = 8;
            const APPEARANCE_LIGHT_NAVIGATION_BARS: i32 = 16;
            let mask = APPEARANCE_LIGHT_STATUS_BARS | APPEARANCE_LIGHT_NAVIGATION_BARS;
            let controller =
                env.call_method(&win, "getInsetsController", "()Landroid/view/WindowInsetsController;", &[])?.l()?;
            if !controller.is_null() {
                let value = if light_page { mask } else { 0 };
                env.call_method(
                    &controller,
                    "setSystemBarsAppearance",
                    "(II)V",
                    &[JValue::Int(value), JValue::Int(mask)],
                )?;
            }
        } else {
            const LIGHT_STATUS_BAR: i32 = 0x2000;
            const LIGHT_NAVIGATION_BAR: i32 = 0x10;
            let decor = env.call_method(&win, "getDecorView", "()Landroid/view/View;", &[])?.l()?;
            let flags = env.call_method(&decor, "getSystemUiVisibility", "()I", &[])?.i()?;
            let light = if sdk_int(env)? >= 26 { LIGHT_STATUS_BAR | LIGHT_NAVIGATION_BAR } else { LIGHT_STATUS_BAR };
            let flags = if light_page { flags | light } else { flags & !light };
            env.call_method(&decor, "setSystemUiVisibility", "(I)V", &[JValue::Int(flags)])?;
        }
        Ok(())
    });
}

/// A system haptic "tick": no VIBRATE permission, follows the user's touch-feedback setting.
pub fn haptic<R: Runtime>(window: &WebviewWindow<R>, kind: Haptic) {
    on_webview(window, move |env, _activity, webview| {
        let constant = kind.android_constant(sdk_int(env)?);
        env.call_method(webview, "performHapticFeedback", "(I)Z", &[JValue::Int(constant)])?;
        Ok(())
    });
}

/// Forgets the pages before the current one, so the back button never returns to the
/// launch page or to a page that failed to load.
pub fn clear_history<R: Runtime>(window: &WebviewWindow<R>) {
    on_webview(window, |env, _activity, webview| {
        env.call_method(webview, "clearHistory", "()V", &[])?;
        Ok(())
    });
}

/// Back at the root: the app goes to the background like any Android app (the story or the
/// game is still there when the child comes back).
pub fn leave_app<R: Runtime>(window: &WebviewWindow<R>) {
    on_webview(window, |env, activity, _webview| {
        env.call_method(activity, "moveTaskToBack", "(Z)Z", &[JValue::Bool(1)])?;
        Ok(())
    });
}

/// Called by `MainActivity` (Kotlin) when the back button reaches the root of the history:
/// Tauri's own handler goes back in the web history first and only lets this one run when
/// there is nothing left to go back to.
#[no_mangle]
pub extern "system" fn Java_fr_ziggyai_app_MainActivity_backAtRoot(_env: JNIEnv, _activity: JObject) {
    let _ = std::panic::catch_unwind(crate::back_at_root);
}

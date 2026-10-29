//! Ziggy AI, the native apps: a Tauri 2 shell around https://ziggy-ai.fr for Android
//! phones and tablets, Android TV / Google TV / Fire TV, iPhone and iPad.
//!
//! The app opens on a bundled launch page (Ziggy on the site's background colour, so
//! the system splash fades into it), checks that the site is reachable, then shows
//! the site. Rust owns every decision: where the window may go (`shell::may_navigate`),
//! which links may leave the app (`shell::validate_external`), how the app introduces
//! itself to the site (user agent token, see `src/lib/app-shell.ts` in the site), and
//! what the back button does. The commands below are all the site can ask of the app.

mod net;
mod platform;
mod shell;

use serde::Serialize;
use shell::{AppInfo, BarStyle, Haptic, Platform};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::time::Duration;
use tauri::webview::{NewWindowResponse, PageLoadEvent};
use tauri::window::Color;
use tauri::{AppHandle, Emitter, Manager, State, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

/// The app's only window.
const MAIN: &str = "main";

/// Event sent to the site when the Android back button reaches the root of the web history
/// (contract: `src/lib/app-bridge.ts`, `onAppBack`). The site then closes a panel, goes to
/// the app's home, or asks "Leave Ziggy?" and calls `exit_app`.
#[cfg_attr(not(target_os = "android"), allow(dead_code))]
const BACK_EVENT: &str = "ziggy://back";

/// Injected at document start in every page (site and bundled pages): removes web
/// artefacts and keeps the status bar readable. See `shell.js`.
const SHELL_JS: &str = include_str!("shell.js");

struct Shell {
    info: AppInfo,
    /// The next site page that finishes loading forgets the launch page behind it.
    forget_launch_page: AtomicBool,
}

static APP: OnceLock<AppHandle> = OnceLock::new();

/// Platform, TV and version, for the site (same facts as the user agent token).
#[tauri::command]
fn app_info(shell: State<'_, Shell>) -> AppInfo {
    shell.info.clone()
}

#[derive(Serialize)]
struct Launch {
    online: bool,
}

/// Called by the bundled launch page with the webview's own user agent: the app adds its
/// token, then goes to the site if it is reachable. `reachable` is the launch page's own
/// check through the webview (it knows the system proxy when the direct check failed).
#[tauri::command]
async fn launch(
    window: WebviewWindow,
    shell: State<'_, Shell>,
    user_agent: String,
    to: Option<String>,
    reachable: Option<bool>,
) -> Result<Launch, String> {
    if let Some(ua) = shell::user_agent_with_token(&user_agent, &shell.info.user_agent_token()) {
        platform::set_user_agent(&window, ua);
    }
    let online = reachable == Some(true)
        || tauri::async_runtime::spawn_blocking(|| net::site_reachable(shell::SITE_HOSTS[0], Duration::from_secs(3)))
            .await
            .unwrap_or(false);
    if online {
        shell.forget_launch_page.store(true, Ordering::SeqCst);
        window.navigate(shell::launch_target(to.as_deref())).map_err(|e| e.to_string())?;
    }
    Ok(Launch { online })
}

/// `"dark"`: light status bar icons (dark page); `"light"`: dark icons.
#[tauri::command]
fn set_bar_style(window: WebviewWindow, style: String) -> Result<(), String> {
    let style = BarStyle::parse(&style).ok_or("style must be \"dark\" or \"light\"")?;
    platform::set_bar_style(&window, style);
    Ok(())
}

/// A subtle system haptic: light, medium, heavy, selection, success, warning, error.
/// Silently nothing on devices without a vibration motor (and on TVs).
#[tauri::command]
fn haptic(window: WebviewWindow, kind: String, shell: State<'_, Shell>) -> Result<(), String> {
    let kind = Haptic::parse(&kind).ok_or("unknown haptic kind")?;
    if !shell.info.tv {
        platform::haptic(&window, kind);
    }
    Ok(())
}

/// Opens a grown-up link (https or mailto) outside the app. The site calls this only
/// after its grown-up gate; the app checks the address again.
#[tauri::command]
fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    let url = shell::validate_external(&url).map_err(|e| e.to_string())?;
    app.opener().open_url(url.as_str(), None::<&str>).map_err(|e| e.to_string())
}

/// "Quitter" ("Leave Ziggy?" in the site, Android). iOS apps never quit themselves.
#[tauri::command]
fn exit_app(app: AppHandle, shell: State<'_, Shell>) -> Result<(), String> {
    if shell.info.platform == Platform::Ios {
        return Err("iOS apps do not quit".into());
    }
    app.exit(0);
    Ok(())
}

/// The back button reached the root of the web history (Android, see `MainActivity.kt`).
/// On a page of the site, the site decides (`ziggy://back`); on the bundled launch or
/// offline page, the app goes to the background like any Android app.
#[cfg_attr(not(target_os = "android"), allow(dead_code))]
pub(crate) fn back_at_root() {
    let Some(app) = APP.get().cloned() else { return };
    // Off the UI thread: reading the webview's address waits for the UI thread.
    std::thread::spawn(move || {
        let Some(window) = app.get_webview_window(MAIN) else { return };
        if window.url().is_ok_and(|url| shell::is_site_url(&url)) {
            let _ = app.emit_to(MAIN, BACK_EVENT, ());
        } else {
            platform::leave_app(&window);
        }
    });
}

/// The bundled offline page, with the page to come back to.
fn offline_url(back_to: &Url) -> Option<Url> {
    let mut url = Url::parse(&format!("{}/index.html", platform::LOCAL_ORIGIN)).ok()?;
    url.query_pairs_mut().append_pair("offline", "1").append_pair("to", back_to.as_str());
    Some(url)
}

fn on_page_loaded(window: &WebviewWindow, url: &Url) {
    let shell = window.state::<Shell>();
    if shell::is_local_url(url) {
        // Back never returns to a page that failed to load.
        platform::clear_history(window);
        return;
    }
    if !shell::is_site_url(url) {
        return;
    }
    if shell.forget_launch_page.swap(false, Ordering::SeqCst) {
        platform::clear_history(window);
    }
    // Every real page runs shell.js; a page that didn't is the system's error page
    // (the connection dropped while navigating): show Ziggy's offline page instead.
    let (window_, failed) = (window.clone(), url.clone());
    let _ = window.eval_with_callback("typeof window.__ziggyShell", move |kind| {
        if kind.trim().trim_matches('"') == "undefined" {
            if let Some(offline) = offline_url(&failed) {
                let _ = window_.navigate(offline);
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Rust API only: no opener permission is granted to any page, and links are not
        // intercepted (the site's grown-up gate decides, then calls `open_external`).
        .plugin(tauri_plugin_opener::Builder::new().open_js_links_on_click(false).build())
        .invoke_handler(tauri::generate_handler![launch, app_info, set_bar_style, haptic, open_external, exit_app])
        .setup(|app| {
            let version = app.package_info().version.to_string();
            let info = AppInfo::new(Platform::current(), platform::television(), version);
            app.manage(Shell { info, forget_launch_page: AtomicBool::new(false) });
            let _ = APP.set(app.handle().clone());
            platform::init_audio();

            let (r, g, b) = if platform::prefers_dark() { shell::BG_DARK } else { shell::BG_LIGHT };
            let handle = app.handle().clone();
            let window = WebviewWindowBuilder::new(app, MAIN, WebviewUrl::App("index.html".into()))
                .title("Ziggy AI")
                .background_color(Color(r, g, b, 255))
                .initialization_script(SHELL_JS)
                .on_navigation(shell::may_navigate)
                .on_new_window(move |url, _features| {
                    // `target="_blank"` to a Ziggy page opens in the same window; anything
                    // else goes through the site's grown-up gate and `open_external`.
                    if shell::may_navigate(&url) {
                        if let Some(window) = handle.get_webview_window(MAIN) {
                            let _ = window.navigate(url);
                        }
                    }
                    NewWindowResponse::Deny
                })
                .on_page_load(|window, payload| {
                    if payload.event() == PageLoadEvent::Finished {
                        on_page_loaded(&window, payload.url());
                    }
                })
                .build()?;
            platform::prepare_webview(&window);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Ziggy AI");
}

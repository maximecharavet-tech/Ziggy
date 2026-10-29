//! The rules of the Ziggy shell, free of any platform code so they are unit-tested
//! on any computer: which pages the app may show, which links may leave the app,
//! and how the app introduces itself to the site.

use serde::Serialize;
use tauri::Url;

/// The site the app shows. Everything a child sees comes from here.
pub const START_URL: &str = "https://ziggy-ai.fr/";

/// Hosts the app window may navigate to (top-level pages).
pub const SITE_HOSTS: [&str; 2] = ["ziggy-ai.fr", "www.ziggy-ai.fr"];

/// Ziggy's Supabase project (sign-in pages and e-mail confirmations).
pub const SUPABASE_HOST: &str = "idoynasiaufymzuwnfpe.supabase.co";

/// Hosts the bundled pages are served from (the launch / offline page):
/// `tauri://localhost` on iOS, `http(s)://tauri.localhost` on Android.
const LOCAL_HOSTS: [&str; 2] = ["localhost", "tauri.localhost"];

/// Page background of the site (`--color-bg`, `--color-bg-dark` in `src/app/globals.css`),
/// shown by the webview before the first paint so there is never a white flash.
pub const BG_LIGHT: (u8, u8, u8) = (0xFA, 0xFB, 0xFC);
pub const BG_DARK: (u8, u8, u8) = (0x0A, 0x0A, 0x1A);

/// The platform the shell runs on, as written in the user agent token.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    Android,
    Ios,
    /// Only for checks on a computer; never shipped.
    Desktop,
}

impl Platform {
    pub fn current() -> Self {
        if cfg!(target_os = "android") {
            Self::Android
        } else if cfg!(target_os = "ios") {
            Self::Ios
        } else {
            Self::Desktop
        }
    }

    fn token_name(self) -> &'static str {
        match self {
            Self::Android => "android",
            Self::Ios => "ios",
            Self::Desktop => "desktop",
        }
    }
}

/// What the site may ask about the shell (`app_info` command).
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct AppInfo {
    pub platform: Platform,
    /// Android TV / Google TV / Fire TV.
    pub tv: bool,
    pub version: String,
    pub shell: &'static str,
}

impl AppInfo {
    pub fn new(platform: Platform, tv: bool, version: impl Into<String>) -> Self {
        Self { platform, tv: tv && platform == Platform::Android, version: version.into(), shell: "tauri" }
    }

    /// The token appended to the webview's user agent, as defined by the site in
    /// `src/lib/app-shell.ts`: `ZiggyApp/<version> (<platform>[; tv])`.
    pub fn user_agent_token(&self) -> String {
        let tv = if self.tv { "; tv" } else { "" };
        format!("ZiggyApp/{} ({}{})", self.version, self.platform.token_name(), tv)
    }
}

/// The webview's own user agent with Ziggy's token appended (any older token removed,
/// so the token is never there twice). Returns `None` for a user agent that can't be a
/// real one (empty, too long, control characters): the webview keeps its own then.
pub fn user_agent_with_token(webview_user_agent: &str, token: &str) -> Option<String> {
    let base = webview_user_agent.trim();
    if base.is_empty() || base.len() > 512 || !base.chars().all(|c| (' '..='~').contains(&c)) {
        return None;
    }
    let base = match base.find("ZiggyApp/") {
        Some(at) => {
            let rest = &base[at..];
            let end = rest.find(')').map_or(rest.len(), |i| i + 1);
            format!("{}{}", base[..at].trim_end(), &rest[end..]).trim().to_string()
        }
        None => base.to_string(),
    };
    Some(format!("{base} {token}"))
}

/// Android TV detection from what the system reports. Any one signal is enough:
/// the UI mode (`UiModeManager` reports `UI_MODE_TYPE_TELEVISION`), the leanback
/// feature (Android TV, Google TV) or Amazon's Fire TV feature. A signal the system
/// could not answer (`None`) counts as "not a TV": a phone layout on a TV is still
/// usable with a mouse-like remote, a TV layout on a phone is not.
#[cfg_attr(not(target_os = "android"), allow(dead_code))]
pub fn is_television(ui_mode_tv: Option<bool>, leanback: Option<bool>, fire_tv: Option<bool>) -> bool {
    [ui_mode_tv, leanback, fire_tv].into_iter().any(|s| s == Some(true))
}

fn is_site_host(host: &str) -> bool {
    SITE_HOSTS.iter().any(|h| host.eq_ignore_ascii_case(h))
}

fn default_https_port(url: &Url) -> bool {
    url.port().is_none() || url.port() == Some(443)
}

/// A page of the site itself (where the shell's commands are allowed).
pub fn is_site_url(url: &Url) -> bool {
    url.scheme() == "https"
        && default_https_port(url)
        && url.username().is_empty()
        && url.password().is_none()
        && url.host_str().is_some_and(is_site_host)
}

/// A page bundled with the app (launch / offline page).
pub fn is_local_url(url: &Url) -> bool {
    let local_host = url.host_str().is_some_and(|h| LOCAL_HOSTS.contains(&h));
    match url.scheme() {
        "tauri" => local_host,
        "http" | "https" => url.host_str() == Some("tauri.localhost"),
        _ => false,
    }
}

/// The navigation guard: the app window only ever shows the site, its Supabase
/// pages and the bundled offline page. Any other address is refused here; the site
/// sends grown-up links out through `open_external`, after its grown-up gate.
pub fn may_navigate(url: &Url) -> bool {
    if is_site_url(url) || is_local_url(url) {
        return true;
    }
    url.scheme() == "https"
        && default_https_port(url)
        && url.username().is_empty()
        && url.host_str().is_some_and(|h| h.eq_ignore_ascii_case(SUPABASE_HOST))
}

/// Why a link may not leave the app.
#[derive(Debug, PartialEq, Eq)]
pub enum ExternalError {
    Invalid,
    Scheme,
    Host,
    Credentials,
}

impl std::fmt::Display for ExternalError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Invalid => "not a valid address",
            Self::Scheme => "only https and mailto links can be opened",
            Self::Host => "this address can't be opened",
            Self::Credentials => "addresses with a user name or password can't be opened",
        })
    }
}

/// Validates a link the site wants to open in the system browser / mail app
/// (`open_external`, called by the site only after its grown-up gate). The shell
/// checks again: `https` to a real domain name, or `mailto` with an address.
pub fn validate_external(raw: &str) -> Result<Url, ExternalError> {
    if raw.len() > 2048 {
        return Err(ExternalError::Invalid);
    }
    let url = Url::parse(raw.trim()).map_err(|_| ExternalError::Invalid)?;
    match url.scheme() {
        "https" => {
            if !url.username().is_empty() || url.password().is_some() {
                return Err(ExternalError::Credentials);
            }
            let domain = url.domain().ok_or(ExternalError::Host)?;
            // A domain name with a dot, no IP address, no "localhost", default port.
            let looks_public = domain.contains('.')
                && !domain.ends_with(".localhost")
                && !domain.ends_with(".local")
                && !domain.starts_with('.')
                && !domain.ends_with('.');
            if !looks_public || !default_https_port(&url) {
                return Err(ExternalError::Host);
            }
            Ok(url)
        }
        "mailto" => {
            let to = url.path();
            let ok = to.split(',').all(|a| {
                let mut parts = a.split('@');
                matches!((parts.next(), parts.next(), parts.next()), (Some(user), Some(host), None)
                    if !user.is_empty() && host.contains('.') && !host.contains('/'))
            });
            if to.is_empty() || !ok {
                return Err(ExternalError::Invalid);
            }
            Ok(url)
        }
        _ => Err(ExternalError::Scheme),
    }
}

/// Where the launch page goes once the network is there: the page the child was on
/// when the connection dropped (only a page of the site), else the home page.
pub fn launch_target(back_to: Option<&str>) -> Url {
    back_to
        .and_then(|raw| Url::parse(raw).ok())
        .filter(is_site_url)
        .unwrap_or_else(|| Url::parse(START_URL).expect("valid start url"))
}

/// Tone of the page under the status bar, so the bar icons stay readable.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BarStyle {
    /// Dark page: light icons.
    Dark,
    /// Light page: dark icons.
    Light,
}

impl BarStyle {
    pub fn parse(style: &str) -> Option<Self> {
        match style {
            "dark" => Some(Self::Dark),
            "light" => Some(Self::Light),
            _ => None,
        }
    }
}

/// A short haptic "tick" the site may ask for (subtle, never on its own).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Haptic {
    Light,
    Medium,
    Heavy,
    Selection,
    Success,
    Warning,
    Error,
}

impl Haptic {
    pub fn parse(kind: &str) -> Option<Self> {
        Some(match kind {
            "light" => Self::Light,
            "medium" => Self::Medium,
            "heavy" => Self::Heavy,
            "selection" => Self::Selection,
            "success" => Self::Success,
            "warning" => Self::Warning,
            "error" => Self::Error,
            _ => return None,
        })
    }

    /// Android `HapticFeedbackConstants` for `View.performHapticFeedback`, which needs no
    /// permission and follows the user's "touch feedback" setting. `CONFIRM` / `REJECT`
    /// exist from Android 11 (API 30); older systems get the closest classic effect.
    #[cfg_attr(not(target_os = "android"), allow(dead_code))]
    pub fn android_constant(self, sdk: i32) -> i32 {
        const LONG_PRESS: i32 = 0;
        const VIRTUAL_KEY: i32 = 1;
        const KEYBOARD_TAP: i32 = 3;
        const CLOCK_TICK: i32 = 4;
        const CONFIRM: i32 = 16;
        const REJECT: i32 = 17;
        match self {
            Self::Light => KEYBOARD_TAP,
            Self::Selection => CLOCK_TICK,
            Self::Medium => VIRTUAL_KEY,
            Self::Heavy => LONG_PRESS,
            Self::Success if sdk >= 30 => CONFIRM,
            Self::Success => VIRTUAL_KEY,
            Self::Warning | Self::Error if sdk >= 30 => REJECT,
            Self::Warning | Self::Error => LONG_PRESS,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn user_agent_token_matches_the_site_contract() {
        // Same strings as src/lib/app-shell.ts.
        assert_eq!(AppInfo::new(Platform::Android, false, "1.0.0").user_agent_token(), "ZiggyApp/1.0.0 (android)");
        assert_eq!(AppInfo::new(Platform::Android, true, "1.0.0").user_agent_token(), "ZiggyApp/1.0.0 (android; tv)");
        assert_eq!(AppInfo::new(Platform::Ios, false, "1.0.0").user_agent_token(), "ZiggyApp/1.0.0 (ios)");
        // There is no iOS TV app: the tv flag only exists on Android.
        assert_eq!(AppInfo::new(Platform::Ios, true, "2.1.0").user_agent_token(), "ZiggyApp/2.1.0 (ios)");
    }

    #[test]
    fn token_is_appended_once_to_the_webview_user_agent() {
        let ua = "Mozilla/5.0 (Linux; Android 15; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0 Mobile Safari/537.36";
        let token = "ZiggyApp/1.0.0 (android; tv)";
        let once = user_agent_with_token(ua, token).unwrap();
        assert_eq!(once, format!("{ua} {token}"));
        assert_eq!(user_agent_with_token(&once, token).unwrap(), once);
        let upgraded =
            user_agent_with_token(&format!("{ua} ZiggyApp/0.9.0 (android)"), "ZiggyApp/1.0.0 (android)").unwrap();
        assert_eq!(upgraded, format!("{ua} ZiggyApp/1.0.0 (android)"));
        assert_eq!(user_agent_with_token("", token), None);
        assert_eq!(user_agent_with_token("bad\nagent", token), None);
        assert_eq!(user_agent_with_token(&"x".repeat(600), token), None);
    }

    #[test]
    fn television_detection_needs_one_positive_signal() {
        assert!(is_television(Some(true), Some(false), None));
        assert!(is_television(Some(false), Some(true), Some(false)));
        assert!(is_television(None, None, Some(true)));
        assert!(!is_television(Some(false), Some(false), Some(false)));
        // The system could not be asked: phone layout, never a guess.
        assert!(!is_television(None, None, None));
    }

    #[test]
    fn navigation_stays_on_ziggy() {
        assert!(may_navigate(&url("https://ziggy-ai.fr/")));
        assert!(may_navigate(&url("https://www.ziggy-ai.fr/monde?x=1#y")));
        assert!(may_navigate(&url("https://ZIGGY-AI.FR/dodo")));
        assert!(may_navigate(&url("https://idoynasiaufymzuwnfpe.supabase.co/auth/v1/verify")));
        assert!(may_navigate(&url("tauri://localhost/index.html")));
        assert!(may_navigate(&url("http://tauri.localhost/index.html?offline=1")));
        assert!(may_navigate(&url("https://tauri.localhost/")));

        assert!(!may_navigate(&url("http://ziggy-ai.fr/")), "no clear text");
        assert!(!may_navigate(&url("https://ziggy-ai.fr:8443/")));
        assert!(!may_navigate(&url("https://evil.ziggy-ai.fr/")));
        assert!(!may_navigate(&url("https://ziggy-ai.fr.evil.com/")));
        assert!(!may_navigate(&url("https://user:pw@ziggy-ai.fr/")));
        assert!(!may_navigate(&url("https://awvgmkoozerfggdvvubi.supabase.co/")), "another product's project");
        assert!(!may_navigate(&url("https://www.youtube.com/")));
        assert!(!may_navigate(&url("javascript:alert(1)")));
        assert!(!may_navigate(&url("data:text/html,hi")));
        assert!(!may_navigate(&url("file:///etc/passwd")));
        assert!(!may_navigate(&url("intent://scan/#Intent;scheme=zxing;end")));
        assert!(!may_navigate(&url("tauri://evil/")));
    }

    #[test]
    fn site_pages_are_recognised() {
        assert!(is_site_url(&url("https://ziggy-ai.fr/en/monde")));
        assert!(!is_site_url(&url("https://idoynasiaufymzuwnfpe.supabase.co/")));
        assert!(!is_site_url(&url("tauri://localhost/")));
    }

    #[test]
    fn external_links_are_checked_again() {
        assert!(validate_external("https://www.cnil.fr/fr/mineurs").is_ok());
        assert!(validate_external("mailto:hello@ziggy-ai.fr").is_ok());
        assert!(validate_external("mailto:a@b.fr,c@d.org?subject=Hi").is_ok());

        assert_eq!(validate_external("http://example.com/"), Err(ExternalError::Scheme));
        assert_eq!(validate_external("javascript:alert(1)"), Err(ExternalError::Scheme));
        assert_eq!(validate_external("tel:+33100000000"), Err(ExternalError::Scheme));
        assert_eq!(validate_external("intent://x#Intent;end"), Err(ExternalError::Scheme));
        assert_eq!(validate_external("file:///sdcard/x"), Err(ExternalError::Scheme));
        assert_eq!(validate_external("https://192.168.1.1/"), Err(ExternalError::Host));
        assert_eq!(validate_external("https://[::1]/"), Err(ExternalError::Host));
        assert_eq!(validate_external("https://localhost/"), Err(ExternalError::Host));
        assert_eq!(validate_external("https://printer.local/"), Err(ExternalError::Host));
        assert_eq!(validate_external("https://example.com:8080/"), Err(ExternalError::Host));
        assert_eq!(validate_external("https://u:p@example.com/"), Err(ExternalError::Credentials));
        assert_eq!(validate_external("mailto:"), Err(ExternalError::Invalid));
        assert_eq!(validate_external("mailto:nobody"), Err(ExternalError::Invalid));
        assert_eq!(validate_external("not a url"), Err(ExternalError::Invalid));
        assert_eq!(
            validate_external(&format!("https://example.com/{}", "a".repeat(3000))),
            Err(ExternalError::Invalid)
        );
    }

    #[test]
    fn launch_returns_to_a_site_page_only() {
        assert_eq!(launch_target(None).as_str(), START_URL);
        assert_eq!(launch_target(Some("https://ziggy-ai.fr/dodo")).as_str(), "https://ziggy-ai.fr/dodo");
        assert_eq!(launch_target(Some("https://evil.example/")).as_str(), START_URL);
        assert_eq!(launch_target(Some("tauri://localhost/index.html")).as_str(), START_URL);
        assert_eq!(launch_target(Some("garbage")).as_str(), START_URL);
    }

    #[test]
    fn small_vocabularies() {
        assert_eq!(BarStyle::parse("dark"), Some(BarStyle::Dark));
        assert_eq!(BarStyle::parse("light"), Some(BarStyle::Light));
        assert_eq!(BarStyle::parse("auto"), None);
        assert_eq!(Haptic::parse("success"), Some(Haptic::Success));
        assert_eq!(Haptic::parse("explode"), None);
        assert_eq!(Haptic::Success.android_constant(34), 16);
        assert_eq!(Haptic::Success.android_constant(26), 1);
        assert_eq!(Haptic::Error.android_constant(29), 0);
        assert_eq!(Haptic::Light.android_constant(24), 3);
    }
}

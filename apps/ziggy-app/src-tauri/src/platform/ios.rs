//! iPhone and iPad, through objc2. UIKit calls run on the main thread (`with_webview`
//! runs its closure there).

use crate::shell::{BarStyle, Haptic};
use objc2::rc::Retained;
use objc2::runtime::{AnyClass, AnyObject};
use objc2::{msg_send, MainThreadMarker, MainThreadOnly};
use objc2_avf_audio::{AVAudioSession, AVAudioSessionCategoryPlayback};
use objc2_foundation::NSString;
use objc2_ui_kit::{
    UIApplication, UIImpactFeedbackGenerator, UIImpactFeedbackStyle, UINotificationFeedbackGenerator,
    UINotificationFeedbackType, UISelectionFeedbackGenerator, UIStatusBarStyle,
};
use tauri::{Runtime, WebviewWindow};

/// No TV app on Apple platforms.
pub fn television() -> bool {
    false
}

/// `UIScreen.mainScreen.traitCollection.userInterfaceStyle == .dark`.
pub fn prefers_dark() -> bool {
    const UI_USER_INTERFACE_STYLE_DARK: isize = 2;
    let Some(screen_class) = AnyClass::get(c"UIScreen") else { return false };
    // SAFETY: `+[UIScreen mainScreen]` and `-traitCollection` exist on every supported iOS;
    // reading the trait collection is allowed from any thread.
    unsafe {
        let screen: Option<Retained<AnyObject>> = msg_send![screen_class, mainScreen];
        let Some(screen) = screen else { return false };
        let traits: Option<Retained<AnyObject>> = msg_send![&*screen, traitCollection];
        let Some(traits) = traits else { return false };
        let style: isize = msg_send![&*traits, userInterfaceStyle];
        style == UI_USER_INTERFACE_STYLE_DARK
    }
}

/// Bedtime stories keep playing with the screen locked or the silent switch on:
/// `.playback` category, together with `UIBackgroundModes: audio` in Info.plist.
pub fn init_audio() {
    // SAFETY: plain AVFoundation calls; the category constant is provided by the system.
    unsafe {
        if let Some(category) = AVAudioSessionCategoryPlayback {
            let _ = AVAudioSession::sharedInstance().setCategory_error(category);
        }
    }
}

fn wk_webview(raw: *mut std::ffi::c_void) -> Option<&'static AnyObject> {
    // SAFETY: Tauri hands out the live `WKWebView` pointer inside `with_webview`, on the
    // main thread; the reference is only used inside that closure.
    unsafe { (raw as *const AnyObject).as_ref() }
}

/// No rubber-band bounce revealing an empty background, no long-press link previews.
pub fn prepare_webview<R: Runtime>(window: &WebviewWindow<R>) {
    let _ = window.with_webview(|webview| {
        let Some(wk) = wk_webview(webview.inner()) else { return };
        // SAFETY: documented WKWebView / UIScrollView properties, set on the main thread.
        unsafe {
            let _: () = msg_send![wk, setAllowsLinkPreview: false];
            let scroll: Option<Retained<AnyObject>> = msg_send![wk, scrollView];
            if let Some(scroll) = scroll {
                let _: () = msg_send![&*scroll, setBounces: false];
                let _: () = msg_send![&*scroll, setAlwaysBounceVertical: false];
            }
        }
    });
}

pub fn set_user_agent<R: Runtime>(window: &WebviewWindow<R>, user_agent: String) {
    let _ = window.with_webview(move |webview| {
        let Some(wk) = wk_webview(webview.inner()) else { return };
        let ua = NSString::from_str(&user_agent);
        // SAFETY: `-[WKWebView setCustomUserAgent:]` takes an NSString, main thread.
        unsafe {
            let _: () = msg_send![wk, setCustomUserAgent: &*ua];
        }
    });
}

/// Light status bar text on dark pages, dark text on light pages
/// (`UIViewControllerBasedStatusBarAppearance` is `false` in Info.plist).
pub fn set_bar_style<R: Runtime>(window: &WebviewWindow<R>, style: BarStyle) {
    let _ = window.with_webview(move |_webview| {
        let Some(mtm) = MainThreadMarker::new() else { return };
        let bar = match style {
            BarStyle::Dark => UIStatusBarStyle::LightContent,
            BarStyle::Light => UIStatusBarStyle::DarkContent,
        };
        #[allow(deprecated)]
        UIApplication::sharedApplication(mtm).setStatusBarStyle_animated(bar, true);
    });
}

pub fn haptic<R: Runtime>(window: &WebviewWindow<R>, kind: Haptic) {
    let _ = window.with_webview(move |_webview| {
        let Some(mtm) = MainThreadMarker::new() else { return };
        let impact = |style: UIImpactFeedbackStyle| {
            #[allow(deprecated)]
            let generator = UIImpactFeedbackGenerator::initWithStyle(UIImpactFeedbackGenerator::alloc(mtm), style);
            generator.impactOccurred();
        };
        let notify =
            |kind: UINotificationFeedbackType| UINotificationFeedbackGenerator::new(mtm).notificationOccurred(kind);
        match kind {
            Haptic::Light => impact(UIImpactFeedbackStyle::Light),
            Haptic::Medium => impact(UIImpactFeedbackStyle::Medium),
            Haptic::Heavy => impact(UIImpactFeedbackStyle::Heavy),
            Haptic::Selection => UISelectionFeedbackGenerator::new(mtm).selectionChanged(),
            Haptic::Success => notify(UINotificationFeedbackType::Success),
            Haptic::Warning => notify(UINotificationFeedbackType::Warning),
            Haptic::Error => notify(UINotificationFeedbackType::Error),
        }
    });
}

/// No back button on iOS: the history never needs clearing.
pub fn clear_history<R: Runtime>(_window: &WebviewWindow<R>) {}

/// iOS apps never quit themselves (App Store rule): the child uses the home gesture.
pub fn leave_app<R: Runtime>(_window: &WebviewWindow<R>) {}

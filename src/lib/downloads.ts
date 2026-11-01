/**
 * Where to get the Ziggy apps (page /telecharger).
 *
 * The Android app (phones, tablets, Android TV) is built by
 * .github/workflows/apps.yml and published as a GitHub release; the site's
 * short address ziggy-ai.fr/apk (easy to type with a TV remote) redirects to
 * the latest one (next.config.ts). iPhone and iPad: App Store in preparation;
 * meanwhile Safari's "Add to Home Screen" opens Ziggy full screen (manifest).
 */

/** Short address of the Android app (typed on a TV in the Downloader app). */
export const APK_PATH = '/apk';

/** The APK of the latest release (stable name, see apps.yml "publish-android"). */
export const APK_RELEASE_URL = 'https://github.com/maximecharavet-tech/Ziggy/releases/latest/download/ziggy-ai-android.apk';

/** Size of the APK in MB (universal build: arm64, armv7, x86_64; GitHub release android-v1.0.0-7). */
export const APK_SIZE_MB = 18;

/** Oldest Android the app runs on (minSdk 24). */
export const ANDROID_MIN = '7';

export type Device = 'android' | 'ios' | 'desktop';

/**
 * The visitor's device, for putting the right install steps first.
 * iPadOS Safari presents itself as a Mac: a Mac with a touch screen is an iPad.
 */
export function detectDevice(userAgent: string, maxTouchPoints = 0): Device {
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios';
  return 'desktop';
}

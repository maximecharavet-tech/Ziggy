package fr.ziggyai.app

import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

// Only what Android forces to be Kotlin: two system callbacks. Every decision is in Rust
// (src-tauri/src/lib.rs, src-tauri/src/platform/android.rs).
class MainActivity : TauriActivity() {
  /** Rust (`back_at_root`): asks the site, then sends the app to the background. */
  private external fun backAtRoot()

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // Registered before Tauri's own callback, so it runs only when Tauri has no web page
    // left to go back to.
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() = backAtRoot()
    })
  }

  override fun onWebViewCreate(webView: WebView) {
    // Edge to edge: the page draws under the system bars and pads itself with
    // env(safe-area-inset-*). WebViews older than 140 report no safe area, so they get
    // padded here instead; the keyboard always shrinks the page.
    val major = if (Build.VERSION.SDK_INT >= 26) {
      WebView.getCurrentWebViewPackage()?.versionName?.substringBefore('.')?.toIntOrNull() ?: 0
    } else 0
    val legacy = major < 140
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
      val ime = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
      if (legacy) {
        view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime))
        WindowInsetsCompat.CONSUMED
      } else {
        view.setPadding(0, 0, 0, if (ime > 0) ime else 0)
        insets
      }
    }
  }
}

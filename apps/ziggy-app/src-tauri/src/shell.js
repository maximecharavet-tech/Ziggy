// Ziggy shell, injected by the app (lib.rs) at document start in every page it shows.
// It never changes the site's DOM or layout: it only
//  1. removes web artefacts (tap highlight, long-press menus and selection on UI,
//     pinch/double-tap zoom, rubber-band overscroll), with a constructed stylesheet;
//  2. keeps the status bar icons readable: it reads the tone of the page under the
//     status bar and tells the app (`set_bar_style`). A page can force it with
//     <html data-app-bars="dark"> (dark page, light icons) or "light".
// `window.__ziggyShell` also tells the app that a real page loaded (not an error page).
(() => {
  if (window.__ziggyShell) return;
  window.__ziggyShell = true;

  const CSS = `
html{-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;-webkit-text-size-adjust:100%;text-size-adjust:100%;overscroll-behavior:none;touch-action:pan-x pan-y}
body{-webkit-user-select:none;user-select:none;overscroll-behavior:none}
input,textarea,select,[contenteditable]:not([contenteditable="false"]),[contenteditable]:not([contenteditable="false"]) *{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default}
img,a,svg,video{-webkit-user-drag:none}`;

  const addStyles = () => {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      return true;
    } catch {
      return false;
    }
  };
  if (!addStyles()) {
    // Older webviews: a <style> in <head> once the page is parsed (never before
    // hydration-sensitive markup).
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);
      },
      { once: true },
    );
  }

  const invoke = (cmd, args) => {
    const ipc = window.__TAURI_INTERNALS__;
    if (!ipc) return;
    try {
      Promise.resolve(ipc.invoke(cmd, args)).catch(() => {});
    } catch {
      /* not allowed on this page */
    }
  };

  // "rgb(10, 10, 26)", "rgba(0, 0, 0, 0.5)" or "color(srgb 0.04 0.04 0.1 / 0.9)" -> [r, g, b] (0-1)
  const parse = (value) => {
    if (!value) return null;
    let m = /rgba?\(([^)]+)\)/.exec(value);
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
      if (p.length > 3 && p[3] < 0.5) return null;
      return [p[0] / 255, p[1] / 255, p[2] / 255];
    }
    m = /color\(srgb ([^)]+)\)/.exec(value);
    if (m) {
      const p = m[1].split(/[\s/]+/).filter(Boolean).map(parseFloat);
      if (p.length > 3 && p[3] < 0.5) return null;
      return p.slice(0, 3);
    }
    return null;
  };
  const colorOf = (el) => {
    const cs = getComputedStyle(el);
    return parse(cs.backgroundColor) || (cs.backgroundImage !== 'none' ? parse(cs.backgroundImage) : null);
  };
  const toneOf = (rgb) => (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] < 0.5 ? 'dark' : 'light');

  const tone = () => {
    const root = document.documentElement;
    if (!root || !document.body) return null;
    const forced = root.dataset.appBars;
    if (forced === 'dark' || forced === 'light') return forced;
    for (const el of document.elementsFromPoint(innerWidth / 2, 2)) {
      const rgb = colorOf(el);
      if (rgb) return toneOf(rgb);
    }
    const rgb = colorOf(document.body) || colorOf(root);
    return rgb ? toneOf(rgb) : null;
  };

  let last = null;
  const update = () => {
    if (document.visibilityState !== 'visible') return;
    const t = tone();
    if (t && t !== last) {
      last = t;
      invoke('set_bar_style', { style: t });
    }
  };
  const soon = () => requestAnimationFrame(update);
  document.addEventListener('DOMContentLoaded', soon);
  addEventListener('load', soon);
  addEventListener('pageshow', () => {
    last = null;
    soon();
  });
  addEventListener('popstate', soon);
  document.addEventListener('visibilitychange', soon);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', soon);
  // Client-side navigations and theme changes have no event: a cheap look every second.
  setInterval(update, 1000);
})();

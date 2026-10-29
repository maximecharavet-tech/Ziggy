// The app's launch page: asks Rust (`launch` command) to open the site, or shows
// Ziggy's offline page and tries again when the network comes back.
(() => {
  const lang = (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-fr]')) el.textContent = el.dataset[lang];
  const say = document.querySelector('.say');
  say.setAttribute('aria-label', say.dataset[lang === 'fr' ? 'labelFr' : 'labelEn']);

  const params = new URLSearchParams(location.search);
  const to = params.get('to') || undefined;
  const ipc = window.__TAURI_INTERNALS__;
  const body = document.body;
  const retry = document.querySelector('.retry');
  let busy = false;
  // TV remotes need the focus on the button; touch screens don't need a focus ring.
  const focusRetry = () => {
    if (!matchMedia('(pointer: coarse)').matches) retry.focus({ preventScroll: true });
  };

  const launch = async (reachable) => {
    if (!ipc) return false;
    try {
      const result = await ipc.invoke('launch', { userAgent: navigator.userAgent, to, reachable });
      return Boolean(result && result.online);
    } catch {
      return false;
    }
  };

  // Second opinion through the webview's own network stack (it knows the system proxy).
  const webviewCheck = async () => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 4000);
    try {
      await fetch('https://ziggy-ai.fr/manifest.json', { mode: 'no-cors', cache: 'no-store', signal: abort.signal });
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  const go = async ({ quiet, button } = {}) => {
    if (busy) return;
    busy = true;
    if (!quiet && !button) body.dataset.state = 'loading';
    body.classList.toggle('trying', Boolean(button));
    const slow = setTimeout(() => body.classList.add('slow'), 1200);
    const ok = (await launch()) || ((await webviewCheck()) && (await launch(true)));
    clearTimeout(slow);
    busy = false;
    if (ok) return; // the site is on its way: this page stays until it paints
    body.classList.remove('slow', 'trying');
    if (button) {
      body.classList.remove('again');
      void body.offsetWidth;
      body.classList.add('again');
    }
    body.dataset.state = 'offline';
    focusRetry();
  };

  retry.addEventListener('click', () => go({ button: true }));
  addEventListener('online', () => go({ quiet: true }));
  setInterval(() => {
    if (body.dataset.state === 'offline') go({ quiet: true });
  }, 10000);

  // Little ones can't read yet: the message can be read aloud where the system can.
  if ('speechSynthesis' in window) {
    say.hidden = false;
    say.addEventListener('click', () => {
      const text = [...document.querySelectorAll('.offline [data-fr]:not(button)')].map((el) => el.textContent).join('. ');
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
      utterance.rate = 0.95;
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    });
  }

  if (params.get('offline') === '1') {
    // The connection dropped while the child was on a page: say so at once, keep trying.
    body.dataset.state = 'offline';
    focusRetry();
    go({ quiet: true });
  } else if (document.readyState === 'complete') {
    go();
  } else {
    addEventListener('load', () => go(), { once: true });
  }
})();

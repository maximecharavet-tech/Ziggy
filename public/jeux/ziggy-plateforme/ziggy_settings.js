// FICHIER: web/ziggy_settings.js
// v15 : panneau Options HTML au-dessus du canvas + pont Rust (miniquad plugin).
// A charger APRES mq_js_bundle.js et AVANT load("ziggy.wasm").
(function () {
  'use strict';

  var STORAGE_KEY = 'ziggy.settings.v1';
  var DEFAULTS = {
    music: 0.8, sfx: 0.8, quality: 2, fx: true, reduced: false,
    touch_scale: 1.0, touch_layout: 0, difficulty: 1
  };
  var memory = null; // secours si localStorage refuse
  var state = Object.assign({}, DEFAULTS);
  var overlay = null, dialogEl = null, lastFocus = null, open = false;

  function clamp(v, lo, hi, fb) {
    var n = Number(v);
    if (!isFinite(n)) return fb;
    return Math.min(hi, Math.max(lo, n));
  }
  function sanitize(o) {
    var src = (o && typeof o === 'object') ? o : {};
    var s = {};
    s.music = clamp(src.music, 0, 1, DEFAULTS.music);
    s.sfx = clamp(src.sfx, 0, 1, DEFAULTS.sfx);
    s.quality = Math.round(clamp(src.quality, 0, 2, DEFAULTS.quality));
    s.fx = src.fx === undefined ? DEFAULTS.fx : !!src.fx;
    s.reduced = src.reduced === undefined ? DEFAULTS.reduced : !!src.reduced;
    s.touch_scale = clamp(src.touch_scale, 0.8, 1.5, DEFAULTS.touch_scale);
    s.touch_layout = Math.round(clamp(src.touch_layout, 0, 1, DEFAULTS.touch_layout));
    s.difficulty = Math.round(clamp(src.difficulty, 0, 2, DEFAULTS.difficulty));
    return s;
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1) return Object.assign({}, DEFAULTS);
      return sanitize(parsed);
    } catch (e) {
      return memory ? Object.assign({}, memory) : Object.assign({}, DEFAULTS);
    }
  }
  function save() {
    memory = Object.assign({}, state);
    try {
      var obj = Object.assign({ v: 1 }, state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) { /* storage refusé : memory garde l'etat */ }
  }
  function resetSettings() {
    state = Object.assign({}, DEFAULTS);
    save();
    syncControls();
  }
  function getSetting(k) {
    switch (k) {
      case 0: return state.music;
      case 1: return state.sfx;
      case 2: return state.quality;
      case 3: return state.fx ? 1 : 0;
      case 4: return state.reduced ? 1 : 0;
      case 5: return state.touch_scale;
      case 6: return state.touch_layout;
      case 7: return state.difficulty;
      default: return 0;
    }
  }

  state = load();

  // ---------- Styles ----------
  function injectStyles() {
    if (document.getElementById('ziggy-settings-style')) return;
    var css = ''
      + '#ziggy-options-btn{position:fixed;top:10px;right:10px;z-index:9998;'
      + 'background:rgba(20,30,55,.72);color:#ffe9a8;border:2px solid rgba(255,220,140,.55);'
      + 'border-radius:12px;padding:8px 14px;font:600 15px/1.1 system-ui,sans-serif;'
      + 'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);cursor:pointer;'
      + 'touch-action:manipulation;-webkit-tap-highlight-color:transparent}'
      + '#ziggy-options-btn:active{transform:scale(.97)}'
      + '#ziggy-options-overlay{position:fixed;inset:0;z-index:9999;display:none;'
      + 'align-items:center;justify-content:center;background:rgba(6,10,22,.62);'
      + 'backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}'
      + '#ziggy-options-overlay.open{display:flex}'
      + '#ziggy-options-dialog{width:min(92vw,520px);max-height:92vh;overflow:auto;'
      + 'background:linear-gradient(160deg,rgba(28,38,66,.96),rgba(18,24,44,.96));'
      + 'border:2px solid rgba(255,220,140,.35);border-radius:20px;padding:18px 18px 14px;'
      + 'color:#e8eefc;font:15px/1.35 system-ui,sans-serif;'
      + 'box-shadow:0 18px 60px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.06)}'
      + '#ziggy-options-dialog h2{margin:0 0 12px;font-size:20px;color:#ffe9a8;letter-spacing:.4px}'
      + '.zgy-row{display:flex;flex-direction:column;gap:6px;margin:10px 0}'
      + '.zgy-label{font-weight:600;color:#cfe0ff}'
      + '.zgy-val{color:#ffe9a8;font-weight:700;margin-left:6px}'
      + 'input[type=range]{width:100%;height:34px;accent-color:#ffd77a;touch-action:manipulation}'
      + '.zgy-seg{display:flex;gap:8px;flex-wrap:wrap}'
      + '.zgy-seg button{flex:1 1 0;min-width:96px;padding:11px 8px;border-radius:12px;'
      + 'border:2px solid rgba(255,220,140,.3);background:rgba(255,255,255,.06);color:#e8eefc;'
      + 'font:600 15px system-ui,sans-serif;cursor:pointer;touch-action:manipulation}'
      + '.zgy-seg button[aria-pressed=true]{background:rgba(255,215,120,.28);'
      + 'border-color:rgba(255,220,140,.9);color:#fff6d6}'
      + '.zgy-toggle{display:flex;align-items:center;justify-content:space-between;'
      + 'gap:12px;padding:8px 0}'
      + '.zgy-toggle button{min-width:92px;padding:11px 12px;border-radius:12px;'
      + 'border:2px solid rgba(255,220,140,.3);background:rgba(255,255,255,.06);color:#e8eefc;'
      + 'font:600 15px system-ui,sans-serif;cursor:pointer;touch-action:manipulation}'
      + '.zgy-toggle button[aria-pressed=true]{background:rgba(120,230,170,.25);'
      + 'border-color:rgba(140,240,180,.85);color:#e9fff1}'
      + '.zgy-actions{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}'
      + '.zgy-actions button{flex:1 1 0;min-width:120px;padding:13px 10px;border-radius:14px;'
      + 'border:2px solid rgba(255,220,140,.4);font:700 16px system-ui,sans-serif;cursor:pointer;'
      + 'touch-action:manipulation}'
      + '#zgy-reset{background:rgba(255,255,255,.06);color:#ffd0c8;border-color:rgba(255,140,120,.5)}'
      + '#zgy-close{background:rgba(255,215,120,.35);color:#1a2038;border-color:rgba(255,220,140,.9)}'
      + '#zgy-confirm{display:none;margin-top:10px;padding:12px;border-radius:14px;'
      + 'background:rgba(120,20,30,.35);border:1px solid rgba(255,150,140,.45)}'
      + '#zgy-confirm.show{display:block}'
      + '#zgy-confirm p{margin:0 0 10px;color:#ffd7d0}';
    var st = document.createElement('style');
    st.id = 'ziggy-settings-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---------- DOM ----------
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (!c) return;
      if (typeof c === 'string' || typeof c === 'number') { e.appendChild(document.createTextNode(String(c))); return; }
      if (c.nodeType) { e.appendChild(c); return; }
      if (c && typeof c.textContent === 'string') { e.appendChild(document.createTextNode(c.textContent)); return; }
    });
    return e;
  }

  var refs = {};
  function build() {
    injectStyles();
    var btn = el('button', { id: 'ziggy-options-btn', type: 'button',
      'aria-label': 'Ouvrir les options', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' });
    btn.textContent = 'Options';

    overlay = el('div', { id: 'ziggy-options-overlay', role: 'presentation' });
    dialogEl = el('div', { id: 'ziggy-options-dialog', role: 'dialog',
      'aria-modal': 'true', 'aria-labelledby': 'zgy-title', tabindex: '-1' });

    dialogEl.appendChild(el('h2', { id: 'zgy-title', text: 'Options' }));

    // Musique
    refs.music = el('input', { type: 'range', min: '0', max: '100', step: '1',
      'aria-label': 'Volume musique', id: 'zgy-music' });
    refs.musicVal = el('span', { class: 'zgy-val', id: 'zgy-music-val' });
    dialogEl.appendChild(el('div', { class: 'zgy-row' }, [
      el('label', { class: 'zgy-label', for: 'zgy-music', text: 'Musique' }),
      refs.music, refs.musicVal
    ]));

    // SFX
    refs.sfx = el('input', { type: 'range', min: '0', max: '100', step: '1',
      'aria-label': 'Volume effets sonores', id: 'zgy-sfx' });
    refs.sfxVal = el('span', { class: 'zgy-val', id: 'zgy-sfx-val' });
    dialogEl.appendChild(el('div', { class: 'zgy-row' }, [
      el('label', { class: 'zgy-label', for: 'zgy-sfx', text: 'Effets sonores' }),
      refs.sfx, refs.sfxVal
    ]));

    // Qualite
    refs.quality = [
      el('button', { type: 'button', 'aria-pressed': 'false', text: 'Basse' }),
      el('button', { type: 'button', 'aria-pressed': 'false', text: 'Moyenne' }),
      el('button', { type: 'button', 'aria-pressed': 'false', text: 'Haute' })
    ];
    refs.quality.forEach(function (b, i) {
      function pick(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        state.quality = i; save(); syncControls();
      }
      b.addEventListener('click', pick);
      b.addEventListener('pointerup', pick);
    });
    dialogEl.appendChild(el('div', { class: 'zgy-row' }, [
      el('span', { class: 'zgy-label', text: 'Qualité graphique' }),
      el('div', { class: 'zgy-seg', role: 'group', 'aria-label': 'Qualité graphique' }, refs.quality)
    ]));

    // Toggles
    function toggleRow(labelText, id, getter, setter) {
      var b = el('button', { type: 'button', id: id, 'aria-pressed': 'false', text: 'Non' });
      b.addEventListener('click', function () { setter(!getter()); save(); syncControls(); });
      var row = el('div', { class: 'zgy-toggle' }, [
        el('span', { class: 'zgy-label', text: labelText }), b
      ]);
      dialogEl.appendChild(row);
      return b;
    }
    refs.fx = toggleRow('Effets visuels', 'zgy-fx',
      function () { return state.fx; }, function (v) { state.fx = v; });
    refs.reduced = toggleRow('Mouvements réduits', 'zgy-reduced',
      function () { return state.reduced; }, function (v) { state.reduced = v; });

    // Taille tactile
    refs.scale = el('input', { type: 'range', min: '80', max: '150', step: '5',
      'aria-label': 'Taille des boutons tactiles', id: 'zgy-scale' });
    refs.scaleVal = el('span', { class: 'zgy-val', id: 'zgy-scale-val' });
    dialogEl.appendChild(el('div', { class: 'zgy-row' }, [
      el('label', { class: 'zgy-label', for: 'zgy-scale', text: 'Taille des boutons tactiles' }),
      refs.scale, refs.scaleVal
    ]));

    // Disposition
    refs.layout = [
      el('button', { type: 'button', 'aria-pressed': 'false', text: 'Droitier' }),
      el('button', { type: 'button', 'aria-pressed': 'false', text: 'Gaucher' })
    ];
    refs.layout.forEach(function (b, i) {
      function pick(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        state.touch_layout = i; save(); syncControls();
      }
      b.addEventListener('click', pick);
      b.addEventListener('pointerup', pick);
    });
    dialogEl.appendChild(el('div', { class: 'zgy-row' }, [
      el('span', { class: 'zgy-label', text: 'Disposition' }),
      el('div', { class: 'zgy-seg', role: 'group', 'aria-label': 'Disposition tactile' }, refs.layout)
    ]));

    // Difficulte
    refs.diff = [
      el('button', { type: 'button', 'aria-pressed': 'false', text: 'Facile' }),
      el('button', { type: 'button', 'aria-pressed': 'false', text: 'Normal' }),
      el('button', { type: 'button', 'aria-pressed': 'false', text: 'Difficile' })
    ];
    refs.diff.forEach(function (b, i) {
      function pick(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        state.difficulty = i; save(); syncControls();
      }
      b.addEventListener('click', pick);
      b.addEventListener('pointerup', pick);
    });
    dialogEl.appendChild(el('div', { class: 'zgy-row' }, [
      el('span', { class: 'zgy-label', text: 'Difficulté' }),
      el('div', { class: 'zgy-seg', role: 'group', 'aria-label': 'Difficulté' }, refs.diff)
    ]));

    // Actions
    var resetBtn = el('button', { type: 'button', id: 'zgy-reset', text: 'Réinitialiser' });
    var closeBtn = el('button', { type: 'button', id: 'zgy-close', text: 'Fermer' });
    dialogEl.appendChild(el('div', { class: 'zgy-actions' }, [resetBtn, closeBtn]));

    var confirm = el('div', { id: 'zgy-confirm' }, [
      el('p', { text: 'Réinitialiser tous les réglages aux valeurs par défaut ?' })
    ]);
    var yes = el('button', { type: 'button', id: 'zgy-reset-yes', text: 'Oui, réinitialiser',
      style: 'background:rgba(255,120,110,.35);color:#fff;border-color:rgba(255,150,140,.9);' +
             'padding:11px 12px;border-radius:12px;font:700 15px system-ui,sans-serif;margin-right:8px' });
    var no = el('button', { type: 'button', id: 'zgy-reset-no', text: 'Annuler',
      style: 'background:rgba(255,255,255,.08);color:#e8eefc;border-color:rgba(255,220,140,.4);' +
             'padding:11px 12px;border-radius:12px;font:700 15px system-ui,sans-serif' });
    confirm.appendChild(yes);
    confirm.appendChild(no);
    dialogEl.appendChild(confirm);
    overlay.appendChild(dialogEl);

    resetBtn.addEventListener('click', function () { confirm.classList.add('show'); yes.focus(); });
    no.addEventListener('click', function () { confirm.classList.remove('show'); resetBtn.focus(); });
    yes.addEventListener('click', function () {
      resetSettings();
      confirm.classList.remove('show');
      resetBtn.focus();
    });
    closeBtn.addEventListener('click', closePanel);
    btn.addEventListener('click', openPanel);
    btn.addEventListener('pointerdown', function (e) { e.stopPropagation(); }, true);

    refs.music.addEventListener('input', function () {
      state.music = clamp(Number(refs.music.value) / 100, 0, 1, DEFAULTS.music); save(); syncControls();
    });
    refs.sfx.addEventListener('input', function () {
      state.sfx = clamp(Number(refs.sfx.value) / 100, 0, 1, DEFAULTS.sfx); save(); syncControls();
    });
    refs.scale.addEventListener('input', function () {
      state.touch_scale = clamp(Number(refs.scale.value) / 100, 0.8, 1.5, DEFAULTS.touch_scale);
      save(); syncControls();
    });

    // Empeche tout evenement DOM du panneau de fuir vers le canvas,
    // SAUF si la cible est un controle interactif a l'interieur du dialogue :
    // sinon les boutons (Qualite, Difficulte, ...) ne recoivent jamais leur 'click'.
    function isInteractiveInside(target) {
      if (!target || !dialogEl || !dialogEl.contains(target)) return false;
      var n = target;
      while (n && n !== dialogEl) {
        var tag = (n.tagName || '').toUpperCase();
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'LABEL' || tag === 'A') return true;
        n = n.parentNode;
      }
      return false;
    }
    function stopUnlessInteractive(e) {
      if (isInteractiveInside(e.target)) return;
      e.stopPropagation();
    }
    ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'touchmove', 'mousedown', 'mouseup', 'click', 'keydown', 'keyup', 'wheel']
      .forEach(function (t) { overlay.addEventListener(t, stopUnlessInteractive, true); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closePanel(); });

    document.body.appendChild(btn);
    document.body.appendChild(overlay);
    refs.btn = btn;
    syncControls();
  }

  function syncControls() {
    if (!refs.music) return;
    refs.music.value = String(Math.round(state.music * 100));
    refs.musicVal.textContent = Math.round(state.music * 100) + '%';
    refs.sfx.value = String(Math.round(state.sfx * 100));
    refs.sfxVal.textContent = Math.round(state.sfx * 100) + '%';
    refs.scale.value = String(Math.round(state.touch_scale * 100));
    refs.scaleVal.textContent = Math.round(state.touch_scale * 100) + '%';
    refs.quality.forEach(function (b, i) { b.setAttribute('aria-pressed', state.quality === i ? 'true' : 'false'); });
    refs.layout.forEach(function (b, i) { b.setAttribute('aria-pressed', state.touch_layout === i ? 'true' : 'false'); });
    refs.diff.forEach(function (b, i) { b.setAttribute('aria-pressed', state.difficulty === i ? 'true' : 'false'); });
    refs.fx.setAttribute('aria-pressed', state.fx ? 'true' : 'false');
    refs.fx.textContent = state.fx ? 'Oui' : 'Non';
    refs.reduced.setAttribute('aria-pressed', state.reduced ? 'true' : 'false');
    refs.reduced.textContent = state.reduced ? 'Oui' : 'Non';
  }

  function focusables() {
    return Array.prototype.slice.call(dialogEl.querySelectorAll(
      'button, input, [tabindex]:not([tabindex="-1"])'
    )).filter(function (e) { return !e.disabled && e.offsetParent !== null; });
  }

  function onKeyDown(e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePanel(); return; }
    if (e.key === 'Tab') {
      var f = focusables();
      if (!f.length) { e.preventDefault(); return; }
      var first = f[0], last = f[f.length - 1];
      var active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !dialogEl.contains(active)) { e.preventDefault(); last.focus(); }
      } else {
        if (active === last || !dialogEl.contains(active)) { e.preventDefault(); first.focus(); }
      }
    }
    e.stopPropagation();
  }
  function blockEvent(e) { if (open) { e.stopPropagation(); } }

  function openPanel() {
    if (open) return;
    open = true;
    lastFocus = document.activeElement;
    overlay.classList.add('open');
    refs.btn.setAttribute('aria-expanded', 'true');
    dialogEl.focus();
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', blockEvent, true);
    window.addEventListener('touchstart', blockEvent, { capture: true, passive: false });
    window.addEventListener('touchmove', blockEvent, { capture: true, passive: false });
    window.addEventListener('touchend', blockEvent, true);
    window.addEventListener('pointerdown', blockEvent, true);
    window.addEventListener('pointerup', blockEvent, true);
  }
  function closePanel() {
    if (!open) return;
    open = false;
    overlay.classList.remove('open');
    refs.btn.setAttribute('aria-expanded', 'false');
    var c = document.getElementById('zgy-confirm');
    if (c) c.classList.remove('show');
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', blockEvent, true);
    window.removeEventListener('touchstart', blockEvent, { capture: true });
    window.removeEventListener('touchmove', blockEvent, { capture: true });
    window.removeEventListener('touchend', blockEvent, true);
    window.removeEventListener('pointerdown', blockEvent, true);
    window.removeEventListener('pointerup', blockEvent, true);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    else refs.btn.focus();
  }

  // ---------- Pont Rust (miniquad plugin) ----------
  function registerWithMiniquad() {
    if (typeof miniquad_add_plugin !== 'function') return;
    miniquad_add_plugin({
      register_plugin: function (importObject) {
        if (!importObject.env) importObject.env = {};
        importObject.env.ziggy_settings_get = function (k) { return getSetting(k | 0); };
        importObject.env.ziggy_overlay_open = function () { return open ? 1 : 0; };
      },
      name: 'ziggy_settings',
      version: '1.0.0'
    });
  }

  // ---------- Init ----------
  // Le plugin miniquad DOIT etre enregistre avant load("ziggy.wasm").
  registerWithMiniquad();
  function initDom() {
    build();
    try { syncControls(); } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDom);
  } else {
    initDom();
  }
  // Exposition modeste pour le debug (non requise par Rust).
  window.ZiggySettings = { get: function () { return Object.assign({}, state); }, reset: resetSettings };
})();

'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { BOUNDARY_DOWN, BOUNDARY_LEFT, BOUNDARY_RIGHT, BOUNDARY_UP, WRAP_X, WRAP_Y, nextFocus, type Box, type Dir, type NextFocusFn } from '@/lib/tv/spatial-nav';
import { loadWasmNav } from '@/lib/tv/wasm-nav';
import { BACK_REQUEST_EVENT, topLayer } from '@/components/app/AppBack';

/**
 * TV remote control: the arrow keys move the focus to the nearest thing in
 * that direction (rows first, each row remembering its last tile), OK/Enter
 * presses it, Back goes back. Only mounted in TV mode.
 *
 * Page markup can steer it:
 * - `data-tv-row` groups tiles in a row (wraps around; `data-tv-wrap="false"` to stop at the ends);
 * - `data-tv-boundary="up down"` keeps the focus inside a group in those directions;
 * - `data-tv-autofocus` is where the focus lands when a page or a step opens;
 * - `data-tv-own-keys` (all arrows), `="x"` (← →) or `="y"` (↑ ↓): a focused region that steers with the arrows itself (runner, puzzle);
 * - `data-tv-scope`: a full-screen layer (like a modal) the focus stays in;
 * - `data-tv-skip`: never focused by the remote.
 */

const KEY_DIR: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const BACK_KEYS = new Set(['Escape', 'GoBack', 'BrowserBack']);
const FOCUSABLE = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex], [role="button"], [contenteditable="true"]';
const TEXT_FIELD = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]), textarea, [contenteditable="true"]';
const BOUNDARY: Record<string, number> = { up: BOUNDARY_UP, right: BOUNDARY_RIGHT, down: BOUNDARY_DOWN, left: BOUNDARY_LEFT };

let engine: NextFocusFn = nextFocus;
/** The remote moved the focus since it last landed on its own (then a late `data-tv-autofocus` must not steal it). */
let userMoved = false;
/** Each row's last focused element. */
const rowMemory = new WeakMap<Element, HTMLElement>();
let lastRect: DOMRect | null = null;

function reduceMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Can the remote reach it: shown, enabled, not hidden under another layer. */
function reachable(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return false;
  if (el.closest('[inert], [aria-hidden="true"], [data-tv-skip]')) return false;
  const tab = el.getAttribute('tabindex');
  if (tab !== null && Number(tab) < 0 && !el.hasAttribute('data-tv-focusable') && !el.hasAttribute('data-tv-own-keys')) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const cs = getComputedStyle(el);
  if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' || Number(cs.opacity) === 0) return false;
  // On screen: really on top somewhere (not under a fixed overlay). Off screen: trust the layout.
  const pts: [number, number][] = [
    [r.left + r.width / 2, r.top + r.height / 2],
    [r.left + 4, r.top + 4],
    [r.right - 4, r.top + 4],
    [r.left + 4, r.bottom - 4],
    [r.right - 4, r.bottom - 4],
  ];
  let onScreen = false;
  for (const [x, y] of pts) {
    if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
    onScreen = true;
    const hit = document.elementFromPoint(x, y);
    if (hit && (el === hit || el.contains(hit) || hit.contains(el))) return true;
  }
  return !onScreen;
}

/** The layer the focus stays in: the top modal or full-screen layer, else the page. */
function scopeRoot(): ParentNode {
  const layers = [...document.querySelectorAll<HTMLElement>('[aria-modal="true"], [data-tv-scope], [data-back-layer]')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  return layers.at(-1) ?? document;
}

function candidates(): HTMLElement[] {
  return [...scopeRoot().querySelectorAll<HTMLElement>(FOCUSABLE)].filter(reachable);
}

/** The focused element's box, without the 1.06 focus scale. */
function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  if (el === document.activeElement) {
    const s = Number.parseFloat(getComputedStyle(el).scale);
    if (Number.isFinite(s) && s > 0 && s !== 1) {
      const w = r.width / s;
      const h = r.height / s;
      return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w, h };
    }
  }
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function rowOf(el: Element): HTMLElement | null {
  return el.closest<HTMLElement>('[data-tv-row], [data-tv-group]');
}

function focusEl(el: HTMLElement, auto = false) {
  if (auto) userMoved = false;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
}

/** The page's chosen landing spot: `data-tv-autofocus`, else the first thing on a game's board (not a 🔊 button). */
function preferredSpot(): HTMLElement | null {
  const scope = scopeRoot();
  const marked = [...scope.querySelectorAll<HTMLElement>('[data-tv-autofocus]')].find(reachable);
  if (marked) return marked;
  const stage = scope.querySelector<HTMLElement>('[data-tv-stage]');
  if (!stage) return null;
  return [...stage.querySelectorAll<HTMLElement>(FOCUSABLE)].find((el) => !el.closest('[data-tv-secondary]') && reachable(el)) ?? null;
}

/** Where the focus goes when nothing is focused: the page's chosen spot, else near where it was, else the first thing. */
function landing(): HTMLElement | null {
  const spot = preferredSpot();
  if (spot) return spot;
  const all = candidates();
  if (!all.length) return null;
  if (lastRect) {
    const cx = lastRect.left + lastRect.width / 2;
    const cy = lastRect.top + lastRect.height / 2;
    let best = all[0];
    let bd = Infinity;
    for (const el of all) {
      const r = el.getBoundingClientRect();
      const d = (r.left + r.width / 2 - cx) ** 2 + (r.top + r.height / 2 - cy) ** 2;
      if (d < bd) {
        bd = d;
        best = el;
      }
    }
    return best;
  }
  // First thing in reading order that is on screen (the page, before the top bar).
  const onScreen = all.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  });
  const main = onScreen.find((el) => el.closest('#main-content'));
  return main ?? onScreen[0] ?? all[0];
}

function ownsKey(el: Element | null, dir: Dir): boolean {
  if (!el) return false;
  if (el.matches(TEXT_FIELD) && (dir === 'left' || dir === 'right')) return true;
  if (el.matches('input[type="range"], select')) return true;
  const region = el.closest('[data-tv-own-keys]');
  if (!region) return false;
  const v = region.getAttribute('data-tv-own-keys');
  if (v === 'x') return dir === 'left' || dir === 'right';
  if (v === 'y') return dir === 'up' || dir === 'down';
  return true;
}

function move(dir: Dir) {
  const active = document.activeElement as HTMLElement | null;
  const all = candidates();
  const current = active ? all.indexOf(active) : -1;
  if (current < 0) {
    const el = landing();
    if (el) focusEl(el, true);
    return;
  }
  userMoved = true;
  // Rows and sections → small group ids, with their flags and last focused child.
  const ids = new Map<HTMLElement, number>();
  const flags = [0];
  const memory = [-1];
  const groups = all.map((el) => {
    const row = rowOf(el);
    if (!row) return 0;
    let id = ids.get(row);
    if (id === undefined) {
      id = ids.size + 1;
      ids.set(row, id);
      let f = 0;
      if (row.hasAttribute('data-tv-row') && row.getAttribute('data-tv-wrap') !== 'false') f |= WRAP_X;
      if (row.getAttribute('data-tv-wrap') === 'y') f |= WRAP_Y;
      for (const d of (row.getAttribute('data-tv-boundary') ?? '').split(/\s+/)) f |= BOUNDARY[d] ?? 0;
      flags[id] = f;
      const remembered = rowMemory.get(row);
      memory[id] = remembered ? all.indexOf(remembered) : -1;
    }
    return id;
  });
  const next = engine(all.map(boxOf), groups, current, dir, flags, memory);
  if (next >= 0) {
    focusEl(all[next]);
    return;
  }
  // Nothing that way: let long pages scroll.
  if (dir === 'up' || dir === 'down') window.scrollBy({ top: (dir === 'down' ? 1 : -1) * window.innerHeight * 0.4, behavior: reduceMotion() ? 'auto' : 'smooth' });
}

export function SpatialNavigation() {
  const pathname = usePathname();

  // The Rust/WebAssembly engine takes over once loaded; the TypeScript one answers meanwhile.
  useEffect(() => {
    let alive = true;
    void loadWasmNav().then((fn) => {
      if (alive && fn) engine = fn;
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
      const dir = KEY_DIR[e.key];
      const isBack = BACK_KEYS.has(e.key) || (e.key === 'Backspace' && !(e.target as Element | null)?.matches?.(TEXT_FIELD));
      const isOk = e.key === 'Enter';
      if (!dir && !isBack && !isOk) return;
      const active = document.activeElement as HTMLElement | null;
      if (dir && ownsKey(active, dir)) return;
      if (isBack && !e.isTrusted) return; // our own synthetic Escape, closing a layer
      const layerOpen = isBack && topLayer() !== null;

      // Let the page's own handlers (registered later) speak first: if one of them
      // calls preventDefault, the key was theirs (a game moving a card, a player…).
      let theirs = false;
      const prevent = e.preventDefault.bind(e);
      e.preventDefault = () => {
        theirs = true;
        prevent();
      };
      if (dir) prevent(); // no native scrolling: the focus scrolls the page
      // A layer opened over the focused element (a reward, a modal): OK must not press what is behind it.
      const scope = scopeRoot();
      const behind = scope !== document && active !== null && !(scope as Element).contains(active);
      if (isOk && behind) prevent();
      window.setTimeout(() => {
        if (behind && (isOk || dir)) {
          // First press: the focus goes into the layer.
          if (!theirs && scopeRoot() === scope) {
            const el = landing();
            if (el) focusEl(el, true);
          }
          return;
        }
        if (theirs) return;
        if (dir) move(dir);
        else if (isBack) {
          if (!layerOpen) window.dispatchEvent(new Event(BACK_REQUEST_EVENT));
        } else if (isOk && active && active !== document.body && !active.matches('a[href], button, input, select, textarea, summary')) {
          active.click();
        }
      }, 0);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // Remember each row's last tile, and where the focus was (to land near it if it vanishes).
  useEffect(() => {
    const onIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      const row = rowOf(el);
      if (row) rowMemory.set(row, el);
    };
    const onOut = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (el?.getBoundingClientRect) lastRect = el.getBoundingClientRect();
      if (e.relatedTarget) return;
      window.setTimeout(() => {
        const a = document.activeElement;
        if (!a || a === document.body || a === document.documentElement) {
          const el = landing();
          if (el) focusEl(el, true);
        }
      }, 90);
    };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);

  // A new page: focus its chosen spot (or the first thing in it) once it has painted.
  useEffect(() => {
    lastRect = null;
    const t = window.setTimeout(() => {
      const a = document.activeElement as HTMLElement | null;
      const inPage = a && a !== document.body && candidates().includes(a);
      if (!inPage) {
        const el = landing();
        if (el) focusEl(el, true);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [pathname]);

  // A step that appears a moment later (a game's first question after "Let's go", the player's
  // controls after "Listen") brings its own landing spot: go there, unless the remote moved meanwhile.
  useEffect(() => {
    let timer = 0;
    const check = () => {
      timer = 0;
      const a = document.activeElement as HTMLElement | null;
      const lost = !a || a === document.body;
      if (!lost && (userMoved || a.closest('[data-tv-stage]'))) return;
      const spot = preferredSpot();
      if (spot && spot !== a && !spot.contains(a)) focusEl(spot, true);
    };
    const mo = new MutationObserver(() => {
      if (!timer) timer = window.setTimeout(check, 80);
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'data-tv-autofocus'] });
    return () => {
      mo.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}

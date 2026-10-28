'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { gapAfter, scaleWords, sentenceOf, sentenceStartTime, sentenceStarts, type SegmentPlan } from '@/lib/dodo/player';
import { tokenize, wordAt } from '@/lib/dodo/voice';
import { isMuted, MUTE_EVENT } from '@/lib/sound';

export type PlayerStatus = 'cover' | 'playing' | 'paused' | 'gap' | 'done';

export interface PlayerSnapshot {
  /** Segment index (0 = title … last = outro). */
  seg: number;
  /** Word being said (-1 before the first). */
  word: number;
  status: PlayerStatus;
  /** Ziggy's voice is audible right now (his mouth moves). */
  speaking: boolean;
  /** The browser refused to start the audio on its own: one more tap is needed. */
  blocked: boolean;
  /** How the current segment is told. */
  kind: SegmentPlan['kind'];
}

/** A silent instant, played inside the first tap so later segments may start on their own (iOS). */
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

type Media = HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean };

/**
 * Plays a story segment after segment and says which word is being spoken.
 *
 * One clock drives the teleprompter: the <audio> position for Ziggy's
 * recording (playbackRate changes keep the sync for free), a virtual clock at
 * the same rate for silent reading, and speech boundaries for the device
 * voice. Next segments are fetched ahead as blobs, so they start at once and
 * play the same way online, offline and from the service worker cache.
 */
export class Conductor {
  private plans: SegmentPlan[];
  private snap: PlayerSnapshot;
  private listeners = new Set<() => void>();
  private audio: Media | null = null;
  private token = 0;
  private timers: number[] = [];
  private raf = 0;
  private rate = 1;
  private useAudio = false;
  private clockAt = 0;
  private clockT = 0;
  private clockRunning = false;
  private words: number[] = [];
  private dur = 0;
  /** What resume() does after a pause taken between two segments. */
  private pending: number | 'done' | null = null;
  private device: { lastToken: number; boundary: boolean } | null = null;
  private blobs = new Map<string, string>();
  private loading = new Map<string, Promise<string | null>>();
  private lang: string;

  constructor(plans: SegmentPlan[], lang: string) {
    this.plans = plans;
    this.lang = lang;
    this.words = plans[0]?.words ?? [];
    this.dur = plans[0]?.dur ?? 0;
    this.snap = { seg: 0, word: -1, status: 'cover', speaking: false, blocked: false, kind: plans[0]?.kind ?? 'read' };
  }

  /* ── React plumbing ── */

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };

  get = () => this.snap;

  private set(patch: Partial<PlayerSnapshot>) {
    const prev = this.snap;
    let changed = false;
    for (const k of Object.keys(patch) as (keyof PlayerSnapshot)[]) if (patch[k] !== prev[k]) changed = true;
    if (!changed) return;
    this.snap = { ...prev, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** New plans (a recording appeared, the fallback changed): the segment being told finishes as it started. */
  setPlans(plans: SegmentPlan[]) {
    this.plans = plans;
    if (this.snap.status === 'cover' || this.snap.status === 'done') {
      this.words = plans[this.snap.seg]?.words ?? [];
      this.dur = plans[this.snap.seg]?.dur ?? 0;
      this.set({ kind: plans[this.snap.seg]?.kind ?? 'read' });
    }
  }

  get count() {
    return this.plans.length;
  }

  /** Seconds into the current segment. */
  time(): number {
    if (this.useAudio && this.audio) return this.audio.currentTime || 0;
    return this.clockRunning ? this.clockT + ((performance.now() - this.clockAt) / 1000) * this.rate : this.clockT;
  }

  /* ── Commands ── */

  /** Start (from a tap: it also unlocks audio for the rest of the story). */
  start(seg = 0, t = 0) {
    this.unlock();
    this.playSegment(seg, t);
  }

  go(seg: number) {
    this.unlock();
    this.playSegment(Math.max(0, Math.min(this.plans.length - 1, seg)));
  }

  pause() {
    const s = this.snap.status;
    if (s === 'gap') {
      this.clearTimers();
      this.set({ status: 'paused', speaking: false });
      return;
    }
    if (s !== 'playing') return;
    if (this.device) {
      // Speech cannot pause reliably everywhere: stop, and say the sentence again on resume.
      const t = this.time();
      this.halt();
      this.clockT = t;
      this.pending = null;
      this.set({ status: 'paused', speaking: false });
      return;
    }
    if (this.useAudio && this.audio) this.audio.pause();
    this.freezeClock();
    cancelAnimationFrame(this.raf);
    this.set({ status: 'paused', speaking: false });
  }

  resume() {
    if (this.snap.status !== 'paused') return;
    this.unlock();
    if (this.pending !== null) {
      const p = this.pending;
      this.pending = null;
      if (p === 'done') this.set({ status: 'done' });
      else this.playSegment(p);
      return;
    }
    const plan = this.plans[this.snap.seg];
    if (this.snap.blocked || !plan) return this.playSegment(this.snap.seg, this.time());
    if (plan.kind === 'device' && !this.useAudio) {
      const of = sentenceOf(tokenize(plan.text));
      return this.playSegment(this.snap.seg, sentenceStartTime(plan.words, of, this.clockT));
    }
    if (this.useAudio && this.audio && !this.audio.ended) {
      const mine = this.token;
      this.set({ status: 'playing' });
      this.audio.play().catch(() => mine === this.token && this.playSegment(this.snap.seg, this.time()));
      this.loop();
      return;
    }
    this.runClock(this.clockT);
    this.set({ status: 'playing' });
    this.loop();
  }

  toggle() {
    if (this.snap.status === 'playing' || this.snap.status === 'gap') this.pause();
    else if (this.snap.status === 'paused') this.resume();
    else if (this.snap.status === 'cover' || this.snap.status === 'done') this.start(0);
  }

  setRate(rate: number) {
    const t = this.time();
    this.rate = Math.max(0.5, Math.min(2, rate));
    if (this.clockRunning) {
      this.clockT = t;
      this.clockAt = performance.now();
    }
    if (this.audio) {
      this.audio.defaultPlaybackRate = this.rate;
      this.audio.playbackRate = this.rate;
    }
  }

  /** Fetch a segment's audio ahead of time. */
  prefetch(seg: number) {
    const p = this.plans[seg];
    if (p && (p.kind === 'voice' || p.kind === 'clip')) this.fetchBlob(p.url);
  }

  /** Stop everything (leaving the page). The conductor can start again later. */
  destroy() {
    this.halt();
    this.blobs.forEach((u) => URL.revokeObjectURL(u));
    this.blobs.clear();
    this.loading.clear();
    if (this.audio) {
      this.audio.removeAttribute('src');
      this.audio.load();
    }
  }

  /** Window listeners: the site-wide mute, and silent reading pauses when the page is hidden. */
  attach() {
    const onMute = () => {
      const muted = isMuted();
      if (this.audio) this.audio.muted = muted;
      if (muted && this.device) this.pause();
      this.set({ speaking: Boolean(this.useAudio && this.audio && !this.audio.paused && !muted) });
    };
    const onVisibility = () => {
      if (document.hidden && this.snap.status === 'playing' && !this.useAudio && !this.device) this.pause();
    };
    window.addEventListener(MUTE_EVENT, onMute);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener(MUTE_EVENT, onMute);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }

  /* ── Inside ── */

  private el(): Media {
    if (this.audio) return this.audio;
    const a = new Audio() as Media;
    a.preload = 'auto';
    a.preservesPitch = true;
    a.webkitPreservesPitch = true;
    a.addEventListener('playing', () => this.set({ speaking: this.useAudio && !a.muted }));
    for (const ev of ['pause', 'waiting', 'ended', 'emptied'] as const) a.addEventListener(ev, () => this.set({ speaking: false }));
    this.audio = a;
    return a;
  }

  private unlock() {
    const a = this.el();
    if (a.dataset.unlocked) return;
    a.dataset.unlocked = '1';
    a.src = SILENT;
    a.play().catch(() => undefined);
  }

  private later(ms: number, fn: () => void) {
    const mine = this.token;
    this.timers.push(window.setTimeout(() => mine === this.token && fn(), ms));
  }

  private clearTimers() {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
  }

  private freezeClock() {
    if (!this.clockRunning) return;
    this.clockT = this.time();
    this.clockRunning = false;
  }

  private runClock(t: number) {
    this.useAudio = false;
    this.clockT = t;
    this.clockAt = performance.now();
    this.clockRunning = true;
  }

  /** Stop whatever plays; callbacks of the old segment are ignored from now on. */
  private halt() {
    this.token++;
    this.clearTimers();
    cancelAnimationFrame(this.raf);
    this.clockRunning = false;
    this.device = null;
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.onloadedmetadata = null;
      this.audio.pause();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    this.set({ speaking: false });
  }

  private playSegment(i: number, t = 0) {
    this.halt();
    const plan = this.plans[i];
    if (!plan) return;
    const mine = this.token;
    this.pending = null;
    this.words = plan.words;
    this.dur = plan.dur;
    this.useAudio = false;
    this.set({ seg: i, word: t > 0 ? wordAt(this.words, t) : -1, status: 'playing', blocked: false, kind: plan.kind });
    if (plan.kind === 'voice' || plan.kind === 'clip') this.playAudio(plan, t, mine);
    else if (plan.kind === 'device' && 'speechSynthesis' in window && !isMuted()) this.playDevice(plan, t, mine);
    else this.runClock(t);
    this.prefetch(i + 1);
    this.loop();
  }

  private playAudio(plan: Extract<SegmentPlan, { kind: 'voice' | 'clip' }>, t: number, mine: number) {
    const a = this.el();
    this.useAudio = true;
    const fallback = () => {
      // Unreachable or unreadable file: the text goes on silently, with the recorded timings.
      if (mine !== this.token || !this.useAudio) return;
      const at = a.currentTime || t;
      a.onended = a.onerror = null;
      a.pause();
      this.runClock(at);
      this.loop();
    };
    a.onended = () => mine === this.token && this.finish();
    a.onerror = fallback;
    a.onloadedmetadata = () => {
      if (mine !== this.token) return;
      if (plan.kind === 'clip' && Number.isFinite(a.duration) && a.duration > 0) {
        this.words = scaleWords(plan.words, plan.dur, a.duration);
        this.dur = a.duration;
      }
      a.playbackRate = this.rate;
      if (t > 0 && Math.abs(a.currentTime - t) > 0.3) a.currentTime = t;
    };
    a.src = this.blobs.get(plan.url) ?? plan.url;
    a.defaultPlaybackRate = this.rate;
    a.playbackRate = this.rate;
    a.muted = isMuted();
    if (t > 0) {
      try {
        a.currentTime = t;
      } catch {
        /* set again once the metadata is there */
      }
    }
    a.play().catch((e: unknown) => {
      if (mine !== this.token) return;
      const name = (e as { name?: string })?.name;
      if (name === 'NotAllowedError') {
        cancelAnimationFrame(this.raf);
        this.set({ status: 'paused', blocked: true, speaking: false });
      } else if (name !== 'AbortError') fallback();
    });
  }

  private playDevice(plan: Extract<SegmentPlan, { kind: 'device' }>, t: number, mine: number) {
    const synth = window.speechSynthesis;
    const tokens = tokenize(plan.text);
    const of = sentenceOf(tokens);
    const starts = sentenceStarts(of);
    let s = of[Math.max(0, wordAt(plan.words, t))] ?? 0;
    const voices = synth.getVoices();
    const voice = voices.find((v) => v.lang === this.lang) ?? voices.find((v) => v.lang.startsWith(this.lang.slice(0, 2))) ?? null;
    let started = false;
    const silent = () => {
      if (mine !== this.token) return;
      synth.cancel();
      this.device = null;
      this.runClock(plan.words[starts[Math.min(s, starts.length - 1)]] ?? 0);
      this.set({ speaking: false });
    };
    const say = () => {
      if (mine !== this.token) return;
      if (s >= starts.length) {
        this.device = null;
        this.finish();
        return;
      }
      const first = starts[s];
      const last = (starts[s + 1] ?? tokens.length) - 1;
      const part = tokens.slice(first, last + 1);
      const offsets: number[] = [];
      let at = 0;
      for (const p of part) {
        offsets.push(at);
        at += p.length + 1;
      }
      const u = new SpeechSynthesisUtterance(part.join(' '));
      u.lang = this.lang;
      u.voice = voice;
      u.rate = 0.86 * this.rate;
      u.pitch = 1.25;
      const boundary = this.device?.boundary ?? false;
      this.device = { lastToken: last, boundary };
      // Until the speech engine reports words, a calm pace estimates them inside the sentence.
      this.clockT = plan.words[first] ?? 0;
      this.clockAt = performance.now();
      this.clockRunning = true;
      this.set({ word: first });
      u.onstart = () => {
        started = true;
        if (mine === this.token) this.set({ speaking: true });
      };
      u.onboundary = (e) => {
        if (mine !== this.token || !this.device || (e.name && e.name !== 'word')) return;
        this.device.boundary = true;
        let k = 0;
        while (k + 1 < offsets.length && offsets[k + 1] <= e.charIndex) k++;
        this.set({ word: first + k });
      };
      u.onend = () => {
        if (mine !== this.token) return;
        s++;
        this.set({ speaking: false });
        say();
      };
      u.onerror = () => silent();
      synth.speak(u);
    };
    synth.cancel();
    say();
    // Some devices have no voice at all and never start: read silently instead.
    this.later(4000, () => !started && silent());
  }

  private loop() {
    cancelAnimationFrame(this.raf);
    const step = () => {
      if (this.snap.status !== 'playing') return;
      const t = this.time();
      if (!this.device || !this.device.boundary) {
        let w = wordAt(this.words, t);
        if (this.device) w = Math.min(w, this.device.lastToken);
        if (w !== this.snap.word && (w >= 0 || !this.device)) this.set({ word: w });
      }
      if (!this.useAudio && !this.device && t >= this.dur) {
        this.finish();
        return;
      }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  /** The segment is over: a quiet moment, the next picture, then Ziggy goes on. */
  private finish() {
    cancelAnimationFrame(this.raf);
    this.clockRunning = false;
    this.device = null;
    const i = this.snap.seg;
    const plan = this.plans[i];
    const next = this.plans[i + 1];
    this.set({ word: this.words.length - 1, speaking: false, status: 'gap' });
    const g = gapAfter(plan?.id ?? 'title', next?.id ?? null);
    this.pending = next ? i + 1 : 'done';
    this.later(g.hold, () => {
      if (!next) {
        this.pending = null;
        this.set({ status: 'done' });
        return;
      }
      this.words = next.words;
      this.dur = next.dur;
      this.set({ seg: i + 1, word: -1, kind: next.kind });
      this.later(g.lead, () => this.playSegment(i + 1));
    });
  }

  private fetchBlob(url: string) {
    if (this.blobs.has(url) || this.loading.has(url)) return;
    const p = fetch(url, { redirect: url.startsWith('/') ? 'manual' : 'follow' })
      .then((r) => (r.ok && /audio|mpeg|octet/.test(r.headers.get('content-type') ?? '') ? r.blob() : null))
      .then((b) => {
        if (!b || !this.loading.has(url)) return null;
        const u = URL.createObjectURL(b);
        this.blobs.set(url, u);
        return u;
      })
      .catch(() => null);
    this.loading.set(url, p);
  }
}

/** One conductor per player; plans may change (a recording appears, the fallback changes). */
export function useConductor(plans: SegmentPlan[], lang: string) {
  const [c] = useState(() => new Conductor(plans, lang));
  useEffect(() => {
    c.setPlans(plans);
  }, [c, plans]);
  useEffect(() => {
    const off = c.attach();
    return () => {
      off();
      c.destroy();
    };
  }, [c]);
  const snap = useSyncExternalStore(c.subscribe, c.get, c.get);
  return [c, snap] as const;
}

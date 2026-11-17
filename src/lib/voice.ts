'use client';

import { isMuted, MUTE_EVENT } from '@/lib/sound';
import { isPersonalText } from '@/lib/privacy/personal';

/**
 * Ziggy's voice in the browser.
 *
 * - First choice: /api/tts (Gemini voice, the Hyper™ AI Engine voice stack).
 * - Fallback: the browser's own speech synthesis, pitched up a little.
 * - A sentence with personal data (the child's first name, a name the child
 *   typed, a line flagged with `markPersonal`, an email or phone number…) is
 *   NEVER sent to /api/tts: the device's own voice says it
 *   (src/lib/privacy/personal.ts).
 * - One clip plays at a time; the site-wide mute silences Ziggy too.
 *
 * The state (which line is being spoken, auto-read on/off) lives in a tiny
 * store so every chat bubble and avatar can follow it.
 */

const LANG: Record<string, string> = {
  fr: 'fr-FR', en: 'en-US', es: 'es-ES', de: 'de-DE', pt: 'pt-BR', it: 'it-IT',
  nl: 'nl-NL', tr: 'tr-TR', ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN', ar: 'ar-SA',
};
export const bcp47 = (locale: string) => LANG[locale] ?? locale;

const AUTO_KEY = 'ziggy:auto-voice';

/** 'bedtime' = the slow, soft storyteller voice of Mode dodo. */
export type VoiceStyle = 'ziggy' | 'bedtime';

type State = { speakingId: string | null; loadingId: string | null; autoRead: boolean };
let state: State = { speakingId: null, loadingId: null, autoRead: true };
const listeners = new Set<() => void>();
const emit = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const voiceStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => state,
  server: (): State => ({ speakingId: null, loadingId: null, autoRead: true }),
};

if (typeof window !== 'undefined') {
  try {
    state.autoRead = window.localStorage.getItem(AUTO_KEY) !== '0';
  } catch {}
  window.addEventListener(MUTE_EVENT, (e) => {
    if ((e as CustomEvent<boolean>).detail) stopSpeaking();
  });
}

export function setAutoRead(on: boolean) {
  try {
    window.localStorage.setItem(AUTO_KEY, on ? '1' : '0');
  } catch {}
  if (!on) stopSpeaking();
  emit({ autoRead: on });
}

let audio: HTMLAudioElement | null = null;
let serverDown = false;
let token = 0;
const clips = new Map<string, string>(); // text → object URL, so replays are instant

/**
 * iOS only lets audio start inside a tap. Call this from the tap that will
 * lead to speech (sending a message): it plays a silent clip on the shared
 * element, which is then allowed to play the real answer later.
 */
export function unlockAudio() {
  if (typeof window === 'undefined') return;
  audio ??= new Audio();
  if (audio.dataset.unlocked) return;
  audio.dataset.unlocked = '1';
  audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  audio.play().catch(() => {});
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export function stopSpeaking() {
  token++;
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  if (state.speakingId || state.loadingId) emit({ speakingId: null, loadingId: null });
}

function browserVoice(text: string, locale: string, id: string, mine: number, style: VoiceStyle = 'ziggy'): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text.replace(/\p{Extended_Pictographic}|️/gu, ''));
    u.lang = bcp47(locale);
    const voices = window.speechSynthesis.getVoices();
    u.voice = voices.find((v) => v.lang === u.lang) ?? voices.find((v) => v.lang.startsWith(locale)) ?? null;
    u.pitch = style === 'bedtime' ? 1.15 : 1.35;
    u.rate = style === 'bedtime' ? 0.82 : 0.98;
    u.onstart = () => mine === token && emit({ speakingId: id, loadingId: null });
    u.onend = u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

async function serverClip(text: string, style: VoiceStyle = 'ziggy'): Promise<string | null> {
  if (serverDown) return null;
  // Personal words stay on the device: the browser's own voice says this sentence.
  if (isPersonalText(text)) return null;
  const hit = clips.get(`${style}:${text}`);
  if (hit) return hit;
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, style }),
    });
    if (res.status === 503) serverDown = true; // no key: stop asking this session
    if (!res.ok) return null;
    const url = URL.createObjectURL(await res.blob());
    clips.set(`${style}:${text}`, url);
    return url;
  } catch {
    return null;
  }
}

async function playClip(url: string): Promise<boolean> {
  audio ??= new Audio();
  audio.src = url;
  const done = new Promise<void>((resolve) => {
    audio!.onended = audio!.onerror = () => resolve();
  });
  try {
    await audio.play();
  } catch {
    return false;
  }
  await done;
  return true;
}

/**
 * Speak several sentences as Ziggy, one after the other. The next clip is
 * fetched while the current one plays, so the first words come quickly even
 * for a long answer. `onSentence(i)` fires as each sentence starts (captions).
 * Resolves true when everything was said, false if interrupted.
 */
export async function speakSequence(
  id: string,
  sentences: string[],
  locale: string,
  onSentence?: (index: number) => void,
  style: VoiceStyle = 'ziggy'
): Promise<boolean> {
  if (typeof window === 'undefined' || isMuted() || !sentences.length) return false;
  stopSpeaking();
  const mine = ++token;
  emit({ loadingId: id });

  let next: Promise<string | null> | null = serverClip(sentences[0], style);
  for (let i = 0; i < sentences.length; i++) {
    const url = await next;
    if (mine !== token) return false;
    next = i + 1 < sentences.length ? serverClip(sentences[i + 1], style) : null;
    onSentence?.(i);
    emit({ speakingId: id, loadingId: null });
    const played = url ? await playClip(url) : false;
    if (mine !== token) return false;
    if (!played) await browserVoice(sentences[i], locale, id, mine, style);
    if (mine !== token) return false;
  }
  emit({ speakingId: null, loadingId: null });
  return true;
}

/** Speak a line as Ziggy. Resolves when he has finished (or was interrupted). */
export async function speak(id: string, text: string, locale: string): Promise<void> {
  if (!text.trim()) return;
  await speakSequence(id, [text], locale);
}

/* ── Listening: the child talks instead of typing ── */

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally?: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type OnDeviceOpts = { langs: string[]; processLocally: true };
type RecognitionCtor = {
  new (): Recognition;
  available?: (o: OnDeviceOpts) => Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
  install?: (o: OnDeviceOpts) => Promise<boolean>;
};

/**
 * Only speech recognition that runs ON THE DEVICE: the standard, un-prefixed
 * API with `processLocally` (Chrome 139+ on computers). The prefixed
 * `webkitSpeechRecognition` and Chrome's default mode send the child's voice to
 * Google's or Apple's servers, so they are never used (CLAUDE.md: no child
 * voice to third parties). Not on Android, where probing it can crash the tab
 * (same rule as the Santa call, src/lib/santa/transcribe.ts).
 */
function onDeviceRecognition(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  if (/Android/i.test(navigator.userAgent)) return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition && typeof w.SpeechRecognition.available === 'function' ? w.SpeechRecognition : null;
}

export function micSupported(): boolean {
  if (typeof window === 'undefined') return false;
  // The Ziggy app never listens: no child's voice goes to Google or Apple (the native shell turns speech recognition off).
  if (document.documentElement.hasAttribute('data-app')) return false;
  return onDeviceRecognition() !== null;
}

/**
 * Start listening. `onText` gets the transcript as it forms; `onDone` the
 * final sentence (empty when nothing was heard). Returns a stop function.
 */
/** Listen for one sentence; resolves with what was heard ('' for silence or no microphone). */
export function listenOnce(locale: string, onText?: (t: string) => void): { result: Promise<string>; stop: () => void } {
  let stop = () => {};
  const result = new Promise<string>((resolve) => {
    stop = listen(locale, (t) => onText?.(t), resolve);
  });
  return { result, stop: () => stop() };
}

export function listen(locale: string, onText: (t: string) => void, onDone: (t: string) => void): () => void {
  const Ctor = micSupported() ? onDeviceRecognition() : null;
  if (!Ctor) {
    onDone('');
    return () => {};
  }
  stopSpeaking();
  let rec: Recognition | null = null;
  let cancelled = false;
  let text = '';
  const opts: OnDeviceOpts = { langs: [bcp47(locale)], processLocally: true };
  void (async () => {
    try {
      // The language pack must be on the device; download it once if needed.
      let state = await Ctor.available!(opts);
      if ((state === 'downloadable' || state === 'downloading') && Ctor.install) state = (await Ctor.install(opts)) ? 'available' : 'unavailable';
      if (state !== 'available' || cancelled) return onDone('');
      const r = new Ctor();
      r.lang = bcp47(locale);
      r.processLocally = true;
      r.interimResults = true;
      r.maxAlternatives = 1;
      r.onresult = (e) => {
        text = Array.from(e.results)
          .map((x) => x[0]?.transcript ?? '')
          .join(' ')
          .trim();
        onText(text);
      };
      r.onerror = () => {};
      r.onend = () => onDone(text);
      rec = r;
      r.start();
    } catch {
      onDone('');
    }
  })();
  return () => {
    cancelled = true;
    try {
      rec?.stop();
    } catch {}
  };
}

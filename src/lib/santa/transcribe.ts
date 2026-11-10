'use client';

/**
 * Speech-to-text ON THE DEVICE for the live AI call (the child's voice never
 * leaves the phone; only the text of the sentence is sent).
 *
 * Two engines, best first:
 * 1. Chrome's on-device recognition (`processLocally`, Chrome 139+ on Android and
 *    computers). Never the browser's cloud speech service (it would send the
 *    child's voice to a third party).
 * 2. Everywhere else (Safari, iPhone, iPad, Firefox): sherpa-onnx WebAssembly
 *    (Apache-2.0) with Silero VAD (MIT) and Whisper tiny (MIT), running in a Web
 *    Worker (public/santa/asr/stt-worker.js). The model (≈ 100 MB) is downloaded
 *    once, after the parent starts the live call, and kept in the browser's cache.
 *
 * (transformers.js was considered: its Node build pulls `sharp`, whose binaries
 * bundle LGPL code — not shipped.)
 */

export type Transcriber = {
  kind: 'chrome-local' | 'sherpa-wasm';
  /** Downloads the on-device language pack when needed; progress 0–1. */
  prepare(onProgress?: (p: number) => void): Promise<void>;
  /** Listens until the child stops talking (or `maxMs`), returns the words ('' if nothing). */
  hear(maxMs: number, onLevel?: (v: number) => void): Promise<string>;
  /** Stops listening now and returns what was heard so far. */
  finish(): void;
  close(): void;
};

type SRStatic = {
  new (): SpeechRec;
  available?: (o: { langs: string[]; processLocally: boolean }) => Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
  install?: (o: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
};
type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  processLocally?: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

const tag = (locale: 'fr' | 'en') => (locale === 'fr' ? 'fr-FR' : 'en-US');

/** Android phones (Chrome, Samsung Internet, webviews). */
export function isAndroid(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /Android/i.test(ua);
}

function chromeLocal(): SRStatic | null {
  // Not on Android: probing the on-device recognizer there (SpeechRecognition.available)
  // can take the whole tab down ("Aw, Snap" / "Zut !") on some phones.
  if (isAndroid()) return null;
  const w = window as unknown as { SpeechRecognition?: SRStatic };
  // Only the standard, un-prefixed API has on-device mode; webkit's goes to the cloud.
  return w.SpeechRecognition && typeof w.SpeechRecognition.available === 'function' ? w.SpeechRecognition : null;
}

/** Where the Whisper tiny model is downloaded from (public Hugging Face mirror of the sherpa-onnx export, MIT). */
export const SHERPA_MODEL_BASE = 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny/resolve/main';
/** sherpa-onnx WebAssembly + worker, served by this site. */
export const SHERPA_BASE_PATH = '/santa/asr';

/** Media the sherpa engine listens to (the call's own microphone stream). */
export type TranscriberMedia = { ctx: AudioContext; stream: MediaStream | null };

function sherpaSupported(): boolean {
  return (
    typeof WebAssembly === 'object' &&
    typeof Worker !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    // 32-bit ARM phones and very old devices: not enough memory for the model
    // (Android tabs are killed sooner when memory runs out: at least 4 GB there).
    ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4) >= (isAndroid() ? 4 : 2)
  );
}

/** Which engine this device can use, without downloading anything. */
export async function transcriberKind(locale: 'fr' | 'en'): Promise<Transcriber['kind'] | null> {
  const SR = chromeLocal();
  if (SR?.available) {
    try {
      const a = await SR.available({ langs: [tag(locale)], processLocally: true });
      if (a !== 'unavailable') return 'chrome-local';
    } catch {
      /* not available */
    }
  }
  return sherpaSupported() ? 'sherpa-wasm' : null;
}

export async function createTranscriber(locale: 'fr' | 'en', media?: TranscriberMedia): Promise<Transcriber | null> {
  const kind = await transcriberKind(locale);
  if (kind === 'chrome-local') return chromeTranscriber(locale);
  if (kind === 'sherpa-wasm' && media) return sherpaTranscriber(locale, media);
  return null;
}

/** Linear-interpolation resampling to 16 kHz (the models' rate). */
export function resampleTo16k(input: Float32Array, rate: number): Float32Array {
  if (rate === 16000) return input;
  const ratio = rate / 16000;
  const n = Math.floor(input.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const f = x - i0;
    out[i] = input[i0] * (1 - f) + input[i1] * f;
  }
  return out;
}

type WorkerMsg = { type: 'progress'; p: number } | { type: 'ready' } | { type: 'error'; message: string } | { type: 'speech'; on: boolean } | { type: 'text'; text: string } | { type: 'flushed'; text: string };

function sherpaTranscriber(locale: 'fr' | 'en', media: TranscriberMedia): Transcriber {
  let worker: Worker | null = null;
  let capture: { src: MediaStreamAudioSourceNode; proc: ScriptProcessorNode; mute: GainNode; stream: MediaStream; own: boolean } | null = null;
  let finishNow: (() => void) | null = null;
  const listeners = new Set<(m: WorkerMsg) => void>();

  const startCapture = async () => {
    if (capture) return capture;
    let stream = media.stream && media.stream.getAudioTracks().length ? media.stream : null;
    const own = !stream;
    if (!stream) stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const src = media.ctx.createMediaStreamSource(stream);
    const proc = media.ctx.createScriptProcessor(4096, 1, 1);
    const mute = media.ctx.createGain();
    mute.gain.value = 0;
    src.connect(proc);
    proc.connect(mute).connect(media.ctx.destination);
    capture = { src, proc, mute, stream, own };
    return capture;
  };
  const stopCapture = () => {
    if (!capture) return;
    capture.proc.onaudioprocess = null;
    capture.src.disconnect();
    capture.proc.disconnect();
    capture.mute.disconnect();
    if (capture.own) capture.stream.getTracks().forEach((t) => t.stop());
    capture = null;
  };

  return {
    kind: 'sherpa-wasm',
    prepare(onProgress) {
      if (worker) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        const w = new Worker(`${SHERPA_BASE_PATH}/stt-worker.js`);
        worker = w;
        w.onmessage = (e: MessageEvent<WorkerMsg>) => {
          const m = e.data;
          if (m.type === 'progress') onProgress?.(m.p);
          else if (m.type === 'ready') resolve();
          else if (m.type === 'error') reject(new Error(m.message));
          listeners.forEach((l) => l(m));
        };
        w.onerror = () => reject(new Error('stt-worker'));
        w.postMessage({ type: 'init', base: `${location.origin}${SHERPA_BASE_PATH}`, modelBase: SHERPA_MODEL_BASE, lang: locale });
      });
    },
    async hear(maxMs, onLevel) {
      const w = worker;
      if (!w) return '';
      const cap = await startCapture();
      w.postMessage({ type: 'start' });
      return new Promise<string>((resolve) => {
        let settled = false;
        let heardSpeech = false;
        const parts: string[] = [];
        const done = (text: string) => {
          if (settled) return;
          settled = true;
          clearTimeout(limit);
          listeners.delete(onMsg);
          cap.proc.onaudioprocess = null;
          finishNow = null;
          onLevel?.(0);
          resolve(text.trim());
        };
        const flush = () => {
          cap.proc.onaudioprocess = null;
          w.postMessage({ type: 'flush' });
        };
        const onMsg = (m: WorkerMsg) => {
          if (m.type === 'speech' && m.on) heardSpeech = true;
          // The child stopped talking: one sentence is enough for Santa to answer.
          if (m.type === 'text') done([...parts, m.text].join(' '));
          if (m.type === 'flushed') done([...parts, m.text].join(' '));
          if (m.type === 'error') done(parts.join(' '));
        };
        listeners.add(onMsg);
        finishNow = flush;
        // While the child is still talking at the limit, give a little more time.
        const limit = setTimeout(function stopAt() {
          flush();
        }, maxMs + (heardSpeech ? 3000 : 0));
        cap.proc.onaudioprocess = (e) => {
          const ch = e.inputBuffer.getChannelData(0);
          let sum = 0;
          for (let i = 0; i < ch.length; i += 4) sum += ch[i] * ch[i];
          onLevel?.(Math.min(1, Math.sqrt(sum / (ch.length / 4)) * 6));
          const samples = resampleTo16k(new Float32Array(ch), media.ctx.sampleRate);
          w.postMessage({ type: 'audio', samples }, [samples.buffer]);
        };
      });
    },
    finish() {
      finishNow?.();
    },
    close() {
      stopCapture();
      worker?.terminate();
      worker = null;
      listeners.clear();
    },
  };
}

function chromeTranscriber(locale: 'fr' | 'en'): Transcriber {
  const SR = chromeLocal()!;
  let rec: SpeechRec | null = null;
  return {
    kind: 'chrome-local',
    async prepare(onProgress) {
      const a = await SR.available!({ langs: [tag(locale)], processLocally: true });
      if (a === 'downloadable' || a === 'downloading') await SR.install?.({ langs: [tag(locale)], processLocally: true });
      onProgress?.(1);
    },
    hear(maxMs, onLevel) {
      return new Promise((resolve) => {
        rec = new SR();
        rec.lang = tag(locale);
        rec.processLocally = true;
        rec.interimResults = true;
        rec.continuous = false;
        let text = '';
        let pulse = 0;
        const wobble = setInterval(() => onLevel?.(text ? 0.3 + 0.3 * Math.abs(Math.sin((pulse += 0.7))) : 0.08), 100);
        const done = () => {
          clearInterval(wobble);
          clearTimeout(limit);
          onLevel?.(0);
          resolve(text.trim());
        };
        const limit = setTimeout(() => rec?.stop(), maxMs);
        rec.onresult = (e) => {
          text = Array.from(e.results)
            .map((r) => r[0]?.transcript ?? '')
            .join(' ');
        };
        rec.onend = done;
        rec.onerror = () => done();
        try {
          rec.start();
        } catch {
          done();
        }
      });
    },
    finish() {
      rec?.stop();
    },
    close() {
      rec?.abort();
    },
  };
}

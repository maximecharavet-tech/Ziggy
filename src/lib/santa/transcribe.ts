'use client';

/**
 * Speech-to-text ON THE DEVICE for the live AI call (the child's voice never
 * leaves the phone; only the text of the sentence is sent).
 *
 * Chrome's on-device recognition (`processLocally`, Chrome 139+ on Android and
 * computers). Never the browser's cloud speech service (it would send the child's
 * voice to a third party), so on other browsers (Safari, Firefox) the live AI call
 * is not offered and the guided call is used instead.
 *
 * (Whisper in the browser was considered: transformers.js pulls `sharp`, whose
 * binaries bundle LGPL code, and a 100 MB+ ONNX Runtime for Node — not shipped.)
 */

export type Transcriber = {
  kind: 'chrome-local';
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

function chromeLocal(): SRStatic | null {
  const w = window as unknown as { SpeechRecognition?: SRStatic };
  // Only the standard, un-prefixed API has on-device mode; webkit's goes to the cloud.
  return w.SpeechRecognition && typeof w.SpeechRecognition.available === 'function' ? w.SpeechRecognition : null;
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
  return null;
}

export async function createTranscriber(locale: 'fr' | 'en'): Promise<Transcriber | null> {
  return (await transcriberKind(locale)) === 'chrome-local' ? chromeTranscriber(locale) : null;
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

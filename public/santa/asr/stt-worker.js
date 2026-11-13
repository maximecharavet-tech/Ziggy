/* Ziggy — Santa's ears on the device (live AI call on Safari, iPhone, Firefox…).
 *
 * Runs in a Web Worker: the child's voice is turned into text right here, on the
 * phone. No audio is ever sent anywhere; only the recognised sentence goes back
 * to the page.
 *
 * Third-party code (see docs/CREDITS.md):
 * - sherpa-onnx WebAssembly build (k2-fsa, Apache-2.0) + ONNX Runtime (MIT):
 *   sherpa-vad-asr.js / .wasm, sherpa-onnx-asr.js, sherpa-onnx-vad.js
 *   (from huggingface.co/spaces/k2-fsa/web-assembly-vad-asr-sherpa-onnx-*; the
 *   embedded model package was removed from the loader, models are added below).
 * - Silero VAD (snakers4, MIT): silero_vad.onnx.
 * - Whisper tiny (OpenAI, MIT), int8 ONNX export by sherpa-onnx: downloaded once
 *   on demand and kept in the browser's Cache Storage.
 *
 * Messages in:  {type:'init', base, modelBase, lang} · {type:'audio', samples: Float32Array (16 kHz)}
 *               {type:'start'} (new turn) · {type:'flush'} (end the turn now)
 * Messages out: {type:'progress', p} · {type:'ready'} · {type:'error', message}
 *               {type:'speech', on: boolean} · {type:'text', text}
 */
/* eslint-disable */
const SR = 16000;
const CACHE = 'ziggy-santa-asr-v1';
let vad = null;
let buf = null;
let recognizer = null;
let lang = 'fr';
let speaking = false;

async function fetchBytes(url, onBytes) {
  let cache = null;
  try {
    cache = await caches.open(CACHE);
    const hit = await cache.match(url);
    if (hit) {
      const b = new Uint8Array(await hit.arrayBuffer());
      onBytes(b.length, b.length);
      return b;
    }
  } catch (e) {
    cache = null;
  }
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error('download ' + res.status);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const parts = [];
  let got = 0;
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    parts.push(r.value);
    got += r.value.length;
    onBytes(got, total);
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  if (cache) {
    try {
      await cache.put(url, new Response(out, { headers: { 'content-type': 'application/octet-stream' } }));
    } catch (e) {
      /* storage full: works for this visit */
    }
  }
  return out;
}

function createEngine(Module) {
  vad = createVad(Module, {
    sileroVad: { model: './silero_vad.onnx', threshold: 0.5, minSilenceDuration: 0.6, minSpeechDuration: 0.25, maxSpeechDuration: 15, windowSize: 512 },
    tenVad: { model: '', threshold: 0.5, minSilenceDuration: 0.5, minSpeechDuration: 0.25, maxSpeechDuration: 20, windowSize: 256 },
    sampleRate: SR,
    numThreads: 1,
    provider: 'cpu',
    debug: 0,
    bufferSizeInSeconds: 30,
  });
  buf = new CircularBuffer(30 * SR, Module);
  recognizer = new OfflineRecognizer(
    {
      modelConfig: {
        debug: 0,
        numThreads: 1,
        tokens: './tokens.txt',
        whisper: { encoder: './whisper-encoder.onnx', decoder: './whisper-decoder.onnx', language: lang, task: 'transcribe' },
      },
    },
    Module
  );
}

function decode(samples) {
  const s = recognizer.createStream();
  s.acceptWaveform(SR, samples);
  recognizer.decode(s);
  const text = (recognizer.getResult(s).text || '').trim();
  s.free();
  return text;
}

/** Feeds 16 kHz samples; returns the sentences finished in this chunk. */
function feed(samples) {
  const out = [];
  buf.push(samples);
  const w = 512;
  while (buf.size() > w) {
    const s = buf.get(buf.head(), w);
    vad.acceptWaveform(s);
    buf.pop(w);
    const on = vad.isDetected();
    if (on !== speaking) {
      speaking = on;
      post({ type: 'speech', on });
    }
    while (!vad.isEmpty()) {
      const seg = vad.front();
      vad.pop();
      const text = decode(seg.samples);
      if (text) out.push(text);
    }
  }
  return out;
}

function flush() {
  const out = [];
  vad.flush();
  while (!vad.isEmpty()) {
    const seg = vad.front();
    vad.pop();
    const text = decode(seg.samples);
    if (text) out.push(text);
  }
  vad.reset();
  buf.reset();
  speaking = false;
  return out;
}

let post = (m) => self.postMessage(m);

async function init(m) {
  lang = m.lang === 'en' ? 'en' : 'fr';
  const files = [
    [m.base + '/silero_vad.onnx', 'silero_vad.onnx', 0.7],
    [m.modelBase + '/tiny-tokens.txt', 'tokens.txt', 0.9],
    [m.modelBase + '/tiny-encoder.int8.onnx', 'whisper-encoder.onnx', 13],
    [m.modelBase + '/tiny-decoder.int8.onnx', 'whisper-decoder.onnx', 90],
  ];
  const weight = files.reduce((a, f) => a + f[2], 0);
  let doneW = 0;
  const loaded = [];
  for (const [url, name, w] of files) {
    const bytes = await fetchBytes(url, (got, total) => post({ type: 'progress', p: Math.min(0.99, (doneW + (total ? (got / total) * w : 0)) / weight) }));
    doneW += w;
    loaded.push([name, bytes]);
  }
  await new Promise((resolve, reject) => {
    self.Module = {
      locateFile: (p) => m.base + '/' + p,
      preRun: [
        () => {
          for (const [name, bytes] of loaded) self.Module.FS_createDataFile('/', name, bytes, true, true, true);
        },
      ],
      onRuntimeInitialized: () => {
        try {
          createEngine(self.Module);
          resolve();
        } catch (e) {
          reject(e);
        }
      },
      print: () => {},
      printErr: () => {},
      onAbort: (e) => reject(new Error(String(e))),
    };
    importScripts(m.base + '/sherpa-vad-asr.js', m.base + '/sherpa-onnx-asr.js', m.base + '/sherpa-onnx-vad.js');
  });
  post({ type: 'progress', p: 1 });
  post({ type: 'ready' });
}

if (typeof self !== 'undefined' && typeof importScripts === 'function') {
  self.onmessage = async (e) => {
    const m = e.data || {};
    try {
      if (m.type === 'init') await init(m);
      else if (!recognizer) return;
      else if (m.type === 'start') {
        vad.reset();
        buf.reset();
        speaking = false;
      } else if (m.type === 'audio') for (const text of feed(m.samples)) post({ type: 'text', text });
      else if (m.type === 'flush') {
        const texts = flush();
        post({ type: 'flushed', text: texts.join(' ') });
      }
    } catch (err) {
      post({ type: 'error', message: String((err && err.message) || err) });
    }
  };
}

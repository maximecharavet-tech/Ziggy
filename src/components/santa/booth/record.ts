/**
 * Photo booth — records the composite canvas (+ the synthesized jingle) into a
 * short clip, on the device (MediaRecorder). MP4 when the browser can (Safari,
 * recent Chrome), WebM otherwise.
 */

const TYPES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export function pickVideoType(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return null;
  return TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

export function canRecordVideo(): boolean {
  return typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype && pickVideoType() !== null;
}

export type Clip = { blob: Blob; type: string; ext: 'mp4' | 'webm' };

/**
 * Records `seconds` of `canvas`. `draw(t)` is called every animation frame
 * with the elapsed time (s) to paint the next frame; `audio` (optional) is mixed in.
 */
export function recordCanvas(canvas: HTMLCanvasElement, opts: { seconds: number; draw: (t: number) => void; audio?: MediaStream | null; onProgress?: (p: number) => void; fps?: number }): Promise<Clip> {
  const type = pickVideoType();
  if (!type) return Promise.reject(new Error('no recorder'));
  const fps = opts.fps ?? 30;
  opts.draw(0);
  const video = canvas.captureStream(fps);
  const tracks = [...video.getVideoTracks(), ...(opts.audio?.getAudioTracks() ?? [])];
  const stream = new MediaStream(tracks);
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 128_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  return new Promise<Clip>((resolve, reject) => {
    let raf = 0;
    let t0 = 0;
    const stopAll = () => {
      cancelAnimationFrame(raf);
      video.getTracks().forEach((t) => t.stop());
    };
    rec.onerror = () => {
      stopAll();
      reject(new Error('recorder error'));
    };
    rec.onstop = () => {
      stopAll();
      const base = type.split(';')[0];
      const blob = new Blob(chunks, { type: base });
      if (!blob.size) reject(new Error('empty clip'));
      else resolve({ blob, type: base, ext: base === 'video/mp4' ? 'mp4' : 'webm' });
    };
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const t = (now - t0) / 1000;
      opts.draw(Math.min(t, opts.seconds));
      opts.onProgress?.(Math.min(1, t / opts.seconds));
      if (t >= opts.seconds) {
        if (rec.state !== 'inactive') rec.stop();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    rec.start(250);
    raf = requestAnimationFrame(tick);
  });
}

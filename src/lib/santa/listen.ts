'use client';

/**
 * Knows when the child answers Santa, without understanding the words: the
 * microphone's loudness is measured on the device (nothing is recorded or
 * sent). Speech = louder than the room's noise for a moment; the answer ends
 * after a short silence, or at the time limit.
 */

export type Ears = {
  /** Resolves when the child finished speaking (true) or nobody spoke (false). */
  listen(maxMs: number, onLevel?: (v: number) => void): Promise<boolean>;
  /**
   * Barge-in: calls `onSpeech` once when the child starts talking over Santa
   * (a stricter threshold than `listen`, so Santa's own voice coming back
   * through the microphone does not trigger it). Returns a stop function.
   */
  watch(onSpeech: () => void): () => void;
  close(): void;
};

/**
 * Pure decision logic, testable: feed it a loudness sample and the real time
 * since the previous one (browsers slow timers down, so never assume a step).
 */
export function makeTurnDetector(opts: { stepMs: number; noise: number }) {
  const start = Math.max(0.035, opts.noise * 2.6);
  let spoken = 0;
  let silence = 0;
  let speaking = false;
  return (level: number, dtMs: number = opts.stepMs): 'wait' | 'speaking' | 'done' => {
    const dt = Math.max(0, Math.min(dtMs, 1000));
    if (level > start) {
      spoken += dt;
      silence = 0;
      if (spoken >= 220) speaking = true;
    } else {
      silence += dt;
      if (!speaking && silence > 400) spoken = 0;
    }
    if (speaking && silence >= 1000) return 'done';
    return speaking ? 'speaking' : 'wait';
  };
}

/** Barge-in detector (pure): the child must be clearly louder than the room for `holdMs`. */
export function makeBargeInDetector(opts: { noise: number; holdMs?: number }) {
  const start = Math.max(0.07, opts.noise * 4);
  const hold = opts.holdMs ?? 380;
  let loud = 0;
  return (level: number, dtMs: number): boolean => {
    const dt = Math.max(0, Math.min(dtMs, 1000));
    loud = level > start ? loud + dt : Math.max(0, loud - dt * 2);
    return loud >= hold;
  };
}

/** `given`: a stream already opened by the caller (camera + mic), which then stays its owner. */
export async function openEars(ctx: AudioContext, given?: MediaStream | null): Promise<Ears | null> {
  let stream: MediaStream;
  if (given && given.getAudioTracks().length) stream = given;
  else
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      return null;
    }
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  src.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  const level = () => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += ((v - 128) / 128) ** 2;
    return Math.sqrt(sum / data.length);
  };
  // The room's noise, measured for half a second.
  let noise = 0;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 50));
    noise = Math.max(noise, level());
  }
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    listen(maxMs, onLevel) {
      return new Promise((resolve) => {
        const step = 50;
        const detect = makeTurnDetector({ stepMs: step, noise });
        const t0 = performance.now();
        let last = t0;
        let heard = false;
        timer = setInterval(() => {
          const now = performance.now();
          const v = level();
          onLevel?.(Math.min(1, v * 6));
          const state = detect(v, now - last);
          last = now;
          if (state === 'speaking') heard = true;
          const elapsed = now - t0;
          // While the child is still talking, give them a little more time.
          if (state === 'done' || (elapsed >= maxMs && state !== 'speaking') || elapsed >= maxMs + 4000) {
            if (timer) clearInterval(timer);
            timer = null;
            onLevel?.(0);
            resolve(heard);
          }
        }, step);
      });
    },
    watch(onSpeech) {
      const detect = makeBargeInDetector({ noise });
      let last = performance.now();
      const w = setInterval(() => {
        const now = performance.now();
        if (detect(level(), now - last)) {
          clearInterval(w);
          onSpeech();
        }
        last = now;
      }, 40);
      return () => clearInterval(w);
    },
    close() {
      if (timer) clearInterval(timer);
      if (stream !== given) stream.getTracks().forEach((t) => t.stop());
      src.disconnect();
    },
  };
}

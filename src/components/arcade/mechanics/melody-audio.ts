/**
 * A tiny pentatonic "music box" for the Melody mechanic: one soft oscillator
 * voice per note, silent when Ziggy's sound is muted.
 */
import { isMuted } from '@/lib/sound';
import { PENTATONIC_HZ } from '../logic';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    type WithWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as WithWebkit).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Play pad `index` (0–4) for `dur` seconds. */
export function playPad(index: number, dur = 0.42): void {
  if (isMuted()) return;
  const a = audio();
  const freq = PENTATONIC_HZ[index];
  if (!a || !freq) return;
  const t0 = a.currentTime;
  const out = a.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(0.22, t0 + 0.015);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  out.connect(a.destination);

  // A sine plus a quiet octave triangle: round, bell-like, never harsh.
  const voices: [OscillatorType, number, number][] = [
    ['sine', freq, 1],
    ['triangle', freq * 2, 0.18],
  ];
  for (const [type, f, level] of voices) {
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t0);
    g.gain.value = level;
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }
}

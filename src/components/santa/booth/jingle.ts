/**
 * Photo booth — a ≈6 s Christmas jingle synthesized with WebAudio (no audio
 * file): the opening of "Jingle Bells" (J. L. Pierpont, 1857, public domain)
 * on a glockenspiel-like bell, an oom-pah bass, sleigh bells, and a sparkle
 * glissando at the end. Also a tiny "ding" for the camera shutter.
 */

const NOTE: Record<string, number> = { C2: 65.41, G2: 98, C3: 130.81, E3: 164.81, G3: 196, C4: 261.63, E4: 329.63, G4: 392, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, C6: 1046.5, E6: 1318.5, G6: 1568, C7: 2093 };

/** One bell strike: a few inharmonic partials with fast-decaying highs (glockenspiel). */
function bell(ac: BaseAudioContext, out: AudioNode, f: number, at: number, dur: number, gain = 0.22) {
  const partials: [number, number, number][] = [
    [1, 1, 1],
    [2.76, 0.32, 0.45],
    [5.4, 0.12, 0.25],
  ];
  for (const [ratio, amp, life] of partials) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * ratio;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain * amp, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, at + Math.max(0.15, dur * 1.6 * life));
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + dur * 1.6 + 0.05);
  }
}

function bass(ac: BaseAudioContext, out: AudioNode, f: number, at: number, dur: number, gain = 0.2) {
  const o = ac.createOscillator();
  o.type = 'triangle';
  o.frequency.value = f;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.02);
}

let noise: AudioBuffer | null = null;
function noiseBuffer(ac: BaseAudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ac.sampleRate) return noise;
  const b = ac.createBuffer(1, Math.round(ac.sampleRate * 0.5), ac.sampleRate);
  const d = b.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < d.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    d[i] = s / 2147483648 - 1;
  }
  noise = b;
  return b;
}

/** Sleigh bells: a few tiny high band-passed noise clicks in a burst. */
function sleigh(ac: BaseAudioContext, out: AudioNode, at: number, gain = 0.08) {
  for (let i = 0; i < 4; i++) {
    const t = at + i * 0.012;
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 6500 + i * 900;
    bp.Q.value = 6;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain * (1 - i * 0.18), t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.09);
    src.connect(bp).connect(g).connect(out);
    src.start(t, (i * 0.07) % 0.4);
    src.stop(t + 0.1);
  }
}

/** Schedules the jingle on `out`; returns its length in seconds (≈ 6). */
export function scheduleJingle(ac: BaseAudioContext, out: AudioNode, start = ac.currentTime + 0.05, bpm = 168): number {
  const beat = 60 / bpm;
  const master = ac.createGain();
  master.gain.value = 0.9;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 3;
  master.connect(comp).connect(out);
  // Melody: E E E– | E E E– | E G C. D | E———
  const melody: [string, number][] = [
    ['E5', 1], ['E5', 1], ['E5', 2],
    ['E5', 1], ['E5', 1], ['E5', 2],
    ['E5', 1], ['G5', 1], ['C5', 1.5], ['D5', 0.5],
    ['E5', 4],
  ];
  let b = 0;
  for (const [n, len] of melody) {
    bell(ac, master, NOTE[n], start + b * beat, len * beat, 0.24);
    b += len;
  }
  // Oom-pah: bass on 1 and 3, a soft chord on 2 and 4
  for (let bar = 0; bar < 4; bar++) {
    const t0 = start + bar * 4 * beat;
    if (bar < 3) {
      bass(ac, master, NOTE.C3, t0, beat * 0.9);
      bass(ac, master, NOTE.G2, t0 + 2 * beat, beat * 0.9);
      for (const off of [1, 3]) for (const n of ['E4', 'G4', 'C5']) bell(ac, master, NOTE[n] / 2, t0 + off * beat, beat * 0.5, 0.05);
    } else {
      bass(ac, master, NOTE.C2, t0, beat * 3.5, 0.24);
      bass(ac, master, NOTE.C3, t0, beat * 3.5, 0.12);
    }
  }
  // Sleigh bells on every eighth note, accent on the beat
  for (let e = 0; e < 26; e++) sleigh(ac, master, start + e * beat * 0.5, e % 2 ? 0.05 : 0.09);
  // Sparkle glissando on the last note
  const end = start + 12 * beat;
  ['C6', 'E6', 'G6', 'C7', 'G6', 'C7'].forEach((n, i) => bell(ac, master, NOTE[n], end + 0.15 + i * 0.07, 0.6, 0.08));
  return 16 * beat + 0.4;
}

/** A tiny happy "ding" (shutter). */
export function ding(ac: BaseAudioContext, out: AudioNode = ac.destination) {
  const t = ac.currentTime + 0.01;
  bell(ac, out, NOTE.G5, t, 0.5, 0.15);
  bell(ac, out, NOTE.C6, t + 0.08, 0.7, 0.15);
}

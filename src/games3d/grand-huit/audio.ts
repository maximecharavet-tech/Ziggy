import { isMuted } from '@/lib/sound';

/**
 * Fairground sounds, all synthesised with Web Audio (nothing to download):
 * an original little calliope waltz, rail clicks, station dings that climb
 * with the numbers, a soft "boing" (never a buzzer), a splash, a quack,
 * balloon pops, a fanfare and fireworks. Quiet, and silent when the site is
 * muted.
 */

const A4 = 440;
/** Frequency of a note name like "C5" or "F#4". */
function hz(note: string): number {
  const m = /^([A-G])(#?)(\d)$/.exec(note);
  if (!m) return A4;
  const semis: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const n = semis[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12;
  return A4 * 2 ** (n / 12);
}

// An original oom-pah-pah waltz (3 beats per bar): [melody note, beats] per bar, and the bar's chord.
const BARS: { mel: [string, number][]; chord: string[] }[] = [
  { mel: [['E4', 2], ['G4', 1]], chord: ['C3', 'E4', 'G4'] },
  { mel: [['C5', 2], ['G4', 1]], chord: ['C3', 'E4', 'G4'] },
  { mel: [['B4', 2], ['D5', 1]], chord: ['G2', 'D4', 'F4'] },
  { mel: [['G4', 3]], chord: ['G2', 'D4', 'F4'] },
  { mel: [['F4', 1], ['G4', 1], ['A4', 1]], chord: ['G2', 'B3', 'F4'] },
  { mel: [['B4', 2], ['D5', 1]], chord: ['G2', 'B3', 'F4'] },
  { mel: [['C5', 2], ['E5', 1]], chord: ['C3', 'E4', 'G4'] },
  { mel: [['C5', 3]], chord: ['C3', 'E4', 'G4'] },
  { mel: [['A4', 2], ['C5', 1]], chord: ['F2', 'A3', 'C4'] },
  { mel: [['F5', 2], ['C5', 1]], chord: ['F2', 'A3', 'C4'] },
  { mel: [['G4', 2], ['E5', 1]], chord: ['C3', 'E4', 'G4'] },
  { mel: [['C5', 2], ['G4', 1]], chord: ['C3', 'E4', 'G4'] },
  { mel: [['F4', 1], ['A4', 1], ['D5', 1]], chord: ['G2', 'B3', 'F4'] },
  { mel: [['B4', 2], ['G4', 1]], chord: ['G2', 'B3', 'F4'] },
  { mel: [['C5', 1], ['E5', 1], ['G5', 1]], chord: ['C3', 'E4', 'G4'] },
  { mel: [['C5', 3]], chord: ['C3', 'E4', 'G4'] },
];

/** C major pentatonic, climbing with the station number. */
const PENTA = [0, 2, 4, 7, 9];
function stationHz(v: number): number {
  const k = ((Math.floor(v) % 10) + 10) % 10;
  return hz('C5') * 2 ** ((PENTA[k % 5] + 12 * Math.floor(k / 5)) / 12);
}

export class FairAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicOn = false;

  private ensure(): AudioContext | null {
    if (isMuted()) return null;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      try {
        this.ctx = new AC();
      } catch {
        return null;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
    }
    void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private tone(freq: number, at: number, dur: number, type: OscillatorType, vol: number, glideTo?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    o.connect(g);
    g.connect(this.master!);
    o.start(at);
    o.stop(at + dur + 0.03);
  }

  private noise(at: number, dur: number, vol: number, filter: { type: BiquadFilterType; from: number; to: number; q?: number }) {
    const ctx = this.ctx!;
    if (!this.noiseBuf) {
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter.type;
    f.Q.value = filter.q ?? 1;
    f.frequency.setValueAtTime(filter.from, at);
    f.frequency.exponentialRampToValueAtTime(filter.to, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master!);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.05);
  }

  /** A rail piece snaps into place: "clac-clac" and a happy blip (higher for bigger pieces). */
  click(size = 1) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.noise(t, 0.05, 0.25, { type: 'bandpass', from: 2400, to: 1800, q: 4 });
    this.noise(t + 0.07, 0.05, 0.2, { type: 'bandpass', from: 3000, to: 2200, q: 4 });
    this.tone(hz('G5') * (1 + Math.min(4, size) * 0.06), t + 0.1, 0.18, 'triangle', 0.12);
  }

  undo() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(hz('E5'), t, 0.2, 'triangle', 0.1, hz('A4'));
  }

  /** The cart lands on a station: a bell that climbs with the number. */
  ding(v: number) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = stationHz(v);
    this.tone(f, t, 0.6, 'sine', 0.18);
    this.tone(f * 2, t, 0.3, 'triangle', 0.05);
  }

  /** Lift-chain clanks then a whoosh, when the ride starts. */
  go() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 5; i++) this.noise(t + i * 0.08, 0.04, 0.16, { type: 'highpass', from: 3000, to: 2500 });
    this.tone(hz('C5'), t + 0.4, 0.14, 'square', 0.05);
    this.tone(hz('G5'), t + 0.5, 0.25, 'square', 0.05);
  }

  whoosh(dur = 0.6, vol = 0.12) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.noise(ctx.currentTime, dur, vol, { type: 'bandpass', from: 500, to: 2600, q: 0.8 });
  }

  /** A funny spring: never a buzzer. */
  boing() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.55);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 18;
    const lg = ctx.createGain();
    lg.gain.value = 30;
    lfo.connect(lg);
    lg.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g);
    g.connect(this.master!);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.62);
    lfo.stop(t + 0.62);
  }

  splash() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.noise(t, 0.9, 0.4, { type: 'lowpass', from: 4000, to: 300 });
    for (let i = 0; i < 6; i++) this.tone(500 + Math.random() * 700, t + 0.15 + i * 0.07, 0.08, 'sine', 0.06, 900 + Math.random() * 600);
  }

  quack() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const d of [0, 0.18]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(560, t + d);
      o.frequency.exponentialRampToValueAtTime(380, t + d + 0.13);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1100;
      f.Q.value = 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.linearRampToValueAtTime(0.16, t + d + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.14);
      o.connect(f);
      f.connect(g);
      g.connect(this.master!);
      o.start(t + d);
      o.stop(t + d + 0.16);
    }
  }

  pop() {
    const ctx = this.ensure();
    if (!ctx) return;
    this.noise(ctx.currentTime, 0.08, 0.3, { type: 'highpass', from: 1500, to: 900 });
  }

  fanfare() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    ['C5', 'E5', 'G5'].forEach((n, i) => this.tone(hz(n), t + i * 0.11, 0.3, 'square', 0.06));
    for (const n of ['C5', 'E5', 'G5', 'C6']) this.tone(hz(n), t + 0.36, 1.1, 'triangle', 0.08);
  }

  firework() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(220, t, 0.5, 'sine', 0.05, 1400);
    this.noise(t + 0.5, 0.5, 0.3, { type: 'lowpass', from: 1800, to: 200 });
    for (let i = 0; i < 8; i++) this.noise(t + 0.6 + Math.random() * 0.5, 0.03, 0.08, { type: 'highpass', from: 4000, to: 3500 });
  }

  /** The little waltz, looped softly. */
  startMusic() {
    this.musicOn = true;
    const ctx = this.ensure();
    if (!ctx || this.musicTimer) return;
    const beat = 0.34;
    const play = () => {
      this.musicTimer = null;
      if (!this.ctx || !this.musicOn || isMuted()) return;
      let at = this.ctx.currentTime + 0.1;
      for (const bar of BARS) {
        // Oom (bass) – pah – pah (chord).
        this.tone(hz(bar.chord[0]), at, beat * 0.9, 'triangle', 0.09);
        for (const k of [1, 2]) for (const n of bar.chord.slice(1)) this.tone(hz(n), at + beat * k, beat * 0.5, 'triangle', 0.025);
        let m = at;
        for (const [n, b] of bar.mel) {
          this.tone(hz(n), m, Math.max(0.25, b * beat * 0.95), 'square', 0.022);
          this.tone(hz(n) * 2, m, Math.max(0.2, b * beat * 0.7), 'sine', 0.03);
          m += b * beat;
        }
        at += beat * 3;
      }
      this.musicTimer = window.setTimeout(play, (at - this.ctx.currentTime + 1.2) * 1000);
    };
    play();
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }

  suspend(on: boolean) {
    if (!this.ctx) return;
    void (on ? this.ctx.suspend() : this.ctx.resume()).catch(() => {});
  }

  dispose() {
    this.stopMusic();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}

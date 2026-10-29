import { isMuted } from '@/lib/sound';

/**
 * Sounds of the detective village, all synthesised with Web Audio (nothing to
 * download): a soft tiptoe tune (an original little melody), sparkles for a
 * clue, a "pop" when a friend is cleared, a gentle boing, a wooden bonk for
 * Ziggy's magnifier, sneezes, a drum roll and a fanfare. Quiet by default,
 * silent when the site is muted, never a buzzer.
 */

const N: Record<string, number> = {
  E2: 82.41, F2: 87.31, G2: 98, A2: 110, B2: 123.47, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5,
};

// A tiptoeing detective tune: [bass, melody|null, beats]. Original, written for this game.
const TUNE: [string, string | null, number][] = [
  ['A2', 'E4', 1], ['E3', null, 1], ['A2', 'G4', 1], ['E3', 'A4', 1],
  ['F2', null, 1], ['C3', 'C5', 1], ['F2', 'B4', 1], ['C3', 'A4', 1],
  ['G2', 'G4', 1], ['D3', null, 1], ['G2', 'E4', 1], ['D3', 'G4', 1],
  ['E2', 'B4', 1], ['B2', 'A4', 1], ['E2', 'G4', 0.5], ['E2', 'E4', 0.5], ['B2', null, 1],
  ['A2', 'E4', 1], ['E3', 'E4', 1], ['A2', 'A4', 1], ['E3', 'C5', 1],
  ['F2', 'D5', 1], ['C3', 'C5', 1], ['F2', 'A4', 1], ['C3', null, 1],
  ['G2', 'B4', 1], ['D3', 'G4', 1], ['E2', 'E4', 1], ['B2', 'G4', 1],
  ['A2', 'A4', 2], ['E3', null, 1], ['A2', null, 1],
];

export type Sfx = 'clue' | 'clear' | 'oops' | 'bonk' | 'sneeze' | 'reveal' | 'party' | 'tap' | 'toot' | 'pop' | 'step';

export class DetectiveAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private timer: number | null = null;
  private noise: AudioBuffer | null = null;
  musicOn = true;

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
      this.master.gain.value = 0.36;
      this.master.connect(this.ctx.destination);
      this.music = this.ctx.createGain();
      this.music.gain.value = 0.55;
      this.music.connect(this.master);
    }
    void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, at: number, dur: number, type: OscillatorType, vol: number, out?: AudioNode, glideTo?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    o.connect(g);
    g.connect(out ?? this.master!);
    o.start(at);
    o.stop(at + dur + 0.03);
  }

  private hiss(at: number, dur: number, vol: number, freq: number, q = 1, sweepTo?: number) {
    const ctx = this.ctx!;
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, at);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master!);
    src.start(at);
    src.stop(at + dur + 0.05);
  }

  play(kind: Sfx) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    switch (kind) {
      case 'clue':
        [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => this.tone(f, t + i * 0.08, 0.7, 'sine', 0.2));
        this.tone(N.G5 * 2, t + 0.36, 0.9, 'triangle', 0.06);
        break;
      case 'clear':
        this.tone(N.G4, t, 0.18, 'triangle', 0.22, undefined, N.C5);
        this.tone(N.E5, t + 0.12, 0.35, 'sine', 0.18);
        break;
      case 'pop':
        this.tone(600, t, 0.08, 'sine', 0.25, undefined, 1200);
        break;
      case 'tap':
        this.tone(N.A5, t, 0.08, 'sine', 0.12);
        break;
      case 'step':
        this.tone(N.E4, t, 0.05, 'triangle', 0.05);
        break;
      case 'oops':
        // A soft "boing", never a buzzer.
        this.tone(330, t, 0.3, 'sine', 0.16, undefined, 220);
        this.tone(440, t + 0.12, 0.3, 'sine', 0.08, undefined, 330);
        break;
      case 'bonk':
        this.tone(900, t, 0.09, 'square', 0.06, undefined, 500);
        this.tone(520, t, 0.16, 'triangle', 0.22, undefined, 360);
        [N.E5, N.G5, N.C6].forEach((f, i) => this.tone(f, t + 0.15 + i * 0.07, 0.2, 'sine', 0.06));
        break;
      case 'sneeze':
        // "Ah… ah… TCHOUM!"
        this.tone(380, t, 0.25, 'sine', 0.06, undefined, 520);
        this.tone(420, t + 0.3, 0.25, 'sine', 0.07, undefined, 620);
        this.hiss(t + 0.62, 0.35, 0.5, 2400, 0.8, 900);
        break;
      case 'toot':
        // A squeaky trumpet note, then a proud one.
        this.tone(N.A4, t, 0.25, 'sawtooth', 0.05, undefined, N.B4 * 1.06);
        this.tone(N.C5, t + 0.3, 0.6, 'sawtooth', 0.06);
        break;
      case 'reveal':
        for (let i = 0; i < 14; i++) this.hiss(t + i * 0.055, 0.08, 0.18 + i * 0.01, 300, 0.7);
        [N.C5, N.E5, N.G5].forEach((f, i) => this.tone(f, t + 0.85 + i * 0.03, 1.0, 'triangle', 0.16));
        break;
      case 'party': {
        const seq: [number, number][] = [
          [N.C5, 0.15],
          [N.C5, 0.15],
          [N.C5, 0.15],
          [N.E5, 0.4],
          [N.D5, 0.15],
          [N.E5, 0.15],
          [N.G5, 0.7],
        ];
        let at = t;
        for (const [f, d] of seq) {
          this.tone(f, at, d * 1.6, 'triangle', 0.16);
          this.tone(f / 2, at, d * 1.4, 'sine', 0.08);
          at += d;
        }
        break;
      }
    }
  }

  /** The tiptoe tune, looped softly. */
  startMusic() {
    this.musicOn = true;
    const ctx = this.ensure();
    if (!ctx || this.timer) return;
    const beat = 0.36;
    const loop = () => {
      if (!this.ctx || !this.musicOn) return;
      let at = this.ctx.currentTime + 0.1;
      for (const [b, m, beats] of TUNE) {
        // Pizzicato bass and a music-box melody.
        this.tone(N[b], at, 0.32, 'triangle', 0.14, this.music!);
        if (m) this.tone(N[m] * 2, at, Math.max(0.3, beats * beat * 1.2), 'sine', 0.045, this.music!);
        at += beats * beat;
      }
      this.timer = window.setTimeout(loop, (at - this.ctx.currentTime + 1.2) * 1000);
    };
    loop();
  }

  stopMusic() {
    this.musicOn = false;
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Pause everything (the tab is hidden). */
  suspend() {
    void this.ctx?.suspend();
  }
  resume() {
    if (this.ctx && !isMuted()) void this.ctx.resume();
  }

  dispose() {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
  }
}

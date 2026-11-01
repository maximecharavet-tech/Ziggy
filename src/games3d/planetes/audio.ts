import { isMuted } from '@/lib/sound';

/**
 * Little synthesised space sounds and a soft, original music-box lullaby
 * (written for this game), all in Web Audio: nothing to download, quiet by
 * default, silent when the site is muted. Never a buzzer: a wrong address is
 * a cartoon "boing".
 */

const PENTA = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 784];
// An original lullaby on the pentatonic scale: [degree, beats].
const TUNE: [number, number][] = [
  [4, 1], [5, 1], [7, 2], [5, 1], [4, 1], [2, 2],
  [3, 1], [4, 1], [5, 1], [4, 1], [2, 3], [-1, 1],
  [4, 1], [5, 1], [7, 2], [8, 1], [7, 1], [5, 2],
  [4, 1], [2, 1], [3, 1], [1, 1], [0, 3], [-1, 1],
];
const BASS = [130.81, 98, 110, 87.31];

export class SpaceAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
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
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, at: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    o.connect(g);
    g.connect(this.master!);
    o.start(at);
    o.stop(at + dur + 0.03);
  }

  private noise(at: number, dur: number, vol: number, f0: number, f1: number, q = 1.2) {
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
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, at);
    f.frequency.exponentialRampToValueAtTime(f1, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master!);
    src.start(at);
    src.stop(at + dur + 0.05);
  }

  play(kind: 'pick' | 'whoosh' | 'boing' | 'land' | 'deliver' | 'star' | 'sneeze' | 'stamp' | 'pop' | 'open' | 'peek' | 'takeoff') {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    switch (kind) {
      case 'pick':
        [PENTA[5], PENTA[7]].forEach((f, i) => this.tone(f, t + i * 0.07, 0.45, 'triangle', 0.22));
        break;
      case 'peek':
        this.tone(PENTA[6], t, 0.3, 'sine', 0.16);
        break;
      case 'whoosh':
        this.noise(t, 1.1, 0.18, 300, 2400, 0.8);
        break;
      case 'takeoff':
        this.noise(t, 1.6, 0.22, 180, 1600, 0.7);
        this.tone(110, t, 1.2, 'sine', 0.12, 330);
        break;
      case 'boing':
        this.tone(320, t, 0.18, 'sine', 0.2, 520);
        this.tone(520, t + 0.17, 0.35, 'sine', 0.18, 240);
        break;
      case 'land':
        this.tone(140, t, 0.35, 'sine', 0.28, 60);
        this.noise(t, 0.4, 0.12, 400, 120);
        break;
      case 'deliver':
        [PENTA[3], PENTA[5], PENTA[7]].forEach((f, i) => this.tone(f, t + i * 0.1, 0.7, 'triangle', 0.22));
        break;
      case 'star':
        [PENTA[5], PENTA[6], PENTA[7], PENTA[8]].forEach((f, i) => this.tone(f, t + i * 0.11, 1.1, 'sine', 0.2));
        break;
      case 'sneeze':
        // "A… a…" rising, then "TCHOUM" (a burst of noise and a little bell).
        this.tone(330, t, 0.35, 'triangle', 0.1, 440);
        this.tone(392, t + 0.45, 0.4, 'triangle', 0.12, 560);
        this.noise(t + 0.95, 0.35, 0.3, 2400, 600, 0.6);
        [PENTA[7], PENTA[8]].forEach((f, i) => this.tone(f, t + 1.0 + i * 0.08, 0.6, 'sine', 0.14));
        break;
      case 'stamp':
        this.noise(t, 0.12, 0.35, 900, 200, 0.9);
        this.tone(180, t, 0.18, 'sine', 0.22, 90);
        break;
      case 'pop':
        this.tone(PENTA[4] * 2, t, 0.12, 'sine', 0.2, PENTA[6] * 2);
        break;
      case 'open':
        this.noise(t, 0.25, 0.12, 1800, 4000, 1.5);
        [PENTA[4], PENTA[6], PENTA[8]].forEach((f, i) => this.tone(f, t + 0.1 + i * 0.07, 0.6, 'triangle', 0.16));
        break;
    }
  }

  /** A soft lullaby with a slow bass, looped. */
  startMusic() {
    this.musicOn = true;
    const ctx = this.ensure();
    if (!ctx || this.musicTimer) return;
    const beat = 0.42;
    const play = () => {
      if (!this.ctx || !this.musicOn) return;
      let at = this.ctx.currentTime + 0.1;
      const start = at;
      TUNE.forEach(([deg, b]) => {
        if (deg >= 0) this.tone(PENTA[deg] * 2, at, Math.max(0.4, b * beat * 1.5), 'sine', 0.045);
        at += b * beat;
      });
      const bar = (at - start) / BASS.length;
      BASS.forEach((f, i) => this.tone(f, start + i * bar, bar * 1.1, 'triangle', 0.035));
      this.musicTimer = window.setTimeout(play, (at - this.ctx.currentTime + 2.5) * 1000);
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
    if (on) void this.ctx.suspend();
    else if (!isMuted()) void this.ctx.resume();
  }

  dispose() {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
  }
}

import { isMuted } from '@/lib/sound';

/**
 * The dig site's sounds, all synthesised with Web Audio (nothing to
 * download): brush scrapes, bone "tocs", marimba chimes, a soft boing, the
 * tiniest friendly roar, a sneeze, munching, the photo click, and a light
 * original marimba tune. Quiet by default, silent when the site is muted.
 */

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

// An original little tune in C major pentatonic: [midi note, beats], 0 = rest.
const TUNE: [number, number][] = [
  [72, 1], [76, 1], [79, 1], [76, 1], [81, 1.5], [79, 0.5], [76, 1],
  [74, 1], [76, 1], [72, 1], [69, 1], [72, 2], [0, 1],
  [72, 1], [74, 1], [76, 1], [79, 1], [81, 1], [84, 1], [81, 1], [79, 1],
  [76, 1], [74, 1], [72, 1], [74, 1], [72, 2], [0, 2],
];
const BASS = [48, 43, 45, 41, 48, 43, 41, 43];

export class DinoAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private lastScrape = 0;
  musicOn = true;

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined' || isMuted()) return null;
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
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private noise(): AudioBuffer {
    const ctx = this.ctx!;
    if (this.noiseBuf) return this.noiseBuf;
    const len = Math.floor(ctx.sampleRate * 1.2);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = b;
    return b;
  }

  private tone(freq: number, at: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur * 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    o.connect(g);
    g.connect(this.master!);
    o.start(at);
    o.stop(at + dur + 0.03);
  }

  /** A marimba-ish note: a sine with a quick, bright overtone. */
  private mallet(freq: number, at: number, vol = 0.2, dur = 0.6) {
    this.tone(freq, at, dur, 'sine', vol);
    this.tone(freq * 4, at, 0.08, 'sine', vol * 0.25);
  }

  private hiss(at: number, dur: number, vol: number, f0: number, f1: number, q = 1.2, type: BiquadFilterType = 'bandpass') {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, at);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + Math.min(0.03, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master!);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.05);
  }

  /** The brush in the sand (throttled: many pointer moves make one soft "shhh"). */
  scrape() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    if (t - this.lastScrape < 0.09) return;
    this.lastScrape = t;
    this.hiss(t, 0.12, 0.09, 3200 + Math.random() * 1500, 1800, 0.8);
  }

  /** A bone comes out of the sand. */
  found(n: number) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const base = [72, 74, 76, 79, 81, 84, 86][Math.min(6, Math.max(0, n - 1))];
    [base, base + 7, base + 12].forEach((m, i) => this.mallet(midi(m), t + i * 0.08, 0.2, 0.7));
  }

  pick() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(660, t, 0.12, 'triangle', 0.14, 990);
  }

  /** The bone clicks into place: a woody "toc" and a chime. */
  clack() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(880, t, 0.09, 'square', 0.06, 440);
    this.hiss(t, 0.05, 0.12, 2500, 1500, 3);
    [79, 84].forEach((m, i) => this.mallet(midi(m), t + 0.06 + i * 0.08, 0.18));
  }

  /** A soft "boing" while a bone wiggles, never a buzzer. */
  wiggle() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(300, t);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 9;
    const lg = ctx.createGain();
    lg.gain.value = 40;
    lfo.connect(lg);
    lg.connect(o.frequency);
    o.frequency.exponentialRampToValueAtTime(220, t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.13, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g);
    g.connect(this.master!);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.52);
    lfo.stop(t + 0.52);
  }

  turn() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(520, t, 0.14, 'triangle', 0.1, 700);
  }

  /** Magic: the skeleton gets its colours. */
  pouf() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.hiss(t, 0.6, 0.12, 600, 5000, 0.7);
    [72, 76, 79, 84, 88, 91].forEach((m, i) => this.mallet(midi(m), t + 0.1 + i * 0.06, 0.13, 0.5));
  }

  /** The tiniest, friendliest roar: a warm "rrrawr" that ends in a little squeak. */
  roar() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(140, t);
    o.frequency.linearRampToValueAtTime(210, t + 0.35);
    o.frequency.linearRampToValueAtTime(170, t + 0.75);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.95);
    const trem = ctx.createOscillator();
    trem.frequency.value = 24;
    const tg = ctx.createGain();
    tg.gain.value = 18;
    trem.connect(tg);
    tg.connect(o.frequency);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(500, t);
    f.frequency.linearRampToValueAtTime(1400, t + 0.4);
    f.frequency.linearRampToValueAtTime(900, t + 0.95);
    f.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.08);
    g.gain.setValueAtTime(0.16, t + 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    o.connect(f);
    f.connect(g);
    g.connect(this.master!);
    o.start(t);
    trem.start(t);
    o.stop(t + 1.05);
    trem.stop(t + 1.05);
    this.hiss(t, 0.8, 0.05, 900, 600, 1);
  }

  /** "Ah… ah… achoo!" */
  sneeze() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(330, t, 0.35, 'triangle', 0.1, 440);
    this.tone(370, t + 0.5, 0.4, 'triangle', 0.11, 520);
    this.hiss(t + 1.0, 0.5, 0.28, 5000, 700, 0.6);
    this.tone(620, t + 1.0, 0.18, 'triangle', 0.12, 260);
  }

  munch() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 4; i++) this.hiss(t + i * 0.16, 0.08, 0.16, 1800, 900, 2);
  }

  /** One of the Stegosaurus's plates, played like a xylophone bar. */
  note(i: number) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const scale = [72, 74, 76, 79, 81, 84, 86, 88];
    this.mallet(midi(scale[((i % scale.length) + scale.length) % scale.length]), t, 0.22, 0.8);
  }

  oops() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(330, t, 0.3, 'sine', 0.13, 220);
  }

  /** Success: a rising arpeggio. */
  star() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    [72, 76, 79, 84].forEach((m, i) => this.mallet(midi(m), t + i * 0.11, 0.2, 1.0));
  }

  /** Camera shutter. */
  click() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.hiss(t, 0.05, 0.25, 4000, 3000, 1, 'highpass');
    this.hiss(t + 0.09, 0.06, 0.2, 3500, 2500, 1, 'highpass');
  }

  /** A soft whoosh (Ziggy flying, a bone flying). */
  whoosh() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.hiss(t, 0.5, 0.1, 400, 2400, 0.9);
  }

  startMusic() {
    this.musicOn = true;
    const ctx = this.ensure();
    if (!ctx || this.musicTimer) return;
    const beat = 0.3;
    const play = () => {
      if (!this.ctx || !this.musicOn) return;
      let at = this.ctx.currentTime + 0.1;
      let bar = 0;
      let inBar = 0;
      for (const [n, b] of TUNE) {
        if (n) this.mallet(midi(n), at, 0.05, Math.max(0.35, b * beat * 1.4));
        if (inBar === 0) this.tone(midi(BASS[bar % BASS.length]), at, beat * 3.5, 'triangle', 0.045);
        inBar += b;
        if (inBar >= 4) {
          inBar -= 4;
          bar++;
        }
        at += b * beat;
      }
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
    if (on) void this.ctx.suspend().catch(() => {});
    else void this.ctx.resume().catch(() => {});
  }

  dispose() {
    this.stopMusic();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}

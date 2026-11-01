import { isMuted } from '@/lib/sound';

/**
 * Little synthesised sounds and a soft music-box Christmas tune
 * ("Jingle Bells", J. L. Pierpont, 1857 — public domain), all in Web Audio:
 * nothing to download, quiet by default, silent when the site is muted.
 */
const NOTE: Record<string, number> = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99 };

// Melody of the chorus: [note, beats]
const JINGLE: [string, number][] = [
  ['E4', 1], ['E4', 1], ['E4', 2], ['E4', 1], ['E4', 1], ['E4', 2],
  ['E4', 1], ['G4', 1], ['C4', 1.5], ['D4', 0.5], ['E4', 4],
  ['F4', 1], ['F4', 1], ['F4', 1.5], ['F4', 0.5], ['F4', 1], ['E4', 1], ['E4', 1], ['E4', 0.5], ['E4', 0.5],
  ['E4', 1], ['D4', 1], ['D4', 1], ['E4', 1], ['D4', 2], ['G4', 2],
];

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicTimer: number | null = null;
  musicOn = true;

  private ensure(): AudioContext | null {
    if (isMuted()) return null;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, at: number, dur: number, type: OscillatorType, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    o.connect(g);
    g.connect(this.master!);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  /** Bell-like chime (pick up, success). */
  chime(kind: 'pick' | 'deliver' | 'oops' | 'star') {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    if (kind === 'pick') [NOTE.C5, NOTE.E5].forEach((f, i) => this.tone(f, t + i * 0.07, 0.5, 'triangle', 0.25));
    if (kind === 'deliver') [NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) => this.tone(f, t + i * 0.1, 0.8, 'triangle', 0.25));
    if (kind === 'star') [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C5 * 2].forEach((f, i) => this.tone(f, t + i * 0.12, 1.2, 'sine', 0.22));
    // A soft "boing", never a buzzer.
    if (kind === 'oops') {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(330, t);
      o.frequency.exponentialRampToValueAtTime(220, t + 0.25);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g);
      g.connect(this.master!);
      o.start(t);
      o.stop(t + 0.32);
    }
  }

  /** Loop the tune softly, as a music box with a little bell on the beat. */
  startMusic() {
    this.musicOn = true;
    const ctx = this.ensure();
    if (!ctx || this.musicTimer) return;
    const beat = 0.34;
    const play = () => {
      if (!this.ctx || !this.musicOn) return;
      let at = this.ctx.currentTime + 0.1;
      for (const [n, b] of JINGLE) {
        this.tone(NOTE[n] * 2, at, Math.max(0.35, b * beat * 1.6), 'triangle', 0.07);
        at += b * beat;
      }
      this.musicTimer = window.setTimeout(play, (at - this.ctx.currentTime + 3.5) * 1000);
    };
    play();
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }

  dispose() {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
  }
}

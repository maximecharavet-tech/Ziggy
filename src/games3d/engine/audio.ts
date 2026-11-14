import { GameAudio } from '../kit/music';
import { isMuted, MUTE_EVENT } from '@/lib/sound';
import { unlockAudio } from '@/lib/voice';

/**
 * Thin audio layer over the kit's synthesised music / SFX (`GameAudio`, or
 * any object with the same shape, e.g. a game's own synth like PizzaAudio):
 *
 * - honours the site mute (`isMuted()` + the `ziggy:muted` event): muting
 *   stops the music at once, unmuting brings it back if it was wanted;
 * - nothing plays before the first user gesture (pointer / key / touch on
 *   the page), then it unlocks Web Audio and the voice player (`unlockAudio`);
 * - the child's music toggle is separate from the site mute.
 *
 * No files, no network: everything is synthesised (zero running cost).
 */

export interface SfxBackend<S extends string = string> {
  play(name: S): void;
  startMusic?(): void;
  stopMusic?(): void;
  dispose?(): void;
}

export type KitSfx = 'pick' | 'deliver' | 'oops' | 'star';

/** The kit's GameAudio as a backend (chimes + the music-box tune). */
export function kitBackend(audio = new GameAudio()): SfxBackend<KitSfx> {
  return {
    play: (n) => audio.chime(n),
    startMusic: () => audio.startMusic(),
    stopMusic: () => audio.stopMusic(),
    dispose: () => audio.dispose(),
  };
}

export class EngineAudio<S extends string = KitSfx> {
  private unlocked = false;
  private wantMusic = false;
  private playing = false;
  private disposed = false;

  constructor(private backend: SfxBackend<S>) {
    if (typeof window === 'undefined') return;
    window.addEventListener('pointerdown', this.onGesture, { capture: true });
    window.addEventListener('keydown', this.onGesture, { capture: true });
    window.addEventListener('touchend', this.onGesture, { capture: true });
    window.addEventListener(MUTE_EVENT, this.onMute);
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  /** Muted by the site setting. */
  get muted(): boolean {
    return isMuted();
  }

  /** A sound effect (ignored while muted or before the first gesture). */
  sfx(name: S): void {
    if (this.disposed || !this.unlocked || isMuted()) return;
    try {
      this.backend.play(name);
    } catch {
      /* audio is never worth a crash */
    }
  }

  /** The child's music toggle. */
  music(on: boolean): void {
    this.wantMusic = on;
    this.sync();
  }

  /** Call when the game pauses (hidden tab, pause menu) / resumes. */
  suspend(paused: boolean): void {
    if (paused) this.stop();
    else this.sync();
  }

  /** Mark the audio unlocked now (call from a "Play" button handler). */
  unlock(): void {
    if (this.unlocked || this.disposed) return;
    this.unlocked = true;
    try {
      unlockAudio();
    } catch {
      /* ignore */
    }
    this.removeGestureListeners();
    this.sync();
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
    this.removeGestureListeners();
    if (typeof window !== 'undefined') window.removeEventListener(MUTE_EVENT, this.onMute);
    this.backend.dispose?.();
  }

  private sync() {
    if (this.disposed) return;
    if (this.wantMusic && this.unlocked && !isMuted()) {
      if (!this.playing) {
        this.playing = true;
        this.backend.startMusic?.();
      }
    } else this.stop();
  }

  private stop() {
    if (!this.playing) return;
    this.playing = false;
    this.backend.stopMusic?.();
  }

  private onGesture = () => this.unlock();

  private onMute = () => this.sync();

  private removeGestureListeners() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('pointerdown', this.onGesture, { capture: true });
    window.removeEventListener('keydown', this.onGesture, { capture: true });
    window.removeEventListener('touchend', this.onGesture, { capture: true });
  }
}

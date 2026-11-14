import { createFaceAnimator, toElfMouth, toSantaTalk, toZiggyMouth, type FaceAnimator, type FaceFrame, type FaceInput, type ZiggyMouth } from '@/lib/face';

/**
 * Face hook: connects a `FaceAnimator` (src/lib/face: baked track or live web
 * fallback) to an actor's mouth each frame while a voice line plays, through
 * the existing adapters (`toElfMouth`, `toZiggyMouth`, `toSantaTalk`).
 * Emotions are happy-only by construction (the face module maps any unknown
 * or negative label to a happy one).
 *
 * Targets are structural, so this file needs no three.js:
 * - elf:   `ElfModel.setMouth(open 0..1)` (src/games3d/lutins/elf.ts)
 * - ziggy: `ZiggyRig.lipSync` (asked each frame for a mouth shape)
 * - santa: `setTalk(level 0..1)`
 */

export type FaceTarget =
  | { kind: 'elf'; elf: 'pepin' | 'grelotte' | 'noisette'; setMouth(open: number): void }
  | { kind: 'ziggy'; rig: { lipSync: (() => string | null) | null } }
  | { kind: 'santa'; setTalk(level: number): void };

export interface FaceLink {
  readonly animator: FaceAnimator;
  /** True between `speak()` and `silence()`. */
  readonly speaking: boolean;
  /** The last computed frame (HUD mirror, tests). */
  readonly frame: FaceFrame | null;
  /** A voice line starts: optionally with its baked face track (else live fallback). */
  speak(track?: unknown): void;
  /** The line ended: mouth back to rest. */
  silence(): void;
  /** Each frame: `time` = playback time of the line, `level` / `samples` = live audio. */
  update(dt: number, input?: Omit<FaceInput, 'dt'>): void;
  setEmotion(emotion: string, intensity?: number): void;
  cue(emotion: string, seconds?: number): void;
  dispose(): void;
}

class Link implements FaceLink {
  animator: FaceAnimator;
  speaking = false;
  frame: FaceFrame | null = null;
  private zMouth: ZiggyMouth | null = null;
  private emotion: { e: string; i: number } | null = null;

  constructor(
    private target: FaceTarget,
    animator?: FaceAnimator
  ) {
    this.animator = animator ?? createFaceAnimator();
    if (target.kind === 'ziggy') target.rig.lipSync = () => (this.speaking ? this.zMouth : null);
  }

  speak(track?: unknown) {
    if (track !== undefined) {
      this.animator = createFaceAnimator(track);
      if (this.emotion) this.animator.setEmotion(this.emotion.e, this.emotion.i);
    }
    this.speaking = true;
  }

  silence() {
    this.speaking = false;
    this.zMouth = null;
    const t = this.target;
    if (t.kind === 'elf') t.setMouth(0);
    else if (t.kind === 'santa') t.setTalk(0);
  }

  update(dt: number, input: Omit<FaceInput, 'dt'> = {}) {
    if (!this.speaking) return;
    const f = this.animator.update({ ...input, dt });
    this.frame = f;
    const t = this.target;
    if (t.kind === 'elf') t.setMouth(toElfMouth(f, t.elf));
    else if (t.kind === 'santa') t.setTalk(toSantaTalk(f));
    else this.zMouth = toZiggyMouth(f);
  }

  setEmotion(e: string, i = 1) {
    this.emotion = { e, i };
    this.animator.setEmotion(e, i);
  }

  cue(e: string, s?: number) {
    this.animator.cue(e, s);
  }

  dispose() {
    this.silence();
    if (this.target.kind === 'ziggy') this.target.rig.lipSync = null;
  }
}

/** Attach a face animator to an actor. */
export function attachFace(target: FaceTarget, animator?: FaceAnimator): FaceLink {
  return new Link(target, animator);
}

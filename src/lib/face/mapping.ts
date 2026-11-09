/**
 * FaceFrame → our characters' existing hooks. Pure functions: the character
 * files (src/games3d/santa, src/games3d/ziggy, src/games3d/lutins) are not
 * touched; a scene calls these and passes the result to the hook it already has.
 *
 * - Santa  `SantaSceneHandle.setTalk(level)` + `setExpression(e)`  → toSantaTalk / toSantaExpression
 * - Ziggy  `ZiggyStage.setLipSync(() => MouthShape)`                 → toZiggyMouth
 * - Elves  `setMouth(open)` (Pépin, Grelotte, Noisette)              → toElfMouth
 * - Any future morph-target face (glTF with ARKit names)             → toArkitWeights
 *
 * See src/lib/face/README.md for the per-character notes.
 */
import { clamp01 } from './features';
import type { ArkitName, FaceFrame } from './types';

export type CharacterId = 'santa' | 'ziggy' | 'pepin' | 'grelotte' | 'noisette';

export interface CharacterProfile {
  /** Multiplies the jaw before it reaches the hook. */
  jawGain: number;
  /** Mouth never opens less than this while voiced (keeps a hidden mouth readable). */
  minVoicedOpen: number;
  /** Extra opening added while laughing (felt mouths read laughs best as wide open). */
  laughOpen: number;
}

export const CHARACTER_PROFILES: Record<CharacterId, CharacterProfile> = {
  // The beard hides the lips: a bigger, simpler jaw reads better; the moustache follows the jaw.
  santa: { jawGain: 1.15, minVoicedOpen: 0.12, laughOpen: 0.35 },
  // Ziggy uses mouth shapes (textures), the jaw only picks between them.
  ziggy: { jawGain: 1, minVoicedOpen: 0, laughOpen: 0.2 },
  // Elves: one felt mouth decal that scales open. Noisette is the small one: a bit more gain.
  pepin: { jawGain: 1, minVoicedOpen: 0.08, laughOpen: 0.3 },
  grelotte: { jawGain: 1, minVoicedOpen: 0.08, laughOpen: 0.3 },
  noisette: { jawGain: 1.2, minVoicedOpen: 0.1, laughOpen: 0.3 },
};

function opening(frame: FaceFrame, p: CharacterProfile): number {
  const voiced = 1 - frame.visemes.rest;
  const base = clamp01(frame.jaw) * p.jawGain;
  const floor = voiced > 0.5 ? p.minVoicedOpen * voiced : 0;
  const laugh = frame.emotion.laugh * p.laughOpen * (0.5 + 0.5 * frame.expression.jawBias);
  return clamp01(Math.max(base, floor) + laugh * (1 - voiced));
}

/** Santa: the 0..1 level for `setTalk`. */
export function toSantaTalk(frame: FaceFrame): number {
  return opening(frame, CHARACTER_PROFILES.santa);
}

/** Santa's expressions (same union as SantaSceneHandle.setExpression, minus the gestures we don't infer). */
export type SantaExpression = 'idle' | 'laugh' | 'wave' | 'listen' | 'write' | 'wink';

/** Santa: the expression to show for the frame's dominant emotion (threshold 0.5). */
export function toSantaExpression(frame: FaceFrame): SantaExpression {
  const e = frame.emotion;
  if (e.laugh >= 0.5) return 'laugh';
  if (e.wink >= 0.5) return 'wink';
  if (e.listen >= 0.5) return 'listen';
  return 'idle';
}

/** Ziggy's mouth textures (same union as MouthShape in src/games3d/ziggy/face.ts, minus 'sleep'). */
export type ZiggyMouth = 'smile' | 'grin' | 'open' | 'o' | 'small';

/** Ziggy: the mouth shape for `setLipSync`. */
export function toZiggyMouth(frame: FaceFrame): ZiggyMouth {
  const v = frame.viseme;
  const quiet = frame.jaw < 0.08;
  if (v === 'rest' || (quiet && v !== 'MM' && v !== 'FF')) {
    return frame.emotion.laugh > 0.4 || frame.emotion.smile > 0.6 || frame.emotion.wink > 0.5 ? 'grin' : 'smile';
  }
  switch (v) {
    case 'AA':
      return 'open';
    case 'OO':
      return 'o';
    case 'EE':
      return 'grin';
    case 'MM':
    case 'FF':
      return 'small';
  }
}

/** Elves: the 0..1 value for `setMouth(open)`. */
export function toElfMouth(frame: FaceFrame, elf: 'pepin' | 'grelotte' | 'noisette'): number {
  const p = CHARACTER_PROFILES[elf];
  // A narrow "i" or a rounded "ou" opens the felt decal less than an "a".
  const shape = 1 - 0.3 * frame.visemes.EE - 0.2 * frame.visemes.OO - 0.6 * frame.visemes.MM;
  return clamp01(opening(frame, p) * shape);
}

/** ARKit blendshape weights for a morph-target face (never any frown). */
export function toArkitWeights(frame: FaceFrame): Partial<Record<ArkitName, number>> {
  const v = frame.visemes;
  const x = frame.expression;
  const smile = clamp01(x.smile * (1 - 0.6 * v.OO));
  return {
    jawOpen: clamp01(frame.jaw),
    mouthFunnel: clamp01(v.OO * 0.7),
    mouthPucker: clamp01(v.OO * 0.8),
    mouthClose: clamp01(v.MM * (1 - frame.jaw)),
    mouthPressLeft: clamp01(v.MM * 0.5),
    mouthPressRight: clamp01(v.MM * 0.5),
    mouthRollLower: clamp01(v.FF * 0.8),
    mouthStretchLeft: clamp01(v.EE * 0.6),
    mouthStretchRight: clamp01(v.EE * 0.6),
    mouthSmileLeft: smile,
    mouthSmileRight: smile,
    cheekSquintLeft: clamp01(x.cheek),
    cheekSquintRight: clamp01(x.cheek),
    browInnerUp: clamp01(x.browUp * 0.8),
    browOuterUpLeft: clamp01(x.browUp),
    browOuterUpRight: clamp01(x.browUp),
    eyeWideLeft: clamp01(x.eyeWide),
    eyeWideRight: clamp01(x.eyeWide),
    eyeBlinkLeft: clamp01(x.blinkL),
    eyeBlinkRight: clamp01(x.blinkR),
  };
}

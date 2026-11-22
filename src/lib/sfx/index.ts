/**
 * Ziggy's procedural sound effects (Web Audio only: no files, no running
 * cost, no licence). The site plays them through `playSound` in
 * `@/lib/sound`, which adds the mute, the soft-sounds preference, the user
 * gesture rule and the ducking under Ziggy's voice.
 */
export { SOUND_NAMES, SOUNDS, isSoundName, type SoundName, type SoundMeta } from './catalog';
export { SOUND_LABELS, GROUP_LABELS, type SoundGroup, type SoundLabel } from './labels';
export { SfxPlayer, startVoice, MAX_VOICES, type PlayOptions, type VoiceHandle } from './player';
export { createBus, type Bus } from './engine';

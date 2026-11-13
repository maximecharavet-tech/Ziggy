/**
 * Santa's pre-recorded voice (public/santa/voice/<locale>/<file>.mp3), made
 * offline and for free (voice-engine/santa_voice_v2: Kokoro-82M Apache-2.0 +
 * WORLD BSD for the old-man ageing and intonation). Every fixed clip is a static file; only the
 * child's first name (name:…) still goes to /api/santa/voice, then to the
 * device's own voice if that fails.
 */
import { SANTA_LINES } from './lines';
import { SANTA_GIFTS } from './gifts';
import { SANTA_PROUD } from './proud';
import { SANTA_ADVENT } from './advent';
import manifest from './voice-manifest.json';

export type SantaVoiceManifest = { voice: string; fr: Record<string, string>; en: Record<string, string> };
export const SANTA_VOICE = manifest as SantaVoiceManifest;

/** Every clip key whose words never change (all but the first names). */
export function staticClipKeys(): string[] {
  return [
    ...Object.keys(SANTA_LINES).map((id) => `line:${id}`),
    ...SANTA_GIFTS.map((g) => `gift:${g.id}`),
    ...SANTA_PROUD.map((p) => `proud:${p.id}`),
    ...Array.from({ length: 11 }, (_, i) => `age:${i + 2}`),
    ...SANTA_ADVENT.map((e) => `advent:${e.day}`),
  ];
}

/** `line:open.hear` → `line-open.hear` (file name without extension). */
export const clipFile = (key: string) => key.replace(/:/g, '-');

/**
 * The static file of a clip, or null when it has none (names, or not recorded yet).
 * `h` changes with the words, `v` with the voice recipe: the files are cached for
 * a week, so a new voice (santa-v2…) must change the URL even when the text did not.
 */
export function staticClipUrl(key: string, locale: 'fr' | 'en'): string | null {
  const hash = SANTA_VOICE[locale]?.[key];
  return hash
    ? `/santa/voice/${locale}/${clipFile(key)}.mp3?h=${hash}&v=${encodeURIComponent(SANTA_VOICE.voice)}`
    : null;
}

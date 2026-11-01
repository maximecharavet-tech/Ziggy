import 'server-only';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { DODO_STORIES } from '@/data/dodo';
import { parseTiming, voiceSummaryOf, type VoiceSummary } from '@/lib/dodo/player';
import { voiceLocale, type DodoVoiceTiming } from '@/lib/dodo/voice';

/**
 * Ziggy's recorded voice is a set of static files in public/dodo/voice
 * (see lib/dodo/voice.ts). The pages read the timings when they are built, so
 * the browser never asks for a recording that does not exist.
 *
 * null = not recorded (yet) · undefined = could not look (the page then fetches it).
 */
const ROOT = path.join(process.cwd(), 'public', 'dodo');

async function canLook(): Promise<boolean> {
  try {
    return (await stat(ROOT)).isDirectory();
  } catch {
    return false;
  }
}

export async function readVoiceTiming(locale: string, storyId: string): Promise<DodoVoiceTiming | null | undefined> {
  if (!/^[a-z0-9-]+$/i.test(storyId) || !(await canLook())) return undefined;
  try {
    const raw = await readFile(path.join(ROOT, 'voice', voiceLocale(locale), storyId, 'timing.json'), 'utf8');
    return parseTiming(JSON.parse(raw), storyId);
  } catch (e) {
    if (e instanceof SyntaxError || (e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    return undefined;
  }
}

/** Every recorded story of this language: its real length and its spoken title. */
export async function readVoiceSummary(locale: string): Promise<VoiceSummary | undefined> {
  if (!(await canLook())) return undefined;
  const out: VoiceSummary = {};
  for (const story of DODO_STORIES) {
    const timing = await readVoiceTiming(locale, story.id);
    if (timing === undefined) return undefined;
    if (timing) out[story.id] = voiceSummaryOf(story, locale, timing);
  }
  return out;
}

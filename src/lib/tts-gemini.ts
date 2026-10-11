import 'server-only';

/**
 * Ziggy's voice: Gemini text-to-speech (the Hyper™ AI Engine voice stack).
 * Shared by the live /api/tts route and Mode dodo's narration, which is
 * generated once per scene and stored.
 */
export const TTS_MODELS = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'];
const VOICE = 'Puck'; // upbeat, friendly — the same voice day and night, so it is always Ziggy

export type TtsStyle = 'ziggy' | 'bedtime';

const STYLES: Record<TtsStyle, string> = {
  ziggy:
    'You are Ziggy, a cheerful little plush robot talking to a young child. Speak warmly and playfully, clearly, a little slower than usual, with a smile in your voice.',
  bedtime:
    'You are Ziggy, a gentle little plush robot telling a bedtime story to a sleepy young child. Speak softly and slowly, warm and calm, close to a whisper but clear, with small pauses between sentences, getting even softer towards the end.',
};

/** Longest text per call: a live line, or a whole bedtime scene. */
export const MAX_CHARS: Record<TtsStyle, number> = { ziggy: 420, bedtime: 1200 };

/** Gemini returns raw 16-bit mono PCM; browsers want a WAV header around it. */
export function pcmToWav(pcm: Uint8Array, rate: number): Uint8Array {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const write = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  write(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  write(36, 'data');
  v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}

/** Emojis and markdown read aloud sound silly. */
export function speakable(text: string, style: TtsStyle = 'ziggy'): string {
  return text
    .replace(/[*_#`~>]/g, '')
    .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, MAX_CHARS[style]);
}

/** One WAV clip of `text` in Ziggy's voice, or null if Gemini is unavailable. */
export async function synthesize(key: string, text: string, style: TtsStyle = 'ziggy'): Promise<Uint8Array | null> {
  for (const model of TTS_MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${STYLES[style]}\nSay exactly this, in its own language, adding nothing:\n${text}` }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
        },
      }),
      signal: AbortSignal.timeout(style === 'bedtime' ? 55_000 : 30_000),
    });
    if (res.status === 404) continue;
    if (!res.ok) {
      console.warn(`[tts] ${model} ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
    };
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!part?.data) return null;
    const pcm = Buffer.from(part.data, 'base64');
    const rate = Number(part.mimeType?.match(/rate=(\d+)/)?.[1] ?? 24000);
    return pcmToWav(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), rate);
  }
  return null;
}

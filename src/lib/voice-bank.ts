import { bankLang, clipId, type BankLang, type BankStyle } from '@/lib/voice-key';
import { isPersonalText } from '@/lib/privacy/personal';

/**
 * Ziggy's voice bank: the site's fixed sentences, recorded offline in Ziggy's
 * own voice (scripts/voice-bake.mjs → public/voice). A sentence found here is
 * played from that file: it never goes to /api/tts.
 *
 * Privacy: the lookup runs on the device. The manifest is a plain list of
 * clip ids (no text) fetched once from this site; the sentence is hashed
 * locally (src/lib/voice-key.ts) and only a fixed sentence's file is then
 * requested, from this site too. A personal sentence (first name, typed
 * name, flagged line…) is never even hashed: it stays on the device voice.
 */

export type BankManifest = {
  v: number;
  ext: string;
  version: string;
  ziggy: Record<BankLang, string[]>;
  bedtime: Record<BankLang, string[]>;
};

type Bank = { ext: string; version: string; ids: Record<BankStyle, Record<BankLang, Set<string>>> };

export const BANK_MANIFEST_URL = '/voice/manifest.json';

let loading: Promise<Bank | null> | null = null;

/** Turn the manifest into sets for constant-time lookups (exported for tests). */
export function parseBank(m: BankManifest | null | undefined): Bank | null {
  if (!m || m.v !== 1 || typeof m.ext !== 'string') return null;
  const set = (x: unknown) => new Set(Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []);
  return {
    ext: m.ext,
    version: String(m.version ?? ''),
    ids: {
      ziggy: { fr: set(m.ziggy?.fr), en: set(m.ziggy?.en) },
      bedtime: { fr: set(m.bedtime?.fr), en: set(m.bedtime?.en) },
    },
  };
}

/** The manifest, loaded once per visit on first use (null when missing or offline without a copy). */
export function loadBank(): Promise<Bank | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  loading ??= fetch(BANK_MANIFEST_URL)
    .then((r) => (r.ok ? (r.json() as Promise<BankManifest>) : null))
    .then(parseBank)
    .catch(() => null);
  return loading;
}

/** Where a bank clip lives, given the parsed bank (exported for tests). */
export function clipUrlIn(bank: Bank | null, text: string, locale: string, style: BankStyle = 'ziggy'): string | null {
  if (!bank) return null;
  const lang = bankLang(locale);
  if (!lang) return null;
  const id = clipId(text, lang, style);
  if (!id || !bank.ids[style]?.[lang]?.has(id)) return null;
  return `/voice/${lang}/${id}.${bank.ext}${bank.version ? `?v=${bank.version}` : ''}`;
}

/**
 * The recorded clip for this sentence, or null (not a fixed sentence of the
 * site, another language, or personal: then the usual path speaks it).
 */
export async function bankClipUrl(text: string, locale: string, style: BankStyle = 'ziggy'): Promise<string | null> {
  if (!text.trim() || !bankLang(locale)) return null;
  // Personal words are never looked up, hashed or played from the bank.
  if (isPersonalText(text)) return null;
  return clipUrlIn(await loadBank(), text, locale, style);
}

/** For tests only. */
export function _resetBank() {
  loading = null;
}

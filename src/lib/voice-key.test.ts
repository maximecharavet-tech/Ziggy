import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { bankKey, bankLang, clipId, spokenText } from './voice-key';

describe('voice bank key', () => {
  it('says what the server voice would say: no emoji, no markdown marks', () => {
    expect(spokenText('  **Bravo** 🎉 tu as   gagné ! ⭐️ ')).toBe('Bravo tu as gagné !');
    expect(spokenText('👍🏽')).toBe('');
  });

  it('folds case, apostrophes, quotes and French typographic spaces', () => {
    expect(bankKey('« C’est   parti ! »')).toBe("c'est parti!");
    expect(bankKey('C’est parti !')).toBe("c'est parti!");
    expect(bankKey('"c\'est parti!"')).toBe("c'est parti!");
    expect(bankKey('Attends… — vite')).toBe('attends... - vite');
  });

  it('gives one stable id per sentence, language and style', () => {
    // Pinned: the bake script and the browser must keep hashing the same way.
    expect(clipId('Bravo !', 'fr')).toBe('1617983830df76');
    expect(clipId('bravo!', 'fr')).toBe(clipId('Bravo ! 🎉', 'fr'));
    expect(clipId('Bravo !', 'en')).not.toBe(clipId('Bravo !', 'fr'));
    expect(clipId('Bravo !', 'fr', 'bedtime')).not.toBe(clipId('Bravo !', 'fr'));
    expect(clipId('Bravo !', 'fr')).toMatch(/^[0-9a-f]{14}$/);
    expect(clipId('Bravo, Léo !', 'fr')).not.toBe(clipId('Bravo, Léa !', 'fr'));
  });

  it('has no id for a line with nothing to say', () => {
    expect(clipId('', 'fr')).toBeNull();
    expect(clipId(' 🎉 … ! ', 'fr')).toBeNull();
  });

  it('records French and English only', () => {
    expect(bankLang('fr')).toBe('fr');
    expect(bankLang('en')).toBe('en');
    expect(bankLang('es')).toBeNull();
    expect(bankLang('ar')).toBeNull();
  });
});

describe('the baked bank', () => {
  const root = process.cwd();
  const sentences = JSON.parse(fs.readFileSync(path.join(root, 'scripts/voice-bake/sentences.json'), 'utf8')) as { id: string; lang: 'fr' | 'en'; style: 'ziggy' | 'bedtime'; text: string }[];
  const manifestPath = path.join(root, 'public/voice/manifest.json');
  const manifest = fs.existsSync(manifestPath) ? (JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>) : null;

  it('ids in the sentence list are the ids the browser computes', () => {
    expect(sentences.length).toBeGreaterThan(100);
    for (const s of sentences) expect(clipId(s.text, s.lang, s.style), s.text).toBe(s.id);
  });

  it('never lists a personal-looking sentence (emails, phone numbers, "my name is")', () => {
    for (const s of sentences) expect(s.text).not.toMatch(/@\w|\b0[1-9](?:[\s.-]?\d{2}){4}\b|je m['’]appelle|my name is/i);
  });

  it('the manifest holds ids only (no text), each with its clip on disk', () => {
    if (!manifest) return;
    const known = new Set(sentences.map((s) => s.id));
    const raw = fs.readFileSync(manifestPath, 'utf8');
    expect(raw).not.toMatch(/[ é]/); // no sentence text in it
    for (const style of ['ziggy', 'bedtime'] as const) {
      for (const lang of ['fr', 'en'] as const) {
        const ids = (manifest[style] as Record<string, string[]>)[lang];
        for (const id of ids) {
          expect(known.has(id)).toBe(true);
          expect(fs.existsSync(path.join(root, 'public/voice', lang, `${id}.${manifest.ext}`))).toBe(true);
        }
      }
    }
  });
});

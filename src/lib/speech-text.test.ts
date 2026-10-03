import { describe, expect, it } from 'vitest';
import { clean, splitSentences, isNoise } from './speech-text';

describe('clean', () => {
  it('removes what should not be read aloud', () => {
    expect(clean('**Bravo** ⭐ ! Va sur https://x.fr et lis `ça`.')).toBe('Bravo ! Va sur et lis ça.');
    expect(clean('- un\n- deux')).toBe('un deux');
  });
});

describe('splitSentences', () => {
  it('cuts an answer into sentences', () => {
    expect(splitSentences('Bonjour mon ami ! Aujourd’hui on apprend les fractions. Prêt à jouer ?')).toEqual([
      'Bonjour mon ami !',
      'Aujourd’hui on apprend les fractions.',
      'Prêt à jouer ?',
    ]);
  });

  it('merges tiny pieces so the voice does not stutter', () => {
    expect(splitSentences('Oui ! Bien sûr. Voici comment faire une addition.')).toEqual([
      'Oui ! Bien sûr.',
      'Voici comment faire une addition.',
    ]);
    expect(splitSentences('Voici comment faire une addition. Ok !')).toEqual(['Voici comment faire une addition. Ok !']);
  });

  it('cuts a very long sentence at a comma', () => {
    const long = `${'un mot, '.repeat(40)}fin.`;
    const parts = splitSentences(long, 18, 120);
    expect(parts.length).toBeGreaterThan(2);
    expect(parts.every((p) => p.length <= 120)).toBe(true);
    expect(parts.join(' ').replace(/\s+/g, ' ')).toBe(long.trim());
  });

  it('handles CJK and Arabic full stops', () => {
    expect(splitSentences('こんにちは、ジギーだよ。いっしょに算数をしようね！', 4)).toHaveLength(2);
    expect(splitSentences('مرحبًا يا صديقي الصغير؟ لنتعلم الرياضيات معًا اليوم.', 8)).toHaveLength(2);
  });

  it('returns nothing for empty text', () => {
    expect(splitSentences('  ⭐ ')).toEqual([]);
  });
});

describe('isNoise', () => {
  it('ignores filler', () => {
    expect(isNoise(' … ')).toBe(true);
    expect(isNoise('a')).toBe(true);
    expect(isNoise('combien font 2 et 2')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { screenChildInput, screenAiOutput, blockedReply } from './child-safety';

const verdict = (text: string, locale = 'fr') => screenChildInput(text, locale).verdict;

describe('screenChildInput', () => {
  it('lets ordinary learning questions through, in any script', () => {
    expect(verdict('Combien font 7 fois 8 ?')).toBe('ok');
    expect(verdict('Comment marche une armée de robots ?')).toBe('ok'); // "arme" inside a word
    expect(verdict('J’aime le sanglier')).toBe('ok'); // "sang" inside a word
    expect(verdict('what is a skill', 'en')).toBe('ok'); // "kill" inside a word
    expect(verdict('2加3等于几', 'zh')).toBe('ok');
    expect(verdict('Wie funktioniert KI?', 'de')).toBe('ok');
    expect(verdict('The year 2024 had 365 days and 12 months', 'en')).toBe('ok');
  });

  it('keeps personal details away from the AI', () => {
    expect(verdict('mon email c’est leo@gmail.com')).toBe('personal');
    expect(verdict('mon numéro 06 12 34 56 78')).toBe('personal');
    expect(verdict('j’habite au 12 rue des Lilas')).toBe('personal');
    expect(verdict('mon mot de passe est soleil')).toBe('personal');
    expect(verdict('私のパスワードは1234', 'ja')).toBe('personal');
    expect(verdict('va sur www.exemple.com')).toBe('personal');
  });

  it('sends a child who may be at risk to a trusted adult', () => {
    expect(verdict('je veux mourir')).toBe('help');
    expect(verdict('On me frappe à l’école')).toBe('help');
    expect(verdict('I want to die', 'en')).toBe('help');
    expect(verdict('死にたいよ', 'ja')).toBe('help');
    expect(verdict('أريد أن أموت', 'ar')).toBe('help');
  });

  it('declines unsafe topics', () => {
    expect(verdict('c’est quoi le sexe')).toBe('unsafe');
    expect(verdict('how to make a bomb', 'en')).toBe('unsafe');
  });

  it('answers in the child’s language, English as fallback', () => {
    const fr = screenChildInput('je veux mourir', 'fr');
    const xx = screenChildInput('I want to die', 'xx');
    expect(fr.verdict === 'help' && fr.reply).toMatch(/119/);
    expect(xx.verdict === 'help' && xx.reply).toMatch(/trust/);
    expect(blockedReply('es')).toMatch(/adulto/);
  });
});

describe('screenAiOutput', () => {
  it('strips links, emails and phone numbers', () => {
    const out = screenAiOutput('Va sur https://evil.com ou écris à a@b.co, appelle le 01 23 45 67 89 ⭐');
    expect(out).not.toMatch(/https?:|@|\d{2} \d{2}/);
    expect(out).toContain('⭐');
  });
});

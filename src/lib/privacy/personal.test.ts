import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetPersonal,
  collectStoredPersonal,
  findTokens,
  fold,
  hasContactData,
  isPersonalText,
  markPersonal,
  obviousPersonalData,
  personalTokens,
  redactPersonal,
  registerPersonal,
  tokenOf,
} from './personal';

/** A tiny localStorage stand-in. */
const store = (data: Record<string, unknown>) => ({
  getItem: (k: string) => (k in data ? JSON.stringify(data[k]) : null),
});
const empty = store({});

describe('personal words: matching', () => {
  it('folds case, accents and apostrophes', () => {
    expect(fold('Léa-Chloé')).toBe('lea-chloe');
    expect(fold('ÉLOÏSE')).toBe('eloise');
    expect(fold('l’atelier')).toBe("l'atelier");
  });

  it('keeps useful tokens and drops stop words and junk', () => {
    expect(tokenOf('  Léa  ')).toBe('lea');
    expect(tokenOf('Marie Lou')).toBe('marie lou');
    expect(tokenOf('le')).toBeNull();
    expect(tokenOf('Ziggy')).toBeNull();
    expect(tokenOf('x')).toBeNull();
    expect(tokenOf('1234')).toBeNull();
    expect(tokenOf(42)).toBeNull();
  });

  it('finds whole words only, whatever the case or accents', () => {
    expect(findTokens('Bonjour LÉA !', ['lea'])).toEqual([[8, 11]]);
    expect(findTokens('Bravo Lea, tu as gagné', ['lea'])).toHaveLength(1);
    expect(findTokens('Une idée géniale', ['lea'])).toEqual([]); // "géniale" / "idée" are not "lea"
    expect(findTokens('Cléa est là', ['lea'])).toEqual([]);
    expect(findTokens("C'est l'heure, Léo-Paul !", ['leo-paul'])).toHaveLength(1);
  });
});

describe('personal words: obvious data', () => {
  it('sees emails, phone numbers and street addresses', () => {
    expect(hasContactData('écris à papa@exemple.fr')).toBe(true);
    expect(hasContactData('mon numéro 06 12 34 56 78')).toBe(true);
    expect(hasContactData('call +44 20 7946 0958')).toBe(true);
    expect(hasContactData('(555) 123-4567')).toBe(true);
    expect(hasContactData("j'habite au 12 rue des Lilas")).toBe(true);
    expect(hasContactData('I live at 221 Baker Street')).toBe(true);
  });

  it('leaves game sentences alone', () => {
    for (const s of ['Combien font 12 + 30 ?', 'Compte : 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 !', 'Il est 18 h 30, le traîneau part.', 'Tu as 250 étoiles !', 'En 2026, Noël tombe un vendredi.']) {
      expect(hasContactData(s), s).toBe(false);
      expect(obviousPersonalData(s), s).toEqual([]);
    }
  });

  it('sees a child saying their name, but not the site characters', () => {
    expect(obviousPersonalData("Je m'appelle Inès").map((d) => d.value)).toEqual(['Inès']);
    expect(obviousPersonalData('my name is Leo and I am six').map((d) => d.value)).toEqual(['Leo']);
    expect(obviousPersonalData("Moi c'est Ziggy !")).toEqual([]);
    expect(obviousPersonalData('Je m’appelle Pépin')).toEqual([]);
  });
});

describe('personal words: the registry', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
    _resetPersonal();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    _resetPersonal();
  });

  it('a registered first name keeps a line on the device', () => {
    expect(isPersonalText('Bonne nuit Léa, fais de beaux rêves.', empty)).toBe(false);
    registerPersonal('Léa');
    expect(isPersonalText('Bonne nuit LEA, fais de beaux rêves.', empty)).toBe(true);
    expect(isPersonalText('Bonne nuit, fais de beaux rêves.', empty)).toBe(false);
  });

  it('a flagged line stays on the device, even read inside a longer one', () => {
    const line = markPersonal('Coucou toi, petit lutin !');
    expect(line).toBe('Coucou toi, petit lutin !');
    expect(isPersonalText('Coucou toi, petit lutin !', empty)).toBe(true);
    expect(isPersonalText('Lettre. Coucou toi, petit lutin ! Bisous.', empty)).toBe(true);
    expect(isPersonalText('Bonjour tout le monde', empty)).toBe(false);
  });

  it('reads first names and creature names from the local stores', () => {
    const s = store({
      'ziggy:santa:v1': { children: [{ id: 'a', name: 'Noé' }, { id: 'b', name: 'Anaïs' }], activeChildId: 'a' },
      'ziggy:creatures:v1': [{ id: 'c1', name: 'Bloupi-Patatou' }, { id: 'c2', name: 'Le' }],
    });
    expect(collectStoredPersonal(s).sort()).toEqual(['anais', 'bloupi-patatou', 'noe']);
    expect(isPersonalText('Au revoir Noé !', s)).toBe(true);
    expect(isPersonalText('Bloupi-Patatou a faim.', s)).toBe(true);
    expect(isPersonalText('Le dragon a faim.', s)).toBe(false);
  });

  it('survives broken stores', () => {
    const bad = { getItem: () => '{not json' };
    expect(collectStoredPersonal(bad)).toEqual([]);
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(collectStoredPersonal(throwing)).toEqual([]);
  });

  it('redacts personal words before a text goes to an AI provider', () => {
    registerPersonal('Léa');
    expect(redactPersonal('Je veux que Léa voie les rennes', 'l’enfant', { storage: empty })).toBe('Je veux que l’enfant voie les rennes');
    expect(redactPersonal("je m'appelle Tom et mon mail est tom@x.fr", 'mon ami', { storage: empty })).toBe("je m'appelle mon ami et mon mail est mon ami");
    expect(redactPersonal('Bonjour Père Noël', 'mon ami', { storage: empty })).toBe('Bonjour Père Noël');
    expect(redactPersonal('LÉA et Lea', 'X', { storage: empty })).toBe('X et X');
  });

  it('takes extra tokens on the server, where there is no registry', () => {
    vi.unstubAllGlobals(); // server: no window
    registerPersonal('Zoé'); // ignored on the server
    expect(personalTokens(null)).toEqual([]);
    expect(redactPersonal('Zoé aime les rennes', 'mon ami', { extra: ['Zoé'] })).toBe('mon ami aime les rennes');
    expect(markPersonal('Coucou Zoé')).toBe('Coucou Zoé');
    expect(isPersonalText('Coucou Zoé', null)).toBe(false);
  });
});

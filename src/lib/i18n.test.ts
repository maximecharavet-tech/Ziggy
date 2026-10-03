import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IntlMessageFormat } from 'intl-messageformat';

const dir = join(__dirname, '../../messages');
const locales = readdirSync(dir).map((f) => f.replace('.json', ''));
type Node = string | number | boolean | Node[] | { [k: string]: Node };
type Tree = { [k: string]: Node };
const load = (l: string) => JSON.parse(readFileSync(join(dir, `${l}.json`), 'utf8')) as Tree;

/** Every string leaf, arrays (raw data such as quiz questions) included. */
function flatten(node: Node, prefix = ''): [string, string][] {
  if (typeof node === 'string') return [[prefix.slice(0, -1), node]];
  if (typeof node !== 'object' || node === null) return [];
  const entries = Array.isArray(node) ? node.map((v, i) => [String(i), v] as const) : Object.entries(node);
  return entries.flatMap(([k, v]) => flatten(v, `${prefix}${k}.`));
}

describe('translations', () => {
  const base = new Set(flatten(load('fr')).map(([k]) => k));

  it.each(locales)('%s has exactly the French keys', (locale) => {
    const keys = new Set(flatten(load(locale)).map(([k]) => k));
    expect([...base].filter((k) => !keys.has(k))).toEqual([]);
    expect([...keys].filter((k) => !base.has(k))).toEqual([]);
  });

  it.each(locales)('%s messages are valid ICU and render', (locale) => {
    // Any variable a message asks for gets a number (works for plurals and plain text).
    const values = new Proxy({}, { has: () => true, get: () => 2 }) as Record<string, number>;
    for (const [key, message] of flatten(load(locale))) {
      expect(() => new IntlMessageFormat(message, locale).format(values), `${locale}:${key}`).not.toThrow();
    }
  });
});

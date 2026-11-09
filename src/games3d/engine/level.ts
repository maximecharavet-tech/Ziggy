import { LEARNING_SKILLS, type LearningSkill } from '@/lib/learning/skills';
import { ASSET_ID_RE, isSemver } from '@/lib/assets/validate';
import type { L } from '@/lib/i18n-text';
import { checkL } from './i18n';

/**
 * Level data: the shared JSON envelope of every Ziggy game level/room, and a
 * hand-written validator (no dependency, same style as src/lib/assets/validate.ts).
 *
 * CHILD-SAFETY RED LINE, enforced by construction: a level that contains a
 * timer, lives, a fail / game-over condition, a score or a penalty — under
 * any key, at any depth, in any spelling (`timeLimit`, `time_limit`,
 * `maxLives`, `onFail`, `gameOver`…), or as a rule `kind` — is REJECTED.
 *
 * Each game validates its own band block with `validateBand` (the Factory
 * reference solution, the Chaos clue uniqueness…).
 */

export const LEVEL_SCHEMA = 'ziggy.level/1';
export const BANDS = ['little', 'middle', 'big'] as const;
export type Band = (typeof BANDS)[number];

export interface LevelEnvelope<B = unknown> {
  schema: typeof LEVEL_SCHEMA;
  /** 'lutin-chaos' | 'lutin-factory' | … */
  game: string;
  /** Unique, stable: `chaos.kitchen`. */
  id: string;
  /** Semver of the content. */
  version: string;
  title: L;
  /** Content pack ('winter', 'spring'…). */
  season?: string;
  /** Asset registry ids (src/data/assets/manifest.json). */
  assets: string[];
  skills: LearningSkill[];
  /** At least one band; each game defines its band block type. */
  bands: Partial<Record<Band, B>>;
}

export type LevelResult<B> = { ok: true; level: LevelEnvelope<B>; errors: [] } | { ok: false; errors: string[] };

export interface ValidateLevelOptions {
  /** Expected game id. */
  game?: string;
  /** Asset ids that exist (a Set, or a lookup). Omitted = only the id format is checked. */
  knownAssets?: ReadonlySet<string> | ((id: string) => boolean);
  /** The game's own checks of one band block; return error messages. */
  validateBand?: (band: unknown, name: Band, path: string) => string[];
}

// --- the red line --------------------------------------------------------

/** Words that may never name a field of a level (any depth). */
const FORBIDDEN_WORDS = new Set([
  'timer',
  'timers',
  'countdown',
  'deadline',
  'lives',
  'fail',
  'fails',
  'failed',
  'failure',
  'failures',
  'failing',
  'gameover',
  'score',
  'scores',
  'penalty',
  'penalties',
  'lose',
]);
/** Two-word names (camelCase / snake / kebab are split first). */
const FORBIDDEN_PAIRS = new Set(['time limit', 'time left', 'time remaining', 'time out', 'game over', 'max tries', 'max attempts', 'max mistakes', 'max errors', 'time attack', 'speed run', 'extra life', 'max life']);
/** Single tokens that are forbidden once glued (`timelimit`, `timeout`). */
const FORBIDDEN_GLUED = new Set(['timelimit', 'timeleft', 'timeout', 'gameover', 'maxtries', 'maxattempts', 'maxmistakes', 'timeattack', 'speedrun']);
/** Fields whose string value names a rule (checked against the same words). */
const RULE_KEYS = new Set(['kind', 'type', 'mechanic', 'rule', 'condition', 'mode']);

/** Split `timeLimitSec` / `time_limit` / `time-limit` / `TIMER` into lower-case words. */
export function words(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

/** Does this name (a key or a rule kind) express a timer, lives, failure or score? */
export function isForbiddenName(name: string): boolean {
  const w = words(name);
  if (FORBIDDEN_GLUED.has(w.join(''))) return true;
  for (let i = 0; i < w.length; i++) {
    if (FORBIDDEN_WORDS.has(w[i]) || FORBIDDEN_GLUED.has(w[i])) return true;
    if (i + 1 < w.length && FORBIDDEN_PAIRS.has(`${w[i]} ${w[i + 1]}`)) return true;
  }
  return false;
}

/** Every forbidden field (or rule value) anywhere in `x`, with its JSON path. */
export function findForbiddenFields(x: unknown, path = '$'): string[] {
  const out: string[] = [];
  const walk = (v: unknown, p: string) => {
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${p}[${i}]`));
      return;
    }
    if (!v || typeof v !== 'object') return;
    for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
      const cp = `${p}.${k}`;
      if (isForbiddenName(k)) out.push(`${cp}: forbidden field (no timer, lives, fail or score in a Ziggy level)`);
      if (RULE_KEYS.has(k) && typeof child === 'string' && isForbiddenName(child)) out.push(`${cp}: forbidden rule "${child}" (no timer, lives, fail or score in a Ziggy level)`);
      walk(child, cp);
    }
  };
  walk(x, path);
  return out;
}

// --- the envelope ---------------------------------------------------------

const ENVELOPE_KEYS = new Set(['$schema', 'schema', 'game', 'id', 'version', 'title', 'season', 'assets', 'skills', 'bands']);
const SKILLS = new Set<string>(LEARNING_SKILLS);
const GAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Validate a parsed level JSON. Errors are `path: message` strings. */
export function validateLevel<B = unknown>(x: unknown, opts: ValidateLevelOptions = {}): LevelResult<B> {
  const errors: string[] = findForbiddenFields(x);
  if (!x || typeof x !== 'object' || Array.isArray(x)) return { ok: false, errors: ['$: a level must be a JSON object', ...errors] };
  const o = x as Record<string, unknown>;

  for (const k of Object.keys(o)) if (!ENVELOPE_KEYS.has(k)) errors.push(`$.${k}: unknown field`);
  if (o.schema !== LEVEL_SCHEMA) errors.push(`$.schema: expected "${LEVEL_SCHEMA}"`);
  if (typeof o.game !== 'string' || !GAME_RE.test(o.game)) errors.push('$.game: expected a game id like "lutin-chaos"');
  else if (opts.game && o.game !== opts.game) errors.push(`$.game: expected "${opts.game}", got "${o.game}"`);
  if (typeof o.id !== 'string' || !ASSET_ID_RE.test(o.id)) errors.push('$.id: expected a stable dotted id like "chaos.kitchen"');
  if (!isSemver(o.version)) errors.push('$.version: expected a semver like "1.0.0"');
  errors.push(...checkL(o.title, '$.title'));
  if (o.season !== undefined && (typeof o.season !== 'string' || !GAME_RE.test(o.season))) errors.push('$.season: expected a pack id like "winter"');

  if (!Array.isArray(o.assets)) errors.push('$.assets: expected an array of asset ids');
  else {
    const seen = new Set<string>();
    o.assets.forEach((a, i) => {
      if (typeof a !== 'string' || !ASSET_ID_RE.test(a)) errors.push(`$.assets[${i}]: bad asset id`);
      else {
        if (seen.has(a)) errors.push(`$.assets[${i}]: duplicate "${a}"`);
        seen.add(a);
        const known = opts.knownAssets;
        if (known && !(typeof known === 'function' ? known(a) : known.has(a))) errors.push(`$.assets[${i}]: unknown asset "${a}"`);
      }
    });
  }

  if (!Array.isArray(o.skills) || o.skills.length === 0) errors.push('$.skills: expected at least one learning skill');
  else o.skills.forEach((s, i) => (typeof s === 'string' && SKILLS.has(s) ? null : errors.push(`$.skills[${i}]: unknown learning skill "${String(s)}"`)));

  if (!o.bands || typeof o.bands !== 'object' || Array.isArray(o.bands)) errors.push('$.bands: expected an object with little / middle / big');
  else {
    const entries = Object.entries(o.bands as Record<string, unknown>);
    if (!entries.length) errors.push('$.bands: at least one band');
    for (const [name, block] of entries) {
      const p = `$.bands.${name}`;
      if (!(BANDS as readonly string[]).includes(name)) {
        errors.push(`${p}: unknown band (little, middle, big)`);
        continue;
      }
      if (!block || typeof block !== 'object') {
        errors.push(`${p}: expected an object`);
        continue;
      }
      if (opts.validateBand) errors.push(...opts.validateBand(block, name as Band, p));
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, level: x as LevelEnvelope<B>, errors: [] };
}

/** Like `validateLevel`, but throws one readable error (dev-time loading). */
export function assertLevel<B = unknown>(x: unknown, opts: ValidateLevelOptions = {}): LevelEnvelope<B> {
  const r = validateLevel<B>(x, opts);
  if (!r.ok) throw new Error(`Invalid level:\n- ${r.errors.join('\n- ')}`);
  return r.level;
}

/** Unique ids helper for band validators (prank ids, hiding spots…). */
export function duplicateIds(list: readonly { id?: unknown }[], path: string): string[] {
  const seen = new Set<unknown>();
  const out: string[] = [];
  list.forEach((x, i) => {
    if (seen.has(x?.id)) out.push(`${path}[${i}].id: duplicate "${String(x?.id)}"`);
    seen.add(x?.id);
  });
  return out;
}

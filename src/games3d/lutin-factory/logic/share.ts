/**
 * Share codes for sandbox layouts (owner decision 2026-11-09: local
 * copy/paste only, no server). A code is compact, URL-safe, versioned and
 * checked on decode:
 *
 *   LF1.<base64url payload>.<checksum>
 *
 * payload = compact JSON [w, h, blocked, pieces], piece = [code, x, y, dir, dial?]
 * checksum = FNV-1a of the payload (catches typos and truncated pastes).
 *
 * Decoding never throws and never trusts the code: every machine, cell and
 * dial is validated by the same plug-in parsers as the game. Locks are not
 * shared (a shared layout is the child's own free workshop).
 */
import { DIRS, type Cell, type Layout, type Piece } from './types';
import { getMachine } from './machines/registry';
import { inGrid, key } from './grid';
import { fnv1a } from './simulator';

export const SHARE_VERSION = 'LF1';
export const SHARE_MAX_LENGTH = 4000;
export const SHARE_MAX_W = 16;
export const SHARE_MAX_H = 12;

/** Stable one-letter codes (never reuse a letter for another machine). */
const CODE: Record<string, string> = {
  belt: 'b',
  chute: 'c',
  shaper: 's',
  painter: 'p',
  mixer: 'm',
  assembler: 'a',
  counter: 'n',
  sorter: 'r',
  loop: 'l',
  stamper: 't',
  wrapper: 'w',
  arm: 'o',
  sack: 'k',
};
const MACHINE_OF: Record<string, string> = Object.fromEntries(Object.entries(CODE).map(([m, c]) => [c, m]));

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toBase64Url(ascii: string): string {
  let out = '';
  for (let i = 0; i < ascii.length; i += 3) {
    const a = ascii.charCodeAt(i);
    const b = i + 1 < ascii.length ? ascii.charCodeAt(i + 1) : 0;
    const c = i + 2 < ascii.length ? ascii.charCodeAt(i + 2) : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < ascii.length) out += B64[(n >> 6) & 63];
    if (i + 2 < ascii.length) out += B64[n & 63];
  }
  return out;
}

function fromBase64Url(s: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
  let out = '';
  for (let i = 0; i < s.length; i += 4) {
    const chunk = s.slice(i, i + 4);
    let n = 0;
    for (let j = 0; j < 4; j++) n = (n << 6) | (j < chunk.length ? B64.indexOf(chunk[j]) : 0);
    out += String.fromCharCode((n >> 16) & 255);
    if (chunk.length > 2) out += String.fromCharCode((n >> 8) & 255);
    if (chunk.length > 3) out += String.fromCharCode(n & 255);
  }
  return out;
}

const isAscii = (s: string) => /^[\x20-\x7e]*$/.test(s);

/** Layout → share code. Throws only on a layout the game itself could not build. */
export function encodeLayout(l: Layout): string {
  const pieces = [...l.pieces]
    .sort((a, b) => a.at[1] - b.at[1] || a.at[0] - b.at[0])
    .map((p) => {
      const code = CODE[p.machine];
      if (!code) throw new Error(`Machine "${p.machine}" has no share code`);
      const def = getMachine(p.machine);
      const dial = def?.dial.parse(p.dial ?? {}) ?? def?.dial.defaults ?? {};
      const isDefault = def && JSON.stringify(dial) === JSON.stringify(def.dial.defaults);
      const row: unknown[] = [code, p.at[0], p.at[1], DIRS.indexOf(p.dir)];
      if (!isDefault) row.push(dial);
      return row;
    });
  const json = JSON.stringify([l.w, l.h, (l.blocked ?? []).map((c) => [c[0], c[1]]), pieces]);
  if (!isAscii(json)) throw new Error('Layout contains non-ASCII text');
  const payload = toBase64Url(json);
  return `${SHARE_VERSION}.${payload}.${fnv1a(payload)}`;
}

export type DecodeResult = { ok: true; layout: Layout } | { ok: false; why: 'format' | 'version' | 'checksum' | 'content' };

const intIn = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** Share code → validated layout (or a reason, for a kind "this code got tangled" message). */
export function decodeLayout(code: unknown): DecodeResult {
  if (typeof code !== 'string') return { ok: false, why: 'format' };
  const s = code.trim();
  if (s.length === 0 || s.length > SHARE_MAX_LENGTH) return { ok: false, why: 'format' };
  const parts = s.split('.');
  if (parts.length !== 3) return { ok: false, why: 'format' };
  const [version, payload, sum] = parts;
  if (!/^LF\d+$/.test(version)) return { ok: false, why: 'format' };
  if (version !== SHARE_VERSION) return { ok: false, why: 'version' };
  if (fnv1a(payload) !== sum) return { ok: false, why: 'checksum' };
  const json = fromBase64Url(payload);
  if (json === null || !isAscii(json)) return { ok: false, why: 'format' };
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, why: 'format' };
  }
  if (!Array.isArray(data) || data.length !== 4) return { ok: false, why: 'content' };
  const [w, h, blockedRaw, piecesRaw] = data as unknown[];
  if (!intIn(w, 3, SHARE_MAX_W) || !intIn(h, 3, SHARE_MAX_H) || !Array.isArray(blockedRaw) || !Array.isArray(piecesRaw)) return { ok: false, why: 'content' };
  if (piecesRaw.length > w * h || blockedRaw.length > w * h) return { ok: false, why: 'content' };

  const blocked: Cell[] = [];
  const taken = new Set<string>();
  for (const c of blockedRaw) {
    if (!Array.isArray(c) || c.length !== 2 || !intIn(c[0], 0, w - 1) || !intIn(c[1], 0, h - 1)) return { ok: false, why: 'content' };
    const k = key([c[0], c[1]]);
    if (taken.has(k)) return { ok: false, why: 'content' };
    taken.add(k);
    blocked.push([c[0], c[1]]);
  }
  const pieces: Piece[] = [];
  for (const row of piecesRaw) {
    if (!Array.isArray(row) || row.length < 4 || row.length > 5) return { ok: false, why: 'content' };
    const [c, x, y, d, dialRaw] = row as unknown[];
    const machine = typeof c === 'string' ? MACHINE_OF[c] : undefined;
    const def = machine ? getMachine(machine) : undefined;
    if (!machine || !def || !intIn(x, 0, w - 1) || !intIn(y, 0, h - 1) || !intIn(d, 0, 3)) return { ok: false, why: 'content' };
    if (!inGrid({ w, h }, [x, y])) return { ok: false, why: 'content' };
    const k = key([x, y]);
    if (taken.has(k)) return { ok: false, why: 'content' };
    taken.add(k);
    const dial = row.length === 5 ? def.dial.parse(dialRaw) : def.dial.defaults;
    if (!dial) return { ok: false, why: 'content' };
    pieces.push({ machine, at: [x, y], dir: DIRS[d], dial });
  }
  return { ok: true, layout: { w, h, blocked, pieces } };
}

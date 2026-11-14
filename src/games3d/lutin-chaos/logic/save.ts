/**
 * Save model, device only (architecture §3.11). The logic never touches
 * storage: the runtime stores `serializeSave(save)` under `SAVE_KEY`
 * (localStorage) and reads it back with `parseSave` — which never throws:
 * unreadable data becomes a fresh save. Versioned with tested migrations.
 * Nothing here is ever sent anywhere.
 */
import type { SandboxLayout } from './sandbox';
import type { RoomResult, RoomSnapshot } from './session';
import { BANDS, ELF_IDS, isBand, type Band } from './types';

export const SAVE_VERSION = 1;
export const SAVE_KEY = `ziggy:game:lutin-chaos:v${SAVE_VERSION}`;

export interface RoomProgress {
  done: boolean;
  /** How many times the room was finished (seeds the replay remix). */
  plays: number;
  bands: Band[];
}

export interface AlbumPhoto {
  roomId: string;
  band: Band;
  seed: number;
}

export interface ChaosSave {
  v: 1;
  /** Per-device random salt for replay seeds (never derived from the child). */
  salt: number;
  rooms: Record<string, RoomProgress>;
  /** The room being played, saved after every prank. */
  current: RoomSnapshot | null;
  costumes: string[];
  /** Small permanent decoration the child chose per finished room. */
  decorations: Record<string, string>;
  album: AlbumPhoto[];
  sandbox: SandboxLayout[];
}

export const freshSave = (salt = 0): ChaosSave => ({ v: 1, salt: salt >>> 0, rooms: {}, current: null, costumes: [], decorations: {}, album: [], sandbox: [] });

const MAX_ALBUM = 60;
const MAX_LAYOUTS = 20;

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);
const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** v0 (prototype): `{ done: string[] }` → v1. */
const MIGRATIONS: Record<number, (old: Json) => Json> = {
  0: (old) => ({
    v: 1,
    salt: 0,
    rooms: Object.fromEntries(strArr(old.done).map((id) => [id, { done: true, plays: 1, bands: [] }])),
    current: null,
    costumes: [],
    decorations: {},
    album: [],
    sandbox: [],
  }),
};

function cleanSnapshot(v: unknown): RoomSnapshot | null {
  if (!isObj(v) || typeof v.roomId !== 'string' || !isBand(v.band) || typeof v.seed !== 'number') return null;
  return { roomId: v.roomId, band: v.band, seed: v.seed >>> 0, night: typeof v.night === 'string' ? v.night : null, fixed: strArr(v.fixed) };
}

function cleanLayout(v: unknown): SandboxLayout | null {
  if (!isObj(v) || typeof v.roomId !== 'string') return null;
  const elves: SandboxLayout['elves'] = {};
  if (isObj(v.elves)) for (const e of ELF_IDS) if (typeof v.elves[e] === 'string') elves[e] = v.elves[e] as string;
  const pranks = Array.isArray(v.pranks)
    ? v.pranks.filter((p): p is SandboxLayout['pranks'][number] => isObj(p) && typeof p.id === 'string' && typeof p.type === 'string' && isObj(p.params))
    : [];
  return { roomId: v.roomId, elves, pranks };
}

/** Keep only valid fields of a v1 object. */
function clean(o: Json): ChaosSave {
  const s = freshSave(typeof o.salt === 'number' ? o.salt : 0);
  if (isObj(o.rooms))
    for (const [id, r] of Object.entries(o.rooms))
      if (isObj(r)) s.rooms[id] = { done: r.done === true, plays: typeof r.plays === 'number' && r.plays >= 0 ? Math.floor(r.plays) : 0, bands: strArr(r.bands).filter(isBand) as Band[] };
  s.current = cleanSnapshot(o.current);
  s.costumes = [...new Set(strArr(o.costumes))];
  if (isObj(o.decorations)) for (const [k, v] of Object.entries(o.decorations)) if (typeof v === 'string') s.decorations[k] = v;
  s.album = (Array.isArray(o.album) ? o.album : [])
    .filter((a): a is AlbumPhoto => isObj(a) && typeof a.roomId === 'string' && isBand(a.band) && typeof a.seed === 'number')
    .slice(-MAX_ALBUM);
  s.sandbox = (Array.isArray(o.sandbox) ? o.sandbox : []).map(cleanLayout).filter((x): x is SandboxLayout => !!x).slice(-MAX_LAYOUTS);
  return s;
}

/** Read whatever is stored (old, broken, hand-edited) into a valid save. Never throws. */
export function parseSave(raw: string | null | undefined, freshSalt = 0): ChaosSave {
  if (!raw) return freshSave(freshSalt);
  try {
    let o: unknown = JSON.parse(raw);
    if (!isObj(o)) return freshSave(freshSalt);
    let v = typeof o.v === 'number' ? o.v : 0;
    while (v < SAVE_VERSION && MIGRATIONS[v]) {
      o = MIGRATIONS[v](o as Json);
      v = (o as Json).v as number;
    }
    if (v !== SAVE_VERSION) return freshSave(freshSalt);
    return clean(o as Json);
  } catch {
    return freshSave(freshSalt);
  }
}

export const serializeSave = (s: ChaosSave): string => JSON.stringify(s);

/** After every prank: remember where we are. */
export const saveProgress = (s: ChaosSave, snap: RoomSnapshot | null): ChaosSave => ({ ...s, current: snap });

/** Costume piece earned by finishing a room (learning progress, never time or visits). */
export const costumeFor = (roomId: string) => `costume.${roomId.replace(/^chaos\./, '')}`;

/** A room is finished: progress, album photo, costume piece. */
export function recordRoomDone(s: ChaosSave, result: RoomResult, seed: number): ChaosSave {
  const prev = s.rooms[result.roomId] ?? { done: false, plays: 0, bands: [] };
  const costume = costumeFor(result.roomId);
  return {
    ...s,
    current: null,
    rooms: { ...s.rooms, [result.roomId]: { done: true, plays: prev.plays + 1, bands: [...new Set([...prev.bands, result.band])] } },
    costumes: s.costumes.includes(costume) ? s.costumes : [...s.costumes, costume],
    album: [...s.album, { roomId: result.roomId, band: result.band, seed }].slice(-MAX_ALBUM),
  };
}

export const saveLayout = (s: ChaosSave, layout: SandboxLayout): ChaosSave => ({ ...s, sandbox: [...s.sandbox, layout].slice(-MAX_LAYOUTS) });

/**
 * Rooms open on the house map: every finished room, plus the next unfinished
 * ones so that 2–3 new rooms are always offered (never one locked path).
 * The Christmas Eve party (the finale room) opens after 8 rooms, or on
 * Christmas Eve itself (the runtime passes the date check).
 */
export function openRooms(s: ChaosSave, roomIds: readonly string[], opts: { christmasEve?: boolean } = {}): string[] {
  const finale = roomIds[roomIds.length - 1];
  const doneCount = roomIds.filter((id) => s.rooms[id]?.done).length;
  const open = new Set(roomIds.filter((id) => s.rooms[id]?.done));
  let fresh = 0;
  for (const id of roomIds.slice(0, -1)) {
    if (open.has(id)) continue;
    if (fresh >= 3) break;
    open.add(id);
    fresh++;
  }
  if (doneCount >= 8 || opts.christmasEve || fresh === 0) open.add(finale);
  return roomIds.filter((id) => open.has(id));
}

/** Which band to play: the World Memory band, as given by the runtime. */
export const bandOrDefault = (b: unknown): Band => (isBand(b) ? b : BANDS[0]);

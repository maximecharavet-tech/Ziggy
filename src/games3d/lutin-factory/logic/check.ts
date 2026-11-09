/**
 * The check gate (Ziggy): compares what reached the sacks with the letter.
 *
 * There is NO failure state: every delivered toy is either a match for the
 * letter or goes to the surprise shelf (the Catalogue) with a funny name.
 * The result says what matched, what is still to make, and one friendly
 * reason that points at the single step that differs ("This ball is blue:
 * which machine paints?"), with the elf on duty taking the blame.
 */
import type { Delivery, ElfId, L, Order, OrderSpec } from './types';
import { lookOf, lookOfSpec, phrase, surpriseName, type Look } from './names';
import { CHECK_TEXT, DIFF_QUESTION, ELF_BLAME, ELF_NAMES, fillL } from './texts';

export type DiffKey = 'toy' | 'color' | 'n' | 'sticker' | 'wrap' | 'material' | 'partColors' | 'bay' | 'order';

export interface Match {
  delivery: number;
  order: number;
  look: Look;
  name: L;
}

export interface ShelfToy {
  delivery: number;
  look: Look;
  /** Funny generated name for the shelf / Catalogue. */
  name: L;
  /** The order it was closest to, and what differs (empty when it is simply a bonus toy). */
  closest?: { order: number; differs: DiffKey[] };
  /** A matching toy made beyond the count of the letter. */
  bonus?: boolean;
}

export interface OrderProgress {
  order: number;
  made: number;
  wanted: number;
  /** Matching toys made beyond `wanted` (they are on the shelf). */
  extra: number;
  done: boolean;
}

export interface CheckResult {
  /** `done`: the letter is fulfilled. There is no other end state: only "keep building". */
  status: 'done' | 'in-progress' | 'not-started';
  complete: boolean;
  matched: Match[];
  shelf: ShelfToy[];
  progress: OrderProgress[];
  /** One friendly sentence (read aloud). */
  reason: L;
  /** What to look at next, if anything. */
  focus?: DiffKey;
  /** The elf on duty laughing it off (never the child). */
  blame?: L;
}

/** Which elf runs the machine behind each kind of difference. */
const BLAME_ELF: Record<DiffKey, ElfId> = {
  color: 'pepin',
  toy: 'grelotte',
  n: 'grelotte',
  sticker: 'noisette',
  wrap: 'noisette',
  material: 'pepin',
  partColors: 'pepin',
  bay: 'noisette',
  order: 'noisette',
};

/** Differences between a toy and what an order spec wants (empty = match). */
export function differences(look: Look, spec: OrderSpec): DiffKey[] {
  const out: DiffKey[] = [];
  if (spec.toy !== 'surprise' && look.toy !== spec.toy) out.push('toy');
  const p = spec.props ?? {};
  if (p.color !== undefined && look.color !== p.color) out.push('color');
  if (p.material !== undefined && look.material !== p.material) out.push('material');
  if (p.sticker !== undefined && (p.sticker === 'none' ? look.sticker !== undefined : look.sticker !== p.sticker)) out.push('sticker');
  if (p.wrap !== undefined && (p.wrap === 'none' ? look.wrap !== undefined : look.wrap !== p.wrap)) out.push('wrap');
  if (p.n !== undefined && look.n !== p.n && !out.includes('toy')) out.push('n');
  if (p.partColors !== undefined) {
    const pc = look.partColors;
    const ok = !!pc && pc.length > 0 && pc.every((c, i) => c === p.partColors![i % p.partColors!.length]);
    if (!ok) out.push('partColors');
  }
  return out;
}

const specsOf = (o: Order): OrderSpec[] => o.sequence ?? [{ toy: o.toy ?? 'surprise', props: o.props }];
const nextSpec = (o: Order, made: number): OrderSpec => {
  const s = specsOf(o);
  return s[made % s.length];
};

export function check(orders: readonly Order[], deliveries: readonly Delivery[]): CheckResult {
  const made = orders.map(() => 0);
  const extra = orders.map(() => 0);
  const matched: Match[] = [];
  const shelf: ShelfToy[] = [];

  deliveries.forEach((d, di) => {
    const look = lookOf(d.item);
    // 1. The first order (in letter order) that still needs exactly this.
    for (let oi = 0; oi < orders.length; oi++) {
      const o = orders[oi];
      if (made[oi] >= o.count) continue;
      if (o.bay !== undefined && d.bay !== o.bay) continue;
      if (differences(look, nextSpec(o, made[oi])).length === 0) {
        made[oi]++;
        matched.push({ delivery: di, order: oi, look, name: phrase(look, { article: 'indef' }) });
        return;
      }
    }
    // 2. A bonus: it matches an order that is already full.
    for (let oi = 0; oi < orders.length; oi++) {
      const o = orders[oi];
      if (made[oi] < o.count) continue;
      if (o.bay !== undefined && d.bay !== o.bay) continue;
      if (specsOf(o).some((s) => differences(look, s).length === 0)) {
        extra[oi]++;
        shelf.push({ delivery: di, look, name: surpriseName(d.item), bonus: true, closest: { order: oi, differs: [] } });
        return;
      }
    }
    // 3. A surprise: find the open order it is closest to and what differs.
    let best: { order: number; differs: DiffKey[] } | undefined;
    for (let oi = 0; oi < orders.length; oi++) {
      const o = orders[oi];
      if (made[oi] >= o.count) continue;
      let diffs = differences(look, nextSpec(o, made[oi]));
      if (diffs.length > 0 && o.sequence && o.sequence.some((s) => differences(look, s).length === 0)) diffs = ['order'];
      if (diffs.length === 0 && o.bay !== undefined && d.bay !== o.bay) diffs = ['bay'];
      if (!best || diffs.length < best.differs.length) best = { order: oi, differs: diffs };
    }
    shelf.push({ delivery: di, look, name: surpriseName(d.item), ...(best ? { closest: best } : {}) });
  });

  const progress: OrderProgress[] = orders.map((o, i) => ({ order: i, made: made[i], wanted: o.count, extra: extra[i], done: made[i] >= o.count }));
  const complete = progress.every((p, i) => p.done && !(orders[i].exact && p.extra > 0));

  const base = { complete, matched, shelf, progress };
  if (deliveries.length === 0) return { ...base, status: 'not-started', reason: CHECK_TEXT.notStarted };

  if (complete) {
    const n = shelf.length;
    const bonus = n === 0 ? null : n === 1 ? CHECK_TEXT.doneShelfOne : fillL(CHECK_TEXT.doneShelfMany, { fr: { n }, en: { n } });
    const reason = bonus ? { fr: `${CHECK_TEXT.done.fr} ${bonus.fr}`, en: `${CHECK_TEXT.done.en} ${bonus.en}` } : CHECK_TEXT.done;
    return { ...base, status: 'done', reason };
  }

  // Too many on a counting letter?
  const over = progress.find((p, i) => orders[i].exact && p.extra > 0);
  if (over) {
    const o = orders[over.order];
    const toys = phrase(lookOfSpec(nextSpec(o, 0)), { count: over.extra });
    return {
      ...base,
      status: 'in-progress',
      focus: 'n',
      reason: fillL(CHECK_TEXT.extra, { fr: { toys: toys.fr, count: o.count }, en: { toys: toys.en, count: o.count } }),
    };
  }

  // A surprise toy that differs from an open order: point at the one step.
  const surprise = shelf.find((s) => s.closest && s.closest.differs.length > 0 && !progress[s.closest.order].done);
  if (surprise && surprise.closest) {
    const o = orders[surprise.closest.order];
    const key = surprise.closest.differs[0];
    const made1 = phrase(surprise.look, { article: 'indef' });
    const wanted = phrase(lookOfSpec(nextSpec(o, made[surprise.closest.order])), { article: 'indef' });
    const elf = ELF_NAMES[BLAME_ELF[key]];
    let middle: L;
    if (key === 'bay') {
      const got = deliveries[surprise.delivery].bay ?? CHECK_TEXT.anyBay.fr;
      const gotEn = deliveries[surprise.delivery].bay ?? CHECK_TEXT.anyBay.en;
      middle = fillL(CHECK_TEXT.wrongBay, { fr: { got, want: o.bay ?? '' }, en: { got: gotEn, want: o.bay ?? '' } });
    } else {
      middle = fillL(CHECK_TEXT.wanted, { fr: { wanted: wanted.fr }, en: { wanted: wanted.en } });
    }
    const intro = fillL(CHECK_TEXT.surprise, { fr: { made: made1.fr }, en: { made: made1.en } });
    const q = DIFF_QUESTION[key];
    return {
      ...base,
      status: 'in-progress',
      focus: key,
      blame: fillL(ELF_BLAME[key], { fr: { elf: elf.fr }, en: { elf: elf.en } }),
      reason: { fr: `${intro.fr} ${middle.fr} ${q.fr}`, en: `${intro.en} ${middle.en} ${q.en}` },
    };
  }

  // Otherwise: what the letter is still waiting for.
  const open = progress.find((p) => !p.done) as OrderProgress;
  const o = orders[open.order];
  const left = open.wanted - open.made;
  const look = lookOfSpec(nextSpec(o, open.made));
  const reason =
    left === 1
      ? fillL(CHECK_TEXT.stillNeedOne, { fr: { toy: phrase(look).fr }, en: { toy: phrase(look).en } })
      : fillL(CHECK_TEXT.stillNeedMany, { fr: { toys: phrase(look, { count: left }).fr }, en: { toys: phrase(look, { count: left }).en } });
  return { ...base, status: 'in-progress', reason };
}

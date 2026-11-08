/**
 * Builds a guided call from the child's details: a list of steps the call
 * player runs (Santa speaks clips, listens for the child's answer on the
 * device, plays sound effects). Pure and deterministic for a given seed.
 */
import type { SantaChild, SantaSceneHandle } from './types';
import { giftById } from '@/data/santa/gifts';
import { proudById } from '@/data/santa/proud';

export type CallKind = 'liste' | 'nouvelles' | 'veille' | 'message';
export type Expression = Parameters<SantaSceneHandle['setExpression']>[0];

export type CallStep =
  | { t: 'say'; clips: string[]; expr?: Expression }
  | { t: 'listen'; ms: number }
  | { t: 'sfx'; id: 'bells' | 'reindeer' }
  | { t: 'ai' }
  | { t: 'end'; reason: 'done' | 'preview' };

export const CALL_KINDS: CallKind[] = ['liste', 'nouvelles', 'veille'];

const line = (id: string) => `line:${id}`;
const say = (ids: string[], expr?: Expression): CallStep => ({ t: 'say', clips: ids, expr });
const listen = (ms = 6000): CallStep => ({ t: 'listen', ms });

function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** A different generic reaction each time (no immediate repeat). */
function reactions(seed: number) {
  const next = rand(seed);
  const pool = [1, 2, 3, 4, 5, 6];
  let last = 0;
  return () => {
    let n = pool[Math.floor(next() * pool.length)];
    if (n === last) n = (n % pool.length) + 1;
    last = n;
    return line(`react.${n}`);
  };
}

function nameClip(child: SantaChild, variant: 'hello' | 'bye' | 'plain') {
  return `name:${variant}:${child.name}`;
}

/** The child's wishes Santa reads out (up to 3, known gifts only). */
export function spokenWishes(child: SantaChild, max = 3): string[] {
  return child.wishes.filter((id) => giftById(id)).slice(0, max);
}

export function buildCall(kind: CallKind, child: SantaChild, opts: { preview?: boolean; ai?: boolean; seed?: number } = {}): CallStep[] {
  const seed = opts.seed ?? 7;
  const react = reactions(seed);
  const giftReact = rand(seed + 1);
  const wishes = spokenWishes(child);
  const proud = proudById(child.proud);
  const steps: CallStep[] = [];

  if (kind === 'message') {
    steps.push(say([nameClip(child, 'hello'), line('msg.open')], 'wave'));
    steps.push(say([line(child.letterSentAt ? 'msg.letter' : 'msg.noLetter')], 'laugh'));
    steps.push(say([line('msg.busy')]));
    steps.push(say([line('msg.close'), nameClip(child, 'bye')], 'wave'));
    steps.push({ t: 'end', reason: 'done' });
    return steps;
  }

  // Every call opens the same warm way.
  steps.push(say([line('open.hohoho'), nameClip(child, 'hello')], 'wave'));
  steps.push(say([line('open.hear')], 'listen'), listen(5000), say([line('open.hear.react')], 'laugh'));

  if (kind === 'liste') {
    steps.push(say([`age:${child.age}`]));
    if (opts.preview) {
      steps.push(say([line('list.letter')], 'write'));
      if (wishes[0]) steps.push(say([`gift:${wishes[0]}`, line(`gift.react.${1 + Math.floor(giftReact() * 4)}`)], 'write'));
      steps.push(say([line('preview.sleigh'), nameClip(child, 'bye')], 'wave'));
      steps.push({ t: 'end', reason: 'preview' });
      return steps;
    }
    if (wishes.length) {
      steps.push(say([line('list.letter'), line('list.read')], 'write'));
      for (const id of wishes) steps.push(say([`gift:${id}`, line(`gift.react.${1 + Math.floor(giftReact() * 4)}`)], 'write'));
      if (child.wishes.length > wishes.length) steps.push(say([line('list.more')], 'laugh'));
      steps.push(say([line('list.which')], 'listen'), listen(), say([line('list.which.react')], 'laugh'));
    } else {
      steps.push(say([line('list.noLetter')], 'listen'), listen(), say([line('list.noLetter.react')], 'write'));
    }
    steps.push(say([line('heart.ask')], 'listen'), listen(7000), say([line('heart.react')], 'laugh'));
    if (proud) steps.push(say([line('proud.intro'), `proud:${proud.id}`, line('proud.bravo')], 'wink'));
    steps.push(say([line('ziggy.hello')], 'wave'));
    steps.push(say([line('reindeer.ask')]), { t: 'sfx', id: 'reindeer' }, say([line('reindeer.after')], 'laugh'));
  }

  if (kind === 'nouvelles') {
    if (opts.preview) {
      steps.push(say([line('news.open'), line('news.snow')], 'laugh'));
      steps.push(say([line('preview.sleigh'), nameClip(child, 'bye')], 'wave'));
      steps.push({ t: 'end', reason: 'preview' });
      return steps;
    }
    steps.push(say([line('news.open'), line('news.snow')], 'laugh'));
    steps.push(say([line('news.color.ask')], 'listen'), listen(), say([line('news.color.react')], 'write'));
    steps.push(say([line('news.reindeer')], 'laugh'), { t: 'sfx', id: 'bells' });
    steps.push(say([line('news.cookie.ask')], 'listen'), listen(), say([line('news.cookie.react')], 'wink'));
    if (proud) steps.push(say([line('proud.intro'), `proud:${proud.id}`, line('proud.bravo')], 'wink'));
    steps.push(say([line('news.joke.ask')], 'listen'), listen(9000), say([line('news.joke.react')], 'laugh'));
    steps.push(say([react()], 'laugh'));
  }

  if (kind === 'veille') {
    if (opts.preview) {
      steps.push(say([line('eve.open')], 'laugh'));
      steps.push(say([line('preview.sleigh'), nameClip(child, 'bye')], 'wave'));
      steps.push({ t: 'end', reason: 'preview' });
      return steps;
    }
    steps.push(say([line('eve.open')], 'laugh'), { t: 'sfx', id: 'bells' });
    if (wishes.length) steps.push(say([line('eve.list'), ...wishes.slice(0, 2).map((id) => `gift:${id}`)], 'write'));
    steps.push(say([line('eve.carrot.ask')], 'listen'), listen(), say([line('eve.carrot.react')], 'laugh'));
    steps.push(say([line('eve.sleep')], 'listen'), listen(4000), say([line('eve.sleep.react')], 'wink'));
    steps.push(say([line('eve.close'), nameClip(child, 'bye')], 'wave'));
    steps.push({ t: 'end', reason: 'done' });
    return steps;
  }

  if (opts.ai) steps.push(say([line('ai.intro')], 'listen'), { t: 'ai' });
  steps.push(say([line('close.work'), line('close.keep')]));
  steps.push(say([nameClip(child, 'bye'), line('close.hohoho')], 'wave'));
  steps.push({ t: 'end', reason: 'done' });
  return steps;
}

/** Every clip a call needs, to fetch them all while the phone rings. */
export function callClips(steps: CallStep[]): string[] {
  return [...new Set(steps.flatMap((s) => (s.t === 'say' ? s.clips : [])))];
}

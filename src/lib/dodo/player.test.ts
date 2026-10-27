import { describe, expect, it } from 'vitest';
import { DODO_STORIES, getDodoStory, outroText } from '@/data/dodo';
import { tokenize } from './voice';
import {
  clampSegment,
  durationBucket,
  forgetPosition,
  gapAfter,
  linesFromTops,
  minutesOf,
  moralTokens,
  paceWords,
  parseTiming,
  planSeconds,
  planSegment,
  planStory,
  prompterOffset,
  readPositions,
  rememberPosition,
  resumable,
  sceneOfSegment,
  scaleWords,
  segmentIds,
  segmentText,
  sentenceOf,
  sentenceStartTime,
  sentenceStarts,
  storySeconds,
  textLocale,
  timingComplete,
  wordLook,
} from './player';

const lili = getDodoStory('lili')!;

describe('segments', () => {
  it('plays the title, the scenes in order, then the outro', () => {
    expect(segmentIds(6)).toEqual(['title', 's1', 's2', 's3', 's4', 's5', 's6', 'outro']);
    expect(segmentIds(0)).toEqual(['title', 'outro']);
  });

  it('shows the right text, in French or else in English', () => {
    expect(segmentText(lili, 'title', 'fr')).toBe(lili.title.fr);
    expect(segmentText(lili, 's1', 'fr')).toBe(lili.scenes[0].text.fr);
    expect(segmentText(lili, 's6', 'en')).toBe(lili.scenes[5].text.en);
    expect(segmentText(lili, 'outro', 'fr')).toBe(outroText(lili, 'fr'));
    // Other site languages use the English text (and the English recording).
    expect(segmentText(lili, 's2', 'de')).toBe(lili.scenes[1].text.en);
    expect(textLocale('ja')).toBe('en');
    expect(segmentText(lili, 's9' as 's1', 'fr')).toBe('');
  });

  it('matches each segment with an illustration', () => {
    expect(sceneOfSegment('title', 6)).toBe(0);
    expect(sceneOfSegment('s1', 6)).toBe(0);
    expect(sceneOfSegment('s4', 6)).toBe(3);
    expect(sceneOfSegment('outro', 6)).toBe(5);
    expect(sceneOfSegment('s12' as 's1', 6)).toBe(5);
  });

  it('clamps navigation', () => {
    expect(clampSegment(-1, 8)).toBe(0);
    expect(clampSegment(3, 8)).toBe(3);
    expect(clampSegment(42, 8)).toBe(7);
  });

  it('leaves a gentle pause between segments, a longer one before the moral', () => {
    const scene = gapAfter('s2', 's3');
    const moral = gapAfter('s6', 'outro');
    expect(scene.hold + scene.lead).toBeGreaterThanOrEqual(2000);
    expect(moral.hold + moral.lead).toBeGreaterThan(scene.hold + scene.lead);
    expect(gapAfter('outro', null).lead).toBe(0);
    expect(gapAfter('title', 's1').hold + gapAfter('title', 's1').lead).toBeLessThan(scene.hold + scene.lead);
  });
});

describe('calm reading pace', () => {
  it('gives one increasing start time per token', () => {
    const text = lili.scenes[0].text.fr;
    const { words, dur } = paceWords(text);
    expect(words).toHaveLength(tokenize(text).length);
    for (let i = 1; i < words.length; i++) expect(words[i]).toBeGreaterThan(words[i - 1]);
    expect(dur).toBeGreaterThan(words[words.length - 1]);
  });

  it('is a calm bedtime pace (80–130 words a minute)', () => {
    for (const s of DODO_STORIES.slice(0, 8)) {
      for (const sc of s.scenes) {
        const { dur } = paceWords(sc.text.fr);
        const wpm = (tokenize(sc.text.fr).length / dur) * 60;
        expect(wpm).toBeGreaterThan(80);
        expect(wpm).toBeLessThan(130);
      }
    }
  });

  it('pauses after a full stop more than after a comma', () => {
    const a = paceWords('chat, chien lapin');
    const b = paceWords('chat. chien lapin');
    expect(b.words[1] - b.words[0]).toBeGreaterThan(a.words[1] - a.words[0]);
    const c = paceWords('chat chien lapin');
    expect(a.words[1] - a.words[0]).toBeGreaterThan(c.words[1] - c.words[0]);
  });

  it('stretches a pace to an audio length', () => {
    expect(scaleWords([0, 1, 2], 4, 8)).toEqual([0, 2, 4]);
    expect(scaleWords([0, 1], 0, 8)).toEqual([0, 1]);
  });
});

describe('sentences', () => {
  it('keeps French dialogue in « » inside its sentence', () => {
    const text = 'Un soir, elle murmura : « On dit que le royaume cache mille secrets. » Les yeux de Lili brillèrent. « Allons-y ! »';
    const tokens = tokenize(text);
    const of = sentenceOf(tokens);
    expect(of).toHaveLength(tokens.length);
    expect(of[tokens.indexOf('secrets.')]).toBe(0);
    expect(of[tokens.indexOf('»')]).toBe(0);
    expect(of[tokens.indexOf('Les')]).toBe(1);
    expect(of[tokens.indexOf('brillèrent.')]).toBe(1);
    expect(of[tokens.length - 1]).toBe(2);
    expect(sentenceStarts(of)).toEqual([0, tokens.indexOf('Les'), tokens.indexOf('brillèrent.') + 1]);
  });

  it('handles English curly and straight quotes', () => {
    const text = 'She whispered: “They say it hides a thousand secrets.” Lili smiled. He said "Hi there!" and left.';
    const tokens = tokenize(text);
    const of = sentenceOf(tokens);
    expect(of[tokens.indexOf('secrets.”')]).toBe(0);
    expect(of[tokens.indexOf('Lili')]).toBe(1);
    expect(of[tokens.indexOf('there!"')]).toBe(2);
    expect(of[tokens.indexOf('left.')]).toBe(2);
  });

  it('goes on after a quote followed by a lowercase word', () => {
    const tokens = tokenize('« Allons-y ! » dit Lili. Puis elle partit.');
    expect(sentenceOf(tokens)).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1]);
  });

  it('never splits on apostrophes', () => {
    const of = sentenceOf(tokenize('L’étoile s’allume. Et voilà.'));
    expect(of).toEqual([0, 0, 1, 1]);
  });

  it('restarts a saved segment at the beginning of its sentence', () => {
    const text = 'Il pleut. Le chat dort. Fin.';
    const tokens = tokenize(text);
    const words = [0, 0.5, 1.5, 2, 2.5, 3.5];
    const of = sentenceOf(tokens);
    expect(sentenceStartTime(words, of, 2.7)).toBe(1.25);
    expect(sentenceStartTime(words, of, 0.2)).toBe(0);
    expect(sentenceStartTime(words, of, -1)).toBe(0);
  });
});

describe('prompter', () => {
  const of = [0, 0, 0, 1, 1, 1];

  it('lights the word being said, softens what was said, emphasises the sentence', () => {
    expect(wordLook(2, -1, of, 'word')).toBe('later');
    expect(wordLook(1, 1, of, 'word')).toBe('now');
    expect(wordLook(0, 1, of, 'word')).toBe('past');
    expect(wordLook(2, 1, of, 'word')).toBe('next');
    expect(wordLook(4, 1, of, 'word')).toBe('later');
  });

  it('lights a whole line in line mode', () => {
    const lines = [0, 0, 1, 1, 2, 2];
    expect(wordLook(2, 3, of, 'line', lines)).toBe('now');
    expect(wordLook(3, 3, of, 'line', lines)).toBe('now');
    expect(wordLook(1, 3, of, 'line', lines)).toBe('past');
    expect(wordLook(4, 3, of, 'line', lines)).toBe('next');
    // Without the layout yet, it falls back to the word mode.
    expect(wordLook(2, 3, of, 'line')).toBe('past');
  });

  it('groups words into lines from their position on screen', () => {
    expect(linesFromTops([10, 10, 11, 52, 52, 95])).toEqual([0, 0, 0, 1, 1, 2]);
    expect(linesFromTops([])).toEqual([]);
  });

  it('keeps the current line near the middle without scrolling past the text', () => {
    expect(prompterOffset(0, 50, 200, 600)).toBe(0);
    expect(prompterOffset(300, 50, 200, 600, 0.5)).toBe(225);
    expect(prompterOffset(560, 50, 200, 600, 0.5)).toBe(400);
    expect(prompterOffset(100, 50, 400, 300)).toBe(0);
  });

  it('knows which outro words are the moral', () => {
    const n = moralTokens(lili, 'fr');
    const outro = tokenize(outroText(lili, 'fr'));
    expect(outro.slice(0, n).join(' ')).toBe(lili.moral.fr);
    expect(outro.length).toBeGreaterThan(n);
  });
});

describe('recorded timing', () => {
  const s1 = lili.scenes[0].text.fr;
  const good = {
    v: 1,
    locale: 'fr',
    story: 'lili',
    segments: {
      title: { file: 'title.mp3', dur: 3, text: lili.title.fr, words: tokenize(lili.title.fr).map((_, i) => i * 0.4) },
      s1: { file: 's1.mp3', dur: 30, text: s1, words: [0, 1] },
      s2: { file: 's2.mp3', dur: -1, text: 'x', words: [0] },
      s3: { text: 'no file', dur: 2, words: [0, 1] },
    },
  };

  it('keeps valid segments, re-paces mismatched words, drops broken ones', () => {
    const t = parseTiming(good, 'lili')!;
    expect(Object.keys(t.segments)).toEqual(['title', 's1']);
    expect(t.segments.title.words).toEqual(good.segments.title.words);
    expect(t.segments.s1.words).toHaveLength(tokenize(s1).length);
    expect(t.segments.s1.words[t.segments.s1.words.length - 1]).toBeLessThan(30);
  });

  it('rejects what is not a timing file', () => {
    expect(parseTiming(null)).toBeNull();
    expect(parseTiming('<html>')).toBeNull();
    expect(parseTiming({ v: 2, segments: {} })).toBeNull();
    expect(parseTiming({ ...good, story: 'other' }, 'lili')).toBeNull();
    expect(parseTiming({ v: 1, segments: { s1: { file: 'a', dur: 1, text: '', words: [] } } })).toBeNull();
  });

  it('uses the recording when there is one, else the calm silent pace', () => {
    const t = parseTiming(good, 'lili');
    const title = planSegment(lili, 'title', 'fr', { timing: t });
    expect(title.kind).toBe('voice');
    expect(title.kind === 'voice' && title.url).toBe('/dodo/voice/fr/lili/title.mp3');
    const s2 = planSegment(lili, 's2', 'fr', { timing: t });
    expect(s2.kind).toBe('read');
    expect(s2.text).toBe(lili.scenes[1].text.fr);
    expect(planSegment(lili, 's2', 'fr', { fallback: 'device' }).kind).toBe('device');
    // English recording for other languages.
    const de = planSegment(lili, 'title', 'de', { timing: { ...t!, locale: 'en' } });
    expect(de.kind === 'voice' && de.url).toBe('/dodo/voice/en/lili/title.mp3');
  });

  it('uses a pre-generated narration (numbered like the pictures) before silence', () => {
    const plans = planStory(lili, 'fr', { clips: { 1: 'https://x/1.mp3', 7: 'https://x/7.mp3' } });
    expect(plans).toHaveLength(8);
    expect(plans[0].kind).toBe('read');
    expect(plans[1].kind).toBe('clip');
    expect(plans[2].kind).toBe('read');
    expect(plans[7].kind === 'clip' && plans[7].url).toBe('https://x/7.mp3');
  });

  it('knows when the whole story is recorded', () => {
    expect(timingComplete(parseTiming(good), 6)).toBe(false);
    expect(timingComplete(null, 6)).toBe(false);
    const all = Object.fromEntries(['title', 's1', 's2', 's3', 's4', 's5', 's6', 'outro'].map((id) => [id, { file: `${id}.mp3`, dur: 1, text: 'Bonjour.', words: [0] }]));
    expect(timingComplete(parseTiming({ v: 1, segments: all }), 6)).toBe(true);
  });
});

describe('durations', () => {
  it('adds the segments and the pauses between them', () => {
    const plans = [
      { id: 'title' as const, dur: 3 },
      { id: 's1' as const, dur: 30 },
      { id: 'outro' as const, dur: 8 },
    ];
    const gaps = (gapAfter('title', 's1').hold + gapAfter('title', 's1').lead + gapAfter('s1', 'outro').hold + gapAfter('s1', 'outro').lead) / 1000;
    expect(planSeconds(plans)).toBe(Math.round(41 + gaps));
  });

  it('estimates every story at a few minutes', () => {
    for (const s of DODO_STORIES) {
      const sec = storySeconds(s, 'fr');
      expect(sec, s.id).toBeGreaterThan(120);
      expect(sec, s.id).toBeLessThan(600);
    }
  });

  it('sorts durations into short, medium and long', () => {
    expect(durationBucket(150)).toBe('short');
    expect(durationBucket(240)).toBe('medium');
    expect(durationBucket(400)).toBe('long');
    expect(minutesOf(20)).toBe(1);
    expect(minutesOf(250)).toBe(4);
  });
});

describe('remembered position', () => {
  const now = 1_800_000_000_000;

  it('reads only valid, recent positions', () => {
    const raw = JSON.stringify({ a: { seg: 3, t: 4.5, at: now - 1000 }, b: { seg: 'x' }, c: { seg: 1, t: 0, at: now - 90 * 24 * 3600 * 1000 } });
    expect(readPositions(raw, now)).toEqual({ a: { seg: 3, t: 4.5, at: now - 1000 } });
    expect(readPositions('{oops', now)).toEqual({});
    expect(readPositions(null, now)).toEqual({});
  });

  it('keeps the most recent stories only, and forgets a finished one', () => {
    let map = {};
    for (let i = 0; i < 15; i++) map = rememberPosition(map, `s${i}`, { seg: 1, t: 0, at: now + i }, 12);
    expect(Object.keys(map)).toHaveLength(12);
    expect(map).not.toHaveProperty('s0');
    expect(map).toHaveProperty('s14');
    expect(forgetPosition(map, 's14')).not.toHaveProperty('s14');
  });

  it('offers to continue only past the title and before the end', () => {
    expect(resumable(undefined, 8)).toBe(false);
    expect(resumable({ seg: 0, t: 0.5, at: now }, 8)).toBe(false);
    expect(resumable({ seg: 0, t: 2, at: now }, 8)).toBe(true);
    expect(resumable({ seg: 3, t: 0, at: now }, 8)).toBe(true);
    expect(resumable({ seg: 8, t: 0, at: now }, 8)).toBe(false);
  });
});

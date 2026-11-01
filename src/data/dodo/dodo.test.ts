import { describe, expect, it } from 'vitest';
import { DODO_STORIES, OUTRO_SCENE, getDodoStory, outroText } from './index';
import { DODO_SKIES, DODO_VALUES } from './types';
import { classify } from '@/lib/safety/policy';
import { sentences, storyMinutes, storyOfTheNight } from '@/lib/dodo/client';
import { missing, plannedAssets } from '@/lib/dodo/prepare';

const AMBIENCES = ['stars', 'moon', 'fireflies', 'snow', 'bubbles', 'petals', 'sunrise'];

describe('Mode dodo stories', () => {
  it('has Princesse Lili and 30 bedtime stories with unique ids', () => {
    expect(DODO_STORIES).toHaveLength(31);
    expect(new Set(DODO_STORIES.map((s) => s.id)).size).toBe(31);
    expect(DODO_STORIES[0].id).toBe('lili');
    expect(getDodoStory('lili')?.cover).toBe('/dodo/lili/lili.webp');
  });

  it('every story is complete, bilingual and well-formed', () => {
    for (const s of DODO_STORIES) {
      expect(s.scenes, s.id).toHaveLength(6);
      expect(DODO_VALUES).toContain(s.value);
      for (const t of [s.title, s.teaser, s.moral]) expect(t.fr.trim() && t.en.trim(), s.id).toBeTruthy();
      for (const sc of s.scenes) {
        const words = sc.text.fr.split(/\s+/).length;
        expect(words, `${s.id}: ${words} words`).toBeGreaterThanOrEqual(40);
        expect(words, `${s.id}: ${words} words`).toBeLessThanOrEqual(85);
        expect(sc.text.en.trim().length).toBeGreaterThan(100);
        expect(DODO_SKIES).toContain(sc.art.sky);
        expect(AMBIENCES).toContain(sc.art.ambience);
        expect(sc.art.props.length).toBeGreaterThanOrEqual(2);
        // Princesse Lili's prompts describe her in detail so every scene looks like her.
        expect(sc.prompt.split(/\s+/).length).toBeLessThanOrEqual(s.reference ? 110 : 60);
      }
    }
  });

  it('passes ChildShield everywhere, illustration prompts included', () => {
    for (const s of DODO_STORIES) {
      const texts = [s.title, s.teaser, s.moral, ...s.scenes.map((x) => x.text)].flatMap((t) => [t.fr, t.en]);
      for (const t of [...texts, ...s.scenes.map((x) => x.prompt), outroText(s, 'fr'), outroText(s, 'en')]) {
        expect(classify(t), `${s.id}: ${t.slice(0, 60)}`).toBeNull();
      }
    }
  });

  it('ends every story gently, with the moral and good night', () => {
    expect(outroText(DODO_STORIES[0], 'fr')).toMatch(/Bonne nuit/);
    expect(outroText(DODO_STORIES[0], 'en')).toMatch(/Good night/);
  });

  it('splits text into sentences for subtitles and the live voice', () => {
    expect(sentences('Il était une fois. « Bonjour ! Ça va ? » dit-il. Fin…')).toEqual(['Il était une fois.', '« Bonjour ! Ça va ? » dit-il.', 'Fin…']);
    expect(sentences('« Mille secrets ? » Les yeux brillent.')).toEqual(['« Mille secrets ? » Les yeux brillent.']);
    expect(sentences('Elle dort... Il rêve!')).toEqual(['Elle dort...', 'Il rêve!']);
    const s = DODO_STORIES[1];
    expect(storyMinutes(s, 'fr')).toBeGreaterThanOrEqual(2);
    expect(storyMinutes(s, 'fr')).toBeLessThanOrEqual(8);
  });

  it('suggests a new story each night, then cycles', () => {
    const all = DODO_STORIES;
    const first = storyOfTheNight(all, [], new Date(2026, 9, 10));
    expect(storyOfTheNight(all, [], new Date(2026, 9, 10))).toBe(first);
    const heardAllButOne = all.slice(1).map((s) => s.id);
    expect(storyOfTheNight(all, heardAllButOne).id).toBe(all[0].id);
  });
});

describe('pre-generation plan', () => {
  it('plans one illustration per scene and one narration per scene plus the outro', () => {
    const fr = plannedAssets(['fr']);
    expect(fr.filter((k) => k.kind === 'image')).toHaveLength(31 * 6);
    expect(fr.filter((k) => k.kind === 'audio')).toHaveLength(31 * 7);
    expect(fr.some((k) => k.scene === OUTRO_SCENE && k.kind === 'audio')).toBe(true);
    expect(plannedAssets(['fr', 'en'], ['audio'])).toHaveLength(31 * 7 * 2);
  });

  it('only generates what is missing', () => {
    const planned = plannedAssets(['fr'], ['image']);
    const left = missing(planned, [{ story_id: 'lili', scene: 1, kind: 'image', locale: '-', path: 'lili/scene-1.jpg' }]);
    expect(left).toHaveLength(planned.length - 1);
    expect(left.some((k) => k.story === 'lili' && k.scene === 1)).toBe(false);
  });
});

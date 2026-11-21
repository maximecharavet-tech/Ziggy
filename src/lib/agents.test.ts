import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAgentSystemPrompt } from './agents';
import { GUIDED } from '@/data/chat/guided';

/** Spark on an ad-free kids' site: posters for good ideas and spotting ads, never making manipulative ones. */
describe('Spark (advertising agent) teaches media literacy', () => {
  const prompt = getAgentSystemPrompt('advertising', 'fr');

  it('the persona teaches to recognise ads and their tricks, with firm limits', () => {
    expect(prompt).toMatch(/media literacy/);
    expect(prompt).toMatch(/recognise advertising/);
    expect(prompt).toMatch(/Never help a child make an ad that tricks or pressures people/);
    expect(prompt).toMatch(/never name or promote a real brand or product/);
    expect(prompt).toMatch(/never encourage buying anything/);
    expect(prompt).not.toMatch(/come up with their own ad ideas/);
  });

  it('the child’s fixed questions are about spotting ads and making posters, not making ads', () => {
    const ids = GUIDED.advertising.map((q) => q.id);
    expect(ids).toEqual(expect.arrayContaining(['spot-ad', 'tricks', 'toy-look', 'poster']));
    for (const q of GUIDED.advertising) {
      expect(q.text.fr).not.toMatch(/fabrique une pub|slogan/i);
      expect(q.text.en).not.toMatch(/how is an ad made|slogan/i);
    }
  });

  it('every language describes Spark as spotting ad tricks, not making ads that stick', () => {
    const dir = join(process.cwd(), 'messages');
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const spark = JSON.parse(readFileSync(join(dir, f), 'utf8')).agents.advertising;
      expect(spark.name, f).toBe('Spark');
      expect(spark.description, f).not.toBe(spark.longDescription);
      expect(spark.suggestions, f).toHaveLength(4);
      expect(JSON.stringify(spark), f).not.toMatch(/pubs qui marquent|eye-catching ads are made|real campaigns|vraies campagnes|Learn the fundamentals/);
    }
  });
});

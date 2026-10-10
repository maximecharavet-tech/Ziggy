import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as gameResult } from './game/result/route';
import { POST as gameContent } from './game/content/route';
import { POST as companionReaction } from './companion/reaction/route';
import { POST as analyze } from './avatar/analyze/route';
import { GET as worlds } from './worlds/route';

const post = (url: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}` } });

describe('/api/ziggy', () => {
  it('computes a guest quest result on the server', async () => {
    const res = await gameResult(post('/api/ziggy/game/result', { result: { gameId: 'alphabet_quest', worldId: 'princess', questId: 'princess_q1', correct: 5, mistakes: 0, total: 5, durationMs: 30000 }, today: '2026-10-10' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.saved).toBe(false);
    expect(body.stars).toBe(3);
    expect(body.memory.completedQuests.princess_q1.stars).toBe(3);
    expect(body.magic.map((m: { kind: string }) => m.kind)).toContain('FIRST_QUEST');
  });

  it('does not count a quest played with the wrong game', async () => {
    const res = await gameResult(post('/api/ziggy/game/result', { result: { gameId: 'math_runner', worldId: 'princess', questId: 'princess_q1', correct: 5, mistakes: 0, total: 5, durationMs: 1000 } }));
    const body = await res.json();
    expect(body.memory.completedQuests.princess_q1).toBeUndefined();
  });

  it('rejects invalid bodies', async () => {
    expect((await gameResult(post('/api/ziggy/game/result', { result: { gameId: 'doom', correct: 1, mistakes: 0, total: 1, durationMs: 1 } }))).status).toBe(400);
    expect((await gameResult(post('/api/ziggy/game/result', { result: { gameId: 'math_runner', correct: 9, mistakes: 0, total: 5, durationMs: 1 } }))).status).toBe(400);
    expect((await gameResult(post('/api/ziggy/game/result', 'not json'))).status).toBe(400);
    expect((await gameContent(post('/api/ziggy/game/content', { gameId: 'math_runner', difficulty: 9, seed: 1 }))).status).toBe(400);
  });

  it('serves local game content to guests', async () => {
    const res = await gameContent(post('/api/ziggy/game/content', { gameId: 'number_island', difficulty: 2, seed: 7, locale: 'fr' }));
    const body = await res.json();
    expect(body.source).toBe('local');
    expect(body.content.kind).toBeTruthy();
  });

  it('requires a parent account for photo analysis', async () => {
    expect((await analyze(post('/api/ziggy/avatar/analyze', { photo: 'data:image/png;base64,AAAA' }))).status).toBe(401);
  });

  it('steps the companion state machine', async () => {
    const body = await (await companionReaction(post('/api/ziggy/companion/reaction', { companion: 'fox', event: 'wrong', locale: 'fr' }))).json();
    expect(body.state.mood).toBe('SAD');
    expect(body.reaction).toBe('failure');
    expect(typeof body.line).toBe('string');
  });

  it('lists the 20 worlds', async () => {
    const body = await worlds(new NextRequest('http://localhost/api/ziggy/worlds?locale=en')).json();
    expect(body.worlds).toHaveLength(20);
    expect(body.worlds[0].quests).toHaveLength(6);
  });
});

import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { Emitter, GameBus, type BaseGameCommands, type BaseGameEvents, type RoundResult } from './events';

type Hud = { stars: number };
type Evt = BaseGameEvents<Hud> & { custom: { n: number } };

describe('Emitter', () => {
  it('delivers in subscription order, typed per event', () => {
    const e = new Emitter<Evt>();
    const got: string[] = [];
    e.on('hud', (h) => {
      expectTypeOf(h).toEqualTypeOf<Hud>();
      got.push(`a${h.stars}`);
    });
    e.on('hud', (h) => got.push(`b${h.stars}`));
    e.on('custom', (c) => got.push(`c${c.n}`));
    e.emit('hud', { stars: 2 });
    e.emit('custom', { n: 5 });
    e.emit('finish');
    expect(got).toEqual(['a2', 'b2', 'c5']);
  });

  it('queues re-entrant emits FIFO so every listener sees the same order', () => {
    const e = new Emitter<{ x: number }>();
    const seen1: number[] = [];
    const seen2: number[] = [];
    e.on('x', (n) => {
      seen1.push(n);
      if (n === 1) {
        e.emit('x', 2);
        e.emit('x', 3);
      }
    });
    e.on('x', (n) => seen2.push(n));
    e.emit('x', 1);
    expect(seen1).toEqual([1, 2, 3]);
    expect(seen2).toEqual([1, 2, 3]);
  });

  it('once, off and unsubscribe during delivery', () => {
    const e = new Emitter<{ x: number }>();
    const got: number[] = [];
    e.once('x', (n) => got.push(n));
    const off = e.on('x', (n) => {
      got.push(n * 10);
      off();
    });
    e.emit('x', 1);
    e.emit('x', 2);
    expect(got).toEqual([1, 10]);
    expect(e.listenerCount('x')).toBe(0);
  });

  it('a throwing listener does not stop the others', () => {
    const e = new Emitter<{ x: number }>();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const got: number[] = [];
    e.on('x', () => {
      throw new Error('bad');
    });
    e.on('x', (n) => got.push(n));
    e.emit('x', 7);
    expect(got).toEqual([7]);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('onAny sees every event after its own listeners', () => {
    const e = new Emitter<{ a: number; b: string }>();
    const got: string[] = [];
    e.on('a', () => got.push('a-own'));
    e.onAny((name, p) => got.push(`${String(name)}:${String(p)}`));
    e.emit('a', 1);
    e.emit('b', 'z');
    expect(got).toEqual(['a-own', 'a:1', 'b:z']);
  });

  it('GameBus carries both directions; result matches finishExtraGame', () => {
    const bus = new GameBus<Evt, BaseGameCommands>();
    const results: RoundResult[] = [];
    const music: boolean[] = [];
    bus.events.on('result', (r) => results.push(r));
    bus.commands.on('music', (m) => music.push(m.on));
    bus.events.emit('result', { gameId: 'lutin-factory', skill: 'logic', stats: { correct: 3, mistakes: 1, total: 4 }, durationMs: 60000 });
    bus.commands.emit('music', { on: false });
    expect(results[0].skill).toBe('logic');
    expect(music).toEqual([false]);
    bus.dispose();
    expect(bus.events.listenerCount('result')).toBe(0);
  });

  it('rejects wrong payloads at compile time', () => {
    const e = new Emitter<Evt>();
    // @ts-expect-error a HUD needs `stars`
    e.emit('hud', { nope: 1 });
    // @ts-expect-error unknown event
    e.emit('nope', 1);
    // @ts-expect-error only happy reactions exist
    e.emit('react', { who: 'ziggy', reaction: 'sad' });
    expect(true).toBe(true);
  });
});

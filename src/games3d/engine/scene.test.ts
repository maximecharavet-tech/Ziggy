import { describe, expect, it } from 'vitest';
import { SceneStack, type GameScene, type RendererLike } from './scene';

type Ctx = { name: string };

function mockScene(id: string, log: string[], opts: { failLoad?: boolean; loadDelay?: number } = {}): GameScene<Ctx, string> {
  return {
    id,
    view: { scene: `${id}-scene`, camera: `${id}-cam` },
    async load(ctx) {
      log.push(`${id}.load(${ctx.name})`);
      if (opts.loadDelay) await new Promise((r) => setTimeout(r, opts.loadDelay));
      if (opts.failLoad) throw new Error('boom');
    },
    enter: () => log.push(`${id}.enter`),
    fixedUpdate: (_s, t) => log.push(`${id}.fixed${t}`),
    update: () => log.push(`${id}.update`),
    command: (c) => log.push(`${id}.cmd:${c}`),
    resize: (w, h) => log.push(`${id}.resize${w}x${h}`),
    pause: () => log.push(`${id}.pause`),
    resume: () => log.push(`${id}.resume`),
    exit: () => log.push(`${id}.exit`),
    dispose: () => log.push(`${id}.dispose`),
  };
}

function setup() {
  const log: string[] = [];
  const renders: string[] = [];
  const renderer: RendererLike = { render: (s, c) => renders.push(`${String(s)}|${String(c)}`) };
  const stack = new SceneStack<Ctx, string>({
    ctx: { name: 'ctx' },
    transition: (p) => void log.push(`fade-${p}`),
    disposeView: (s) => log.push(`${s.id}.disposeView`),
    beforeActivate: (s) => log.push(`${s.id}.activate`),
  });
  return { log, renders, renderer, stack };
}

describe('SceneStack', () => {
  it('push → load, enter; push over → pause; pop → exit, dispose, resume', async () => {
    const { log, stack } = setup();
    await stack.push(mockScene('map', log));
    await stack.push(mockScene('room', log));
    expect(stack.ids).toEqual(['map', 'room']);
    await stack.pop();
    expect(stack.ids).toEqual(['map']);
    expect(log).toEqual([
      'map.load(ctx)',
      'fade-out',
      'map.activate',
      'map.enter',
      'fade-in',
      'room.load(ctx)',
      'fade-out',
      'map.pause',
      'room.activate',
      'room.enter',
      'fade-in',
      'fade-out',
      'room.exit',
      'room.dispose',
      'room.disposeView',
      'map.activate',
      'map.resume',
      'fade-in',
    ]);
  });

  it('replace loads the new scene before closing the old one', async () => {
    const { log, stack } = setup();
    await stack.push(mockScene('a', log));
    log.length = 0;
    await stack.replace(mockScene('b', log));
    expect(log).toEqual(['b.load(ctx)', 'fade-out', 'a.exit', 'a.dispose', 'a.disposeView', 'b.activate', 'b.enter', 'fade-in']);
    expect(stack.ids).toEqual(['b']);
  });

  it('only the top scene updates, gets commands and is rendered', async () => {
    const { log, stack, renders, renderer } = setup();
    await stack.push(mockScene('a', log));
    await stack.push(mockScene('b', log));
    log.length = 0;
    stack.fixedUpdate(1 / 60, 3);
    stack.update(0.016, 0.5);
    stack.command('go');
    stack.render(renderer);
    expect(log).toEqual(['b.fixed3', 'b.update', 'b.cmd:go']);
    expect(renders).toEqual(['b-scene|b-cam']);
  });

  it('serialises operations: a push during a slow load waits its turn', async () => {
    const { log, stack } = setup();
    const p1 = stack.push(mockScene('slow', log, { loadDelay: 20 }));
    const p2 = stack.push(mockScene('next', log));
    await Promise.all([p1, p2]);
    expect(log.indexOf('slow.enter')).toBeLessThan(log.indexOf('next.load(ctx)'));
    expect(stack.ids).toEqual(['slow', 'next']);
  });

  it('a failing load disposes that scene and leaves the stack as it was', async () => {
    const { log, stack } = setup();
    await stack.push(mockScene('a', log));
    await expect(stack.push(mockScene('bad', log, { failLoad: true }))).rejects.toThrow('boom');
    expect(stack.ids).toEqual(['a']);
    expect(log).toContain('bad.dispose');
    expect(log).not.toContain('bad.enter');
    expect(log).not.toContain('a.pause');
    // The chain still works afterwards.
    await stack.push(mockScene('c', log));
    expect(stack.ids).toEqual(['a', 'c']);
  });

  it('resize reaches every scene and is replayed to a newly entered scene', async () => {
    const { log, stack } = setup();
    stack.resize(800, 600);
    await stack.push(mockScene('a', log));
    expect(log).toContain('a.resize800x600');
    expect(log.indexOf('a.resize800x600')).toBeLessThan(log.indexOf('a.enter'));
  });

  it('dispose closes everything top first and refuses new work', async () => {
    const { log, stack } = setup();
    await stack.push(mockScene('a', log));
    await stack.push(mockScene('b', log));
    log.length = 0;
    stack.dispose();
    expect(log).toEqual(['b.exit', 'b.dispose', 'b.disposeView', 'a.exit', 'a.dispose', 'a.disposeView']);
    await stack.push(mockScene('c', log));
    expect(stack.depth).toBe(0);
    expect(log).not.toContain('c.load(ctx)');
  });
});

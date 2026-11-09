import { it } from 'vitest';
import { ROOMS, startRoom, perfectRun, replay, validateRoom } from './index';
it('probe', () => {
  const r = ROOMS[1];
  for (const band of ['little', 'middle', 'big'] as const) {
    const s = startRoom(r, band, 7);
    console.log(band, s.pranks.map((p) => `${p.id}:${p.culprit}:${p.clues.map((c) => c.id).join('+')}:${p.puzzle.fix}:${p.puzzle.seconds}s:${p.puzzle.prompt.fr}`).join('\n  '));
    const acts = perfectRun(r, band, 7);
    const end = replay(r, band, 7, acts);
    console.log(band, 'actions', acts.length, 'phase', end.session.phase, 'events', end.events.length);
  }
  const t = Date.now();
  console.log(validateRoom(ROOMS[14], { seeds: 12 }).length, 'issues', Date.now() - t, 'ms');
  const broken = JSON.parse(JSON.stringify(ROOMS[0]));
  broken.bands.little.timer = 30;
  broken.pranks[0].fix.mechanic = 'nope';
  console.log(validateRoom(broken).map((i) => i.message));
});

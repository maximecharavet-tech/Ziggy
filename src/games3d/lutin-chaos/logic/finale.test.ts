import { describe, expect, it } from 'vitest';
import { expectedStep, FINALE_STEPS, predictFinale, startFinale, tapFinale } from './finale';
import { makeRng } from './rand';
import { referenceState } from './room-def';
import { ROOMS } from './rooms';
import { sameRoom } from './room-state';
import { BANDS } from './types';

describe('room finale (chain reaction undone in reverse order)', () => {
  for (const room of ROOMS) {
    it(`${room.id}: every band rewinds last-to-first back to the tidy room`, () => {
      const ref = referenceState(room);
      for (const band of BANDS) {
        const order = room.bands[band].finale;
        expect(order.length).toBeGreaterThanOrEqual(FINALE_STEPS[band].min);
        expect(order.length).toBeLessThanOrEqual(FINALE_STEPS[band].max);
        let { state, run } = startFinale(ref, room.finale.steps, order, band, makeRng(3));
        expect(sameRoom(state, ref)).toBe(false);
        expect(run.steps.map((s) => s.id)).toEqual(order);
        if (band === 'big') {
          expect(run.phase).toBe('predict');
          // a tap before predicting does nothing
          expect(tapFinale(state, run, order[order.length - 1]).result.ok).toBe(false);
          run = predictFinale(run, run.predictOptions[0]).run;
        }
        expect(run.phase).toBe('rewind');
        const undone: string[] = [];
        while (expectedStep(run)) {
          const want = expectedStep(run)!;
          // the first step is never the one to tap first (unless it is the only one left)
          if (run.undone.length === 0) expect(want).toBe(order[order.length - 1]);
          const wrong = order.find((id) => id !== want && !run.undone.includes(id));
          if (wrong) {
            const miss = tapFinale(state, run, wrong);
            expect(miss.result).toEqual({ ok: false, glow: want });
            expect(miss.state).toBe(state);
            run = miss.run;
          }
          const hit = tapFinale(state, run, want);
          expect(hit.result.ok).toBe(true);
          state = hit.state;
          run = hit.run;
          undone.push(want);
        }
        expect(undone).toEqual([...order].reverse());
        expect(run.phase).toBe('done');
        expect(sameRoom(state, ref)).toBe(true);
      }
    });
  }

  it('big kids’ prediction: the right step among 3 options, any answer moves on', () => {
    const room = ROOMS[1];
    const { run } = startFinale(referenceState(room), room.finale.steps, room.bands.big.finale, 'big', makeRng(8));
    expect(run.predictAt).not.toBeNull();
    expect(run.predictOptions.length).toBe(3);
    const right = run.steps[run.predictAt!].id;
    expect(run.predictOptions).toContain(right);
    expect(predictFinale(run, right)).toMatchObject({ correct: true, run: { phase: 'rewind', predicted: true } });
    const other = run.predictOptions.find((o) => o !== right)!;
    expect(predictFinale(run, other)).toMatchObject({ correct: false, run: { phase: 'rewind', predicted: false } });
  });
});

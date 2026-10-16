/**
 * The program's per-week set count follows the PHASE TABLE.
 *
 * Establish base−1, Accumulation base then base+1 from its second week on,
 * Intensification and Peak base, Deload 2. Volume climbs in the volume
 * block and comes off as load goes up — the thirds rule it replaces put the
 * extra set in the Peak weeks and ran Accumulation one set under the
 * program, the opposite of what the overview and the tour promise.
 */
import { describe, it, expect } from 'vitest';
import { getWeekSets } from '../training';
import { buildMesoConfig } from '../../data/constants';

const schedule = (base: number, workWeeks: number) =>
  Array.from({ length: workWeeks + 1 }, (_, w) => getWeekSets(base, w, workWeeks + 1));

describe('getWeekSets follows the phase table', () => {
  it('8 weeks (the shipped Full Body meso): volume peaks in the second accumulation week', () => {
    // Est, Acc, Acc, Int, Int, Int, Peak, Peak, Deload
    expect(schedule(4, 8)).toEqual([3, 4, 5, 4, 4, 4, 4, 4, 2]); // anchors
    expect(schedule(3, 8)).toEqual([2, 3, 4, 3, 3, 3, 3, 3, 2]); // accessories
  });

  it('6 weeks: a one-week accumulation block never reaches base + 1', () => {
    // Est, Acc, Int, Int, Peak, Peak, Deload
    expect(schedule(4, 6)).toEqual([3, 4, 4, 4, 4, 4, 2]);
  });

  it('4 weeks: establish, then base through the deload', () => {
    // Est, Acc, Int, Peak, Deload
    expect(schedule(4, 4)).toEqual([3, 4, 4, 4, 2]);
  });

  it('10 and 12 weeks: the extra set holds through the rest of the accumulation block', () => {
    // 10: Est, Acc×3, Int×3, Peak×3, Deload
    expect(schedule(4, 10)).toEqual([3, 4, 5, 5, 4, 4, 4, 4, 4, 4, 2]);
    // 12: Est, Acc×3, Int×4, Peak×4, Deload
    expect(schedule(4, 12)).toEqual([3, 4, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 2]);
  });

  it('never prescribes fewer than 2 working sets in Establish', () => {
    expect(getWeekSets(2, 0, 9)).toBe(2);
    expect(getWeekSets(3, 0, 9)).toBe(2);
  });

  it('the deload is always 2, whatever the base', () => {
    for (const total of [5, 7, 9, 11, 13]) {
      expect(getWeekSets(5, total - 1, total)).toBe(2);
      expect(getWeekSets(2, total - 1, total)).toBe(2);
    }
  });

  it('agrees with the phase labels the lifter sees on the meso overview', () => {
    for (const workWeeks of [4, 6, 8, 10, 12]) {
      const phases = buildMesoConfig(workWeeks, 4, 'FB').phases;
      const sets = schedule(4, workWeeks);
      phases.forEach((phase, w) => {
        const prevAcc = phases[w - 1] === 'Accumulation';
        const want =
          phase === 'Deload' ? 2
            : phase === 'Establish' ? 3
              : phase === 'Accumulation' && prevAcc ? 5
                : 4;
        expect(sets[w], `${workWeeks}wk week ${w + 1} (${phase})`).toBe(want);
      });
    }
  });
});

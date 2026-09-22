/**
 * loadSparklineData feeds the e1RM card, the PR timeline and the anchor
 * charts. Given the lift's id it resolves each week's sets by `_exId`, so a
 * reorder or swap mid-meso does not graft another lift's weeks onto it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadSparklineData } from '../training';

const set = (id: string, weight: number, reps: number) => ({ weight: String(weight), reps: String(reps), _exId: id });

describe('loadSparklineData by exercise id', () => {
  beforeEach(() => localStorage.clear());

  it('follows the lift across slots after a reorder', () => {
    // Week 0: bench in slot 0, squat in slot 1. Week 1: reordered.
    localStorage.setItem('foundry:day0:week0', JSON.stringify({ 0: { 0: set('bench', 185, 8) }, 1: { 0: set('squat', 225, 5) } }));
    localStorage.setItem('foundry:day0:week1', JSON.stringify({ 0: { 0: set('squat', 235, 5) }, 1: { 0: set('bench', 190, 8) } }));

    const bench = loadSparklineData(0, 1, 2, 'bench');
    expect(bench.map((p) => [p.week, p.bestWeight])).toEqual([
      [0, 185],
      [1, 190],
    ]);
    // Positional read (no id) is the old, wrong picture: slot 1 = squat, bench.
    const positional = loadSparklineData(0, 1, 2);
    expect(positional.map((p) => p.bestWeight)).toEqual([225, 190]);
  });

  it('drops a week whose slot belongs to a swapped-out lift', () => {
    localStorage.setItem('foundry:day0:week0', JSON.stringify({ 2: { 0: set('bench', 185, 8) } }));
    localStorage.setItem('foundry:day0:week1', JSON.stringify({ 2: { 0: set('incline', 70, 10) } }));
    const incline = loadSparklineData(0, 2, 2, 'incline');
    expect(incline).toEqual([{ week: 1, bestWeight: 70, bestReps: 10, e1rm: Math.round(70 * (1 + 10 / 30)) }]);
  });

  it('reads every week it is told to, not a fixed seven', () => {
    for (let w = 0; w < 9; w++) {
      localStorage.setItem(`foundry:day0:week${w}`, JSON.stringify({ 0: { 0: set('bench', 100 + w, 8) } }));
    }
    expect(loadSparklineData(0, 0, 9, 'bench')).toHaveLength(9);
    expect(loadSparklineData(0, 0, undefined, 'bench')).toHaveLength(7);
  });
});

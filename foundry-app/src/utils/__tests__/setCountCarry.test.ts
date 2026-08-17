import { describe, it, expect, beforeEach } from 'vitest';
import { loadSetCountWeeks, pickSetCount, saveSetCount } from '../persistence';
import { getWeekSets } from '../training';

// 6-week meso: week 0 is MEV (base-1), weeks 1-3 MAV (base), week 4 MRV
// (base+1), week 5 deload (always 2). Prescribed 3 sets throughout.
const TOTAL_WEEKS = 6;
const PROGRAM_SETS = 3;
const baseFor = (w: number) => getWeekSets(PROGRAM_SETS, w, TOTAL_WEEKS);

const resolve = (dayIdx: number, weekIdx: number, exId: string) =>
  pickSetCount(loadSetCountWeeks(dayIdx, weekIdx), exId, weekIdx, baseFor);

describe('set-count carry across weeks', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('follows the program when the lifter has never adjusted', () => {
    expect(resolve(0, 0, 'bench')).toBe(2); // MEV
    expect(resolve(0, 1, 'bench')).toBe(3); // MAV
    expect(resolve(0, 4, 'bench')).toBe(4); // MRV
    expect(resolve(0, 5, 'bench')).toBe(2); // deload
  });

  it('carries an added set forward as a delta, not a frozen count', () => {
    // Week 0 prescribes 2; lifter makes it 3. That's +1 over prescribed.
    saveSetCount(0, 0, 'bench', 3);
    expect(resolve(0, 0, 'bench')).toBe(3);
    // Week 1 prescribes 3 — the program's own bump still lands, and the
    // lifter's +1 rides on top of it. This is the bug: it used to revert
    // to the prescribed 3 because nothing carried.
    expect(resolve(0, 1, 'bench')).toBe(4);
    // Week 4 prescribes 4 → 5. The progression keeps progressing.
    expect(resolve(0, 4, 'bench')).toBe(5);
  });

  it('carries a removed set forward the same way', () => {
    saveSetCount(0, 1, 'bench', 2); // prescribed 3, lifter drops to 2
    expect(resolve(0, 2, 'bench')).toBe(2); // 3 - 1
    expect(resolve(0, 4, 'bench')).toBe(3); // 4 - 1
  });

  it('lets a later adjustment supersede an earlier one', () => {
    saveSetCount(0, 0, 'bench', 3); // +1
    saveSetCount(0, 2, 'bench', 3); // back to prescribed → delta 0
    expect(resolve(0, 3, 'bench')).toBe(3);
    expect(resolve(0, 4, 'bench')).toBe(4);
  });

  it('applies the delta to the deload week too', () => {
    // The lifter stays in control: if they don't want the extra set on a
    // deload they remove it, and that becomes the new delta.
    saveSetCount(0, 0, 'bench', 3);
    expect(resolve(0, 5, 'bench')).toBe(3); // deload 2 + 1
  });

  it('never resolves below a single set', () => {
    saveSetCount(0, 1, 'bench', 1); // prescribed 3 → delta -2
    expect(resolve(0, 5, 'bench')).toBe(1); // deload 2 - 2 = 0, clamped
  });

  it('keeps each exercise and each day independent', () => {
    saveSetCount(0, 0, 'bench', 3);
    expect(resolve(0, 1, 'row')).toBe(3); // untouched exercise
    expect(resolve(1, 1, 'bench')).toBe(3); // same exercise, different day
  });

  it('this week\'s explicit choice wins over a carried delta', () => {
    saveSetCount(0, 0, 'bench', 4); // +2
    saveSetCount(0, 1, 'bench', 3); // explicit for week 1
    expect(resolve(0, 1, 'bench')).toBe(3);
  });

  it('falls back to the base when the exercise has no id', () => {
    expect(pickSetCount([], null, 1, baseFor)).toBe(3);
    expect(pickSetCount([], undefined, 4, baseFor)).toBe(4);
  });
});

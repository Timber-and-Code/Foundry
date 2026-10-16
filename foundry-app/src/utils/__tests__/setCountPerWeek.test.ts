/**
 * A lifter's add or remove of a set lasts the week it was made.
 *
 * The program re-prescribes every week (getWeekSets). A removed set is
 * usually fatigue or time that day; an added set is usually a good day.
 * Neither is an edit to the program, so neither carries forward: next week
 * the card shows the program's count again. This replaces the delta carry
 * of 2af293f/7db9380, which re-applied a one-time trim to every later week
 * — the lifter had to add the set back by hand each week (prod meso
 * b9ba647d: bench and deadlift trimmed in week 3, re-added in week 4).
 *
 * 8-week meso (9 incl. deload), base 4: 3 4 5 4 4 4 4 4 2.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadSetCountWeeks, pickSetCount, saveSetCount } from '../persistence';
import { getWeekSets } from '../training';

const TOTAL_WEEKS = 9;
const PROGRAM_SETS = 4;
const baseFor = (w: number) => getWeekSets(PROGRAM_SETS, w, TOTAL_WEEKS);
const OPTS = { baseFor };

const resolve = (dayIdx: number, weekIdx: number, exId: string) =>
  pickSetCount(loadSetCountWeeks(dayIdx, weekIdx), exId, weekIdx, baseFor);

describe('set-count choices are per week', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('follows the program when the lifter has never adjusted', () => {
    expect([0, 1, 2, 3, 7, 8].map((w) => resolve(0, w, 'bench'))).toEqual([3, 4, 5, 4, 4, 2]);
  });

  it('a removed set stays removed for THAT week and the program is back next week', () => {
    // Week 3 prescribes 5; lifter drops to 4.
    saveSetCount(0, 2, 'bench', 4, OPTS);
    expect(resolve(0, 2, 'bench')).toBe(4); // survives re-entry
    expect(resolve(0, 3, 'bench')).toBe(4); // week 4's own prescription, not 5 − 1
    expect(resolve(0, 4, 'bench')).toBe(4);
  });

  it('an added set stays added for THAT week only', () => {
    saveSetCount(0, 1, 'bench', 5, OPTS); // week 2: 4 → 5
    expect(resolve(0, 1, 'bench')).toBe(5);
    expect(resolve(0, 2, 'bench')).toBe(5); // the program's own 5, not 6
    expect(resolve(0, 3, 'bench')).toBe(4);
  });

  it('never reaches the deload from an earlier week, in either direction', () => {
    saveSetCount(0, 1, 'bench', 2, OPTS); // −2
    saveSetCount(0, 5, 'bench', 6, OPTS); // +2
    expect(resolve(0, 8, 'bench')).toBe(2);
  });

  it('an explicit choice made IN the deload week wins', () => {
    saveSetCount(0, 8, 'bench', 3, OPTS);
    expect(resolve(0, 8, 'bench')).toBe(3);
  });

  it('keeps each exercise and each day independent', () => {
    saveSetCount(0, 1, 'bench', 5, OPTS);
    expect(resolve(0, 1, 'row')).toBe(4);
    expect(resolve(1, 1, 'bench')).toBe(4);
  });

  it('falls back to the base when the exercise has no id', () => {
    expect(pickSetCount([], null, 1, baseFor)).toBe(4);
    expect(pickSetCount([], undefined, 2, baseFor)).toBe(5);
  });

  it('pins the deload rule to getWeekSets', () => {
    for (const total of [5, 7, 9, 11, 13]) {
      expect(getWeekSets(PROGRAM_SETS, total - 1, total)).toBe(2);
      expect(getWeekSets(PROGRAM_SETS, total - 2, total)).not.toBe(2);
    }
  });
});

describe('returning to the prescription clears the row', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('leaves no residue when a set is added then removed again', () => {
    saveSetCount(0, 2, 'bench', 6, OPTS); // 5 → 6
    expect(loadSetCountWeeks(0, 2)[2]).toEqual({ bench: 6 });
    saveSetCount(0, 2, 'bench', 5, OPTS); // and back
    expect(loadSetCountWeeks(0, 2)[2]).toEqual({});
  });

  it('keeps other exercises in the same week untouched', () => {
    saveSetCount(0, 2, 'bench', 6, OPTS);
    saveSetCount(0, 2, 'row', 6, OPTS);
    saveSetCount(0, 2, 'bench', 5, OPTS);
    expect(loadSetCountWeeks(0, 2)[2]).toEqual({ row: 6 });
  });

  it('stores the choice when it differs from the week\'s base', () => {
    saveSetCount(0, 2, 'bench', 3, OPTS);
    expect(loadSetCountWeeks(0, 2)[2]).toEqual({ bench: 3 });
  });

  it('without a resolver, stores whatever it is given', () => {
    saveSetCount(0, 2, 'bench', 5);
    expect(loadSetCountWeeks(0, 2)[2]).toEqual({ bench: 5 });
  });
});

describe('regression: the week-3 trim that governed the rest of the meso', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Real data, meso b9ba647d day 0, 2026-10-06 → 10-13: db_flat_bench was
  // trimmed one set in week 3. Under the delta carry week 4 opened one set
  // short and the lifter added it back by hand (a second override row).
  it('week 4 shows the program count with no add-back needed', () => {
    saveSetCount(0, 2, 'db_flat_bench', baseFor(2) - 1, OPTS);
    expect(resolve(0, 3, 'db_flat_bench')).toBe(baseFor(3));
    expect(loadSetCountWeeks(0, 3)[3]).toEqual({});
  });
});

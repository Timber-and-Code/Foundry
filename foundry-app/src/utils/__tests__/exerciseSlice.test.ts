/**
 * resolveExerciseSlice — the one rule for "which sets belong to this lift".
 *
 * DayData is keyed by slot, the program can be reordered or swapped between
 * weeks, so readers must go by the `_exId` stamp. Positional reads put
 * another lift's weight on Progress → Current Weights, the e1RM card, the
 * Home last-wk pill and the archive's anchor peaks.
 */
import { describe, it, expect } from 'vitest';
import { findSliceByExId, resolveExerciseSlice } from '../exerciseSlice';
import type { DayData } from '../../types';

const stamped = (id: string, weight: number, reps = 8) => ({ weight, reps, _exId: id });

describe('resolveExerciseSlice', () => {
  it('finds the lift by stamp when a reorder moved it to another slot', () => {
    // Last week: squat in slot 0, bench in slot 1. This week they swapped.
    const lastWeek: DayData = {
      0: { 0: stamped('squat', 225), 1: stamped('squat', 225) },
      1: { 0: stamped('bench', 185) },
    } as unknown as DayData;
    expect(resolveExerciseSlice(lastWeek, 'bench', 0)).toEqual(lastWeek[1]);
    expect(resolveExerciseSlice(lastWeek, 'squat', 1)).toEqual(lastWeek[0]);
  });

  it('gives NOTHING when the slot holds another lift — never that lift\'s weight', () => {
    // Bench was swapped for incline this week; slot 1 last week is bench.
    const lastWeek: DayData = { 1: { 0: stamped('bench', 185) } } as unknown as DayData;
    expect(resolveExerciseSlice(lastWeek, 'incline', 1)).toBeUndefined();
  });

  it('falls back to the slot only for unstamped (legacy) data', () => {
    const legacy: DayData = { 1: { 0: { weight: 185, reps: 8 } } } as unknown as DayData;
    expect(resolveExerciseSlice(legacy, 'bench', 1)).toEqual(legacy[1]);
    expect(resolveExerciseSlice(legacy, null, 1)).toEqual(legacy[1]);
    expect(resolveExerciseSlice(legacy, 'bench', 0)).toBeUndefined();
  });

  it('keeps only this lift\'s sets out of a mixed post-swap slice', () => {
    const wd: DayData = {
      1: { 0: stamped('bench', 185), 1: stamped('bench', 185), 2: stamped('incline', 70) },
    } as unknown as DayData;
    const slice = findSliceByExId(wd, 'incline');
    expect(Object.keys(slice ?? {})).toEqual(['2']);
    expect(resolveExerciseSlice(wd, 'bench', 1)).toEqual({ 0: stamped('bench', 185), 1: stamped('bench', 185) });
  });

  it('handles missing data and numeric ids', () => {
    expect(resolveExerciseSlice(undefined, 'bench', 0)).toBeUndefined();
    const wd: DayData = { 0: { 0: stamped('42', 100) } } as unknown as DayData;
    expect(resolveExerciseSlice(wd, 42, 3)).toEqual(wd[0]);
  });
});

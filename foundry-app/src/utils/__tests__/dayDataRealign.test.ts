/**
 * realignDayDataByExId — heals position-keyed day data whose slices were
 * reindexed by an in-session reorder (ReorderSheet / move up-down) and then
 * persisted, while the exercise ORDER itself reverted on remount. Slices
 * reattach to the slot whose exercise id matches their `_exId` stamp.
 *
 * Conservative contract: anything ambiguous (duplicate slot ids, slice
 * collisions) returns the input untouched.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { realignDayDataByExId, loadDayWeekWithCarryover } from '../persistence';
import type { DayData, TrainingDay } from '../../types';

const day = {
  label: 'PUSH',
  tag: 'PUSH',
  exercises: [
    { id: 'bench_bb', name: 'Bench Press', sets: 4, reps: '8-12' },
    { id: 'ohp_bb', name: 'Overhead Press', sets: 3, reps: '8-12' },
    { id: 'fly_db', name: 'DB Fly', sets: 3, reps: '10-15' },
  ],
} as unknown as TrainingDay;

const set = (exId: string, weight: string) => ({ weight, reps: '8', _exId: exId });

describe('realignDayDataByExId', () => {
  it('reattaches reordered slices to their id-matched slots', () => {
    // Saved layout: fly's sets under slot 0, bench's under slot 2 (post-reorder).
    const data = {
      0: { 0: set('fly_db', '30') },
      1: { 0: set('ohp_bb', '95') },
      2: { 0: set('bench_bb', '185'), 1: set('bench_bb', '185') },
    } as unknown as DayData;
    const healed = realignDayDataByExId(data, day);
    expect((healed[0] as unknown as Record<string, { _exId: string }>)[0]._exId).toBe('bench_bb');
    expect(Object.keys(healed[0]!)).toHaveLength(2); // bench keeps both sets
    expect((healed[1] as unknown as Record<string, { _exId: string }>)[0]._exId).toBe('ohp_bb');
    expect((healed[2] as unknown as Record<string, { _exId: string }>)[0]._exId).toBe('fly_db');
  });

  it('returns the same object when already aligned', () => {
    const data = {
      0: { 0: set('bench_bb', '185') },
      1: { 0: set('ohp_bb', '95') },
    } as unknown as DayData;
    expect(realignDayDataByExId(data, day)).toBe(data);
  });

  it('leaves unstamped slices in place', () => {
    const data = {
      1: { 0: { weight: '95', reps: '8' } }, // legacy — no _exId
    } as unknown as DayData;
    expect(realignDayDataByExId(data, day)).toBe(data);
  });

  it('bails untouched when two slots share an exercise id', () => {
    const dupDay = {
      ...day,
      exercises: [
        { id: 'bench_bb', name: 'Bench A', sets: 4 },
        { id: 'bench_bb', name: 'Bench B', sets: 4 },
      ],
    } as unknown as TrainingDay;
    const data = { 1: { 0: set('bench_bb', '185') } } as unknown as DayData;
    expect(realignDayDataByExId(data, dupDay)).toBe(data);
  });

  it('bails untouched on a slice collision', () => {
    // Slot-1 slice is stamped for slot 0, but an unstamped slice already
    // occupies slot 0 — moving would displace it, so nothing moves.
    const data = {
      0: { 0: { weight: '30', reps: '12' } }, // unstamped, stays at 0
      1: { 0: set('bench_bb', '185') }, // wants slot 0 — collision
    } as unknown as DayData;
    expect(realignDayDataByExId(data, day)).toBe(data);
  });

  it('keeps a slice stamped with an id not in the day (swapped-away exercise)', () => {
    const data = {
      1: { 0: set('incline_db', '60') }, // no matching slot
    } as unknown as DayData;
    expect(realignDayDataByExId(data, day)).toBe(data);
  });
});

describe('loadDayWeekWithCarryover heals reordered current-week data', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns id-aligned slices for a week saved in reordered layout', () => {
    localStorage.setItem(
      'foundry:day0:week1',
      JSON.stringify({
        0: { 0: set('fly_db', '30') },
        2: { 0: set('bench_bb', '185') },
      }),
    );
    const out = loadDayWeekWithCarryover(0, 1, day, null);
    expect((out[0] as unknown as Record<string, { _exId: string }>)[0]._exId).toBe('bench_bb');
    expect((out[2] as unknown as Record<string, { _exId: string }>)[0]._exId).toBe('fly_db');
  });
});

/**
 * workoutDaysHistory — meso-scoped state living on a user-scoped object.
 *
 * Entries are `{ fromWeek, days }` where fromWeek is a week index INSIDE the
 * current mesocycle. The profile deliberately survives a meso reset, so an
 * entry written at week 3 of one cycle silently reapplied at week 3 of the
 * next — handing that week and every week after it a training-day set the
 * lifter never chose for this block.
 *
 * getWorkoutDaysForWeek prefers history over profile.workoutDays, so the
 * stale entry beat the correct, synced value. buildSessionDateMap then dealt
 * that week's sessions onto the wrong weekdays, which is how a 4-day week
 * ends up spread across two calendar weeks and Home reports the next workout
 * as "next week".
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: () => ({
      upsert: () => Promise.resolve({ data: null, error: null }),
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }), single: () => Promise.resolve({ data: null, error: null }) }) }),
    }),
  },
}));
vi.mock('@sentry/react', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import { reconcileWorkoutDaysHistory } from '../sync';
import { wipeMesoSessionData } from '../storage';
import { getWorkoutDaysForWeek } from '../training';
import type { Profile } from '../../types';

describe('wipeMesoSessionData — workoutDaysHistory', () => {
  beforeEach(() => localStorage.clear());

  it('clears the history when a meso ends', () => {
    localStorage.setItem('foundry:profile', JSON.stringify({
      name: 'Test',
      workoutDays: [1, 2, 4, 5],
      workoutDaysHistory: [{ fromWeek: 0, days: [1, 2, 4, 5] }, { fromWeek: 3, days: [1, 4] }],
    }));

    wipeMesoSessionData();

    const p = JSON.parse(localStorage.getItem('foundry:profile')!);
    expect(p.workoutDaysHistory).toBeUndefined();
  });

  it('keeps workoutDays — that is user-level preference and syncs', () => {
    localStorage.setItem('foundry:profile', JSON.stringify({
      name: 'Test', workoutDays: [1, 2, 4, 5], workoutDaysHistory: [{ fromWeek: 2, days: [1, 4] }],
    }));

    wipeMesoSessionData();

    const p = JSON.parse(localStorage.getItem('foundry:profile')!);
    expect(p.workoutDays).toEqual([1, 2, 4, 5]);
    expect(p.name).toBe('Test');
  });

  it('is a no-op without a profile or without a history', () => {
    expect(() => wipeMesoSessionData()).not.toThrow();
    localStorage.setItem('foundry:profile', JSON.stringify({ workoutDays: [1, 3] }));
    wipeMesoSessionData();
    expect(JSON.parse(localStorage.getItem('foundry:profile')!).workoutDays).toEqual([1, 3]);
  });

  it('survives a corrupt profile without destroying it', () => {
    localStorage.setItem('foundry:profile', '{not json');
    expect(() => wipeMesoSessionData()).not.toThrow();
    expect(localStorage.getItem('foundry:profile')).toBe('{not json');
  });

  it('closes the reported failure: a stale entry no longer reapplies', () => {
    // Cycle 1: days changed to Mon/Thu from week 3.
    const before = {
      workoutDays: [1, 2, 4, 5],
      workoutDaysHistory: [{ fromWeek: 0, days: [1, 2, 4, 5] }, { fromWeek: 3, days: [1, 4] }],
    } as unknown as Profile;
    expect(getWorkoutDaysForWeek(before, 3)).toEqual([1, 4]);

    localStorage.setItem('foundry:profile', JSON.stringify(before));
    wipeMesoSessionData();
    const after = JSON.parse(localStorage.getItem('foundry:profile')!) as Profile;

    // Cycle 2, week 3: the full four-day week, not the old two-day override.
    expect(getWorkoutDaysForWeek(after, 3)).toEqual([1, 2, 4, 5]);
  });
});

describe('reconcileWorkoutDaysHistory', () => {
  beforeEach(() => localStorage.clear());

  it('seeds an empty history from the synced days', () => {
    const p: Record<string, unknown> = { workoutDays: [1, 3, 5] };
    reconcileWorkoutDaysHistory(p);
    expect(p.workoutDaysHistory).toEqual([{ fromWeek: 0, days: [1, 3, 5] }]);
  });

  it('leaves an agreeing history untouched', () => {
    const p: Record<string, unknown> = {
      workoutDays: [1, 3, 5],
      workoutDaysHistory: [{ fromWeek: 0, days: [1, 3, 5] }],
    };
    reconcileWorkoutDaysHistory(p);
    expect(p.workoutDaysHistory).toEqual([{ fromWeek: 0, days: [1, 3, 5] }]);
  });

  it('records a change made on another device from the current week', () => {
    // The device pulled new workoutDays but its history still names the old
    // ones — and history WINS in getWorkoutDaysForWeek, so without this the
    // stale local entry overrides the value that actually synced.
    localStorage.setItem('foundry:currentWeek', '2');
    const p: Record<string, unknown> = {
      workoutDays: [1, 4],
      workoutDaysHistory: [{ fromWeek: 0, days: [1, 2, 4, 5] }],
    };

    reconcileWorkoutDaysHistory(p);

    expect(p.workoutDaysHistory).toEqual([
      { fromWeek: 0, days: [1, 2, 4, 5] },
      { fromWeek: 2, days: [1, 4] },
    ]);
    // Weeks before the change keep their real days — the point of a history.
    expect(getWorkoutDaysForWeek(p as unknown as Profile, 1)).toEqual([1, 2, 4, 5]);
    expect(getWorkoutDaysForWeek(p as unknown as Profile, 2)).toEqual([1, 4]);
  });

  it('does not stack duplicates when the same pull repeats', () => {
    localStorage.setItem('foundry:currentWeek', '2');
    const p: Record<string, unknown> = {
      workoutDays: [1, 4],
      workoutDaysHistory: [{ fromWeek: 0, days: [1, 2, 4, 5] }],
    };
    reconcileWorkoutDaysHistory(p);
    reconcileWorkoutDaysHistory(p);
    reconcileWorkoutDaysHistory(p);
    expect(p.workoutDaysHistory).toHaveLength(2);
  });

  it('ignores a missing or empty workoutDays rather than seeding nonsense', () => {
    const a: Record<string, unknown> = {};
    reconcileWorkoutDaysHistory(a);
    expect(a.workoutDaysHistory).toBeUndefined();

    const b: Record<string, unknown> = { workoutDays: [] };
    reconcileWorkoutDaysHistory(b);
    expect(b.workoutDaysHistory).toBeUndefined();
  });

  it('discards malformed entries instead of trusting them', () => {
    const p: Record<string, unknown> = {
      workoutDays: [1, 3],
      workoutDaysHistory: [{ fromWeek: 'x', days: [1] }, { days: [2] }, null],
    };
    reconcileWorkoutDaysHistory(p);
    expect(p.workoutDaysHistory).toEqual([{ fromWeek: 0, days: [1, 3] }]);
  });
});

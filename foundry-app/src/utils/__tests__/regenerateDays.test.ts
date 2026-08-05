/**
 * Partial regeneration — rebuild only the days not yet trained.
 *
 * The user is two days into a 4-day full-body cycle and wants the remaining
 * days rebuilt with anchor continuity and the accessory fix, without losing
 * the two he has already logged. A whole-meso regenerate would discard the
 * exercise ids in those blobs, which is precisely what every history reader
 * matches on.
 *
 * The invariant under test is one-directional: a day with ANY logged work is
 * never touched. Over-preserving is a missed improvement; under-preserving
 * destroys real training data.
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

import { regenerateUntouchedDays, dayHasLoggedWork } from '../regenerateDays';
import type { RegenerateOptions } from '../regenerateDays';
import { EXERCISE_DB } from '../../data/exercises';
import type { Profile } from '../../types';

const DB = EXERCISE_DB as unknown as NonNullable<RegenerateOptions['exerciseDB']>;

const profile = {
  splitType: 'full_body', daysPerWeek: 4, workoutDays: [1, 2, 4, 5],
  sessionDuration: 55, experience: 'intermediate', equipment: ['full_gym'],
  goal: 'build_muscle', mesoLength: 5,
} as unknown as Profile;

/** A stored program whose day labels are easy to identify after a merge. */
const storedProgram = () =>
  Array.from({ length: 4 }, (_, i) => ({
    dayNum: i + 1,
    label: `ORIGINAL ${i}`,
    tag: 'FULL',
    exercises: [{ id: `orig_${i}`, name: `Original ${i}`, anchor: true, sets: 3, reps: '8' }],
  }));

const seedProgram = () =>
  localStorage.setItem('foundry:storedProgram', JSON.stringify(storedProgram()));

const logWork = (dayIdx: number, weekIdx = 0) =>
  localStorage.setItem(
    `foundry:day${dayIdx}:week${weekIdx}`,
    JSON.stringify({ 0: { 1: { _exId: 'orig_x', weight: 135, reps: 8, confirmed: true } } }),
  );

describe('dayHasLoggedWork', () => {
  beforeEach(() => localStorage.clear());

  it('is false for a day never opened', () => {
    expect(dayHasLoggedWork(0)).toBe(false);
  });

  it('is true on a completion flag alone', () => {
    localStorage.setItem('foundry:done:d2:w0', '1');
    expect(dayHasLoggedWork(2)).toBe(true);
  });

  it('is true for sets logged without tapping Complete', () => {
    // Mid-session work is still work. Regenerating out from under it would
    // orphan the sets already in the blob.
    logWork(1);
    expect(dayHasLoggedWork(1)).toBe(true);
  });

  it('finds work in any week, not just week 1', () => {
    logWork(3, 4);
    expect(dayHasLoggedWork(3)).toBe(true);
  });

  it('ignores warmup-only and empty blobs', () => {
    localStorage.setItem('foundry:day0:week0', JSON.stringify({
      0: { 1: { _exId: 'x', weight: 45, reps: 10, warmup: true } },
    }));
    expect(dayHasLoggedWork(0)).toBe(false);
  });

  it('treats an unparseable blob as work rather than risking data loss', () => {
    localStorage.setItem('foundry:day0:week0', '{corrupt');
    expect(dayHasLoggedWork(0)).toBe(true);
  });
});

describe('regenerateUntouchedDays', () => {
  beforeEach(() => localStorage.clear());

  it('replaces only the untrained days — the reported scenario', () => {
    // Two days in: days 0 and 1 logged, days 2 and 3 never opened.
    seedProgram();
    logWork(0);
    logWork(1);

    const result = regenerateUntouchedDays(profile, { exerciseDB: DB });

    expect(result.preserved).toEqual([0, 1]);
    expect(result.regenerated).toEqual([2, 3]);
    expect(result.program![0].label).toBe('ORIGINAL 0');
    expect(result.program![1].label).toBe('ORIGINAL 1');
    expect(result.program![2].label).not.toBe('ORIGINAL 2');
    expect(result.program![3].label).not.toBe('ORIGINAL 3');
  });

  it('never writes to storage unless commit is set', () => {
    // Dry run by default: this is destructive for the days it touches, and
    // on a shared meso it changes what a training partner sees too.
    seedProgram();
    const before = localStorage.getItem('foundry:storedProgram');

    const result = regenerateUntouchedDays(profile, { exerciseDB: DB });

    expect(result.committed).toBe(false);
    expect(localStorage.getItem('foundry:storedProgram')).toBe(before);
  });

  it('persists exactly the previewed program when committed', () => {
    seedProgram();
    logWork(0);

    const preview = regenerateUntouchedDays(profile, { exerciseDB: DB, trainedIds: [] });
    const committed = regenerateUntouchedDays(profile, {
      exerciseDB: DB, trainedIds: [], commit: true,
    });

    expect(committed.committed).toBe(true);
    expect(committed.preserved).toEqual(preview.preserved);
    expect(JSON.parse(localStorage.getItem('foundry:storedProgram')!)[0].label)
      .toBe('ORIGINAL 0');
  });

  it('preserves every day when the whole cycle has been trained', () => {
    seedProgram();
    [0, 1, 2, 3].forEach((d) => logWork(d));

    const result = regenerateUntouchedDays(profile, { exerciseDB: DB });
    expect(result.regenerated).toEqual([]);
    expect(result.preserved).toEqual([0, 1, 2, 3]);
    expect(result.program!.map((d) => d.label))
      .toEqual(['ORIGINAL 0', 'ORIGINAL 1', 'ORIGINAL 2', 'ORIGINAL 3']);
  });

  it('regenerates everything when no program is stored yet', () => {
    const result = regenerateUntouchedDays(profile, { exerciseDB: DB });
    expect(result.preserved).toEqual([]);
    expect(result.regenerated.length).toBeGreaterThan(0);
  });

  it('keeps a trained day even if the fresh program is shorter', () => {
    // Day count dropped: the merge must not blank days off the end of the
    // stored program.
    seedProgram();
    logWork(3);
    const twoDay = { ...profile, daysPerWeek: 2, workoutDays: [1, 4] } as unknown as Profile;

    const result = regenerateUntouchedDays(twoDay, { exerciseDB: DB });
    expect(result.program).toHaveLength(4);
    expect(result.program![3].label).toBe('ORIGINAL 3');
  });

  it('returns an inert result without a profile or an exercise DB', () => {
    expect(regenerateUntouchedDays(null, { exerciseDB: DB }).program).toBeNull();
    expect(regenerateUntouchedDays(profile, { exerciseDB: [] }).program).toBeNull();
    expect(regenerateUntouchedDays(profile, { exerciseDB: [] }).committed).toBe(false);
  });

  it('does not touch logged day blobs or completion flags', () => {
    // The regenerate changes the PROGRAM. Logged work is a separate store and
    // must survive untouched.
    seedProgram();
    logWork(0);
    localStorage.setItem('foundry:done:d0:w0', '1');
    const blob = localStorage.getItem('foundry:day0:week0');

    regenerateUntouchedDays(profile, { exerciseDB: DB, commit: true });

    expect(localStorage.getItem('foundry:day0:week0')).toBe(blob);
    expect(localStorage.getItem('foundry:done:d0:w0')).toBe('1');
  });
});

// A swap override pins an exercise id to a SLOT INDEX and is applied on top
// of the stored program by Home, WorkoutSplash, NextUpCard, the overview
// accordion and DayView. Left in place across a rebuild it re-pins the old
// exercise to the new day — the program changes and the lifter sees nothing
// move, which is indistinguishable from the rebuild not running at all.
describe('regenerateUntouchedDays — swap overrides', () => {
  beforeEach(() => localStorage.clear());

  it('clears overrides on the days it rebuilds', () => {
    seedProgram();
    logWork(0); // day 0 preserved, days 1-3 rebuilt
    localStorage.setItem('foundry:exov:d1:ex0', 'stale_pick');
    localStorage.setItem('foundry:exov:d2:w3:ex1', 'stale_pick_weekly');

    regenerateUntouchedDays(profile, { exerciseDB: DB, commit: true });

    expect(localStorage.getItem('foundry:exov:d1:ex0')).toBeNull();
    expect(localStorage.getItem('foundry:exov:d2:w3:ex1')).toBeNull();
  });

  it('keeps overrides on preserved days — those are current choices', () => {
    seedProgram();
    logWork(0);
    localStorage.setItem('foundry:exov:d0:ex0', 'my_swap');

    regenerateUntouchedDays(profile, { exerciseDB: DB, commit: true });

    expect(localStorage.getItem('foundry:exov:d0:ex0')).toBe('my_swap');
  });

  it('does not match a day index by prefix', () => {
    // d1 must not take d11's overrides with it.
    seedProgram();
    logWork(0);
    localStorage.setItem('foundry:exov:d11:ex0', 'other_day');

    regenerateUntouchedDays(profile, { exerciseDB: DB, commit: true });

    expect(localStorage.getItem('foundry:exov:d11:ex0')).toBe('other_day');
  });

  it('leaves overrides alone on a dry run', () => {
    seedProgram();
    logWork(0);
    localStorage.setItem('foundry:exov:d1:ex0', 'stale_pick');

    regenerateUntouchedDays(profile, { exerciseDB: DB });

    expect(localStorage.getItem('foundry:exov:d1:ex0')).toBe('stale_pick');
  });
});

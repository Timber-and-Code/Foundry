/**
 * useExerciseProgression — unit tests for the shared progression banner +
 * stall warning derivation. Covers the canonical scenarios called out in
 * Bundle I:
 *
 *  - week 0 always returns null banner (no prior week to compare)
 *  - suggested weight bump produces the "+X lbs" banner
 *  - bodyweight + repsSuggested produces the "+1 rep" banner
 *  - >2 lb weight drop without compensating reps triggers stallWarning
 *  - matching the prior week's last set does NOT trigger stallWarning
 *
 * Hook outputs are derived purely from inputs — no localStorage, no store
 * access — so tests just assert against the returned shape.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useExerciseProgression } from '../useExerciseProgression';
import type { Exercise } from '../../types';

function makeEx(overrides: Partial<Exercise> = {}): Exercise {
  return {
    name: 'Bench Press',
    muscle: 'chest',
    sets: 3,
    reps: '8-12',
    rest: '2 min',
    ...overrides,
  };
}

describe('useExerciseProgression', () => {
  it('returns null banner on week 0 even when set 0 is suggested', () => {
    const { result } = renderHook(() =>
      useExerciseProgression({
        exIdx: 0,
        exercise: makeEx(),
        weekData: { 0: { 0: { weight: 135, reps: 8, suggested: true } } },
        prevWeekRaw: {},
        weekIdx: 0,
      }),
    );
    expect(result.current.progressionBanner).toBeNull();
    expect(result.current.stallWarning).toBe(false);
  });

  it('returns null banner once the user has edited set 0 (no suggestion flags)', () => {
    const { result } = renderHook(() =>
      useExerciseProgression({
        exIdx: 0,
        exercise: makeEx(),
        weekData: { 0: { 0: { weight: 140, reps: 10 } } },
        prevWeekRaw: { 0: { 0: { weight: 135, reps: 10 } } },
        weekIdx: 1,
      }),
    );
    expect(result.current.progressionBanner).toBeNull();
  });

  it('returns "+X lbs" banner when set 0 is suggested at a higher weight than last week', () => {
    const { result } = renderHook(() =>
      useExerciseProgression({
        exIdx: 0,
        exercise: makeEx(),
        weekData: { 0: { 0: { weight: 140, reps: 10, suggested: true } } },
        prevWeekRaw: { 0: { 0: { weight: 135, reps: 10 } } },
        weekIdx: 1,
      }),
    );
    expect(result.current.progressionBanner).not.toBeNull();
    expect(result.current.progressionBanner?.text).toMatch(/^\+5 lbs/);
  });

  it('returns "+1 rep — bodyweight progression" banner for bw + repsSuggested', () => {
    const { result } = renderHook(() =>
      useExerciseProgression({
        exIdx: 0,
        exercise: makeEx({ bw: true }),
        weekData: { 0: { 0: { weight: 0, reps: 11, repsSuggested: true } } },
        prevWeekRaw: { 0: { 0: { weight: 0, reps: 10 } } },
        weekIdx: 1,
      }),
    );
    expect(result.current.progressionBanner?.text).toMatch(/bodyweight/i);
  });

  it('flags stallWarning when weight drops >2 lb without compensating reps', () => {
    const { result } = renderHook(() =>
      useExerciseProgression({
        exIdx: 0,
        exercise: makeEx({ sets: 3 }),
        weekData: { 0: { 0: { weight: 25, reps: 10 } } },
        // Last week: best/last working set was 30 × 12.
        prevWeekRaw: {
          0: {
            0: { weight: 30, reps: 12 },
            1: { weight: 30, reps: 11 },
            2: { weight: 30, reps: 10 },
          },
        },
        weekIdx: 1,
      }),
    );
    expect(result.current.stallWarning).toBe(true);
    expect(result.current.stallTarget).toEqual({ w: 30, r: 10 });
  });

  it('does NOT flag stallWarning when weight matches and reps match last week', () => {
    const { result } = renderHook(() =>
      useExerciseProgression({
        exIdx: 0,
        exercise: makeEx({ sets: 3 }),
        weekData: { 0: { 0: { weight: 30, reps: 12 } } },
        prevWeekRaw: {
          0: {
            0: { weight: 30, reps: 12 },
            1: { weight: 30, reps: 11 },
            2: { weight: 30, reps: 10 },
          },
        },
        weekIdx: 1,
      }),
    );
    expect(result.current.stallWarning).toBe(false);
  });

  it('does NOT flag stallWarning when weight drops but reps compensate', () => {
    // Last set: 30 × 10 → equiv at 25 lb is 30*10/25 = 12 reps. 13 reps clears.
    const { result } = renderHook(() =>
      useExerciseProgression({
        exIdx: 0,
        exercise: makeEx({ sets: 3 }),
        weekData: { 0: { 0: { weight: 25, reps: 13 } } },
        prevWeekRaw: {
          0: {
            0: { weight: 30, reps: 10 },
            1: { weight: 30, reps: 10 },
            2: { weight: 30, reps: 10 },
          },
        },
        weekIdx: 1,
      }),
    );
    expect(result.current.stallWarning).toBe(false);
  });

  it('skips warmup sets when picking last week target', () => {
    const { result } = renderHook(() =>
      useExerciseProgression({
        exIdx: 0,
        exercise: makeEx({ sets: 3 }),
        weekData: { 0: { 0: { weight: 25, reps: 10 } } },
        prevWeekRaw: {
          0: {
            0: { weight: 30, reps: 12 },
            // The "last" warming-up entry should be ignored — target should
            // be the highest non-warmup index, set 0.
            1: { weight: 999, reps: 1, warmup: true },
          },
        },
        weekIdx: 1,
      }),
    );
    expect(result.current.stallTarget).toEqual({ w: 30, r: 12 });
    expect(result.current.stallWarning).toBe(true);
  });
});

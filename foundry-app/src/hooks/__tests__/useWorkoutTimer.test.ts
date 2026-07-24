/**
 * useWorkoutTimer — stale session-start re-anchoring.
 *
 * A persisted foundry:sessionStart older than 12h is a leftover from an
 * abandoned sitting (e.g. the user fell off mid-workout for a layoff).
 * Restoring it verbatim produced multi-week elapsed times ("1700 hrs").
 * The hook must re-anchor to now, clear the stale strength-end stamp, and
 * leave fresh (< 12h) starts untouched.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWorkoutTimer, formatElapsed } from '../useWorkoutTimer';

const START_KEY = 'foundry:sessionStart:d0:w0';
const END_KEY = 'foundry:strengthEnd:d0:w0';

function mount(opts: Partial<Parameters<typeof useWorkoutTimer>[0]> = {}) {
  return renderHook(() =>
    useWorkoutTimer({
      startKey: START_KEY,
      strengthEndKey: END_KEY,
      isDone: false,
      ...opts,
    }),
  );
}

describe('useWorkoutTimer stale-start re-anchoring', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('restores a fresh saved start as-is', () => {
    const twentyMinAgo = Date.now() - 20 * 60 * 1000;
    localStorage.setItem(START_KEY, String(twentyMinAgo));
    const { result } = mount();
    expect(result.current.workoutStarted).toBe(true);
    expect(result.current.sessionStartRef.current).toBe(twentyMinAgo);
  });

  it('re-anchors a start older than 12h to now', () => {
    const fiveWeeksAgo = Date.now() - 5 * 7 * 24 * 3600 * 1000;
    localStorage.setItem(START_KEY, String(fiveWeeksAgo));
    localStorage.setItem(END_KEY, String(fiveWeeksAgo + 3600 * 1000));
    const before = Date.now();
    const { result } = mount();
    const restored = result.current.sessionStartRef.current!;
    // Restarted the clock for this sitting…
    expect(restored).toBeGreaterThanOrEqual(before);
    // …persisted the new anchor…
    expect(parseInt(localStorage.getItem(START_KEY)!, 10)).toBe(restored);
    // …and dropped the equally-stale strength-end stamp.
    expect(localStorage.getItem(END_KEY)).toBe('');
    expect(result.current.strengthEndRef.current).toBeNull();
    // Session itself is still considered in-progress (sets are untouched).
    expect(result.current.workoutStarted).toBe(true);
  });

  it('keeps a start just under the threshold', () => {
    const elevenHoursAgo = Date.now() - 11 * 3600 * 1000;
    localStorage.setItem(START_KEY, String(elevenHoursAgo));
    const { result } = mount();
    expect(result.current.sessionStartRef.current).toBe(elevenHoursAgo);
  });

  it('does not restore anything when the session is done', () => {
    localStorage.setItem(START_KEY, String(Date.now() - 5 * 7 * 24 * 3600 * 1000));
    const { result } = mount({ isDone: true });
    expect(result.current.workoutStarted).toBe(false);
    expect(result.current.sessionStartRef.current).toBeNull();
  });
});

describe('formatElapsed', () => {
  it('formats under an hour as M:SS', () => {
    expect(formatElapsed(65)).toBe('1:05');
  });
  it('formats over an hour as H:MM:SS', () => {
    expect(formatElapsed(3725)).toBe('1:02:05');
  });
});

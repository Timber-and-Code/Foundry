/**
 * Re-anchoring tests for buildSessionDateMap.
 *
 * The bug: the map was a pure function of startDate + workoutDays, so
 * session N landed on the Nth matching weekday after the start no matter
 * when the lifter actually trained. Home only surfaces dates >= today and
 * deliberately hides missed sessions, so any drift quietly swallowed the
 * rest of the week — reported from a real account as "her next scheduled
 * workout is next week even though she had a workout today".
 *
 * Supabase and Sentry are mocked because training.ts transitively pulls in
 * the sync bootstrap chain, which wants env vars.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: () => ({
      upsert: () => Promise.resolve({ data: null, error: null }),
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }), single: () => Promise.resolve({ data: null, error: null }) }) }),
    }),
  },
}));

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import { buildSessionDateMap } from '../training';

// Mon/Tue/Thu/Fri, 4 days — the real configuration from the report.
const profile = {
  experience: 'intermediate' as const,
  startDate: '2026-08-03', // a Monday
  workoutDays: [1, 2, 4, 5],
  daysPerWeek: 4,
  mesoLength: 5,
};

const resolvedSet = (...keys: string[]) => (k: string) => keys.includes(k);
const dateOf = (map: Record<string, string | string[]>, key: string): string | undefined =>
  Object.keys(map)
    .sort()
    .find((d) => {
      const v = map[d];
      return Array.isArray(v) ? v.includes(key) : v === key;
    });

describe('buildSessionDateMap — re-anchoring', () => {
  it('reproduces the fixed calendar when no resolver is supplied', () => {
    // Backwards compatibility: every existing caller and test depends on
    // the untouched walk.
    const map = buildSessionDateMap(profile, 4, 6);
    expect(map['2026-08-03']).toBe('0:0');
    expect(map['2026-08-04']).toBe('1:0');
    expect(map['2026-08-06']).toBe('2:0');
    expect(map['2026-08-07']).toBe('3:0');
  });

  it('leaves an on-track calendar completely alone', () => {
    // Trained Mon and Tue, today is Tue. Nothing has slipped into the past,
    // so the map must not churn — re-anchoring an on-schedule lifter would
    // be a behaviour change nobody asked for.
    const map = buildSessionDateMap(profile, 4, 6, {
      isResolved: resolvedSet('0:0', '1:0'),
      todayStr: '2026-08-04',
    });
    expect(map['2026-08-06']).toBe('2:0');
    expect(map['2026-08-07']).toBe('3:0');
  });

  it('pulls the rest of the block forward after a lapse', () => {
    // Started Aug 3, trained the first two sessions, then nothing for two
    // weeks. Under the old map every remaining week-0/week-1 session sat in
    // the past and was treated as missed, so Home skipped straight to
    // whatever was left in the future.
    const map = buildSessionDateMap(profile, 4, 6, {
      isResolved: resolvedSet('0:0', '1:0'),
      todayStr: '2026-08-18', // a Tuesday, two weeks on
    });

    // Completed work stays where it happened.
    expect(map['2026-08-03']).toBe('0:0');
    expect(map['2026-08-04']).toBe('1:0');
    // The next outstanding session is today, not two weeks ago. The one
    // after it skips Wednesday — re-anchoring still respects workoutDays
    // rather than dealing sessions onto consecutive calendar days.
    expect(dateOf(map, '2:0')).toBe('2026-08-18');
    expect(dateOf(map, '3:0')).toBe('2026-08-20');
  });

  it('never dates an outstanding session in the past', () => {
    // The core invariant. Whatever else re-anchoring does, an unfinished
    // session sitting behind today is exactly the state Home cannot show.
    const today = '2026-09-01';
    const map = buildSessionDateMap(profile, 4, 6, {
      isResolved: resolvedSet('0:0'),
      todayStr: today,
    });
    for (const [date, value] of Object.entries(map)) {
      const keys = Array.isArray(value) ? value : [value];
      for (const k of keys) {
        if (k === '0:0') continue; // resolved — history, allowed in the past
        expect(date >= today).toBe(true);
      }
    }
  });

  it('keeps every session — re-anchoring must not drop any', () => {
    const base = buildSessionDateMap(profile, 4, 6);
    const baseKeys = Object.values(base).flat().sort();

    const reanchored = buildSessionDateMap(profile, 4, 6, {
      isResolved: resolvedSet('0:0', '1:0'),
      todayStr: '2026-08-18',
    });
    expect(Object.values(reanchored).flat().sort()).toEqual(baseKeys);
  });

  it('does not stack an outstanding session onto a completed day', () => {
    // Today is Tuesday and Tuesday's session is already done. The next
    // outstanding one must find the following workout day, not double-book
    // today and make Home offer a workout that is already finished.
    const map = buildSessionDateMap(profile, 4, 6, {
      isResolved: resolvedSet('0:0', '1:0'),
      todayStr: '2026-08-11', // a Tuesday, a week after the start
    });
    expect(map['2026-08-11']).toBe('2:0');
    expect(dateOf(map, '1:0')).toBe('2026-08-04');
  });

  it('treats skipped sessions as resolved, not as outstanding work', () => {
    // A skipped day is dead to the next-session card the same way a
    // completed one is; re-anchoring must not resurrect it.
    const map = buildSessionDateMap(profile, 4, 6, {
      isResolved: resolvedSet('0:0', '1:0', '2:0'),
      todayStr: '2026-08-18',
    });
    expect(dateOf(map, '2:0')).toBe('2026-08-06'); // stayed put
    expect(dateOf(map, '3:0')).toBe('2026-08-18'); // first outstanding
  });

  it('leaves the calendar untouched once everything is resolved', () => {
    const allKeys = Object.values(buildSessionDateMap(profile, 4, 6)).flat() as string[];
    const map = buildSessionDateMap(profile, 4, 6, {
      isResolved: (k) => allKeys.includes(k),
      todayStr: '2026-12-01',
    });
    expect(map['2026-08-03']).toBe('0:0');
    expect(map['2026-08-04']).toBe('1:0');
  });

  it('survives an empty workoutDays without spinning or losing the map', () => {
    // Pathological config: nothing can be placed. The guard must bail and
    // leave the base walk intact rather than emit a half-built calendar.
    const broken = { ...profile, workoutDays: [] as number[] };
    const map = buildSessionDateMap(broken, 4, 6, {
      isResolved: resolvedSet(),
      todayStr: '2026-08-18',
    });
    expect(map).toEqual({});
  });
});

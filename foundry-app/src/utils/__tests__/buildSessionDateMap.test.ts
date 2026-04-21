/**
 * Pure-function tests for buildSessionDateMap — the helper that computes
 * the Schedule calendar's date → sessionKey map with scheduleOverrides
 * applied as an overlay.
 *
 * Supabase is mocked so the sync.ts bootstrap chain (which training.ts
 * transitively imports) doesn't require env vars.
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

describe('buildSessionDateMap', () => {
  it('produces the base walk when no overrides are set', () => {
    // 2030-01-07 is a Monday. Workout days Mon/Wed/Fri → Week 0 sessions
    // land on 01-07 (0:0), 01-09 (1:0), 01-11 (2:0).
    const profile = {
      experience: 'intermediate' as const,
      startDate: '2030-01-07',
      workoutDays: [1, 3, 5],
      daysPerWeek: 3,
      mesoLength: 6,
    };
    const map = buildSessionDateMap(profile, 3, 6);
    expect(map['2030-01-07']).toBe('0:0');
    expect(map['2030-01-09']).toBe('1:0');
    expect(map['2030-01-11']).toBe('2:0');
  });

  it('applies a single override: source removed, target populated', () => {
    const profile = {
      experience: 'intermediate' as const,
      startDate: '2030-01-07',
      workoutDays: [1, 3, 5],
      daysPerWeek: 3,
      mesoLength: 6,
      scheduleOverrides: {
        '2030-01-07': { to: '2030-01-08', sessionKey: '0:0' },
      },
    };
    const map = buildSessionDateMap(profile, 3, 6);
    expect(map['2030-01-07']).toBeUndefined();
    expect(map['2030-01-08']).toBe('0:0');
  });

  it('stacks when the override target is already occupied', () => {
    const profile = {
      experience: 'intermediate' as const,
      startDate: '2030-01-07',
      workoutDays: [1, 3, 5],
      daysPerWeek: 3,
      mesoLength: 6,
      // Move Mon 0:0 onto Wed, which already has 1:0.
      scheduleOverrides: {
        '2030-01-07': { to: '2030-01-09', sessionKey: '0:0' },
      },
    };
    const map = buildSessionDateMap(profile, 3, 6);
    expect(map['2030-01-07']).toBeUndefined();
    const wed = map['2030-01-09'];
    expect(Array.isArray(wed)).toBe(true);
    expect(wed).toEqual(expect.arrayContaining(['0:0', '1:0']));
  });

  it('returns {} when profile has no startDate', () => {
    const map = buildSessionDateMap({ experience: 'intermediate' }, 3, 6);
    expect(map).toEqual({});
  });
});

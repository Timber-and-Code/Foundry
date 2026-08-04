/**
 * Mesocycle display names must identify a specific cycle.
 *
 * They used to be month-granular, so two cycles begun in the same month got
 * byte-identical names. Prod has two distinct mesos both called "6 Week FB —
 * July 2026" — one holding 231 sets, one empty. Beyond confusing Previous
 * Meso Cycles, it is actively misleading wherever the name stands in for the
 * cycle: it is how a pair of perfectly ordinary rows got misdiagnosed as
 * duplicate training_day_exercises.
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
vi.mock('@sentry/react', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import { generateMesoName } from '../sync';

describe('generateMesoName', () => {
  it('includes the start day, not just the month', () => {
    expect(generateMesoName(6, 'FB' as never, '2026-08-03'))
      .toBe('6 Week FB — August 3, 2026');
  });

  it('distinguishes two cycles begun in the same month', () => {
    // The exact prod collision: 2026-07-30 and 2026-07-31 both became
    // "6 Week FB — July 2026".
    const a = generateMesoName(6, 'FB' as never, '2026-07-30');
    const b = generateMesoName(6, 'FB' as never, '2026-07-31');
    expect(a).not.toBe(b);
  });

  it('does not shift the date backwards in western timezones', () => {
    // `new Date('2026-08-03')` parses as UTC midnight, which is Aug 2 local
    // anywhere west of Greenwich — naming a cycle started on the 3rd "Aug 2".
    // Date-only strings must be read as LOCAL midnight.
    for (const d of ['2026-01-01', '2026-06-15', '2026-12-31']) {
      const [y, m, day] = d.split('-').map(Number);
      const local = new Date(y, m - 1, day);
      const name = generateMesoName(6, 'FB' as never, d);
      expect(name).toContain(`${local.toLocaleString('en-US', { month: 'long' })} ${day}, ${y}`);
    }
  });

  it('accepts a full timestamp as well as a date-only string', () => {
    expect(generateMesoName(4, 'UL' as never, '2026-03-09T14:22:00Z'))
      .toMatch(/^4 Week UL — March \d{1,2}, 2026$/);
  });

  it('falls back to today for a null or unparseable start', () => {
    for (const bad of [null, 'not-a-date']) {
      expect(generateMesoName(6, 'PPL' as never, bad)).toMatch(/^6 Week PPL — \w+ \d{1,2}, \d{4}$/);
    }
  });
});

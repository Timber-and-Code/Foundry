/**
 * Tests for the Big-Big Phase 1 dual-write infrastructure.
 *
 * Covers:
 *  - saveDayWeekV2 / loadDayWeekV2 round-trip + malformed JSON tolerance
 *  - saveDayWeek does NOT write v2 when the feature flag is off
 *  - saveDayWeek writes v2 when flag on + tde_ids cache populated + _exId stamped
 *  - saveDayWeek skips slots whose tde-id is missing from the cache
 *  - saveDayWeek's v1 write succeeds even if v2 write throws
 *
 * No vi.mock for supabase — these are pure persistence tests; sync wiring
 * fires fire-and-forget and any errors get swallowed by syncWorkoutToSupabase.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveDayWeek,
  saveDayWeekV2,
  loadDayWeekV2,
  isDayV2WritesEnabled,
} from '../persistence';
import type { DayData } from '../../types';

const FLAG_KEY = 'foundry:flag:day_v2_writes';
const ACTIVE_MESO_KEY = 'foundry:active_meso_id';

function setFlag(on: boolean): void {
  if (on) localStorage.setItem(FLAG_KEY, '1');
  else localStorage.removeItem(FLAG_KEY);
}

function seedTdeCache(mesoId: string, map: Record<string, string>): void {
  localStorage.setItem(`foundry:tde_ids:${mesoId}`, JSON.stringify(map));
}

describe('isDayV2WritesEnabled', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to false when flag is unset', () => {
    expect(isDayV2WritesEnabled()).toBe(false);
  });

  it('is true when flag is set to "1"', () => {
    setFlag(true);
    expect(isDayV2WritesEnabled()).toBe(true);
  });

  it('is false when flag is set to anything other than "1"', () => {
    localStorage.setItem(FLAG_KEY, '0');
    expect(isDayV2WritesEnabled()).toBe(false);
    localStorage.setItem(FLAG_KEY, 'true');
    expect(isDayV2WritesEnabled()).toBe(false);
  });
});

describe('saveDayWeekV2 / loadDayWeekV2', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips v2 data via the foundry:day_v2:{d}:{w} key', () => {
    const v2 = {
      'tde-uuid-a': { sortOrder: 0, exId: 'bench_press_bb', sets: { 0: { weight: '135', reps: '8' } } },
      'tde-uuid-b': { sortOrder: 1, exId: 'incline_db_press', sets: { 0: { weight: '50', reps: '10' } } },
    };
    saveDayWeekV2(2, 3, v2);
    const raw = localStorage.getItem('foundry:day_v2:2:3');
    expect(raw).not.toBeNull();
    expect(loadDayWeekV2(2, 3)).toEqual(v2);
  });

  it('returns {} for a missing key', () => {
    expect(loadDayWeekV2(0, 0)).toEqual({});
  });

  it('returns {} when stored JSON is malformed', () => {
    localStorage.setItem('foundry:day_v2:1:1', '{not valid json');
    expect(loadDayWeekV2(1, 1)).toEqual({});
  });

  it('returns {} when stored value is a JSON array (wrong shape)', () => {
    localStorage.setItem('foundry:day_v2:1:1', '[1,2,3]');
    expect(loadDayWeekV2(1, 1)).toEqual({});
  });

  it('returns {} when stored value is a JSON primitive', () => {
    localStorage.setItem('foundry:day_v2:1:1', '"a string"');
    expect(loadDayWeekV2(1, 1)).toEqual({});
  });
});

describe('saveDayWeek dual-write — flag OFF (default)', () => {
  beforeEach(() => localStorage.clear());

  it('does NOT write the v2 key when the flag is off, even with full cache', () => {
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-1');
    seedTdeCache('meso-1', { '0:0': 'tde-uuid-a' });
    const v1: DayData = { 0: { 0: { weight: '135', reps: '8', _exId: 'bench_press_bb' } as never } };

    saveDayWeek(0, 0, v1);

    expect(localStorage.getItem('foundry:day0:week0')).not.toBeNull();
    expect(localStorage.getItem('foundry:day_v2:0:0')).toBeNull();
  });
});

describe('saveDayWeek dual-write — flag ON', () => {
  beforeEach(() => {
    localStorage.clear();
    setFlag(true);
  });
  afterEach(() => vi.restoreAllMocks());

  it('writes v2 alongside v1 when cache + _exId are present', () => {
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-1');
    seedTdeCache('meso-1', { '0:0': 'tde-uuid-a', '0:1': 'tde-uuid-b' });
    const v1: DayData = {
      0: { 0: { weight: '135', reps: '8', _exId: 'bench_press_bb' } as never },
      1: { 0: { weight: '50', reps: '10', _exId: 'incline_db_press' } as never },
    };

    saveDayWeek(0, 0, v1);

    const v2 = loadDayWeekV2(0, 0);
    expect(Object.keys(v2).sort()).toEqual(['tde-uuid-a', 'tde-uuid-b']);
    expect(v2['tde-uuid-a'].exId).toBe('bench_press_bb');
    expect(v2['tde-uuid-a'].sortOrder).toBe(0);
    expect(v2['tde-uuid-b'].exId).toBe('incline_db_press');
    expect(v2['tde-uuid-b'].sortOrder).toBe(1);
    expect(v2['tde-uuid-a'].sets['0']).toMatchObject({ weight: '135', reps: '8' });
  });

  it('skips slots whose tde-id is missing from the cache (Phase 2 backfill)', () => {
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-1');
    // Only slot 0 has a mapping; slot 1 does not.
    seedTdeCache('meso-1', { '0:0': 'tde-uuid-a' });
    const v1: DayData = {
      0: { 0: { weight: '135', reps: '8', _exId: 'bench_press_bb' } as never },
      1: { 0: { weight: '50', reps: '10', _exId: 'incline_db_press' } as never },
    };

    saveDayWeek(0, 0, v1);

    const v2 = loadDayWeekV2(0, 0);
    expect(Object.keys(v2)).toEqual(['tde-uuid-a']);
    expect(v2['tde-uuid-a'].exId).toBe('bench_press_bb');
  });

  it('skips slots whose set blobs lack _exId (legacy pre-Med data)', () => {
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-1');
    seedTdeCache('meso-1', { '0:0': 'tde-uuid-a', '0:1': 'tde-uuid-b' });
    const v1: DayData = {
      // Slot 0: legacy data with no _exId — should be skipped.
      0: { 0: { weight: '135', reps: '8' } },
      // Slot 1: stamped — should write through.
      1: { 0: { weight: '50', reps: '10', _exId: 'incline_db_press' } as never },
    };

    saveDayWeek(0, 0, v1);

    const v2 = loadDayWeekV2(0, 0);
    expect(Object.keys(v2)).toEqual(['tde-uuid-b']);
  });

  it('does not write v2 at all when no slots qualify', () => {
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-1');
    seedTdeCache('meso-1', {}); // empty cache
    const v1: DayData = {
      0: { 0: { weight: '135', reps: '8', _exId: 'bench_press_bb' } as never },
    };

    saveDayWeek(0, 0, v1);

    expect(localStorage.getItem('foundry:day0:week0')).not.toBeNull();
    expect(localStorage.getItem('foundry:day_v2:0:0')).toBeNull();
  });

  it('skips v2 when active_meso_id is missing', () => {
    // No ACTIVE_MESO_KEY set.
    seedTdeCache('meso-1', { '0:0': 'tde-uuid-a' });
    const v1: DayData = {
      0: { 0: { weight: '135', reps: '8', _exId: 'bench_press_bb' } as never },
    };

    saveDayWeek(0, 0, v1);

    expect(localStorage.getItem('foundry:day0:week0')).not.toBeNull();
    expect(localStorage.getItem('foundry:day_v2:0:0')).toBeNull();
  });

  it('skips v2 (gracefully) when the tde_ids cache JSON is malformed', () => {
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-1');
    localStorage.setItem('foundry:tde_ids:meso-1', '{garbled');
    const v1: DayData = {
      0: { 0: { weight: '135', reps: '8', _exId: 'bench_press_bb' } as never },
    };

    saveDayWeek(0, 0, v1);

    expect(localStorage.getItem('foundry:day0:week0')).not.toBeNull();
    expect(localStorage.getItem('foundry:day_v2:0:0')).toBeNull();
  });

  it('v1 write succeeds even if the v2 path throws', () => {
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-1');
    seedTdeCache('meso-1', { '0:0': 'tde-uuid-a' });
    const v1: DayData = {
      0: { 0: { weight: '135', reps: '8', _exId: 'bench_press_bb' } as never },
    };

    // Force the v2 write path to throw by stubbing JSON.stringify to fail
    // ONLY on the v2 payload (object containing tde-uuid-a as a key). The v1
    // write call passes the user's DayData first, so we can target the
    // second invocation by inspecting argument shape.
    const realStringify = JSON.stringify;
    const spy = vi.spyOn(JSON, 'stringify').mockImplementation((value: unknown, ...rest: unknown[]) => {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.prototype.hasOwnProperty.call(value, 'tde-uuid-a')
      ) {
        throw new Error('boom (v2 stringify)');
      }
      return realStringify(value, rest[0] as never, rest[1] as never);
    });

    // Should NOT throw despite the v2 stringify blowing up.
    expect(() => saveDayWeek(0, 0, v1)).not.toThrow();

    // v1 write still landed.
    const raw = localStorage.getItem('foundry:day0:week0');
    expect(raw).not.toBeNull();
    expect(realStringify(JSON.parse(raw as string))).toBe(realStringify(v1));
    // v2 was attempted but failed → key absent.
    expect(localStorage.getItem('foundry:day_v2:0:0')).toBeNull();

    spy.mockRestore();
  });
});

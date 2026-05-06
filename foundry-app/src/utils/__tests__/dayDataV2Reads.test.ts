/**
 * Tests for the Big-Big Phase 3 v2 read path on `loadDayWeekWithCarryover`.
 *
 * Covers:
 *  - isDayV2ReadsEnabled flag basics
 *  - Flag OFF — carryover behaves identically to the v1-only path (regression)
 *  - Flag ON + v2 prior week populated — carryover values come from the
 *    tdeId-keyed v2 lookup
 *  - Flag ON + v2 empty / no active_meso_id / no tde-ids cache / malformed
 *    cache — falls through to the v1 carryover path
 *  - tdeId reorder scenario — v2 lookup follows the row's identity, not the
 *    slot's array position; an exercise that moved between weeks still pulls
 *    its own history (not the slot's previous occupant)
 *
 * Carryover math itself is covered by the existing v1 carryover tests; these
 * tests focus on the read-path branch (v2-first, v1-fallback) and confirm
 * the math runs end-to-end on each branch.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadDayWeekWithCarryover,
  isDayV2ReadsEnabled,
} from '../persistence';
import type { DayData, DayDataV2, Profile, TrainingDay } from '../../types';

const READS_FLAG = 'foundry:flag:day_v2_reads';
const ACTIVE_MESO_KEY = 'foundry:active_meso_id';

function setReadsFlag(on: boolean): void {
  if (on) localStorage.setItem(READS_FLAG, '1');
  else localStorage.removeItem(READS_FLAG);
}

function seedV1(dayIdx: number, weekIdx: number, data: DayData): void {
  localStorage.setItem(`foundry:day${dayIdx}:week${weekIdx}`, JSON.stringify(data));
}

function seedV2(dayIdx: number, weekIdx: number, data: DayDataV2): void {
  localStorage.setItem(`foundry:day_v2:${dayIdx}:${weekIdx}`, JSON.stringify(data));
}

function seedTdeCache(mesoId: string, map: Record<string, string>): void {
  localStorage.setItem(`foundry:active_meso_id`, mesoId);
  localStorage.setItem(`foundry:tde_ids:${mesoId}`, JSON.stringify(map));
}

const PROFILE: Profile = {
  experience: 'intermediate',
} as Profile;

// Two-exercise day used by most carryover scenarios. Reps = '6-10', sets = 3.
function dayWith(exId1: string, exId2: string): TrainingDay {
  return {
    label: 'Day 1',
    exercises: [
      {
        id: exId1,
        name: 'Bench Press',
        muscle: 'Chest',
        equipment: 'barbell',
        sets: 3,
        reps: '6-10',
      },
      {
        id: exId2,
        name: 'Overhead Press',
        muscle: 'Shoulders',
        equipment: 'barbell',
        sets: 3,
        reps: '6-10',
      },
    ],
  };
}

describe('isDayV2ReadsEnabled', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to false when flag is unset', () => {
    expect(isDayV2ReadsEnabled()).toBe(false);
  });

  it('is true when flag is set to "1"', () => {
    setReadsFlag(true);
    expect(isDayV2ReadsEnabled()).toBe(true);
  });

  it('is false for any value other than "1"', () => {
    localStorage.setItem(READS_FLAG, '0');
    expect(isDayV2ReadsEnabled()).toBe(false);
    localStorage.setItem(READS_FLAG, 'true');
    expect(isDayV2ReadsEnabled()).toBe(false);
  });
});

describe('loadDayWeekWithCarryover — flag OFF (regression)', () => {
  beforeEach(() => localStorage.clear());

  it('carries over from v1 when flag is OFF (no v2 read attempted)', () => {
    // Week 0 v1: bench 100x10, OHP 50x10 — both at top of range → expect bumps.
    seedV1(0, 0, {
      0: { 0: { weight: '100', reps: '10' }, 1: { weight: '100', reps: '10' }, 2: { weight: '100', reps: '10' } },
      1: { 0: { weight: '50', reps: '10' }, 1: { weight: '50', reps: '10' }, 2: { weight: '50', reps: '10' } },
    });
    // Week 0 v2: deliberately seed with WRONG numbers — flag-off should ignore this.
    seedV2(0, 0, {
      'tde-bench': { sortOrder: 0, exId: 'bench', sets: { 0: { weight: '999', reps: '10' } } },
    });
    seedTdeCache('meso-A', { '0:0': 'tde-bench', '0:1': 'tde-ohp' });

    const result = loadDayWeekWithCarryover(0, 1, dayWith('bench', 'ohp'), PROFILE);

    // Bench: 100 → all reps at top → barbell +5 → 105 (suggested), reset reps to rangeMin (6).
    expect(result[0][0]).toEqual({ weight: '105', reps: '6', suggested: true, repsSuggested: true });
    // OHP: same pattern → 50 + 5 = 55.
    expect(result[1][0]).toEqual({ weight: '55', reps: '6', suggested: true, repsSuggested: true });
  });
});

describe('loadDayWeekWithCarryover — flag ON, v2 hit', () => {
  beforeEach(() => localStorage.clear());

  it('reads carryover from v2 when v2 has prior-week data', () => {
    setReadsFlag(true);
    // Week 0 v1 deliberately wrong — flag-on path should ignore v1 when v2 hits.
    seedV1(0, 0, {
      0: { 0: { weight: '999', reps: '10' } },
    });
    // Week 0 v2: bench 100x10 on all 3 sets → expect 100 → 105 nudge.
    seedV2(0, 0, {
      'tde-bench': {
        sortOrder: 0,
        exId: 'bench',
        sets: {
          0: { weight: '100', reps: '10' },
          1: { weight: '100', reps: '10' },
          2: { weight: '100', reps: '10' },
        },
      },
      'tde-ohp': {
        sortOrder: 1,
        exId: 'ohp',
        sets: {
          0: { weight: '50', reps: '8' },
          1: { weight: '50', reps: '8' },
          2: { weight: '50', reps: '8' },
        },
      },
    });
    seedTdeCache('meso-A', { '0:0': 'tde-bench', '0:1': 'tde-ohp' });

    const result = loadDayWeekWithCarryover(0, 1, dayWith('bench', 'ohp'), PROFILE);

    // Bench: 100x10 baseline, all reps at top → +5 → 105, reset to rangeMin=6.
    expect(result[0][0]).toEqual({ weight: '105', reps: '6', suggested: true, repsSuggested: true });
    // OHP: 50x8 baseline, NOT at top of range (rangeMax=10), no nudge → hold 50, +1 rep → 9.
    expect(result[1][0]).toEqual({ weight: '50', reps: '9', suggested: false, repsSuggested: true });
  });

  it('follows tdeId on slot reorder — week 1 slot 0 reads its own row, not the slot occupant', () => {
    setReadsFlag(true);
    // Week 0 v2: tde-bench was at slot 0, tde-ohp at slot 1.
    seedV2(0, 0, {
      'tde-bench': {
        sortOrder: 0,
        exId: 'bench',
        sets: {
          0: { weight: '100', reps: '10' },
          1: { weight: '100', reps: '10' },
          2: { weight: '100', reps: '10' },
        },
      },
      'tde-ohp': {
        sortOrder: 1,
        exId: 'ohp',
        sets: {
          0: { weight: '60', reps: '6' },
          1: { weight: '60', reps: '6' },
          2: { weight: '60', reps: '6' },
        },
      },
    });
    // Week 1: user has reordered — OHP is now at slot 0, Bench at slot 1.
    // Cache reflects the new positions.
    seedTdeCache('meso-A', { '0:0': 'tde-ohp', '0:1': 'tde-bench' });

    const result = loadDayWeekWithCarryover(0, 1, dayWith('ohp', 'bench'), PROFILE);

    // Slot 0 is now OHP — pulls tde-ohp's history (60x6, NOT at top of 6-10 → hold).
    expect(result[0][0]).toEqual({ weight: '60', reps: '7', suggested: false, repsSuggested: true });
    // Slot 1 is now Bench — pulls tde-bench's history (100x10 → +5 → 105, reset reps to 6).
    expect(result[1][0]).toEqual({ weight: '105', reps: '6', suggested: true, repsSuggested: true });
  });
});

describe('loadDayWeekWithCarryover — flag ON, v2 fallthrough', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to v1 when v2 has no prior week with weights', () => {
    setReadsFlag(true);
    // v2 entirely empty.
    seedV1(0, 0, {
      0: { 0: { weight: '120', reps: '6' }, 1: { weight: '120', reps: '6' }, 2: { weight: '120', reps: '6' } },
      1: { 0: { weight: '40', reps: '8' }, 1: { weight: '40', reps: '8' }, 2: { weight: '40', reps: '8' } },
    });
    seedTdeCache('meso-A', { '0:0': 'tde-bench', '0:1': 'tde-ohp' });

    const result = loadDayWeekWithCarryover(0, 1, dayWith('bench', 'ohp'), PROFILE);

    // Bench: 120x6 → only 6 reps, rangeMax=10, NOT at top → hold weight, +1 rep → 7.
    expect(result[0][0]).toEqual({ weight: '120', reps: '7', suggested: false, repsSuggested: true });
    // OHP: 40x8 → not at top → hold, +1 rep → 9.
    expect(result[1][0]).toEqual({ weight: '40', reps: '9', suggested: false, repsSuggested: true });
  });

  it('falls back to v1 when active_meso_id is missing', () => {
    setReadsFlag(true);
    seedV1(0, 0, {
      0: { 0: { weight: '100', reps: '10' }, 1: { weight: '100', reps: '10' }, 2: { weight: '100', reps: '10' } },
    });
    seedV2(0, 0, {
      'tde-bench': { sortOrder: 0, exId: 'bench', sets: { 0: { weight: '999', reps: '10' } } },
    });
    // No meso id seeded — v2 path can't resolve tdeIds, falls to v1.
    expect(localStorage.getItem(ACTIVE_MESO_KEY)).toBeNull();

    const result = loadDayWeekWithCarryover(0, 1, dayWith('bench', 'ohp'), PROFILE);

    // V1 carryover: 100x10 → +5 → 105, rangeMin reset.
    expect(result[0][0]).toEqual({ weight: '105', reps: '6', suggested: true, repsSuggested: true });
  });

  it('falls back to v1 when tde_ids cache is missing for the active meso', () => {
    setReadsFlag(true);
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-A');
    // No tde_ids:meso-A key — v2 path bails.
    seedV1(0, 0, {
      0: { 0: { weight: '100', reps: '10' }, 1: { weight: '100', reps: '10' }, 2: { weight: '100', reps: '10' } },
    });
    seedV2(0, 0, {
      'tde-bench': { sortOrder: 0, exId: 'bench', sets: { 0: { weight: '999', reps: '10' } } },
    });

    const result = loadDayWeekWithCarryover(0, 1, dayWith('bench', 'ohp'), PROFILE);

    expect(result[0][0]).toEqual({ weight: '105', reps: '6', suggested: true, repsSuggested: true });
  });

  it('falls back to v1 when tde_ids cache JSON is malformed', () => {
    setReadsFlag(true);
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-A');
    localStorage.setItem('foundry:tde_ids:meso-A', '{not valid json');
    seedV1(0, 0, {
      0: { 0: { weight: '100', reps: '10' }, 1: { weight: '100', reps: '10' }, 2: { weight: '100', reps: '10' } },
    });

    const result = loadDayWeekWithCarryover(0, 1, dayWith('bench', 'ohp'), PROFILE);

    expect(result[0][0]).toEqual({ weight: '105', reps: '6', suggested: true, repsSuggested: true });
  });

  it('current-week data short-circuits v2 path (returns current as-is)', () => {
    setReadsFlag(true);
    seedTdeCache('meso-A', { '0:0': 'tde-bench' });
    // Week 1 v1 already has user-logged data → return it, no carryover.
    const currentData: DayData = {
      0: { 0: { weight: '110', reps: '8' } },
    };
    seedV1(0, 1, currentData);

    const result = loadDayWeekWithCarryover(0, 1, dayWith('bench', 'ohp'), PROFILE);

    expect(result).toEqual(currentData);
  });
});

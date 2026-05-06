/**
 * Tests for the Big-Big Phase 2 v1 → v2 migration.
 *
 * Covers:
 *   - Pure migrateDayDataToV2: shape, exId resolution order, _exId stripping,
 *     orphan reasons.
 *   - Storage runner runDayDataV2Migration: prereq guards, multi-key walk,
 *     idempotency on re-run, v1-snapshot backup behaviour, accurate counts.
 *
 * No vi.mock for supabase — saveDayWeekV2 is a pure localStorage write; sync
 * wiring isn't touched here.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  migrateDayDataToV2,
  runDayDataV2Migration,
  type MigrationContext,
} from '../dayDataV2Migration';
import type { DayData, TrainingDay } from '../../types';

const ACTIVE_MESO_KEY = 'foundry:active_meso_id';

function seedTdeCache(mesoId: string, map: Record<string, string>): void {
  localStorage.setItem(`foundry:tde_ids:${mesoId}`, JSON.stringify(map));
}

function seedStoredProgram(program: TrainingDay[]): void {
  localStorage.setItem('foundry:storedProgram', JSON.stringify(program));
}

// ─── PURE TRANSFORM ─────────────────────────────────────────────────────────

describe('migrateDayDataToV2 — pure transform', () => {
  const baseCtx: MigrationContext = {
    tdeIdMap: { '0:0': 'tde-a', '0:1': 'tde-b', '0:2': 'tde-c' },
    programExIds: {
      '0:0': 'bench_press_bb',
      '0:1': 'incline_db_press',
      '0:2': 'cable_fly',
    },
  };

  it('returns empty v2 + no orphans for empty v1 input', () => {
    const out = migrateDayDataToV2({}, 0, baseCtx);
    expect(out.v2).toEqual({});
    expect(out.skipped).toEqual([]);
  });

  it('migrates a standard 3-exercise day with sortOrder, exId, sets', () => {
    const v1: DayData = {
      0: {
        0: { weight: '135', reps: '8', _exId: 'bench_press_bb' } as never,
        1: { weight: '135', reps: '8', _exId: 'bench_press_bb' } as never,
      },
      1: {
        0: { weight: '50', reps: '10', _exId: 'incline_db_press' } as never,
      },
      2: {
        0: { weight: '30', reps: '12', _exId: 'cable_fly' } as never,
      },
    };

    const { v2, skipped } = migrateDayDataToV2(v1, 0, baseCtx);

    expect(skipped).toEqual([]);
    expect(Object.keys(v2).sort()).toEqual(['tde-a', 'tde-b', 'tde-c']);
    expect(v2['tde-a']).toMatchObject({ sortOrder: 0, exId: 'bench_press_bb' });
    expect(v2['tde-b']).toMatchObject({ sortOrder: 1, exId: 'incline_db_press' });
    expect(v2['tde-c']).toMatchObject({ sortOrder: 2, exId: 'cable_fly' });
    expect(v2['tde-a'].sets['0']).toMatchObject({ weight: '135', reps: '8' });
    expect(v2['tde-a'].sets['1']).toMatchObject({ weight: '135', reps: '8' });
  });

  it('uses _exId from any set in the slice when present', () => {
    const v1: DayData = {
      0: {
        // First set lacks the marker; second set carries it. Resolver should
        // walk until it finds one.
        0: { weight: '135', reps: '8' },
        1: { weight: '135', reps: '8', _exId: 'wide_grip_bench' } as never,
      },
    };
    // Program-level fallback would be `bench_press_bb`; _exId on the set
    // wins, so the v2 record reflects the swap.
    const { v2 } = migrateDayDataToV2(v1, 0, baseCtx);
    expect(v2['tde-a'].exId).toBe('wide_grip_bench');
  });

  it('falls back to programExIds when no set carries _exId', () => {
    const v1: DayData = {
      0: {
        0: { weight: '135', reps: '8' },
        1: { weight: '135', reps: '8' },
      },
    };
    const { v2 } = migrateDayDataToV2(v1, 0, baseCtx);
    expect(v2['tde-a'].exId).toBe('bench_press_bb');
  });

  it('records no_tde_id orphan when the slot has no uuid mapping', () => {
    const v1: DayData = {
      0: { 0: { weight: '135', reps: '8', _exId: 'bench_press_bb' } as never },
      9: { 0: { weight: '50', reps: '10', _exId: 'random_ex' } as never },
    };
    const { v2, skipped } = migrateDayDataToV2(v1, 0, baseCtx);
    expect(Object.keys(v2)).toEqual(['tde-a']);
    expect(skipped).toEqual([{ exIdx: 9, reason: 'no_tde_id' }]);
  });

  it('records no_ex_id orphan when both _exId and programExIds are missing', () => {
    const v1: DayData = {
      0: { 0: { weight: '135', reps: '8' } },
    };
    const { v2, skipped } = migrateDayDataToV2(v1, 0, {
      tdeIdMap: { '0:0': 'tde-a' },
      programExIds: {}, // no fallback
    });
    expect(v2).toEqual({});
    expect(skipped).toEqual([{ exIdx: 0, reason: 'no_ex_id' }]);
  });

  it('strips _exId from each set in the v2 output', () => {
    const v1: DayData = {
      0: {
        0: { weight: '135', reps: '8', _exId: 'bench_press_bb' } as never,
        1: { weight: '135', reps: '8', _exId: 'bench_press_bb' } as never,
      },
    };
    const { v2 } = migrateDayDataToV2(v1, 0, baseCtx);
    for (const setKey of Object.keys(v2['tde-a'].sets)) {
      const blob = v2['tde-a'].sets[setKey] as unknown as Record<string, unknown>;
      expect(blob._exId).toBeUndefined();
      // Sanity: the rest of the WorkoutSet payload survives intact.
      expect(blob.weight).toBe('135');
      expect(blob.reps).toBe('8');
    }
  });

  it('preserves WorkoutSet flags (warmup, suggested, repsSuggested, rpe)', () => {
    const v1: DayData = {
      0: {
        0: {
          weight: '95',
          reps: '10',
          warmup: true,
          suggested: true,
          repsSuggested: true,
          rpe: 8,
          _exId: 'bench_press_bb',
        } as never,
      },
    };
    const { v2 } = migrateDayDataToV2(v1, 0, baseCtx);
    expect(v2['tde-a'].sets['0']).toMatchObject({
      weight: '95',
      reps: '10',
      warmup: true,
      suggested: true,
      repsSuggested: true,
      rpe: 8,
    });
  });

  it('uses the dayIdx parameter to scope tdeIdMap lookups', () => {
    const ctx: MigrationContext = {
      tdeIdMap: { '1:0': 'tde-d1-0', '0:0': 'tde-d0-0' },
      programExIds: { '1:0': 'bench_press_bb' },
    };
    const v1: DayData = {
      0: { 0: { weight: '135', reps: '8', _exId: 'bench_press_bb' } as never },
    };
    const { v2 } = migrateDayDataToV2(v1, 1, ctx);
    expect(Object.keys(v2)).toEqual(['tde-d1-0']);
  });
});

// ─── STORAGE RUNNER ─────────────────────────────────────────────────────────

describe('runDayDataV2Migration — storage runner', () => {
  beforeEach(() => localStorage.clear());

  it('is a no-op when foundry:active_meso_id is missing', () => {
    const result = runDayDataV2Migration();
    expect(result.migrated).toBe(0);
    expect(result.skippedPrereq).toBe(1);
  });

  it('is a no-op when foundry:tde_ids:{mesoId} is missing', () => {
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-1');
    const result = runDayDataV2Migration();
    expect(result.migrated).toBe(0);
    expect(result.skippedPrereq).toBe(1);
  });

  it('is a no-op when the tde_ids cache is malformed JSON', () => {
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-1');
    localStorage.setItem('foundry:tde_ids:meso-1', '{not json');
    const result = runDayDataV2Migration();
    expect(result.migrated).toBe(0);
    expect(result.skippedPrereq).toBe(1);
  });

  it('is a no-op when no v1 day keys exist', () => {
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-1');
    seedTdeCache('meso-1', { '0:0': 'tde-a' });
    const result = runDayDataV2Migration();
    expect(result.migrated).toBe(0);
    expect(result.skippedPrereq).toBe(1);
  });

  it('walks all v1 keys and migrates them', () => {
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-1');
    seedTdeCache('meso-1', {
      '0:0': 'tde-d0-0',
      '0:1': 'tde-d0-1',
      '1:0': 'tde-d1-0',
    });
    const program: TrainingDay[] = [
      {
        exercises: [
          { id: 'bench_press_bb', name: 'Bench', muscle: 'chest' },
          { id: 'incline_db_press', name: 'Incline DB', muscle: 'chest' },
        ],
      },
      {
        exercises: [{ id: 'squat_bb', name: 'Squat', muscle: 'quads' }],
      },
    ];
    seedStoredProgram(program);

    // Two days, two weeks each — four v1 records total.
    const v1Day0Wk0: DayData = {
      0: { 0: { weight: '135', reps: '8', _exId: 'bench_press_bb' } as never },
      1: { 0: { weight: '50', reps: '10', _exId: 'incline_db_press' } as never },
    };
    const v1Day0Wk1: DayData = {
      0: { 0: { weight: '140', reps: '8', _exId: 'bench_press_bb' } as never },
    };
    const v1Day1Wk0: DayData = {
      0: { 0: { weight: '225', reps: '5', _exId: 'squat_bb' } as never },
    };
    const v1Day1Wk1: DayData = {
      0: { 0: { weight: '230', reps: '5', _exId: 'squat_bb' } as never },
    };
    localStorage.setItem('foundry:day0:week0', JSON.stringify(v1Day0Wk0));
    localStorage.setItem('foundry:day0:week1', JSON.stringify(v1Day0Wk1));
    localStorage.setItem('foundry:day1:week0', JSON.stringify(v1Day1Wk0));
    localStorage.setItem('foundry:day1:week1', JSON.stringify(v1Day1Wk1));

    const result = runDayDataV2Migration();

    expect(result.migrated).toBe(4);
    expect(result.alreadyMigrated).toBe(0);
    expect(result.skippedPrereq).toBe(0);
    expect(result.orphanSlots).toEqual([]);

    // Every v1 pair has a v2 record now.
    expect(localStorage.getItem('foundry:day_v2:0:0')).not.toBeNull();
    expect(localStorage.getItem('foundry:day_v2:0:1')).not.toBeNull();
    expect(localStorage.getItem('foundry:day_v2:1:0')).not.toBeNull();
    expect(localStorage.getItem('foundry:day_v2:1:1')).not.toBeNull();

    // And v1 is intact (not deleted — Phase 4 owns deletion).
    expect(localStorage.getItem('foundry:day0:week0')).not.toBeNull();

    // Spot-check shape of one v2 record.
    const v2Wk0Raw = localStorage.getItem('foundry:day_v2:0:0');
    const v2Wk0 = JSON.parse(v2Wk0Raw as string);
    expect(Object.keys(v2Wk0).sort()).toEqual(['tde-d0-0', 'tde-d0-1']);
    expect(v2Wk0['tde-d0-0'].exId).toBe('bench_press_bb');
    expect(v2Wk0['tde-d0-0'].sortOrder).toBe(0);
    // _exId is stripped.
    expect(v2Wk0['tde-d0-0'].sets['0']._exId).toBeUndefined();
  });

  it('is idempotent: re-running with v2 already present skips those pairs', () => {
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-1');
    seedTdeCache('meso-1', { '0:0': 'tde-a' });
    seedStoredProgram([
      { exercises: [{ id: 'bench_press_bb', name: 'Bench', muscle: 'chest' }] },
    ]);
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({
        0: { 0: { weight: '135', reps: '8', _exId: 'bench_press_bb' } },
      }),
    );

    const first = runDayDataV2Migration();
    expect(first.migrated).toBe(1);
    expect(first.alreadyMigrated).toBe(0);

    const second = runDayDataV2Migration();
    expect(second.migrated).toBe(0);
    expect(second.alreadyMigrated).toBe(1);
  });

  it('snapshots v1 to backup key before writing v2', () => {
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-1');
    seedTdeCache('meso-1', { '0:0': 'tde-a' });
    seedStoredProgram([
      { exercises: [{ id: 'bench_press_bb', name: 'Bench', muscle: 'chest' }] },
    ]);
    const v1Json = JSON.stringify({
      0: { 0: { weight: '135', reps: '8', _exId: 'bench_press_bb' } },
    });
    localStorage.setItem('foundry:day0:week0', v1Json);

    runDayDataV2Migration();

    expect(localStorage.getItem('foundry:backup:day0:week0:v1')).toBe(v1Json);
  });

  it('does not overwrite an existing backup on subsequent migration passes', () => {
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-1');
    seedTdeCache('meso-1', { '0:0': 'tde-a' });
    seedStoredProgram([
      { exercises: [{ id: 'bench_press_bb', name: 'Bench', muscle: 'chest' }] },
    ]);
    // Pre-existing backup from a prior run.
    const existingBackup = '{"prior":true}';
    localStorage.setItem('foundry:backup:day0:week0:v1', existingBackup);
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({
        0: { 0: { weight: '135', reps: '8', _exId: 'bench_press_bb' } },
      }),
    );

    runDayDataV2Migration();

    // Backup unchanged.
    expect(localStorage.getItem('foundry:backup:day0:week0:v1')).toBe(existingBackup);
    // But v2 still got written.
    expect(localStorage.getItem('foundry:day_v2:0:0')).not.toBeNull();
  });

  it('reports orphan slots without aborting the rest of the day', () => {
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-1');
    // Slot 0 has a uuid; slot 1 doesn't.
    seedTdeCache('meso-1', { '0:0': 'tde-a' });
    seedStoredProgram([
      {
        exercises: [
          { id: 'bench_press_bb', name: 'Bench', muscle: 'chest' },
          { id: 'incline_db_press', name: 'Incline', muscle: 'chest' },
        ],
      },
    ]);
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({
        0: { 0: { weight: '135', reps: '8', _exId: 'bench_press_bb' } },
        1: { 0: { weight: '50', reps: '10', _exId: 'incline_db_press' } },
      }),
    );

    const result = runDayDataV2Migration();

    expect(result.migrated).toBe(1);
    expect(result.orphanSlots).toEqual([
      { dayIdx: 0, weekIdx: 0, exIdx: 1, reason: 'no_tde_id' },
    ]);
    // The good slot still landed.
    const v2Raw = localStorage.getItem('foundry:day_v2:0:0');
    const v2 = JSON.parse(v2Raw as string);
    expect(Object.keys(v2)).toEqual(['tde-a']);
  });

  it('migrates legacy pre-Med data via programExIds fallback', () => {
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-1');
    seedTdeCache('meso-1', { '0:0': 'tde-a' });
    seedStoredProgram([
      { exercises: [{ id: 'bench_press_bb', name: 'Bench', muscle: 'chest' }] },
    ]);
    // No `_exId` on the set — pre-Med legacy.
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({ 0: { 0: { weight: '135', reps: '8' } } }),
    );

    const result = runDayDataV2Migration();
    expect(result.migrated).toBe(1);
    expect(result.orphanSlots).toEqual([]);

    const v2Raw = localStorage.getItem('foundry:day_v2:0:0');
    const v2 = JSON.parse(v2Raw as string);
    expect(v2['tde-a'].exId).toBe('bench_press_bb');
  });

  it('handles a missing storedProgram by recording no_ex_id orphans', () => {
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-1');
    seedTdeCache('meso-1', { '0:0': 'tde-a' });
    // No storedProgram → no fallback exId. Set has no _exId either.
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({ 0: { 0: { weight: '135', reps: '8' } } }),
    );

    const result = runDayDataV2Migration();
    expect(result.migrated).toBe(1);
    expect(result.orphanSlots).toEqual([
      { dayIdx: 0, weekIdx: 0, exIdx: 0, reason: 'no_ex_id' },
    ]);
    // v2 was written but is empty.
    const v2Raw = localStorage.getItem('foundry:day_v2:0:0');
    expect(JSON.parse(v2Raw as string)).toEqual({});
  });

  it('skips malformed v1 JSON without throwing', () => {
    localStorage.setItem(ACTIVE_MESO_KEY, 'meso-1');
    seedTdeCache('meso-1', { '0:0': 'tde-a' });
    seedStoredProgram([
      { exercises: [{ id: 'bench_press_bb', name: 'Bench', muscle: 'chest' }] },
    ]);
    localStorage.setItem('foundry:day0:week0', '{garbled');
    // Plus a valid neighbour to confirm the loop continues.
    localStorage.setItem(
      'foundry:day1:week0',
      JSON.stringify({ 0: { 0: { weight: '135', reps: '8', _exId: 'bench_press_bb' } } }),
    );
    seedTdeCache('meso-1', { '0:0': 'tde-a', '1:0': 'tde-b' });

    expect(() => runDayDataV2Migration()).not.toThrow();
    // Day 1 still landed.
    expect(localStorage.getItem('foundry:day_v2:1:0')).not.toBeNull();
    // Day 0 (garbled) is absent.
    expect(localStorage.getItem('foundry:day_v2:0:0')).toBeNull();
  });
});

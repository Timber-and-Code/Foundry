/**
 * Tests for progressAggregation:
 *   aggregateLiftsByMuscle, aggregatePreviousMesos
 * Plus the small pure helpers (normaliseMuscle, epleyE1RM).
 */
import { describe, it, expect } from 'vitest';
import {
  aggregateLiftsByMuscle,
  aggregatePreviousMesos,
  findLastMesoWeight,
  normaliseMuscle,
  epleyE1RM,
} from '../progressAggregation';
import type { DayData, TrainingDay, ArchiveEntry } from '../../types';
import type { ExerciseEntry } from '../../data/exerciseDB';

// ─── pure helpers ────────────────────────────────────────────────────────

describe('normaliseMuscle', () => {
  it('rolls Bicep / Biceps / Tricep / Triceps into Arms', () => {
    expect(normaliseMuscle('Bicep')).toBe('Arms');
    expect(normaliseMuscle('Biceps')).toBe('Arms');
    expect(normaliseMuscle('Tricep')).toBe('Arms');
    expect(normaliseMuscle('Triceps')).toBe('Arms');
    expect(normaliseMuscle('biceps')).toBe('Arms');
  });

  it('passes through other muscles unchanged', () => {
    expect(normaliseMuscle('Chest')).toBe('Chest');
    expect(normaliseMuscle('Back')).toBe('Back');
    expect(normaliseMuscle('Hamstrings')).toBe('Hamstrings');
  });

  it('falls back to Other for missing values', () => {
    expect(normaliseMuscle(undefined)).toBe('Other');
    expect(normaliseMuscle('')).toBe('Other');
  });
});

describe('epleyE1RM', () => {
  it('matches the Epley formula weight * (1 + reps/30)', () => {
    expect(epleyE1RM(100, 0)).toBe(0); // 0 reps → bail
    expect(epleyE1RM(225, 5)).toBeCloseTo(225 * (1 + 5 / 30), 6);
    expect(epleyE1RM(135, 10)).toBeCloseTo(135 * (1 + 10 / 30), 6);
  });

  it('returns 0 on garbage input', () => {
    expect(epleyE1RM('', '')).toBe(0);
    expect(epleyE1RM('abc', 5)).toBe(0);
    expect(epleyE1RM(100, 'def')).toBe(0);
    expect(epleyE1RM(-50, 5)).toBe(0);
  });

  it('parses numeric strings', () => {
    expect(epleyE1RM('100', '6')).toBeCloseTo(100 * (1 + 6 / 30), 6);
  });
});

// ─── aggregateLiftsByMuscle ──────────────────────────────────────────────

describe('aggregateLiftsByMuscle', () => {
  function makeDays(): TrainingDay[] {
    return [
      {
        label: 'Push A',
        tag: 'PUSH',
        exercises: [
          { id: 'bench_bb', name: 'Bench Press', muscle: 'Chest', anchor: true, sets: 3, reps: '6-8' },
          { id: 'ohp_bb', name: 'Overhead Press', muscle: 'Shoulders', sets: 3, reps: '8' },
          // Bicep should fold into Arms
          { id: 'ez_curl', name: 'EZ Curl', muscle: 'Biceps', sets: 3, reps: '10' },
        ],
      },
      {
        label: 'Pull A',
        tag: 'PULL',
        exercises: [
          { id: 'row_bb', name: 'Barbell Row', muscle: 'Back', anchor: true, sets: 3, reps: '6-8' },
          // Tricep should also fold into Arms (same group as Biceps)
          { id: 'rope_pd', name: 'Tricep Rope', muscle: 'Triceps', sets: 3, reps: '12' },
        ],
      },
    ];
  }

  it('returns empty array when there is no logged data', () => {
    const days = makeDays();
    const out = aggregateLiftsByMuscle(days, 4, () => ({}));
    expect(out).toEqual([]);
  });

  it('aggregates start → current and PR across multiple weeks', () => {
    const days = makeDays();

    // Bench Press: w0 top 200, w1 top 210, w2 top 215 (and 215×6 = e1RM ~258)
    const weekData: Record<string, DayData> = {
      '0:0': {
        0: { 0: { weight: '135', reps: '5', warmup: true }, 1: { weight: '200', reps: '6' }, 2: { weight: '200', reps: '5' } },
        1: { 0: { weight: '95', reps: '8' } },
      },
      '0:1': {
        0: { 0: { weight: '210', reps: '6' }, 1: { weight: '205', reps: '6' } },
      },
      '0:2': {
        0: { 0: { weight: '215', reps: '6' } },
      },
    };
    const out = aggregateLiftsByMuscle(days, 3, (d, w) => weekData[`${d}:${w}`] || {});

    const chest = out.find((m) => m.muscle === 'Chest');
    expect(chest).toBeDefined();
    expect(chest!.lifts).toHaveLength(1);
    const bench = chest!.lifts[0];
    expect(bench.name).toBe('Bench Press');
    expect(bench.start).toBe(200);
    expect(bench.current).toBe(215);
    // PR e1RM = max over all weeks. Best = 215 * (1 + 6/30) = 258.
    expect(bench.pr).toBe(258);
  });

  it('skips warmup sets when computing top working weight', () => {
    const days: TrainingDay[] = [
      {
        label: 'Day',
        exercises: [{ id: 'bench_bb', name: 'Bench Press', muscle: 'Chest', sets: 2, reps: '6' }],
      },
    ];
    // Warmup at 300 (very heavy) — should be ignored. Real top is 100.
    const weekData: DayData = {
      0: {
        0: { weight: '300', reps: '5', warmup: true },
        1: { weight: '100', reps: '6' },
      },
    };
    const out = aggregateLiftsByMuscle(days, 1, () => weekData);
    expect(out[0].lifts[0].current).toBe(100);
    expect(out[0].lifts[0].pr).toBe(Math.round(100 * (1 + 6 / 30)));
  });

  it('picks the heaviest working set as the top set (multi-set selection)', () => {
    const days: TrainingDay[] = [
      {
        label: 'Day',
        exercises: [{ id: 'sq_bb', name: 'Back Squat', muscle: 'Quads', sets: 3, reps: '6' }],
      },
    ];
    const weekData: DayData = {
      0: {
        0: { weight: '225', reps: '6' }, 1: { weight: '245', reps: '6' }, 2: { weight: '225', reps: '5' },
      },
    };
    const out = aggregateLiftsByMuscle(days, 1, () => weekData);
    expect(out[0].lifts[0].current).toBe(245);
  });

  it('rolls Biceps + Triceps into a single Arms group', () => {
    const days = makeDays();
    const weekData: Record<string, DayData> = {
      '0:0': { 2: { 0: { weight: '75', reps: '10' } } }, // EZ Curl (Biceps)
      '1:0': { 1: { 0: { weight: '50', reps: '12' } } }, // Tricep Rope
    };
    const out = aggregateLiftsByMuscle(days, 1, (d, w) => weekData[`${d}:${w}`] || {});
    const arms = out.find((m) => m.muscle === 'Arms');
    expect(arms).toBeDefined();
    expect(arms!.lifts.map((l) => l.name).sort()).toEqual(['EZ Curl', 'Tricep Rope']);
    // No raw Biceps / Triceps group should leak through.
    expect(out.find((m) => m.muscle === 'Biceps')).toBeUndefined();
    expect(out.find((m) => m.muscle === 'Triceps')).toBeUndefined();
  });

  it('uses _exId to follow an exercise that shifted slots between weeks', () => {
    // w0: bench at slot 0. w1: bench shifted to slot 1 (reorder). Lookup via
    // _exId should still find it.
    const days: TrainingDay[] = [
      {
        label: 'Push',
        exercises: [
          { id: 'bench_bb', name: 'Bench Press', muscle: 'Chest', sets: 3, reps: '6' },
        ],
      },
    ];
    const weekData: Record<string, DayData> = {
      '0:0': {
        0: { 0: { weight: '200', reps: '6', _exId: 'bench_bb' } as never },
      },
      '0:1': {
        // Slot 0 is now some other exercise; bench moved to slot 1.
        0: { 0: { weight: '50', reps: '15', _exId: 'something_else' } as never },
        1: { 0: { weight: '215', reps: '6', _exId: 'bench_bb' } as never },
      },
    };
    const out = aggregateLiftsByMuscle(days, 2, (d, w) => weekData[`${d}:${w}`] || {});
    const bench = out.find((m) => m.muscle === 'Chest')!.lifts[0];
    expect(bench.start).toBe(200);
    expect(bench.current).toBe(215);
  });

  it('skips cardio exercises', () => {
    const days: TrainingDay[] = [
      {
        label: 'Mix',
        exercises: [
          { id: 'bike', name: 'Stationary Bike', muscle: 'Cardio', cardio: true, sets: 1, reps: '1' },
          { id: 'bench', name: 'Bench Press', muscle: 'Chest', sets: 3, reps: '6' },
        ],
      },
    ];
    const weekData: DayData = {
      0: { 0: { weight: '0', reps: '0' } },
      1: { 0: { weight: '200', reps: '6' } },
    };
    const out = aggregateLiftsByMuscle(days, 1, () => weekData);
    expect(out.find((m) => m.muscle === 'Cardio')).toBeUndefined();
    expect(out.find((m) => m.muscle === 'Chest')).toBeDefined();
  });
});

// ─── aggregatePreviousMesos ──────────────────────────────────────────────

describe('aggregatePreviousMesos', () => {
  const exerciseDB: ExerciseEntry[] = [
    { id: 'bench_bb', name: 'Bench Press', muscle: 'Chest' },
    { id: 'row_bb', name: 'Barbell Row', muscle: 'Back' },
    { id: 'ez_curl', name: 'EZ Curl', muscle: 'Biceps' },
  ];

  it('returns empty array when archive is empty', () => {
    expect(aggregatePreviousMesos([], exerciseDB)).toEqual([]);
  });

  it('numbers mesos with newest = highest', () => {
    // loadArchive returns newest-first (archive is unshifted).
    const archive = [
      { id: 100, profile: { goal: 'Hypertrophy', startDate: '2026-03-01' }, mesoWeeks: 7, mesoDays: 6, totalSessions: 42, completedSessions: 38, sessions: [] },
      { id: 99, profile: { goal: 'Strength', startDate: '2026-01-01' }, mesoWeeks: 6, mesoDays: 6, totalSessions: 36, completedSessions: 34, sessions: [] },
      { id: 98, profile: { goal: 'Hypertrophy', startDate: '2025-11-01' }, mesoWeeks: 7, mesoDays: 6, totalSessions: 42, completedSessions: 40, sessions: [] },
    ] as unknown as ArchiveEntry[];

    const out = aggregatePreviousMesos(archive, exerciseDB);
    expect(out.map((m) => m.number)).toEqual([3, 2, 1]);
    expect(out[0].id).toBe('100');
    expect(out[0].phaseSummary).toContain('Hypertrophy block');
    expect(out[0].phaseSummary).toContain('7 wk');
    expect(out[1].phaseSummary).toContain('Strength block');
  });

  it('aggregates per-muscle lift breakdown using _exId → EXERCISE_DB', () => {
    const archive = [
      {
        id: 1,
        archivedAt: '2026-04-30T00:00:00.000Z',
        profile: { goal: 'Hypertrophy', startDate: '2026-03-01' },
        mesoWeeks: 3,
        mesoDays: 1,
        totalSessions: 3,
        completedSessions: 3,
        sessions: [
          // d=0, w=0 — bench at 200×6
          { d: 0, w: 0, data: { 0: { 0: { weight: '200', reps: '6', _exId: 'bench_bb' } } }, done: true },
          // d=0, w=1 — bench at 210×6
          { d: 0, w: 1, data: { 0: { 0: { weight: '210', reps: '6', _exId: 'bench_bb' } } }, done: true },
          // d=0, w=2 — bench at 220×6 (final week → "end")
          { d: 0, w: 2, data: { 0: { 0: { weight: '220', reps: '6', _exId: 'bench_bb' } } }, done: true },
        ],
      },
    ] as unknown as ArchiveEntry[];

    const out = aggregatePreviousMesos(archive, exerciseDB);
    expect(out).toHaveLength(1);
    const chest = out[0].liftsByMuscle.find((g) => g.muscle === 'Chest')!;
    expect(chest).toBeDefined();
    expect(chest.lifts[0].name).toBe('Bench Press');
    expect(chest.lifts[0].start).toBe(200);
    expect(chest.lifts[0].end).toBe(220);
    expect(chest.lifts[0].pr).toBe(Math.round(220 * (1 + 6 / 30)));
  });

  it('rolls Biceps into Arms in archived data too', () => {
    const archive = [
      {
        id: 1,
        profile: { goal: 'Hypertrophy', startDate: '2026-03-01' },
        mesoWeeks: 1,
        mesoDays: 1,
        totalSessions: 1,
        completedSessions: 1,
        sessions: [
          { d: 0, w: 0, data: { 0: { 0: { weight: '75', reps: '10', _exId: 'ez_curl' } } } },
        ],
      },
    ] as unknown as ArchiveEntry[];
    const out = aggregatePreviousMesos(archive, exerciseDB);
    const arms = out[0].liftsByMuscle.find((g) => g.muscle === 'Arms');
    expect(arms).toBeDefined();
    expect(arms!.lifts[0].name).toBe('EZ Curl');
    expect(out[0].liftsByMuscle.find((g) => g.muscle === 'Biceps')).toBeUndefined();
  });

  it('skips sets that have no _exId (legacy data) without crashing', () => {
    const archive = [
      {
        id: 1,
        profile: { goal: 'Hypertrophy', startDate: '2026-03-01' },
        mesoWeeks: 1,
        mesoDays: 1,
        totalSessions: 1,
        completedSessions: 1,
        sessions: [
          { d: 0, w: 0, data: { 0: { 0: { weight: '200', reps: '6' } } } },
        ],
      },
    ] as unknown as ArchiveEntry[];
    const out = aggregatePreviousMesos(archive, exerciseDB);
    expect(out).toHaveLength(1);
    // No per-muscle data because we couldn't attribute the sets.
    expect(out[0].liftsByMuscle).toEqual([]);
  });

  it('handles multi-meso archive (smoke: 3 mesos with different goals)', () => {
    const archive = [
      {
        id: 'm3',
        profile: { goal: 'Strength', startDate: '2026-04-01' },
        mesoWeeks: 6,
        mesoDays: 4,
        totalSessions: 24,
        completedSessions: 22,
        sessions: [
          { d: 0, w: 0, data: { 0: { 0: { weight: '300', reps: '5', _exId: 'bench_bb' } } } },
          { d: 0, w: 5, data: { 0: { 0: { weight: '320', reps: '3', _exId: 'bench_bb' } } } },
        ],
      },
      {
        id: 'm2',
        profile: { goal: 'Hypertrophy', startDate: '2026-02-01' },
        mesoWeeks: 7,
        mesoDays: 4,
        totalSessions: 28,
        completedSessions: 26,
        sessions: [
          { d: 0, w: 0, data: { 0: { 0: { weight: '180', reps: '8', _exId: 'row_bb' } } } },
          { d: 0, w: 6, data: { 0: { 0: { weight: '200', reps: '8', _exId: 'row_bb' } } } },
        ],
      },
      {
        id: 'm1',
        profile: { goal: 'Hypertrophy', startDate: '2025-12-01' },
        mesoWeeks: 7,
        mesoDays: 4,
        totalSessions: 28,
        completedSessions: 24,
        sessions: [],
      },
    ] as unknown as ArchiveEntry[];

    const out = aggregatePreviousMesos(archive, exerciseDB);
    expect(out).toHaveLength(3);
    expect(out.map((m) => m.number)).toEqual([3, 2, 1]);
    expect(out[0].liftsByMuscle.find((g) => g.muscle === 'Chest')!.lifts[0].end).toBe(320);
    expect(out[1].liftsByMuscle.find((g) => g.muscle === 'Back')!.lifts[0].end).toBe(200);
    // Sessions counts pass through.
    expect(out[0].sessions).toEqual({ done: 22, total: 24 });
    expect(out[1].sessions).toEqual({ done: 26, total: 28 });
    expect(out[2].sessions).toEqual({ done: 24, total: 28 });
  });
});

// ─── findLastMesoWeight ──────────────────────────────────────────────────

describe('findLastMesoWeight', () => {
  const mkMeso = (id: number, sessions: unknown[], archivedAt?: string) =>
    ({ id, archivedAt, mesoWeeks: 6, mesoDays: 4, sessions }) as unknown as ArchiveEntry;

  it('returns null for empty archive or missing exId', () => {
    expect(findLastMesoWeight([], 'bench_bb')).toBeNull();
    expect(findLastMesoWeight([mkMeso(1, [])], undefined)).toBeNull();
    expect(findLastMesoWeight([mkMeso(1, [])], 'bench_bb')).toBeNull();
  });

  it('returns the top working set from the LATEST week with data', () => {
    const archive = [
      mkMeso(1, [
        { d: 0, w: 0, data: { 0: { 0: { weight: '200', reps: '8', _exId: 'bench_bb' } } } },
        { d: 0, w: 3, data: { 0: { 0: { weight: '215', reps: '6', _exId: 'bench_bb' }, 1: { weight: '215', reps: '8', _exId: 'bench_bb' } } } },
        { d: 0, w: 1, data: { 0: { 0: { weight: '205', reps: '7', _exId: 'bench_bb' } } } },
      ], '2026-06-01T00:00:00.000Z'),
    ];
    const hit = findLastMesoWeight(archive, 'bench_bb')!;
    expect(hit.weight).toBe(215);
    expect(hit.reps).toBe(8); // best reps at the top weight
    expect(hit.weekIdx).toBe(3);
    expect(hit.mesosAgo).toBe(1);
    expect(hit.archivedAt).toBe('2026-06-01T00:00:00.000Z');
  });

  it('answers from an UNFINISHED meso (only week 1 logged)', () => {
    const archive = [
      mkMeso(1, [
        { d: 0, w: 0, data: { 0: { 0: { weight: '100', reps: '10', _exId: 'ez_curl' } } } },
        // weeks 1..5 exist as sessions but were never logged
        { d: 0, w: 1, data: {} },
        { d: 0, w: 2, data: {} },
      ]),
    ];
    const hit = findLastMesoWeight(archive, 'ez_curl')!;
    expect(hit.weight).toBe(100);
    expect(hit.weekIdx).toBe(0);
  });

  it('walks past mesos without the exercise to an older meso', () => {
    const archive = [
      // Newest meso has no curls
      mkMeso(2, [
        { d: 0, w: 0, data: { 0: { 0: { weight: '225', reps: '5', _exId: 'bench_bb' } } } },
      ]),
      // Older meso has them
      mkMeso(1, [
        { d: 1, w: 4, data: { 2: { 0: { weight: '95', reps: '12', _exId: 'ez_curl' } } } },
      ]),
    ];
    const hit = findLastMesoWeight(archive, 'ez_curl')!;
    expect(hit.weight).toBe(95);
    expect(hit.mesosAgo).toBe(2);
  });

  it('matches by _exId regardless of slot position (reorder-proof)', () => {
    const archive = [
      mkMeso(1, [
        // ez_curl sits in slot 3 here; slot 0 is a heavier exercise
        { d: 0, w: 2, data: {
          0: { 0: { weight: '315', reps: '5', _exId: 'deadlift_bb' } },
          3: { 0: { weight: '90', reps: '10', _exId: 'ez_curl' } },
        } },
      ]),
    ];
    const hit = findLastMesoWeight(archive, 'ez_curl')!;
    expect(hit.weight).toBe(90);
  });

  it('skips warmups and unlogged sets', () => {
    const archive = [
      mkMeso(1, [
        { d: 0, w: 1, data: { 0: {
          0: { weight: '135', reps: '10', warmup: true, _exId: 'bench_bb' },
          1: { weight: '', reps: '', _exId: 'bench_bb' },
          2: { weight: '185', reps: '9', _exId: 'bench_bb' },
        } } },
      ]),
    ];
    const hit = findLastMesoWeight(archive, 'bench_bb')!;
    expect(hit.weight).toBe(185);
    expect(hit.reps).toBe(9);
  });

  it('returns null for legacy archives without _exId stamps', () => {
    const archive = [
      mkMeso(1, [
        { d: 0, w: 5, data: { 0: { 0: { weight: '200', reps: '8' } } } },
      ]),
    ];
    expect(findLastMesoWeight(archive, 'bench_bb')).toBeNull();
  });
});

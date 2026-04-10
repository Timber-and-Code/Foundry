/**
 * Tests for program.js — generateProgram
 * Covers split types, exercise structure, experience filtering,
 * equipment filtering, goal-based rep ranges, and session duration.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { generateProgram } from '../program';

// ─── Shared exercise DB fixture (same as core.test.js) ───────────────────────

const mkEx = (overrides) => ({
  id: 'default_id',
  name: 'Test Exercise',
  muscle: 'Chest',
  muscles: ['Chest', 'Triceps'],
  tag: 'PUSH',
  equipment: 'barbell',
  pattern: 'push',
  anchor: true,
  diff: 2,
  sets: 3,
  reps: '6-10',
  rest: '2-3 min',
  warmup: 'Full protocol',
  bw: false,
  ...overrides,
});

const EXERCISE_DB = [
  // PUSH
  mkEx({ id: 'bench', name: 'Bench Press', tag: 'PUSH', anchor: true, muscles: ['Chest', 'Shoulders', 'Triceps'], diff: 2, equipment: 'barbell' }),
  mkEx({ id: 'ohp', name: 'OHP', tag: 'PUSH', anchor: true, muscles: ['Shoulders', 'Triceps'], diff: 2, equipment: 'barbell' }),
  mkEx({ id: 'incline', name: 'Incline Press', tag: 'PUSH', anchor: false, muscles: ['Chest', 'Shoulders'], diff: 1, equipment: 'dumbbell', pattern: 'push', warmup: '1 feeler set' }),
  mkEx({ id: 'tricep', name: 'Tricep Pushdown', tag: 'PUSH', anchor: false, muscles: ['Triceps'], diff: 1, equipment: 'cable', pattern: 'isolation', warmup: '1 feeler set' }),
  mkEx({ id: 'lat_raise', name: 'Lat Raise', tag: 'PUSH', anchor: false, muscles: ['Shoulders'], diff: 1, equipment: 'dumbbell', pattern: 'isolation', warmup: '1 light feeler set' }),
  mkEx({ id: 'dip', name: 'Dip', tag: 'PUSH', anchor: false, muscles: ['Chest', 'Triceps'], diff: 1, equipment: 'bodyweight', pattern: 'push', bw: true, warmup: null }),
  mkEx({ id: 'fly', name: 'Cable Fly', tag: 'PUSH', anchor: false, muscles: ['Chest'], diff: 1, equipment: 'cable', pattern: 'isolation', warmup: '1 light feeler set' }),
  // PULL
  mkEx({ id: 'row', name: 'Barbell Row', tag: 'PULL', anchor: true, muscles: ['Lats', 'Back', 'Biceps'], diff: 2, equipment: 'barbell', pattern: 'pull' }),
  mkEx({ id: 'pullup', name: 'Pull-up', tag: 'PULL', anchor: true, muscles: ['Lats', 'Back'], diff: 1, equipment: 'bodyweight', pattern: 'pull', bw: true, warmup: null }),
  mkEx({ id: 'curl', name: 'Bicep Curl', tag: 'PULL', anchor: false, muscles: ['Biceps'], diff: 1, equipment: 'dumbbell', pattern: 'isolation', warmup: '1 light feeler set' }),
  mkEx({ id: 'face', name: 'Face Pull', tag: 'PULL', anchor: false, muscles: ['Shoulders', 'Upper Traps'], diff: 1, equipment: 'cable', pattern: 'isolation', warmup: '1 light feeler set' }),
  mkEx({ id: 'cable_row', name: 'Cable Row', tag: 'PULL', anchor: false, muscles: ['Lats', 'Back'], diff: 1, equipment: 'cable', pattern: 'pull', warmup: '1 feeler set' }),
  mkEx({ id: 'rdl', name: 'RDL', tag: 'PULL', anchor: false, muscles: ['Hamstrings', 'Glutes'], diff: 2, equipment: 'barbell', pattern: 'hinge' }),
  mkEx({ id: 'shrug', name: 'Shrug', tag: 'PULL', anchor: false, muscles: ['Upper Traps'], diff: 1, equipment: 'dumbbell', pattern: 'isolation', warmup: '1 light feeler set' }),
  // LEGS
  mkEx({ id: 'squat', name: 'Barbell Squat', tag: 'LEGS', anchor: true, muscles: ['Quads', 'Hamstrings', 'Glutes'], diff: 2, equipment: 'barbell', pattern: 'squat' }),
  mkEx({ id: 'deadlift', name: 'Deadlift', tag: 'LEGS', anchor: true, muscles: ['Hamstrings', 'Glutes', 'Back'], diff: 2, equipment: 'barbell', pattern: 'hinge' }),
  mkEx({ id: 'leg_press', name: 'Leg Press', tag: 'LEGS', anchor: false, muscles: ['Quads', 'Hamstrings'], diff: 1, equipment: 'machine', pattern: 'push', warmup: '1 feeler set' }),
  mkEx({ id: 'leg_curl', name: 'Leg Curl', tag: 'LEGS', anchor: false, muscles: ['Hamstrings'], diff: 1, equipment: 'machine', pattern: 'isolation', warmup: '1 light feeler set' }),
  mkEx({ id: 'calf', name: 'Calf Raise', tag: 'LEGS', anchor: false, muscles: ['Gastrocnemius'], diff: 1, equipment: 'machine', pattern: 'isolation', warmup: null }),
  mkEx({ id: 'lunge', name: 'Lunge', tag: 'LEGS', anchor: false, muscles: ['Quads', 'Glutes'], diff: 1, equipment: 'dumbbell', pattern: 'squat', warmup: '1 feeler set' }),
];

const BASE_PROFILE = {
  experience: 'intermediate',
  equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'],
  sessionDuration: 60,
  goal: 'build_muscle',
};

// ============================================================================
// Split type day labels / tags
// ============================================================================
describe('generateProgram — PPL day labels and tags', () => {
  beforeEach(() => localStorage.clear());

  it('PPL 3 days: day[0] is Push (PUSH tag)', () => {
    const days = generateProgram({ ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3 }, EXERCISE_DB);
    expect(days[0].tag).toBe('PUSH');
  });

  it('PPL 3 days: day[1] is Pull (PULL tag)', () => {
    const days = generateProgram({ ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3 }, EXERCISE_DB);
    expect(days[1].tag).toBe('PULL');
  });

  it('PPL 3 days: day[2] is Legs (LEGS tag)', () => {
    const days = generateProgram({ ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3 }, EXERCISE_DB);
    expect(days[2].tag).toBe('LEGS');
  });

  it('upper_lower 4 days: days 0 and 2 are UPPER', () => {
    const days = generateProgram({ ...BASE_PROFILE, splitType: 'upper_lower', daysPerWeek: 4 }, EXERCISE_DB);
    expect(days[0].tag).toBe('UPPER');
    expect(days[2].tag).toBe('UPPER');
  });

  it('upper_lower 4 days: days 1 and 3 are LOWER', () => {
    const days = generateProgram({ ...BASE_PROFILE, splitType: 'upper_lower', daysPerWeek: 4 }, EXERCISE_DB);
    expect(days[1].tag).toBe('LOWER');
    expect(days[3].tag).toBe('LOWER');
  });

  it('full_body 3 days: all days have FULL tag', () => {
    const days = generateProgram({ ...BASE_PROFILE, splitType: 'full_body', daysPerWeek: 3 }, EXERCISE_DB);
    days.forEach((day) => expect(day.tag).toBe('FULL'));
  });
});

// ============================================================================
// Exercise structure and content
// ============================================================================
describe('generateProgram — exercise structure', () => {
  beforeEach(() => localStorage.clear());

  it('each day has a non-empty exercises array', () => {
    const days = generateProgram({ ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3 }, EXERCISE_DB);
    days.forEach((day) => expect(day.exercises.length).toBeGreaterThan(0));
  });

  it('anchor exercise (first) has anchor=true', () => {
    const days = generateProgram({ ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3 }, EXERCISE_DB);
    days.forEach((day) => {
      if (day.exercises.length > 0) expect(day.exercises[0].anchor).toBe(true);
    });
  });

  it('accessory exercises (after first) have anchor=false', () => {
    const days = generateProgram({ ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3 }, EXERCISE_DB);
    days.forEach((day) => {
      day.exercises.slice(1).forEach((ex) => expect(ex.anchor).toBe(false));
    });
  });

  it('no duplicate exercise IDs within a single day', () => {
    const days = generateProgram({ ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 6 }, EXERCISE_DB);
    days.forEach((day) => {
      const ids = day.exercises.map((e) => e.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });
  });

  it('each exercise has a non-empty reps string', () => {
    const days = generateProgram({ ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3 }, EXERCISE_DB);
    days.forEach((day) => {
      day.exercises.forEach((ex) => {
        expect(typeof ex.reps).toBe('string');
        expect(ex.reps.length).toBeGreaterThan(0);
      });
    });
  });

  it('each exercise has sets > 0', () => {
    const days = generateProgram({ ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3 }, EXERCISE_DB);
    days.forEach((day) => {
      day.exercises.forEach((ex) => expect(ex.sets).toBeGreaterThan(0));
    });
  });
});

// ============================================================================
// Experience level filtering
// ============================================================================
describe('generateProgram — experience level filtering', () => {
  it('beginner: only includes exercises with diff ≤ 1', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, experience: 'beginner', splitType: 'ppl', daysPerWeek: 3 },
      EXERCISE_DB
    );
    days.forEach((day) => {
      day.exercises.forEach((ex) => {
        // Find the original DB entry to check diff
        const orig = EXERCISE_DB.find((e) => e.id === ex.id);
        if (orig) expect(orig.diff).toBeLessThanOrEqual(1);
      });
    });
  });
});

// ============================================================================
// Goal-based rep ranges
// ============================================================================
describe('generateProgram — goal-based rep ranges', () => {
  it('strength goal: anchor reps are in "4-6" range for compound exercises', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3, goal: 'build_strength' },
      EXERCISE_DB
    );
    // The anchor (first) exercise is a compound — should get '4-6'
    const anchor = days[0].exercises[0];
    expect(anchor.reps).toBe('4-6');
  });

  it('build_muscle goal: compound anchor reps are "6-10"', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3, goal: 'build_muscle' },
      EXERCISE_DB
    );
    const anchor = days[0].exercises[0];
    expect(anchor.reps).toBe('6-10');
  });
});

// ============================================================================
// Session duration affects exercise count
// ============================================================================
describe('generateProgram — session duration exercise count', () => {
  it('sessionDuration 30: max 3 exercises per day', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3, sessionDuration: 30 },
      EXERCISE_DB
    );
    days.forEach((day) => expect(day.exercises.length).toBeLessThanOrEqual(3));
  });

  it('sessionDuration 60: up to 5 exercises per day', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3, sessionDuration: 60 },
      EXERCISE_DB
    );
    days.forEach((day) => expect(day.exercises.length).toBeLessThanOrEqual(5));
  });
});

// ============================================================================
// aiDays passthrough
// ============================================================================
describe('generateProgram — aiDays passthrough', () => {
  it('returns aiDays directly when present and non-empty', () => {
    const aiDays = [{ dayNum: 1, label: 'AI Push', tag: 'PUSH', exercises: [] }];
    const result = generateProgram({ ...BASE_PROFILE, aiDays }, EXERCISE_DB);
    expect(result).toBe(aiDays);
  });

  it('does NOT return aiDays when the array is empty', () => {
    const result = generateProgram({ ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3, aiDays: [] }, EXERCISE_DB);
    // Falls through to normal generation
    expect(result).toHaveLength(3);
  });
});

// ============================================================================
// Edge cases
// ============================================================================
describe('generateProgram — edge cases', () => {
  it('handles empty EXERCISE_DB without throwing', () => {
    expect(() =>
      generateProgram({ ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3 }, [])
    ).not.toThrow();
  });

  it('each day object has required shape fields', () => {
    const days = generateProgram({ ...BASE_PROFILE, splitType: 'ppl', daysPerWeek: 3 }, EXERCISE_DB);
    days.forEach((day) => {
      expect(day).toHaveProperty('dayNum');
      expect(day).toHaveProperty('label');
      expect(day).toHaveProperty('tag');
      expect(day).toHaveProperty('muscles');
      expect(day).toHaveProperty('note');
      expect(Array.isArray(day.exercises)).toBe(true);
    });
  });
});

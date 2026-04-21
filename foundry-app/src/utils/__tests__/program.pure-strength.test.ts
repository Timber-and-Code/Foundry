/**
 * program.pure-strength.test.ts
 *
 * Pure Strength goal branches generateProgram in two places:
 *   1. Anchor reps drop to '3-6' (stricter than the generic strength 4-6 that
 *      non-anchor compounds still get via goalReps).
 *   2. Non-anchor set count is trimmed by 1 with a floor of 2, to offset the
 *      higher-intensity anchor work.
 *
 * The muscle+strength path (goal='build_muscle' + anchor_strength_bias='1')
 * stays on the hypertrophy ranges and full accessory sets — that flag is
 * consumed elsewhere and program.ts intentionally only keys off profile.goal.
 */
import { describe, it, expect } from 'vitest';
import { generateProgram } from '../program';

interface DbEx {
  id: string;
  name: string;
  muscle: string;
  muscles: string[];
  tag: string;
  equipment: string;
  pattern: string;
  anchor: boolean;
  diff: number;
  sets: number;
  reps: string;
  rest: string;
  warmup: string;
  bw: boolean;
}

const mkEx = (overrides: Partial<DbEx>): DbEx => ({
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

// Small DB — enough anchors + accessories per tag to fill a 3-day PPL.
const EXERCISE_DB: DbEx[] = [
  // PUSH
  mkEx({ id: 'bench', name: 'Bench Press', tag: 'PUSH', muscles: ['Chest', 'Shoulders', 'Triceps'] }),
  mkEx({ id: 'ohp', name: 'OHP', tag: 'PUSH', muscles: ['Shoulders', 'Triceps'] }),
  mkEx({ id: 'incline', name: 'Incline Press', tag: 'PUSH', anchor: false, muscles: ['Chest', 'Shoulders'], equipment: 'dumbbell' }),
  mkEx({ id: 'tricep', name: 'Tricep Pushdown', tag: 'PUSH', anchor: false, muscles: ['Triceps'], equipment: 'cable', pattern: 'isolation' }),
  mkEx({ id: 'lat_raise', name: 'Lat Raise', tag: 'PUSH', anchor: false, muscles: ['Shoulders'], equipment: 'dumbbell', pattern: 'isolation' }),
  mkEx({ id: 'fly', name: 'Cable Fly', tag: 'PUSH', anchor: false, muscles: ['Chest'], equipment: 'cable', pattern: 'isolation' }),
  // PULL
  mkEx({ id: 'row', name: 'Barbell Row', tag: 'PULL', muscles: ['Lats', 'Back', 'Biceps'], pattern: 'pull' }),
  mkEx({ id: 'pullup', name: 'Pull-up', tag: 'PULL', muscles: ['Lats', 'Back'], equipment: 'bodyweight', pattern: 'pull' }),
  mkEx({ id: 'cable_row', name: 'Cable Row', tag: 'PULL', anchor: false, muscles: ['Lats', 'Back'], equipment: 'cable', pattern: 'pull' }),
  mkEx({ id: 'curl', name: 'Bicep Curl', tag: 'PULL', anchor: false, muscles: ['Biceps'], equipment: 'dumbbell', pattern: 'isolation' }),
  mkEx({ id: 'face', name: 'Face Pull', tag: 'PULL', anchor: false, muscles: ['Shoulders'], equipment: 'cable', pattern: 'isolation' }),
  mkEx({ id: 'shrug', name: 'Shrug', tag: 'PULL', anchor: false, muscles: ['Upper Traps'], equipment: 'dumbbell', pattern: 'isolation' }),
  // LEGS
  mkEx({ id: 'squat', name: 'Barbell Squat', tag: 'LEGS', muscles: ['Quads', 'Hamstrings', 'Glutes'], pattern: 'squat' }),
  mkEx({ id: 'deadlift', name: 'Deadlift', tag: 'LEGS', muscles: ['Hamstrings', 'Glutes', 'Back'], pattern: 'hinge' }),
  mkEx({ id: 'leg_press', name: 'Leg Press', tag: 'LEGS', anchor: false, muscles: ['Quads', 'Hamstrings'], equipment: 'machine' }),
  mkEx({ id: 'leg_curl', name: 'Leg Curl', tag: 'LEGS', anchor: false, muscles: ['Hamstrings'], equipment: 'machine', pattern: 'isolation' }),
  mkEx({ id: 'calf', name: 'Calf Raise', tag: 'LEGS', anchor: false, muscles: ['Gastrocnemius'], equipment: 'machine', pattern: 'isolation' }),
  mkEx({ id: 'lunge', name: 'Lunge', tag: 'LEGS', anchor: false, muscles: ['Quads', 'Glutes'], equipment: 'dumbbell', pattern: 'squat' }),
];

const BASE_PROFILE = {
  experience: 'intermediate',
  equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'],
  sessionDuration: 60,
  splitType: 'ppl' as const,
  daysPerWeek: 3,
};

describe('generateProgram — Pure Strength goal', () => {
  it('baseline (build_muscle): compound anchor reps are "6-10" and accessories keep full set count', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, goal: 'build_muscle' },
      EXERCISE_DB as any,
    );
    const anchor = days[0].exercises[0];
    expect(anchor.reps).toBe('6-10');
    expect(anchor.anchor).toBe(true);
    // Accessories at sessionDuration=60 get 3 sets (from DB e.sets=3), no trim.
    const accessories = days[0].exercises.slice(1);
    accessories.forEach((acc) => {
      expect(acc.sets).toBe(3);
    });
  });

  it('pure strength (build_strength): anchor reps = "3-6"', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, goal: 'build_strength' },
      EXERCISE_DB as any,
    );
    days.forEach((day) => {
      const anchor = day.exercises[0];
      expect(anchor.anchor).toBe(true);
      expect(anchor.reps).toBe('3-6');
    });
  });

  it('pure strength: accessory sets = baseline − 1 (floor 2)', () => {
    // Baseline accessories at sessionDuration=60 get e.sets || 3 = 3 sets.
    // Pure strength trims by 1 → expect 2 (floor).
    const days = generateProgram(
      { ...BASE_PROFILE, goal: 'build_strength' },
      EXERCISE_DB as any,
    );
    const accessories = days[0].exercises.slice(1);
    expect(accessories.length).toBeGreaterThan(0);
    accessories.forEach((acc) => {
      expect(acc.anchor).toBeFalsy();
      expect(acc.sets).toBe(2);
    });
  });

  it('pure strength accessory set floor is 2 even when baseline would go lower', () => {
    // Contrived DB where every accessory ships with e.sets=3 — trim would
    // land at 2, still at the floor. If the DB ever supplies sets=2 natively,
    // the pure-strength branch should NOT drop it below 2.
    const lowSetDB = EXERCISE_DB.map((e) =>
      e.anchor ? e : { ...e, sets: 2 },
    );
    const days = generateProgram(
      { ...BASE_PROFILE, goal: 'build_strength' },
      lowSetDB as any,
    );
    const accessories = days[0].exercises.slice(1);
    accessories.forEach((acc) => {
      expect(Number(acc.sets)).toBeGreaterThanOrEqual(2);
    });
  });

  it('is idempotent — same profile + DB produces the same program shape', () => {
    // generateProgram internally shuffles, so individual anchor *identity* can
    // vary between calls. What must NOT vary per-call for the same profile is
    // the **rep range + set count** rule — both are profile-derived, not
    // shuffle-derived. We snapshot those invariants across two calls.
    const profile = { ...BASE_PROFILE, goal: 'build_strength' };
    const daysA = generateProgram(profile, EXERCISE_DB as any);
    const daysB = generateProgram(profile, EXERCISE_DB as any);
    expect(daysA.length).toBe(daysB.length);
    daysA.forEach((dayA, i) => {
      const dayB = daysB[i];
      expect(dayA.exercises.length).toBe(dayB.exercises.length);
      // Anchor rep range is deterministic per profile.goal regardless of which
      // specific compound got picked as today's anchor.
      expect(dayA.exercises[0].reps).toBe('3-6');
      expect(dayB.exercises[0].reps).toBe('3-6');
      // Every accessory in both runs is at the floor.
      dayA.exercises.slice(1).forEach((acc) => expect(acc.sets).toBe(2));
      dayB.exercises.slice(1).forEach((acc) => expect(acc.sets).toBe(2));
    });
  });
});

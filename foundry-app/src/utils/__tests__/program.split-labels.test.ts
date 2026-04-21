/**
 * program.split-labels.test.ts
 *
 * Verifies that generateProgram emits the correct day count and tag set for
 * every (splitType, daysPerWeek) combination listed as valid in SplitSheet.
 *
 * The primary regression this guards: upper_lower + push_pull used to fall
 * through to PPL for daysPerWeek not in {2,4}, which produced Push/Pull/Legs
 * tags instead of Upper/Lower or Push/Pull.
 */
import { describe, it, expect } from 'vitest';
import { generateProgram } from '../program';

const mkEx = (overrides: Record<string, unknown>) => ({
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

// Minimal exercise DB covering all three tags, multiple patterns, and enough
// variety that buildDay can pick unique anchors for up to 6 days.
// Each exercise sets `muscle` explicitly — the traditional split filters by
// `muscle` not `tag`, so falling back to the mkEx default ('Chest') would
// mis-bucket everything.
const EXERCISE_DB = [
  // PUSH — Chest
  mkEx({ id: 'bench', name: 'Bench Press', tag: 'PUSH', muscle: 'Chest', muscles: ['Chest', 'Shoulders', 'Triceps'] }),
  mkEx({ id: 'incline', name: 'Incline Press', tag: 'PUSH', muscle: 'Chest', muscles: ['Chest', 'Shoulders'], equipment: 'dumbbell' }),
  mkEx({ id: 'dip', name: 'Dip', tag: 'PUSH', muscle: 'Chest', muscles: ['Chest', 'Triceps'], equipment: 'bodyweight' }),
  mkEx({ id: 'fly', name: 'Cable Fly', tag: 'PUSH', anchor: false, muscle: 'Chest', muscles: ['Chest'], equipment: 'cable', pattern: 'isolation' }),
  // PUSH — Shoulders
  mkEx({ id: 'ohp', name: 'OHP', tag: 'PUSH', muscle: 'Shoulders', muscles: ['Shoulders', 'Triceps'], pattern: 'push' }),
  mkEx({ id: 'db_ohp', name: 'DB OHP', tag: 'PUSH', muscle: 'Shoulders', muscles: ['Shoulders'], equipment: 'dumbbell', pattern: 'push' }),
  mkEx({ id: 'lat_raise', name: 'Lat Raise', tag: 'PUSH', anchor: false, muscle: 'Shoulders', muscles: ['Shoulders'], equipment: 'dumbbell', pattern: 'isolation' }),
  mkEx({ id: 'rear_delt_fly', name: 'Rear Delt Fly', tag: 'PULL', anchor: false, muscle: 'Shoulders', muscles: ['Shoulders'], equipment: 'dumbbell', pattern: 'isolation' }),
  // PUSH — Triceps
  mkEx({ id: 'cg_bench', name: 'Close Grip Bench', tag: 'PUSH', muscle: 'Triceps', muscles: ['Triceps', 'Chest'], equipment: 'barbell', pattern: 'push' }),
  mkEx({ id: 'tricep', name: 'Tricep Pushdown', tag: 'PUSH', anchor: false, muscle: 'Triceps', muscles: ['Triceps'], equipment: 'cable', pattern: 'isolation' }),
  mkEx({ id: 'skullcrusher', name: 'Skull Crushers', tag: 'PUSH', anchor: false, muscle: 'Triceps', muscles: ['Triceps'], equipment: 'barbell', pattern: 'isolation' }),
  // PULL — Back / Lats
  mkEx({ id: 'row', name: 'Barbell Row', tag: 'PULL', muscle: 'Back', muscles: ['Lats', 'Back', 'Biceps'], pattern: 'pull' }),
  mkEx({ id: 'pullup', name: 'Pull-up', tag: 'PULL', muscle: 'Lats', muscles: ['Lats', 'Back'], equipment: 'bodyweight', pattern: 'pull' }),
  mkEx({ id: 'cable_row', name: 'Cable Row', tag: 'PULL', muscle: 'Back', muscles: ['Lats', 'Back'], equipment: 'cable', pattern: 'pull' }),
  mkEx({ id: 'lat_pulldown', name: 'Lat Pulldown', tag: 'PULL', muscle: 'Lats', muscles: ['Lats', 'Back'], equipment: 'cable', pattern: 'pull' }),
  mkEx({ id: 'rdl', name: 'RDL', tag: 'PULL', muscle: 'Hamstrings', muscles: ['Hamstrings', 'Glutes'], pattern: 'hinge' }),
  // PULL — Biceps
  mkEx({ id: 'curl', name: 'Bicep Curl', tag: 'PULL', anchor: false, muscle: 'Biceps', muscles: ['Biceps'], equipment: 'dumbbell', pattern: 'isolation' }),
  mkEx({ id: 'hammer_curl', name: 'Hammer Curl', tag: 'PULL', anchor: false, muscle: 'Biceps', muscles: ['Biceps'], equipment: 'dumbbell', pattern: 'isolation' }),
  mkEx({ id: 'ez_curl', name: 'EZ Bar Curl', tag: 'PULL', anchor: false, muscle: 'Biceps', muscles: ['Biceps'], equipment: 'barbell', pattern: 'isolation' }),
  // PULL — other
  mkEx({ id: 'face', name: 'Face Pull', tag: 'PULL', anchor: false, muscle: 'Shoulders', muscles: ['Shoulders'], equipment: 'cable', pattern: 'isolation' }),
  mkEx({ id: 'shrug', name: 'Shrug', tag: 'PULL', anchor: false, muscle: 'Traps', muscles: ['Upper Traps'], equipment: 'dumbbell', pattern: 'isolation' }),
  // LEGS
  mkEx({ id: 'squat', name: 'Barbell Squat', tag: 'LEGS', muscle: 'Quads', muscles: ['Quads', 'Hamstrings', 'Glutes'], pattern: 'squat' }),
  mkEx({ id: 'front_squat', name: 'Front Squat', tag: 'LEGS', muscle: 'Quads', muscles: ['Quads', 'Glutes'], pattern: 'squat' }),
  mkEx({ id: 'deadlift', name: 'Deadlift', tag: 'LEGS', muscle: 'Hamstrings', muscles: ['Hamstrings', 'Glutes', 'Back'], pattern: 'hinge' }),
  mkEx({ id: 'good_morning', name: 'Good Morning', tag: 'LEGS', muscle: 'Hamstrings', muscles: ['Hamstrings', 'Glutes'], pattern: 'hinge' }),
  mkEx({ id: 'leg_press', name: 'Leg Press', tag: 'LEGS', anchor: false, muscle: 'Quads', muscles: ['Quads', 'Hamstrings'], equipment: 'machine', pattern: 'push' }),
  mkEx({ id: 'leg_curl', name: 'Leg Curl', tag: 'LEGS', anchor: false, muscle: 'Hamstrings', muscles: ['Hamstrings'], equipment: 'machine', pattern: 'isolation' }),
  mkEx({ id: 'calf', name: 'Calf Raise', tag: 'LEGS', anchor: false, muscle: 'Calves', muscles: ['Gastrocnemius'], equipment: 'machine', pattern: 'isolation' }),
  mkEx({ id: 'lunge', name: 'Lunge', tag: 'LEGS', anchor: false, muscle: 'Quads', muscles: ['Quads', 'Glutes'], equipment: 'dumbbell', pattern: 'squat' }),
];

const BASE_PROFILE = {
  experience: 'intermediate',
  equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'],
  sessionDuration: 60,
  goal: 'build_muscle',
};

type Split = 'ppl' | 'upper_lower' | 'push_pull' | 'full_body' | 'traditional';

// Mirrors SplitSheet.tsx validDays, minus custom.
const COMBOS: { splitType: Split; days: number; validTags: string[] }[] = [
  // PPL
  { splitType: 'ppl', days: 3, validTags: ['PUSH', 'PULL', 'LEGS'] },
  { splitType: 'ppl', days: 5, validTags: ['PUSH', 'PULL', 'LEGS'] },
  { splitType: 'ppl', days: 6, validTags: ['PUSH', 'PULL', 'LEGS'] },
  // Upper / Lower
  { splitType: 'upper_lower', days: 2, validTags: ['UPPER', 'LOWER'] },
  { splitType: 'upper_lower', days: 3, validTags: ['UPPER', 'LOWER'] },
  { splitType: 'upper_lower', days: 4, validTags: ['UPPER', 'LOWER'] },
  { splitType: 'upper_lower', days: 5, validTags: ['UPPER', 'LOWER'] },
  { splitType: 'upper_lower', days: 6, validTags: ['UPPER', 'LOWER'] },
  // Push / Pull
  { splitType: 'push_pull', days: 2, validTags: ['PUSH', 'PULL'] },
  { splitType: 'push_pull', days: 3, validTags: ['PUSH', 'PULL'] },
  { splitType: 'push_pull', days: 4, validTags: ['PUSH', 'PULL'] },
  { splitType: 'push_pull', days: 5, validTags: ['PUSH', 'PULL'] },
  { splitType: 'push_pull', days: 6, validTags: ['PUSH', 'PULL'] },
  // Full Body
  { splitType: 'full_body', days: 2, validTags: ['FULL'] },
  { splitType: 'full_body', days: 3, validTags: ['FULL'] },
  { splitType: 'full_body', days: 4, validTags: ['FULL'] },
  { splitType: 'full_body', days: 5, validTags: ['FULL'] },
  // Traditional (Bro split)
  { splitType: 'traditional', days: 4, validTags: ['PUSH', 'PULL', 'LEGS'] },
  { splitType: 'traditional', days: 5, validTags: ['PUSH', 'PULL', 'LEGS', 'ARMS'] },
];

describe('generateProgram — split tag coverage for every valid (splitType, daysPerWeek)', () => {
  for (const combo of COMBOS) {
    it(`${combo.splitType} × ${combo.days} → day count + tag set`, () => {
      const days = generateProgram(
        { ...BASE_PROFILE, splitType: combo.splitType, daysPerWeek: combo.days },
        EXERCISE_DB as any
      );
      expect(days.length).toBe(combo.days);
      for (const day of days) {
        expect(combo.validTags).toContain(day.tag);
      }
    });
  }
});

describe('generateProgram — upper_lower alternation + label sanity', () => {
  it('upper_lower × 2 → [UPPER, LOWER]', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'upper_lower', daysPerWeek: 2 },
      EXERCISE_DB as any
    );
    expect(days.map((d) => d.tag)).toEqual(['UPPER', 'LOWER']);
  });

  it('upper_lower × 3 → [UPPER, LOWER, UPPER] (odd favors Upper)', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'upper_lower', daysPerWeek: 3 },
      EXERCISE_DB as any
    );
    expect(days.map((d) => d.tag)).toEqual(['UPPER', 'LOWER', 'UPPER']);
    // Labels use "Upper A"/"Lower"/"Upper B" — letter suffix appears when
    // the same tag shows up more than once.
    const labels = days.map((d) => d.label);
    expect(labels[0]).toBe('Upper A');
    expect(labels[1]).toBe('Lower');
    expect(labels[2]).toBe('Upper B');
  });

  it('upper_lower × 5 → 3 Upper, 2 Lower, alternating', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'upper_lower', daysPerWeek: 5 },
      EXERCISE_DB as any
    );
    expect(days.map((d) => d.tag)).toEqual(['UPPER', 'LOWER', 'UPPER', 'LOWER', 'UPPER']);
  });

  it('upper_lower × 6 → fully alternating', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'upper_lower', daysPerWeek: 6 },
      EXERCISE_DB as any
    );
    expect(days.map((d) => d.tag)).toEqual(['UPPER', 'LOWER', 'UPPER', 'LOWER', 'UPPER', 'LOWER']);
  });
});

describe('generateProgram — push_pull alternation', () => {
  it('push_pull × 2 → [PUSH, PULL]', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'push_pull', daysPerWeek: 2 },
      EXERCISE_DB as any
    );
    expect(days.map((d) => d.tag)).toEqual(['PUSH', 'PULL']);
  });

  it('push_pull × 3 → [PUSH, PULL, PUSH] (odd favors Push)', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'push_pull', daysPerWeek: 3 },
      EXERCISE_DB as any
    );
    expect(days.map((d) => d.tag)).toEqual(['PUSH', 'PULL', 'PUSH']);
  });

  it('push_pull × 5 → 3 Push, 2 Pull, alternating', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'push_pull', daysPerWeek: 5 },
      EXERCISE_DB as any
    );
    expect(days.map((d) => d.tag)).toEqual(['PUSH', 'PULL', 'PUSH', 'PULL', 'PUSH']);
  });
});

describe('generateProgram — traditional (bro split) body-part days', () => {
  it('traditional × 5 → Arms · Shoulders · Back · Chest · Legs', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'traditional', daysPerWeek: 5 },
      EXERCISE_DB as any
    );
    expect(days.length).toBe(5);
    expect(days.map((d) => d.label)).toEqual([
      'Arms',
      'Shoulders',
      'Back',
      'Chest',
      'Legs',
    ]);
    expect(days.map((d) => d.tag)).toEqual(['ARMS', 'PUSH', 'PULL', 'PUSH', 'LEGS']);
  });

  it('traditional × 5 → each day filters by its body-part muscle', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'traditional', daysPerWeek: 5 },
      EXERCISE_DB as any
    );
    const [armsDay, shouldersDay, backDay, chestDay, legsDay] = days;

    // Arms day — every exercise is Biceps or Triceps primary
    for (const ex of armsDay.exercises) {
      expect(['Biceps', 'Triceps']).toContain((ex as any).muscle);
    }
    // Shoulders day — every exercise is Shoulders primary
    for (const ex of shouldersDay.exercises) {
      expect((ex as any).muscle).toBe('Shoulders');
    }
    // Back day — Back or Lats primary
    for (const ex of backDay.exercises) {
      expect(['Back', 'Lats']).toContain((ex as any).muscle);
    }
    // Chest day — Chest primary
    for (const ex of chestDay.exercises) {
      expect((ex as any).muscle).toBe('Chest');
    }
    // Legs day — reuses LEGS tag pool (Quads/Hamstrings/Glutes/Calves)
    for (const ex of legsDay.exercises) {
      expect(['Quads', 'Hamstrings', 'Glutes', 'Calves']).toContain(
        (ex as any).muscle
      );
    }
  });

  it('traditional × 4 → Chest · Back · Legs · Shoulders + Arms', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'traditional', daysPerWeek: 4 },
      EXERCISE_DB as any
    );
    expect(days.length).toBe(4);
    expect(days.map((d) => d.label)).toEqual([
      'Chest',
      'Back',
      'Legs',
      'Shoulders + Arms',
    ]);
    expect(days.map((d) => d.tag)).toEqual(['PUSH', 'PULL', 'LEGS', 'PUSH']);
  });

  it('traditional × 4 → Shoulders+Arms day pulls from all three muscles', () => {
    const days = generateProgram(
      { ...BASE_PROFILE, splitType: 'traditional', daysPerWeek: 4 },
      EXERCISE_DB as any
    );
    const shoulArmsDay = days[3];
    for (const ex of shoulArmsDay.exercises) {
      expect(['Shoulders', 'Biceps', 'Triceps']).toContain((ex as any).muscle);
    }
  });
});

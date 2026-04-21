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
const EXERCISE_DB = [
  // PUSH
  mkEx({ id: 'bench', name: 'Bench Press', tag: 'PUSH', muscles: ['Chest', 'Shoulders', 'Triceps'] }),
  mkEx({ id: 'ohp', name: 'OHP', tag: 'PUSH', muscles: ['Shoulders', 'Triceps'] }),
  mkEx({ id: 'incline', name: 'Incline Press', tag: 'PUSH', muscles: ['Chest', 'Shoulders'], equipment: 'dumbbell' }),
  mkEx({ id: 'dip', name: 'Dip', tag: 'PUSH', muscles: ['Chest', 'Triceps'], equipment: 'bodyweight' }),
  mkEx({ id: 'tricep', name: 'Tricep Pushdown', tag: 'PUSH', anchor: false, muscles: ['Triceps'], equipment: 'cable', pattern: 'isolation' }),
  mkEx({ id: 'lat_raise', name: 'Lat Raise', tag: 'PUSH', anchor: false, muscles: ['Shoulders'], equipment: 'dumbbell', pattern: 'isolation' }),
  mkEx({ id: 'fly', name: 'Cable Fly', tag: 'PUSH', anchor: false, muscles: ['Chest'], equipment: 'cable', pattern: 'isolation' }),
  // PULL
  mkEx({ id: 'row', name: 'Barbell Row', tag: 'PULL', muscles: ['Lats', 'Back', 'Biceps'], pattern: 'pull' }),
  mkEx({ id: 'pullup', name: 'Pull-up', tag: 'PULL', muscles: ['Lats', 'Back'], equipment: 'bodyweight', pattern: 'pull' }),
  mkEx({ id: 'cable_row', name: 'Cable Row', tag: 'PULL', muscles: ['Lats', 'Back'], equipment: 'cable', pattern: 'pull' }),
  mkEx({ id: 'rdl', name: 'RDL', tag: 'PULL', muscles: ['Hamstrings', 'Glutes'], pattern: 'hinge' }),
  mkEx({ id: 'curl', name: 'Bicep Curl', tag: 'PULL', anchor: false, muscles: ['Biceps'], equipment: 'dumbbell', pattern: 'isolation' }),
  mkEx({ id: 'face', name: 'Face Pull', tag: 'PULL', anchor: false, muscles: ['Shoulders'], equipment: 'cable', pattern: 'isolation' }),
  mkEx({ id: 'shrug', name: 'Shrug', tag: 'PULL', anchor: false, muscles: ['Upper Traps'], equipment: 'dumbbell', pattern: 'isolation' }),
  // LEGS
  mkEx({ id: 'squat', name: 'Barbell Squat', tag: 'LEGS', muscles: ['Quads', 'Hamstrings', 'Glutes'], pattern: 'squat' }),
  mkEx({ id: 'front_squat', name: 'Front Squat', tag: 'LEGS', muscles: ['Quads', 'Glutes'], pattern: 'squat' }),
  mkEx({ id: 'deadlift', name: 'Deadlift', tag: 'LEGS', muscles: ['Hamstrings', 'Glutes', 'Back'], pattern: 'hinge' }),
  mkEx({ id: 'good_morning', name: 'Good Morning', tag: 'LEGS', muscles: ['Hamstrings', 'Glutes'], pattern: 'hinge' }),
  mkEx({ id: 'leg_press', name: 'Leg Press', tag: 'LEGS', anchor: false, muscles: ['Quads', 'Hamstrings'], equipment: 'machine', pattern: 'push' }),
  mkEx({ id: 'leg_curl', name: 'Leg Curl', tag: 'LEGS', anchor: false, muscles: ['Hamstrings'], equipment: 'machine', pattern: 'isolation' }),
  mkEx({ id: 'calf', name: 'Calf Raise', tag: 'LEGS', anchor: false, muscles: ['Gastrocnemius'], equipment: 'machine', pattern: 'isolation' }),
  mkEx({ id: 'lunge', name: 'Lunge', tag: 'LEGS', anchor: false, muscles: ['Quads', 'Glutes'], equipment: 'dumbbell', pattern: 'squat' }),
];

const BASE_PROFILE = {
  experience: 'intermediate',
  equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'],
  sessionDuration: 60,
  goal: 'build_muscle',
};

type Split = 'ppl' | 'upper_lower' | 'push_pull' | 'full_body';

// Mirrors SplitSheet.tsx validDays, minus custom/traditional.
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

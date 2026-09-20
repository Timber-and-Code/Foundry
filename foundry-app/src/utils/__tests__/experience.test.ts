import { describe, it, expect } from 'vitest';
import { experienceTier, experienceLabel, EXPERIENCE_OPTIONS } from '../experience';
import { generateProgram } from '../program';
import { EXERCISE_DB } from '../../data/exercises';

describe('experienceTier', () => {
  it('maps every spelling the app has ever saved', () => {
    expect(experienceTier('new')).toBe('beginner');
    expect(experienceTier('beginner')).toBe('beginner');
    expect(experienceTier('intermediate')).toBe('intermediate');
    expect(experienceTier('advanced')).toBe('advanced');
    expect(experienceTier('experienced')).toBe('advanced');
    expect(experienceTier(null)).toBe('intermediate');
    expect(experienceTier('')).toBe('intermediate');
  });

  it('labels by tier and offers the values onboarding stores', () => {
    expect(experienceLabel('new')).toBe('Under 1 year');
    expect(experienceLabel('experienced')).toBe('3+ years');
    expect(EXPERIENCE_OPTIONS.map((o) => o.value)).toEqual(['new', 'intermediate', 'advanced']);
  });
});

describe('generateProgram — experience gates exercise difficulty', () => {
  const diffById = new Map((EXERCISE_DB as Array<{ id: string; diff?: number }>).map((e) => [e.id, e.diff ?? 0]));
  const build = (experience: string) =>
    generateProgram(
      {
        experience,
        splitType: 'upper_lower',
        daysPerWeek: 4,
        workoutDays: [1, 2, 4, 5],
        sessionDuration: 60,
        equipment: ['full_gym'],
        goal: 'build_muscle',
      } as never,
      EXERCISE_DB as never,
    );
  const maxDiff = (experience: string) => {
    let max = 0;
    for (let i = 0; i < 15; i++) {
      for (const d of build(experience)) for (const e of d.exercises) max = Math.max(max, diffById.get(String(e.id)) ?? 0);
    }
    return max;
  };

  // Onboarding saves "Under 1 year" as 'new'. The generator only knew
  // 'beginner', so first-year lifters were handed the advanced pool.
  it("keeps a first-year lifter ('new') on beginner lifts", () => {
    expect(maxDiff('new')).toBeLessThanOrEqual(1);
    expect(maxDiff('beginner')).toBeLessThanOrEqual(1);
  });

  it('caps intermediates at 2', () => {
    expect(maxDiff('intermediate')).toBeLessThanOrEqual(2);
  });

  it('still builds full days for a first-year lifter', () => {
    for (const d of build('new')) expect(d.exercises.length).toBeGreaterThanOrEqual(5);
  });
});

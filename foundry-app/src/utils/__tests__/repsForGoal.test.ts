/**
 * Rep ranges come from the training GOAL, through one rule.
 *
 * The generator has always ignored the library's `reps` field and set a
 * goal-based range for every slot. But every swap/add path copied the
 * library value straight across, so swapping in one of the twelve entries
 * that carried a bare number ("15" on face pulls) put a fixed target next
 * to ranges on every other lift — and, because "15" parses as the range
 * 15-15, handed that lift a stricter progression gate than its neighbours.
 *
 * Two guards: the rule itself, and the library never carrying a bare
 * number again.
 */
import { describe, it, expect } from 'vitest';
import { repsForGoal } from '../program';
import { EXERCISE_DB } from '../../data/exercises';

describe('repsForGoal', () => {
  const compound = { pattern: 'push' };
  const isolation = { pattern: 'isolation' };

  it('maps every goal to a compound and an isolation range', () => {
    expect(repsForGoal('build_strength', compound)).toBe('4-6');
    expect(repsForGoal('build_strength', isolation)).toBe('6-10');
    expect(repsForGoal('build_muscle', compound)).toBe('6-10');
    expect(repsForGoal('build_muscle', isolation)).toBe('10-15');
    expect(repsForGoal('lose_fat', compound)).toBe('8-12');
    expect(repsForGoal('lose_fat', isolation)).toBe('12-18');
    for (const g of ['general_fitness', 'improve_fitness', 'sport_conditioning']) {
      expect(repsForGoal(g, compound)).toBe('8-15');
      expect(repsForGoal(g, isolation)).toBe('12-20');
    }
  });

  it('defaults to hypertrophy with no goal, and treats an unknown pattern as isolation', () => {
    expect(repsForGoal(undefined, compound)).toBe('6-10');
    expect(repsForGoal(null, {})).toBe('10-15');
    expect(repsForGoal('build_muscle', { pattern: 'carry' })).toBe('10-15');
  });

  it('always returns a range', () => {
    for (const g of ['build_strength', 'build_muscle', 'lose_fat', 'general_fitness', '']) {
      for (const p of ['push', 'pull', 'squat', 'hinge', 'isolation', undefined]) {
        expect(repsForGoal(g, { pattern: p })).toMatch(/^\d+-\d+$/);
      }
    }
  });
});

describe('EXERCISE_DB reps', () => {
  it('never carries a bare rep number — every rep prescription is a range', () => {
    const bare = EXERCISE_DB.filter((e) => /^\d+(\s*ea\.)?$/.test(String(e.reps ?? '').trim()));
    expect(bare.map((e) => `${e.id}: ${e.reps}`)).toEqual([]);
  });
});

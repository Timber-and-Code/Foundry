/**
 * Program ⇄ editable day list. What the lifter approves in review must be
 * exactly what gets installed — including the builder's own prescription
 * for every exercise they did NOT touch.
 */
import { describe, it, expect } from 'vitest';
import { toDayBuilds, hydrateDayBuilds } from '../dayBuilds';
import type { TrainingDay } from '../../../types';

const program = [
  {
    dayNum: 1,
    label: 'Full A',
    tag: 'FULL',
    muscles: 'x',
    note: 'keep me',
    cardio: null,
    exercises: [
      { id: 'bb_back_squat', name: 'Back Squat', muscle: 'Quads', anchor: true, sets: 5, reps: '3-5', rest: '4 min', warmup: 'Full protocol' },
      { id: 'db_row', name: 'DB Row', muscle: 'Back', anchor: false, sets: 2, reps: '10-15', rest: '90 s', warmup: '' },
    ],
  },
] as unknown as TrainingDay[];

// The library's `reps` is a hint the generator never used; a swapped-in lift
// gets the goal's range for its pattern (see repsForGoal), so '8-12' here
// must NOT reach the program.
const DB = [{ id: 'cable_row', name: 'Cable Row', muscle: 'Back', pattern: 'pull', reps: '8-12', rest: '2 min' }];

describe('hydrateDayBuilds with the original program', () => {
  it('round-trips an untouched program unchanged', () => {
    expect(hydrateDayBuilds(toDayBuilds(program), DB, program)).toEqual(program);
  });

  it('keeps untouched lifts verbatim and fills a swapped-in one from the DB, reps from the goal', () => {
    const days = toDayBuilds(program);
    days[0].exercises[1] = { id: 'cable_row', name: 'Cable Row', muscle: 'Back' };
    const [day] = hydrateDayBuilds(days, DB, program, 'build_strength');
    expect(day.note).toBe('keep me');
    expect(day.exercises[0]).toEqual(program[0].exercises[0]);
    expect(day.exercises[1]).toMatchObject({ id: 'cable_row', name: 'Cable Row', reps: '4-6', rest: '2 min', anchor: false });
    // No goal → hypertrophy range for a compound.
    expect(hydrateDayBuilds(days, DB, program)[0].exercises[1].reps).toBe('6-10');
  });

  it('applies an anchor toggle to a kept lift without touching the rest of it', () => {
    const days = toDayBuilds(program);
    days[0].anchors = [1];
    const [day] = hydrateDayBuilds(days, DB, program);
    expect(day.exercises[0]).toEqual({ ...program[0].exercises[0], anchor: false });
    expect(day.exercises[1]).toEqual({ ...program[0].exercises[1], anchor: true });
  });
});

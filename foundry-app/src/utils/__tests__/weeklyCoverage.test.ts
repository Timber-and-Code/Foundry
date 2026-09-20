/**
 * The weekly coverage rule. Before it, the generator left whole muscle groups
 * out of every build on common settings (Upper/Lower 4-day 60 min: no Triceps,
 * 100% of the time) because it filled accessory slots in a fixed order and ran
 * out before the arms. A lifter ran two mesos with no triceps work.
 */
import { describe, it, expect } from 'vitest';
import { generateProgram } from '../program';
import { ensureWeeklyCoverage, missingGroups } from '../weeklyCoverage';
import { EXERCISE_DB } from '../../data/exercises.js';
import type { Exercise, TrainingDay } from '../../types';

const GYM = ['barbell', 'dumbbell', 'cable', 'machine'];
const ALL = [...GYM, 'bodyweight', 'kettlebell', 'band'];
const build = (splitType: string, days: number, sessionDuration: number, equipment: string[], extra = {}) =>
  generateProgram(
    { experience: 'intermediate', splitType, daysPerWeek: days, workoutDays: [1, 2, 3, 4, 5, 6].slice(0, days), mesoLength: 6, sessionDuration, equipment, ...extra } as never,
    EXERCISE_DB as never,
  );

describe('weekly coverage — generated programs', () => {
  const SPLITS: [string, number[]][] = [['full_body', [3, 4, 5]], ['upper_lower', [4]], ['ppl', [3, 5, 6]], ['push_pull', [4]]];

  it('60+ minute programs train every major group directly, every build', () => {
    for (const [split, dayCounts] of SPLITS) for (const d of dayCounts) for (const dur of [60, 75]) for (const eq of [GYM, ALL]) {
      for (let i = 0; i < 12; i++) {
        expect({ split, d, dur, missing: missingGroups(build(split, d, dur, eq)) }).toEqual({ split, d, dur, missing: [] });
      }
    }
  });

  it('45 minute programs never drop triceps (the reported bug)', () => {
    for (const [split, dayCounts] of SPLITS) for (const d of dayCounts) {
      for (let i = 0; i < 12; i++) expect(missingGroups(build(split, d, 45, GYM))).not.toContain('Triceps');
    }
  });

  it('keeps session length and every anchor', () => {
    for (let i = 0; i < 10; i++) {
      const prog = build('upper_lower', 4, 60, GYM);
      prog.forEach((day) => {
        expect(day.exercises).toHaveLength(5);
        expect(day.exercises[0].anchor).toBe(true);
      });
    }
  });

  it('leaves an approved program alone', () => {
    const aiDays = [{ dayNum: 1, label: 'Only chest', tag: 'PUSH', exercises: [{ id: 'bb_flat_bench', name: 'Bench', muscle: 'Chest', anchor: true }] }];
    expect(build('ppl', 3, 60, GYM, { aiDays })).toBe(aiDays);
  });
});

describe('ensureWeeklyCoverage', () => {
  const ex = (id: string, muscle: string, anchor = false) => ({ id, name: id, muscle, anchor }) as Exercise;
  const day = (tag: string, ...exercises: Exercise[]) => ({ dayNum: 1, label: tag, tag, exercises }) as TrainingDay;
  const pool = [
    { id: 'pushdown', muscle: 'Triceps', pattern: 'isolation' },
    { id: 'close_grip', muscle: 'Triceps', pattern: 'push' },
    { id: 'curl', muscle: 'Biceps', pattern: 'isolation' },
  ];
  const toEx = (e: { id: string; muscle: string }) => ex(e.id, e.muscle);

  it('replaces a repeated accessory on a day the muscle belongs to — never an anchor', () => {
    const days = [
      day('UPPER', ex('bench', 'Chest', true), ex('fly', 'Chest'), ex('row', 'Back'), ex('lateral', 'Shoulders'), ex('curl0', 'Biceps')),
      day('LOWER', ex('squat', 'Quads', true), ex('rdl', 'Hamstrings'), ex('ext', 'Quads'), ex('calf', 'Calves')),
    ];
    const out = ensureWeeklyCoverage(days, pool, toEx);
    expect(out[0].exercises.map((e) => e.id)).toEqual(['bench', 'pushdown', 'row', 'lateral', 'curl0']); // isolation preferred, fly was the repeat
    expect(out[1].exercises.map((e) => e.id)).toEqual(['squat', 'rdl', 'ext', 'calf']); // triceps don't go on a lower day
    expect(days[0].exercises[1].id).toBe('fly'); // input untouched
  });

  it('does nothing when no accessory can be spared', () => {
    const days = [day('UPPER', ex('bench', 'Chest', true), ex('row', 'Back'), ex('lateral', 'Shoulders'))];
    expect(ensureWeeklyCoverage(days, pool, toEx)[0].exercises.map((e) => e.id)).toEqual(['bench', 'row', 'lateral']);
  });
});

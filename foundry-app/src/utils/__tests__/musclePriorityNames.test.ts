/**
 * Muscle-priority names must be real primary muscles.
 *
 * `buildDay` prefers an exercise whose PRIMARY muscle equals the slot target
 * — a curl for the Biceps slot, not a row that lists Biceps as secondary.
 * That preference silently does nothing for a name the DB never uses as a
 * primary value: the slot falls through to the secondary match and loses
 * every tie to a compound that mentions the muscle in passing.
 *
 * Five such names were in use — 'Gastrocnemius', 'Soleus', 'Upper Traps',
 * 'Teres Major' and 'Long Head Tri'. Calf entries are muscle:'Calves' with
 * muscles:['Gastrocnemius'], which is how calves went missing from full-body
 * weeks entirely.
 *
 * The `MusclePriority` type now makes a bad name a compile error. This test
 * guards the other half: that the type's value list still matches the DB. A
 * new muscle added to exercises.js, or one renamed, breaks the pairing
 * silently otherwise.
 */
import { describe, it, expect } from 'vitest';
import { PRIMARY_MUSCLES } from '../program';
import { EXERCISE_DB } from '../../data/exercises';

const dbPrimaryMuscles = new Set(
  (EXERCISE_DB as { muscle?: string }[]).map((e) => e.muscle).filter(Boolean) as string[],
);

describe('PRIMARY_MUSCLES', () => {
  it('matches the exercise DB exactly', () => {
    expect([...PRIMARY_MUSCLES].sort()).toEqual([...dbPrimaryMuscles].sort());
  });

  it('names no muscle the DB never uses as a primary', () => {
    // The direction that caused the bug: a target nothing can primary-match.
    for (const m of PRIMARY_MUSCLES) {
      expect(dbPrimaryMuscles.has(m)).toBe(true);
    }
  });

  it('leaves no DB muscle unreachable by a priority slot', () => {
    // The opposite direction: a muscle in the DB that no priority list can
    // ever name is a muscle group that can never be deliberately programmed.
    for (const m of dbPrimaryMuscles) {
      expect(PRIMARY_MUSCLES as readonly string[]).toContain(m);
    }
  });

  it('has at least one exercise available for every name', () => {
    // A valid-but-empty target burns an accessory slot on the fallback path.
    for (const m of PRIMARY_MUSCLES) {
      const count = (EXERCISE_DB as { muscle?: string }[]).filter((e) => e.muscle === m).length;
      expect(count).toBeGreaterThan(0);
    }
  });
});

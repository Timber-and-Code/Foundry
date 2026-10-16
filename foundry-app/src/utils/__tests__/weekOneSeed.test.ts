/**
 * Week 1 of a new meso starts where the last hard week of the previous one
 * left off: the reference weight from `findLastMesoWeight`, reps at the
 * bottom of the range, as an unconfirmed suggestion. Lifts without an
 * archived reference open blank, as they always did.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadDayWeekWithCarryover } from '../persistence';

const profile = { experience: 'intermediate' } as never;

const day = (exercises: Record<string, unknown>[]) =>
  ({ name: 'A', label: 'A', tag: 'FULL', type: 'strength', exercises }) as never;

const done = (exId: string, weight: number | string, reps: number) => ({
  _exId: exId,
  weight,
  reps,
  confirmed: true,
});

const seedArchive = () =>
  localStorage.setItem(
    'foundry:archive',
    JSON.stringify([
      {
        id: 'aug',
        archivedAt: '2026-09-18T00:00:00Z',
        profile: { mesoLength: 6 },
        mesoWeeks: 7,
        sessions: [
          { d: 0, w: 0, data: { 0: { 0: done('bb_back_squat', 185, 8) } } },
          // Last hard week: 225 × 6 is the reference, not the deload's 170.
          { d: 0, w: 5, data: { 0: { 0: done('bb_back_squat', 225, 6), 1: done('bb_back_squat', 225, 5) }, 2: { 0: done('pullups_bw', '', 9) } } },
          { d: 0, w: 6, data: { 0: { 0: done('bb_back_squat', 170, 6) } } },
        ],
      },
    ]),
  );

describe('week 1 seeds from the previous meso', () => {
  beforeEach(() => localStorage.clear());

  it('prescribes the last hard week\'s weight at the bottom of the range, unconfirmed', () => {
    seedArchive();
    const out = loadDayWeekWithCarryover(
      0, 0,
      day([{ id: 'bb_back_squat', name: 'Squat', sets: 3, reps: '6-8', equipment: 'barbell' }]),
      profile,
    );
    expect(Object.keys(out[0])).toHaveLength(3);
    expect(out[0][0]).toEqual({ weight: '225', reps: '6', suggested: false, repsSuggested: true });
    expect(out[0][2]).toEqual({ weight: '225', reps: '6', suggested: false, repsSuggested: true });
  });

  it('leaves an unloaded bodyweight lift blank — the reference is a weight', () => {
    seedArchive();
    const out = loadDayWeekWithCarryover(
      0, 0,
      day([{ id: 'pullups_bw', name: 'Pull-ups', sets: 2, reps: '6-10', bw: true }]),
      profile,
    );
    expect(out).toEqual({});
  });

  it('leaves a lift with no archived reference blank', () => {
    seedArchive();
    const out = loadDayWeekWithCarryover(
      0, 0,
      day([{ id: 'db_rdl', name: 'RDL', sets: 3, reps: '8-10', equipment: 'dumbbell' }]),
      profile,
    );
    expect(out).toEqual({});
  });

  it('is blank with no archive at all (first meso)', () => {
    const out = loadDayWeekWithCarryover(
      0, 0,
      day([{ id: 'bb_back_squat', name: 'Squat', sets: 3, reps: '6-8', equipment: 'barbell' }]),
      profile,
    );
    expect(out).toEqual({});
  });

  it('never overrides week-1 data the lifter has already entered', () => {
    seedArchive();
    localStorage.setItem('foundry:day0:week0', JSON.stringify({ 0: { 0: { weight: '205', reps: '6', confirmed: true } } }));
    const out = loadDayWeekWithCarryover(
      0, 0,
      day([{ id: 'bb_back_squat', name: 'Squat', sets: 3, reps: '6-8', equipment: 'barbell' }]),
      profile,
    );
    expect(out[0][0].weight).toBe('205');
    expect(out[0][1]).toBeUndefined();
  });

  it('only seeds week 1 — later weeks carry from the week before as always', () => {
    seedArchive();
    const out = loadDayWeekWithCarryover(
      0, 1,
      day([{ id: 'bb_back_squat', name: 'Squat', sets: 3, reps: '6-8', equipment: 'barbell' }]),
      profile,
    );
    // Nothing logged in week 1 → no baseline → nothing seeded from the archive.
    expect(out[0]?.[0]?.weight ?? '').toBe('');
  });
});

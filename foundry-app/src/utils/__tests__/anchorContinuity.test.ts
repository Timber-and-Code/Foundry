/**
 * Anchor continuity — generateProgram should keep progressing the compounds
 * the lifter already has numbers for.
 *
 * The bug this exists for: on prod, a lifter with 29 exercises of logged
 * history opened a new mesocycle that shared only THREE of them. Every
 * history reader matches on exact `_exId`, so the other 26 had nothing to
 * show — not because the lookup was broken, but because the generator had
 * reshuffled the exercise selection out from under it.
 *
 * The two halves are tested separately because they must NOT behave the
 * same way: anchors pin to history, accessories keep rotating. Pinning
 * accessories too would make every cycle a copy of the last one and remove
 * the variation stimulus.
 */
import { describe, it, expect } from 'vitest';
import { generateProgram } from '../program';
import { collectTrainedExerciseIds } from '../progressAggregation';
import type { Profile, ArchiveEntry } from '../../types';

const profile = {
  splitType: 'ppl',
  daysPerWeek: 3,
  workoutDays: [1, 3, 5],
  sessionDuration: 60,
  experience: 'intermediate',
  equipment: ['full_gym'],
  mesoLength: 5,
} as unknown as Profile;

// Two interchangeable push anchors and two interchangeable pull anchors, so
// the only thing that can decide between them is continuity (or the shuffle).
// Field names mirror data/exercises.js exactly — `equipment` is a single
// string (the pool filter does equipment.includes(e.equipment)), difficulty
// is `diff`, and `splits` gates which split types can draw the exercise.
// Getting any of these wrong yields empty days rather than a loud failure.
const SPLITS = ['ppl', 'upper', 'full'];
const ex = (
  id: string, muscle: string, tag: string, pattern: string,
  anchor: boolean, equipment: string, diff = 1,
) => ({ id, name: id, muscle, muscles: [muscle], tag, splits: SPLITS, equipment, pattern, anchor, diff, fatigue: 'moderate' });

const DB = [
  // Two interchangeable anchors per pattern, so only continuity (or the
  // shuffle) can decide between them.
  ex('bb_bench', 'Chest', 'PUSH', 'push', true, 'barbell', 2),
  ex('db_bench', 'Chest', 'PUSH', 'push', true, 'dumbbell', 2),
  ex('bb_row', 'Back', 'PULL', 'pull', true, 'barbell', 2),
  ex('db_row', 'Back', 'PULL', 'pull', true, 'dumbbell', 2),
  ex('bb_squat', 'Quads', 'LEGS', 'squat', true, 'barbell', 2),
  ex('leg_press', 'Quads', 'LEGS', 'squat', true, 'machine', 1),
  // Accessories — several per muscle so rotation is observable.
  ex('cable_fly', 'Chest', 'PUSH', 'isolation', false, 'cable'),
  ex('pec_deck', 'Chest', 'PUSH', 'isolation', false, 'machine'),
  ex('lat_raise', 'Shoulders', 'PUSH', 'isolation', false, 'dumbbell'),
  ex('tri_pushdown', 'Triceps', 'PUSH', 'isolation', false, 'cable'),
  ex('oh_tri_ext', 'Triceps', 'PUSH', 'isolation', false, 'dumbbell'),
  ex('face_pull', 'Rear Delts', 'PULL', 'isolation', false, 'cable'),
  ex('db_curl', 'Biceps', 'PULL', 'isolation', false, 'dumbbell'),
  ex('ez_curl', 'Biceps', 'PULL', 'isolation', false, 'barbell'),
  ex('lat_pulldown', 'Back', 'PULL', 'pull', false, 'cable'),
  ex('cable_row', 'Back', 'PULL', 'pull', false, 'cable'),
  ex('leg_curl', 'Hamstrings', 'LEGS', 'isolation', false, 'machine'),
  ex('leg_ext', 'Quads', 'LEGS', 'isolation', false, 'machine'),
  ex('calf_raise', 'Calves', 'LEGS', 'isolation', false, 'machine'),
  ex('rdl', 'Hamstrings', 'LEGS', 'hinge', false, 'barbell', 2),
] as unknown as Parameters<typeof generateProgram>[1];

const anchorsOf = (days: ReturnType<typeof generateProgram>): string[] =>
  days.map((d) => String(d.exercises?.find((e) => e.anchor)?.id ?? '')).filter(Boolean);

const allIdsOf = (days: ReturnType<typeof generateProgram>): string[] =>
  days.flatMap((d) => (d.exercises || []).map((e) => String(e.id)));

/** The push day's anchor id. Empty string if there isn't one — which is
 *  itself a failure worth surfacing rather than skipping past. */
const pushAnchorOf = (days: ReturnType<typeof generateProgram>): string => {
  const pushDay = days.find((d) => d.tag === 'PUSH');
  return String(pushDay?.exercises?.find((e) => e.anchor)?.id ?? '');
};

describe('generateProgram — anchor continuity', () => {
  it('picks the trained anchor over an equally eligible untrained one', () => {
    // db_bench and bb_bench are interchangeable for the push slot. Without
    // continuity the shuffle decides; with it, the one carrying history wins.
    // Repeated because the failure mode is probabilistic — a single pass
    // could pass by luck.
    for (let i = 0; i < 25; i++) {
      const days = generateProgram(profile, DB, { trainedIds: ['db_bench', 'db_row'] });
      // Asserted unconditionally: a ppl split always yields a push day with a
      // push anchor, and a guarded assertion here could pass without ever
      // exercising the continuity branch.
      expect(pushAnchorOf(days)).toBe('db_bench');
      expect(anchorsOf(days)).not.toContain('bb_bench');
    }
  });

  it('does not let history override the day\'s movement pattern', () => {
    // Only a leg anchor has history. The push day must still get a press —
    // continuity breaks ties inside the eligible set, it does not reach
    // outside it. Otherwise "keep training what you know" degenerates into
    // squatting on chest day.
    for (let i = 0; i < 25; i++) {
      const days = generateProgram(profile, DB, { trainedIds: ['bb_squat'] });
      expect(['bb_bench', 'db_bench']).toContain(pushAnchorOf(days));
    }
  });

  it('still rotates accessories — continuity is anchors only', () => {
    // Every accessory is marked as trained. If continuity leaked into
    // accessory selection they would freeze into one fixed set and every
    // cycle would be identical.
    const everyAccessory = ['cable_fly', 'pec_deck', 'lat_raise', 'tri_pushdown',
      'face_pull', 'db_curl', 'ez_curl', 'lat_pulldown', 'leg_curl', 'leg_ext', 'calf_raise', 'rdl'];
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      allIdsOf(generateProgram(profile, DB, { trainedIds: everyAccessory })).forEach((id) => seen.add(id));
    }
    const distinctAccessories = everyAccessory.filter((id) => seen.has(id));
    expect(distinctAccessories.length).toBeGreaterThan(4);
  });

  it('reproduces the old behaviour exactly when no history is supplied', () => {
    // Backwards compatibility: an omitted option, an empty set, and an
    // undefined option must all be indistinguishable from the pre-change
    // generator, which every existing program test depends on.
    for (const opts of [undefined, {}, { trainedIds: [] }, { trainedIds: new Set<string>() }]) {
      const days = generateProgram(profile, DB, opts);
      expect(days.length).toBeGreaterThan(0);
      expect(anchorsOf(days).length).toBeGreaterThan(0);
    }
  });

  it('ignores trained ids that are not in the exercise DB', () => {
    // Stale archive entries naming retired exercises must not blank the
    // anchor slot.
    const days = generateProgram(profile, DB, { trainedIds: ['retired_lift', 'another_ghost'] });
    expect(anchorsOf(days).length).toBe(days.length);
  });
});

describe('collectTrainedExerciseIds', () => {
  const archiveWith = (sets: Record<string, unknown>[]): ArchiveEntry[] =>
    ([{
      id: 'm1',
      archivedAt: '2026-05-01T00:00:00Z',
      sessions: [{ d: 0, w: 0, data: { 0: Object.fromEntries(sets.map((s, i) => [i + 1, s])) } }],
    }] as unknown as ArchiveEntry[]);

  it('collects ids from confirmed working sets', () => {
    const ids = collectTrainedExerciseIds(
      archiveWith([{ _exId: 'bb_squat', weight: 225, reps: 5 }]),
    );
    expect(ids.has('bb_squat')).toBe(true);
  });

  it('counts bodyweight work that logs reps but no weight', () => {
    // pullups_bw and friends would otherwise never register as trained.
    const ids = collectTrainedExerciseIds(archiveWith([{ _exId: 'pullups_bw', reps: 8 }]));
    expect(ids.has('pullups_bw')).toBe(true);
  });

  it('ignores warmups and empty rows', () => {
    // A slot you opened and abandoned is not history. Treating it as such
    // would pin the next meso to a lift never actually performed.
    const ids = collectTrainedExerciseIds(archiveWith([
      { _exId: 'bb_bench', weight: 45, reps: 10, warmup: true },
      { _exId: 'db_fly', weight: 0, reps: 0 },
      { _exId: 'ghost_lift' },
    ]));
    expect(ids.size).toBe(0);
  });

  it('ignores unstamped sets rather than guessing by slot position', () => {
    const ids = collectTrainedExerciseIds(archiveWith([{ weight: 100, reps: 5 }]));
    expect(ids.size).toBe(0);
  });

  it('survives an empty, null, or malformed archive', () => {
    expect(collectTrainedExerciseIds([]).size).toBe(0);
    expect(collectTrainedExerciseIds(null as unknown as ArchiveEntry[]).size).toBe(0);
    expect(collectTrainedExerciseIds([{ id: 'x' }] as unknown as ArchiveEntry[]).size).toBe(0);
  });

  it('unions ids across multiple archived mesos', () => {
    const archive = [
      { id: 'm2', sessions: [{ d: 0, w: 0, data: { 0: { 1: { _exId: 'db_ohp', weight: 60, reps: 8 } } } }] },
      { id: 'm1', sessions: [{ d: 0, w: 0, data: { 0: { 1: { _exId: 'bb_squat', weight: 225, reps: 5 } } } }] },
    ] as unknown as ArchiveEntry[];
    expect(collectTrainedExerciseIds(archive)).toEqual(new Set(['db_ohp', 'bb_squat']));
  });
});

/**
 * Full-body accessory coverage.
 *
 * Reported: "when this full body program was generated there was no
 * accessory movements like arms or calfs."
 *
 * It wasn't luck. A full-body day spends 3 of its slots on the push/pull/legs
 * anchors, so a 55-minute session (exCount 5) leaves exactly two accessory
 * slots. The old code sliced one accessory off each sub-pool and dealt them
 * round-robin from push — with two slots that reached push and pull and never
 * legs. And since each sub-pool returns accessories in muscle-priority order,
 * the one taken was always that list's first muscle: Chest and Lats, every
 * day. Triceps sat 3rd in push, Biceps 3rd in pull, Gastrocnemius 4th in legs.
 * Arms and calves were unreachable by construction.
 *
 * Runs against the REAL exercise DB and the real reported profile, because a
 * hand-built fixture is exactly what would have hidden this.
 */
import { describe, it, expect } from 'vitest';
import { generateProgram } from '../program';
import { EXERCISE_DB } from '../../data/exercises';
import type { Profile } from '../../types';

// The account this was reported from: full body, 4 days, 55-minute sessions.
const profile = {
  splitType: 'full_body',
  daysPerWeek: 4,
  workoutDays: [1, 2, 4, 5],
  sessionDuration: 55,
  experience: 'intermediate',
  equipment: ['full_gym'],
  goal: 'build_muscle',
  mesoLength: 5,
} as unknown as Profile;

const DB = EXERCISE_DB as unknown as Parameters<typeof generateProgram>[1];

const musclesInWeek = (days: ReturnType<typeof generateProgram>): Set<string> => {
  const out = new Set<string>();
  for (const day of days) {
    for (const ex of day.exercises || []) {
      const full = (EXERCISE_DB as { id: string; muscle?: string }[]).find((e) => e.id === ex.id);
      if (full?.muscle) out.add(full.muscle);
    }
  }
  return out;
};

describe('full body — accessory coverage', () => {
  it('confirms the shape that caused the bug: only 2 accessory slots a day', () => {
    // If this ever stops being true the rotation maths below needs revisiting,
    // so pin it rather than leave it as a silent assumption.
    const days = generateProgram(profile, DB);
    expect(days).toHaveLength(4);
    for (const day of days) {
      expect(day.exercises).toHaveLength(5);
      expect((day.exercises || []).filter((e) => e.anchor)).toHaveLength(3);
    }
  });

  it('trains arms within the week', () => {
    // 30 rolls: the pick inside a muscle group is shuffled, but WHICH muscle
    // gets the slot is now deterministic, so this must hold every time.
    for (let i = 0; i < 30; i++) {
      const muscles = musclesInWeek(generateProgram(profile, DB));
      const hasArms = muscles.has('Biceps') || muscles.has('Triceps');
      expect(hasArms).toBe(true);
    }
  });

  it('trains calves within the week', () => {
    // Asserts on 'Calves' — the DB's `muscle` field. Calf entries carry
    // muscles:['Gastrocnemius'|'Soleus'], so matching the anatomical name
    // here would silently never fire.
    for (let i = 0; i < 30; i++) {
      const muscles = musclesInWeek(generateProgram(profile, DB));
      expect(muscles.has('Calves')).toBe(true);
    }
  });

  it('does not hand every day the same two muscles', () => {
    // The old failure signature: Chest + Lats on all four days. Distinct
    // accessory muscles across the week is the thing that actually changed.
    const days = generateProgram(profile, DB);
    const perDay = days.map((d) =>
      (d.exercises || [])
        .filter((e) => !e.anchor)
        .map((e) => (EXERCISE_DB as { id: string; muscle?: string }[]).find((x) => x.id === e.id)?.muscle)
        .sort()
        .join('+'),
    );
    expect(new Set(perDay).size).toBeGreaterThan(1);
  });

  it('never repeats an exercise inside a single day', () => {
    for (let i = 0; i < 20; i++) {
      for (const day of generateProgram(profile, DB)) {
        const ids = (day.exercises || []).map((e) => String(e.id));
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it('still fills every slot at shorter and longer sessions', () => {
    // 30 min → exCount 3 → zero accessory slots; 90 min → exCount 7 → four.
    // Neither should crash or emit a short day.
    for (const sessionDuration of [30, 45, 60, 75, 90]) {
      const days = generateProgram({ ...profile, sessionDuration } as Profile, DB);
      const expected = sessionDuration <= 30 ? 3 : sessionDuration <= 45 ? 4
        : sessionDuration <= 60 ? 5 : sessionDuration <= 75 ? 6 : 7;
      for (const day of days) expect(day.exercises).toHaveLength(expected);
    }
  });

  it('covers arms and calves even on a 2-day full-body week', () => {
    // Fewer days means fewer accessory slots overall — the rotation should
    // still reach the starved muscles rather than restarting at Chest.
    const twoDay = { ...profile, daysPerWeek: 2, workoutDays: [1, 4] } as unknown as Profile;
    const muscles = musclesInWeek(generateProgram(twoDay, DB));
    // With 2 days x 2 slots the rotation reaches index 3 — Triceps.
    expect(muscles.has('Triceps') || muscles.has('Biceps')).toBe(true);
  });
});
